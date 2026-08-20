import { handleCloudflareRequest } from './cf-adapter';

const DEFAULT_NEON_STREAM_ORIGIN = 'https://br-lucky-wave-axbfuzrm.storage.c-4.us-east-2.aws.neon.tech/m3u8-streamer';

export default {
  async fetch(request: Request, env: Record<string, any>, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Embedded Anti-Sanction Stream Proxy (HLS Live Stream & TS Video Segments)
    if (path === '/live.m3u8' || path.endsWith('.ts') || path.startsWith('/live/')) {
      const origin = env.NEON_STREAM_ORIGIN || DEFAULT_NEON_STREAM_ORIGIN;
      const targetUrl = path.startsWith('/live/') 
        ? `${origin}${path.replace(/^\/live/, '')}` 
        : `${origin}${path}`;

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          }
        });
      }

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: request.headers
        });

        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        newHeaders.set('Pragma', 'no-cache');
        newHeaders.set('Expires', '0');

        if (path.endsWith('.m3u8')) {
          newHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
        } else if (path.endsWith('.ts')) {
          newHeaders.set('Content-Type', 'video/mp2t');
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (e: any) {
        return new Response(e.message || 'Stream Proxy Error', { status: 500 });
      }
    }

    // 2. Delegate static assets to Cloudflare Assets binding if not an API route
    if (!path.startsWith('/api') && !path.startsWith('/sms') && !path.startsWith('/db') && !path.startsWith('/stream')) {
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return env.ASSETS.fetch(request);
      }
    }

    return handleCloudflareRequest(request, env);
  },
};


