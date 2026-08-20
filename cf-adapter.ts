import { app } from './express-server.js';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';

export async function handleCloudflareRequest(request: Request, env?: Record<string, any>): Promise<Response> {
  // Sync Cloudflare Workers bindings / secrets to process.env
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string' && value) {
        process.env[key] = value;
      }
    }
  }

  const url = new URL(request.url);

  return new Promise<Response>(async (resolve, reject) => {
    try {
      const req = new IncomingMessage(null as any);

      req.method = request.method;
      req.url = url.pathname + url.search;

      // Copy headers from Web Request to Node IncomingMessage
      request.headers.forEach((value, key) => {
        req.headers[key.toLowerCase()] = value;
      });

      // Prepare Node ServerResponse object
      const res = new ServerResponse(req);
      const resHeaders = new Headers();
      const resBodyChunks: Uint8Array[] = [];
      let statusCode = 200;
      let statusMessage = 'OK';

      // Always set basic CORS headers on response if not explicitly provided
      resHeaders.set('Access-Control-Allow-Origin', '*');
      resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      resHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, Cache-Control, Pragma');

      res.writeHead = function (code: number, message?: any, headers?: any) {
        statusCode = code;
        let hdrs = headers;
        if (typeof message === 'object') {
          hdrs = message;
        } else if (typeof message === 'string') {
          statusMessage = message;
        }

        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            if (v !== undefined) {
              if (Array.isArray(v)) {
                v.forEach(val => resHeaders.append(k, String(val)));
              } else {
                resHeaders.set(k, String(v));
              }
            }
          }
        }
        return res;
      };

      res.setHeader = function (name: string, value: any) {
        if (Array.isArray(value)) {
          resHeaders.delete(name);
          value.forEach(v => resHeaders.append(name, String(v)));
        } else {
          resHeaders.set(name, String(value));
        }
        return res;
      };

      res.getHeader = function (name: string) {
        return resHeaders.get(name) || undefined;
      };

      res.removeHeader = function (name: string) {
        resHeaders.delete(name);
      };

      res.write = function (chunk: any) {
        if (chunk) {
          if (typeof chunk === 'string') {
            resBodyChunks.push(Buffer.from(chunk));
          } else if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
            resBodyChunks.push(chunk);
          }
        }
        return true;
      };

      res.end = function (chunk?: any) {
        if (chunk) {
          if (typeof chunk === 'string') {
            resBodyChunks.push(Buffer.from(chunk));
          } else if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
            resBodyChunks.push(chunk);
          }
        }

        const isNullBodyStatus = [101, 204, 205, 304].includes(statusCode) || request.method === 'HEAD';
        const body = isNullBodyStatus ? null : Buffer.concat(resBodyChunks);

        const finalResponse = new Response(body, {
          status: statusCode,
          statusText: statusMessage,
          headers: resHeaders,
        });
        resolve(finalResponse);
        return res;
      };

      // Handle OPTIONS preflight quickly
      if (request.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Read request body if present (POST, PUT, PATCH, DELETE, etc.)
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          const arrayBuffer = await request.arrayBuffer();
          if (arrayBuffer && arrayBuffer.byteLength > 0) {
            const buf = Buffer.from(arrayBuffer);
            let text = buf.toString('utf-8').trim();
            if (text.charCodeAt(0) === 0xFEFF) {
              text = text.slice(1);
            }
            const contentType = (request.headers.get('content-type') || '').toLowerCase();
            req.headers['content-length'] = String(buf.length);

            if (contentType.includes('application/json')) {
              try {
                (req as any).body = JSON.parse(text);
              } catch (e) {
                (req as any).body = {};
              }
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
              try {
                const params = new URLSearchParams(text);
                const bodyObj: Record<string, string> = {};
                params.forEach((v, k) => { bodyObj[k] = v; });
                (req as any).body = bodyObj;
              } catch (e) {
                (req as any).body = {};
              }
            }
            req.push(buf);
          } else {
            if (request.headers.get('content-type')?.includes('application/json')) {
              (req as any).body = {};
            }
          }
        } catch (bodyReadErr) {
          if (request.headers.get('content-type')?.includes('application/json')) {
            (req as any).body = {};
          }
        }
      }
      req.push(null); // End of stream

      // Dispatch to Express app
      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}
