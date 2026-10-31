// Minimal MQTT 3.1.1 encoder, decoder and TLS client for Cloudflare Workers.
// Adapted from MitraKit (macOS / Swift) & Hawadaar.

import { connect } from 'cloudflare:sockets';

export interface ConnAckPacket {
  type: 'connack';
  returnCode: number;
}

export interface PublishPacket {
  type: 'publish';
  topic: string;
  payload: Uint8Array;
  retained: boolean;
}

export interface SubAckPacket {
  type: 'suback';
}

export interface PingRespPacket {
  type: 'pingresp';
}

export interface OtherPacket {
  type: 'other';
  packetType: number;
}

export type IncomingPacket = ConnAckPacket | PublishPacket | SubAckPacket | PingRespPacket | OtherPacket;

function encodeString(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = (bytes.length >> 8) & 0xff;
  out[1] = bytes.length & 0xff;
  out.set(bytes, 2);
  return out;
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function makePacket(header: number, body: Uint8Array): Uint8Array {
  const lenBytes: number[] = [];
  let len = body.length;
  do {
    let byte = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) byte |= 0x80;
    lenBytes.push(byte);
  } while (len > 0);

  const out = new Uint8Array(1 + lenBytes.length + body.length);
  out[0] = header;
  out.set(lenBytes, 1);
  out.set(body, 1 + lenBytes.length);
  return out;
}

export const MQTTPacket = {
  pingRequest: new Uint8Array([0xc0, 0x00]),
  disconnect: new Uint8Array([0xe0, 0x00]),

  connect(clientId: string, username: string, password: string, keepAlive = 60): Uint8Array {
    const protoName = encodeString('MQTT');
    const headerFlags = new Uint8Array([0x04, 0xc2]); // level 4 (3.1.1); username + password + clean session
    const keepAliveBytes = new Uint8Array([(keepAlive >> 8) & 0xff, keepAlive & 0xff]);
    const cid = encodeString(clientId);
    const u = encodeString(username);
    const p = encodeString(password);
    const body = concat([protoName, headerFlags, keepAliveBytes, cid, u, p]);
    return makePacket(0x10, body);
  },

  subscribe(packetId: number, topics: string[]): Uint8Array {
    const idBytes = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
    const parts: Uint8Array[] = [idBytes];
    for (const t of topics) {
      parts.push(encodeString(t));
      parts.push(new Uint8Array([0x00])); // QoS 0
    }
    return makePacket(0x82, concat(parts));
  },

  publish(topic: string, payload: Uint8Array): Uint8Array {
    const topicBytes = encodeString(topic);
    return makePacket(0x30, concat([topicBytes, payload]));
  },
};

export class MQTTDecoder {
  private buffer = new Uint8Array(0);

  append(chunk: Uint8Array): IncomingPacket[] {
    const combined = new Uint8Array(this.buffer.length + chunk.length);
    combined.set(this.buffer);
    combined.set(chunk, this.buffer.length);
    this.buffer = combined;

    const packets: IncomingPacket[] = [];
    while (true) {
      const frame = this.nextFrame();
      if (!frame) break;
      const { header, body, consumed } = frame;
      this.buffer = this.buffer.slice(consumed);
      packets.push(this.parsePacket(header, body));
    }
    return packets;
  }

  private nextFrame(): { header: number; body: Uint8Array; consumed: number } | null {
    if (this.buffer.length < 2) return null;
    let length = 0;
    let multiplier = 1;
    let index = 1;

    while (true) {
      if (index >= this.buffer.length || index > 4) return null;
      const byte = this.buffer[index];
      length += (byte & 0x7f) * multiplier;
      multiplier *= 128;
      index += 1;
      if ((byte & 0x80) === 0) break;
    }

    if (this.buffer.length < index + length) return null;
    const body = this.buffer.slice(index, index + length);
    return { header: this.buffer[0], body, consumed: index + length };
  }

  private parsePacket(header: number, body: Uint8Array): IncomingPacket {
    const type = header >> 4;
    switch (type) {
      case 2: // CONNACK
        return { type: 'connack', returnCode: body.length >= 2 ? body[1] : 0xff };
      case 3: { // PUBLISH
        if (body.length < 2) return { type: 'other', packetType: 3 };
        const topicLen = (body[0] << 8) | body[1];
        if (body.length < 2 + topicLen) return { type: 'other', packetType: 3 };
        const topic = new TextDecoder().decode(body.slice(2, 2 + topicLen));
        const hasPacketId = ((header >> 1) & 0x03) > 0;
        const payloadStart = 2 + topicLen + (hasPacketId ? 2 : 0);
        const payload = body.slice(payloadStart);
        return {
          type: 'publish',
          topic,
          payload,
          retained: (header & 0x01) !== 0,
        };
      }
      case 9:
        return { type: 'suback' };
      case 13:
        return { type: 'pingresp' };
      default:
        return { type: 'other', packetType: type };
    }
  }
}

