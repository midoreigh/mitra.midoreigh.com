// Frontend API client to talk to the Cloudflare Worker endpoints.

export interface ApiDevice {
  id: string;
  name: string;
  kind: 'airConditioner' | 'unsupported';
  topicBase: string;
  room?: string;
}

export interface ApiLoginResult {
  accessToken: string;
  expiresIn: number;
  homeId?: string;
  devices: ApiDevice[];
  error?: string;
}

export async function apiLogin(username: string, password: string): Promise<ApiLoginResult> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Sign-in failed (${res.status})`);
  }
  return json as ApiLoginResult;
}

export async function apiGetDevices(token: string): Promise<{ id: string; devices: ApiDevice[] }> {
  const res = await fetch('/api/devices', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch devices (${res.status})`);
  }
  return json as { id: string; devices: ApiDevice[] };
}

export async function apiGetDeviceStatus(deviceId: string, token: string): Promise<Record<string, any>> {
  const res = await fetch(`/api/devices/${deviceId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Failed to get AC status (${res.status})`);
  }
  return (json.status || {}) as Record<string, any>;
}

export interface CommandOptions {
  deviceId: string;
  token: string;
  homeId: string;
  topicBase: string;
  fields: Record<string, any>;
  kind?: number;
}

export async function apiSendCommand(options: CommandOptions): Promise<any> {
  const { deviceId, token, homeId, topicBase, fields, kind = 1 } = options;

  const res = await fetch(`/api/devices/${deviceId}/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ homeId, topicBase, fields, kind }),
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Command failed (${res.status})`);
  }
  return json.confirmed || null;
}
