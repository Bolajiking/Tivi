import { NextResponse } from 'next/server';
import { getSrc } from '@livepeer/react/external';
import { getPlaybackInfoUncached } from '@/lib/livepeer';

const scoreSource = (source: any): number => {
  const url = String(source?.src || source?.url || '').toLowerCase();
  const type = String(source?.type || '').toLowerCase();
  const mime = String(source?.mime || '').toLowerCase();
  const isRaw = url.includes('/raw/');

  if ((url.includes('.m3u8') || type.includes('hls') || mime.includes('mpegurl')) && !isRaw) return 0;
  if (type.includes('webrtc')) return 1;
  if (isRaw || url.includes('.mp4')) return 4;
  return 2;
};

const normalizePlaybackSources = (sources: any[]): any[] => {
  const deduped = sources.filter((source, index, arr) => {
    const currentUrl = String(source?.src || source?.url || '');
    return arr.findIndex((item) => String(item?.src || item?.url || '') === currentUrl) === index;
  });

  return [...deduped].sort((a, b) => scoreSource(a) - scoreSource(b));
};

const isHlsSource = (source: any): boolean => {
  const url = String(source?.src || source?.url || '').toLowerCase();
  const type = String(source?.type || '').toLowerCase();
  const mime = String(source?.mime || '').toLowerCase();
  return url.includes('.m3u8') || type.includes('hls') || mime.includes('mpegurl');
};

const hasManifestError = (body: string): boolean => {
  const text = body.toLowerCase();
  return text.includes('#ext-x-error') || text.includes('stream open failed');
};

const fetchWithTimeout = async (url: string, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const validateSource = async (source: any) => {
  const url = String(source?.src || source?.url || '');
  if (!url) return false;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return false;

    if (isHlsSource(source)) {
      const body = await response.text();
      if (hasManifestError(body)) return false;
    }

    return true;
  } catch {
    return false;
  }
};

const toProxySource = (source: any, request: Request) => {
  const src = String(source?.src || source?.url || '');
  if (!src) return source;

  const proxyUrl = new URL('/api/playback/proxy', request.url);
  proxyUrl.searchParams.set('target', src);

  return {
    ...source,
    src: proxyUrl.toString(),
    url: proxyUrl.toString(),
  };
};

export async function GET(
  _request: Request,
  { params }: { params: { playbackId: string } },
) {
  const playbackId = params?.playbackId;

  if (!playbackId) {
    return NextResponse.json({ error: 'playbackId is required' }, { status: 400 });
  }

  try {
    const playbackInfo = await getPlaybackInfoUncached(playbackId);
    if (!playbackInfo) {
      return NextResponse.json(
        { status: 'processing', sources: [], message: 'Playback info not ready yet.' },
        { status: 202 },
      );
    }

    const rawSources = normalizePlaybackSources((getSrc(playbackInfo) || []) as any[]);
    if (!rawSources.length) {
      return NextResponse.json(
        { status: 'processing', sources: [], message: 'No playable sources available yet.' },
        { status: 202 },
      );
    }

    // Validate candidate sources and only return those that are currently reachable and valid.
    const validationResults = await Promise.all(
      rawSources.map(async (source) => ({ source, ok: await validateSource(source) })),
    );
    const healthySources = validationResults.filter((item) => item.ok).map((item) => item.source);

    if (!healthySources.length) {
      return NextResponse.json(
        {
          status: 'processing',
          sources: [],
          message: 'Playback sources exist but are not currently playable. Asset may still be processing.',
        },
        { status: 202 },
      );
    }

    const hlsOnly = healthySources.filter((source) => isHlsSource(source));
    const selectedSources = hlsOnly.length > 0 ? hlsOnly : healthySources;
    const proxiedSources = selectedSources.map((source) => toProxySource(source, _request));
    return NextResponse.json({ status: 'ready', sources: proxiedSources }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch playback info' },
      { status: 500 },
    );
  }
}
