// Cloudflare Worker entry point for mitra.midoreigh.com
// Handles /api/* proxy and command routes, delegates all other requests to static assets.

import { login, getHome, getDeviceStatus } from './miraie-api';
import { publishOnce } from './mqtt';
import { connect } from 'cloudflare:sockets';

export interface Env {
  ASSETS: Fetcher;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(error: any, status = 400): Response {
  const message = error instanceof Error ? error.message : String(error);
  return jsonResponse({ error: message }, status);
}

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only intercept /api/* routes; everything else serves static assets
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      // Test socket connectivity
      if (url.pathname === '/api/test-mqtt') {
        const socket = connect({ hostname: 'mqtt.miraie.in', port: 8883 }, { secureTransport: 'on', allowHalfOpen: false });
        const info = await socket.opened;
        socket.close();
        return jsonResponse({ ok: true, connected: true, info });
      }

      // 1. POST /api/auth/login
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const { username, password } = body;
        if (!username || !password) {
          return errorResponse('Username and password are required', 400);
        }
        const result = await login(username, password);
        return jsonResponse(result);
      }

      // Check authorization for all subsequent API endpoints
      const token = getBearerToken(request);
      if (!token) {
        return errorResponse('Sign in to MirAIe in Mitra first.', 401);
      }

      // 2. GET /api/devices
      if (url.pathname === '/api/devices' && request.method === 'GET') {
        const home = await getHome(token);
        if (!home) {
          return errorResponse('No home found on this MirAIe account.', 404);
        }
        return jsonResponse(home);
      }

      // Match /api/devices/:id/...
      const deviceMatch = url.pathname.match(/^\/api\/devices\/([^/]+)(\/(status|command))?$/);
      if (deviceMatch) {
        const deviceId = deviceMatch[1];
        const action = deviceMatch[3] || 'status';

        // 3. GET /api/devices/:id/status
        if (action === 'status' && request.method === 'GET') {
          const status = await getDeviceStatus(deviceId, token);
          return jsonResponse({ status });
        }

        // 4. POST /api/devices/:id/command
        if (action === 'command' && request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const { homeId, topicBase, fields, kind } = body;

          console.log(`[Worker /api/command] deviceId=${deviceId}, homeId=${homeId}, topicBase=${topicBase}, fields=`, fields);

          if (!homeId || !topicBase || !fields) {
            console.error(`[Worker /api/command] Missing required parameters!`);
            return errorResponse('Missing required command parameters (homeId, topicBase, fields)', 400);
          }

          const messageObj = {
            ki: kind ?? 1,
            cnt: 'an',
            sid: '1',
            ...fields,
          };

          const payloadBytes = new TextEncoder().encode(JSON.stringify(messageObj));
          const clientId = `mitra-web-${crypto.randomUUID().slice(0, 8)}`;
          const controlTopic = `${topicBase}/control`;
          const statusTopic = `${topicBase}/status`;

          console.log(`[Worker /api/command] Publishing payload:`, JSON.stringify(messageObj));

          // Check if response confirms fields
          const isConfirmed = (reply: any) => {
            if (!reply || typeof reply !== 'object') return false;
            for (const [key, expected] of Object.entries(fields)) {
              if (reply[key] === undefined) return false;
              if (String(reply[key]) !== String(expected)) return false;
            }
            return true;
          };

          const reply = await publishOnce({
            clientId,
            username: homeId,
            accessToken: token,
            topic: controlTopic,
            statusTopic,
            payload: payloadBytes,
            timeoutMs: 4000,
            accepts: isConfirmed,
          });

          console.log(`[Worker /api/command] publishOnce result:`, reply);

          return jsonResponse({
            ok: true,
            sent: messageObj,
            confirmed: reply || null,
          });
        }
      }

      return errorResponse('Not found', 404);
    } catch (err: any) {
      const status = err.message?.includes('expired') ? 401 : 500;
      return errorResponse(err, status);
    }
  },
};
