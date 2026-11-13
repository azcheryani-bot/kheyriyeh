import { handleCloudflareRequest } from './cf-adapter';

const DEFAULT_NEON_STREAM_ORIGIN = '';

export default {
  async fetch(request: Request, env: Record<string, any>, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Embedded Anti-Sanction Stream Proxy (HLS Live Stream & TS Video Segments)
    const isHlsProxyPath =
      path === '/live.m3u8' ||
      path.endsWith('.ts') ||
      (path.startsWith('/live/') && (path.endsWith('.m3u8') || path.endsWith('.ts')));

    if (isHlsProxyPath) {
      let origin = env.S3_ENDPOINT_URL || DEFAULT_NEON_STREAM_ORIGIN;
      if (!origin) {
        return new Response('Stream Proxy Error: S3_ENDPOINT_URL is not configured', { status: 500 });
      }
      if (!env.S3_BUCKET_NAME) {
        return new Response('Stream Proxy Error: S3_BUCKET_NAME is not configured', { status: 500 });
      }
      if (!origin.endsWith(env.S3_BUCKET_NAME)) {
        origin = `${origin.replace(/\/$/, '')}/${env.S3_BUCKET_NAME}`;
      }
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

    // 2. Delegate static assets (including dedicated TV pages /display and /live) to Cloudflare Assets binding
    if (!path.startsWith('/api') && !path.startsWith('/sms') && !path.startsWith('/db') && !path.startsWith('/stream')) {
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const normalizedPath = path.replace(/\/+$/, '') || '/';
        if (normalizedPath === '/display' || normalizedPath === '/display.html') {
          const assetUrl = new URL(url.toString());
          assetUrl.pathname = '/display.html';
          return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
        }
        if (normalizedPath === '/live' || normalizedPath === '/live.html' || normalizedPath === '/tv' || normalizedPath === '/watch') {
          const assetUrl = new URL(url.toString());
          assetUrl.pathname = '/live.html';
          return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
        }
        return env.ASSETS.fetch(request);
      }
    }

    return handleCloudflareRequest(request, env);
  },
};


