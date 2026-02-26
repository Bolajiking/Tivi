import { NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'vod-cdn.lp-playback.studio',
  'lp-playback.studio',
  'livepeercdn.studio',
  'lp-playback.com',
  'playback.livepeer.studio',
  'recordings-cdn-s.lp-playback.studio',
  'recordings-cdn.lp-playback.studio',
]);

const buildProxyUrl = (url: string, request: Request) => {
  const proxy = new URL('/api/playback/proxy', request.url);
  proxy.searchParams.set('target', url);
  return proxy.toString();
};

const rewriteManifest = (manifest: string, targetUrl: string, request: Request) => {
  const lines = manifest.split('\n');
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    try {
      const absolute = new URL(trimmed, targetUrl).toString();
      return buildProxyUrl(absolute, request);
    } catch {
      return line;
    }
  });
  return rewritten.join('\n');
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url: string, headers: Headers, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const fetchWithRetry = async (url: string, headers: Headers, retries = 3) => {
  let lastError: any = null;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, headers, 7000 + attempt * 1500);
      if (response.ok || response.status === 206) {
        return response;
      }

      // Do not turn upstream 4xx segment misses into 502s; pass them through.
      if (response.status < 500) {
        return response;
      }

      lastResponse = response;
      lastError = new Error(`Upstream responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) {
      await sleep(attempt * 400);
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('Failed to fetch upstream media');
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('target');

  if (!target) {
    return NextResponse.json({ error: 'target query param is required' }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return NextResponse.json({ error: 'Invalid target URL' }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return NextResponse.json({ error: 'Target host is not allowed' }, { status: 403 });
  }

  const headers = new Headers();
  const range = request.headers.get('range');
  if (range) headers.set('range', range);

  let upstream: Response;
  try {
    upstream = await fetchWithRetry(targetUrl.toString(), headers, 3);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch upstream media' }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') || '';
  const isManifest =
    targetUrl.pathname.toLowerCase().endsWith('.m3u8') ||
    contentType.toLowerCase().includes('mpegurl');

  if (isManifest) {
    const text = await upstream.text();
    const rewritten = rewriteManifest(text, targetUrl.toString(), request);
    return new NextResponse(rewritten, {
      status: upstream.status,
      headers: {
        'content-type': 'application/vnd.apple.mpegurl',
        'cache-control': 'no-store',
      },
    });
  }

  const passthroughHeaders = new Headers();
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) passthroughHeaders.set('content-type', upstreamType);
  const acceptRanges = upstream.headers.get('accept-ranges');
  if (acceptRanges) passthroughHeaders.set('accept-ranges', acceptRanges);
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) passthroughHeaders.set('content-length', contentLength);
  passthroughHeaders.set('cache-control', 'no-store');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: passthroughHeaders,
  });
}