export interface PublishOnceOptions {
  clientId: string;
  username: string; // homeId
  accessToken: string;
  topic: string;
  payload: Uint8Array;
  statusTopic: string;
  timeoutMs?: number;
  accepts?: (json: any) => boolean;
}

/**
 * Connects to mqtt.miraie.in:8883 over TLS, publishes one command,
 * optionally waits for the status acknowledgment message, and disconnects.
 */
export async function publishOnce(options: PublishOnceOptions): Promise<any | null> {
  const {
    clientId,
    username,
    accessToken,
    topic,
    payload,
    statusTopic,
    timeoutMs = 5000,
    accepts,
  } = options;

  console.log(`[publishOnce] Connecting to mqtt.miraie.in:8883 (clientId=${clientId}, homeId=${username}, topic=${topic})`);

  const socket = connect(
    { hostname: 'mqtt.miraie.in', port: 8883 },
    { secureTransport: 'on', allowHalfOpen: false }
  );

  console.log(`[publishOnce] Waiting for socket.opened...`);
  await socket.opened;
  console.log(`[publishOnce] Socket connected successfully over TLS`);

  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const decoder = new MQTTDecoder();

  let resolvedReply: any = null;
  let isDone = false;
  let commandPublished = false;

  const cleanup = async () => {
    if (isDone) return;
    isDone = true;
    try {
      if (commandPublished) {
        await writer.write(MQTTPacket.disconnect);
      }
    } catch {
      // ignore
    }
    try {
      writer.releaseLock();
    } catch {
      // ignore
    }
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
    try {
      socket.close();
    } catch {
      // ignore
    }
  };

  const timer = setTimeout(() => {
    console.log(`[publishOnce] Timeout reached (${timeoutMs}ms) - commandPublished=${commandPublished}`);
    cleanup();
  }, timeoutMs);

  try {
    // 1. Send CONNECT packet
    console.log(`[publishOnce] Sending CONNECT packet...`);
    const connectPacket = MQTTPacket.connect(clientId, username, accessToken, 60);
    await writer.write(connectPacket);

    // Read loop
    while (!isDone) {
      const { value, done } = await reader.read();
      if (done || !value) {
        console.log(`[publishOnce] Stream closed or empty value received`);
        break;
      }

      const packets = decoder.append(value);
      for (const packet of packets) {
        console.log(`[publishOnce] Received packet type: ${packet.type}`);

        if (packet.type === 'connack') {
          console.log(`[publishOnce] CONNACK returnCode: ${packet.returnCode}`);
          if (packet.returnCode !== 0) {
            throw new Error(`MQTT broker refused connection (code ${packet.returnCode})`);
          }

          // Subscribe to status topic
          console.log(`[publishOnce] Subscribing to: ${statusTopic}`);
          await writer.write(MQTTPacket.subscribe(1, [statusTopic]));

          // Publish command
          console.log(`[publishOnce] Publishing command to: ${topic}`);
          await writer.write(MQTTPacket.publish(topic, payload));
          commandPublished = true;
          console.log(`[publishOnce] Command successfully published!`);
        } else if (packet.type === 'publish') {
          console.log(`[publishOnce] Incoming PUBLISH on: ${packet.topic} (retained: ${packet.retained})`);
          if (packet.topic === statusTopic && !packet.retained) {
            try {
              const text = new TextDecoder().decode(packet.payload);
              const json = JSON.parse(text);
              console.log(`[publishOnce] Status JSON:`, json);
              if (!accepts || accepts(json)) {
                resolvedReply = json;
                await cleanup();
                return resolvedReply;
              }
            } catch (e) {
              console.warn(`[publishOnce] Failed to parse status payload:`, e);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[publishOnce] Error during MQTT exchange:`, err);
    if (!isDone) {
      await cleanup();
      throw err;
    }
  } finally {
    clearTimeout(timer);
    await cleanup();
  }

  return resolvedReply;
}
