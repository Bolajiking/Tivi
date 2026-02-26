import { NextResponse } from 'next/server';
import { getSrc } from '@livepeer/react/external';
import { getPlaybackInfoUncached } from '@/lib/livepeer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const scoreLiveSource = (source: any) => {
  const url = String(source?.src || source?.url || '').toLowerCase();
  const type = String(source?.type || '').toLowerCase();
  const mime = String(source?.mime || '').toLowerCase();

  // For viewer reliability prefer HLS first, then WebRTC fallback.
  if (type.includes('hls') || mime.includes('mpegurl') || url.includes('.m3u8')) return 0;
  if (type.includes('webrtc') || url.includes('/webrtc/')) return 1;
  return 2;
};

const isPlayableLiveSource = (source: any) => {
  const url = String(source?.src || source?.url || '').toLowerCase();
  const type = String(source?.type || '').toLowerCase();
  const mime = String(source?.mime || '').toLowerCase();

  const isWebrtc = type.includes('webrtc') || url.includes('/webrtc/');
  const isHls = type.includes('hls') || mime.includes('mpegurl') || url.includes('.m3u8');
  return isWebrtc || isHls;
};

const hasManifestError = (body: string): boolean => {
  const text = body.toLowerCase();
  return text.includes('#ext-x-error') || text.includes('stream open failed') || text.includes('not allowed to view this stream');
};

const fetchWithTimeout = async (url: string, timeoutMs = 5000) => {
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

const isHlsReady = async (source: any): Promise<boolean> => {
  const src = String(source?.src || source?.url || '');
  if (!src) return false;

  try {
    const response = await fetchWithTimeout(src, 6000);
    if (!response.ok) return false;
    const manifest = await response.text();
    return !hasManifestError(manifest);
  } catch {
    return false;
  }
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
      return NextResponse.json({ status: 'processing', sources: [] }, { status: 202 });
    }
    const isLive = Number((playbackInfo as any)?.meta?.live ?? 0) === 1;
    if (!isLive) {
      return NextResponse.json(
        { status: 'offline', sources: [], message: 'Livestream is currently offline.' },
        { status: 202 },
      );
    }

    const sources = ((getSrc(playbackInfo) || []) as any[])
      .filter((source) => isPlayableLiveSource(source))
      .sort((a, b) => scoreLiveSource(a) - scoreLiveSource(b));

    const hlsSources = sources.filter((source) => {
      const type = String(source?.type || '').toLowerCase();
      const mime = String(source?.mime || '').toLowerCase();
      const url = String(source?.src || source?.url || '').toLowerCase();
      return type.includes('hls') || mime.includes('mpegurl') || url.includes('.m3u8');
    });

    const webrtcSources = sources.filter((source) => {
      const type = String(source?.type || '').toLowerCase();
      const url = String(source?.src || source?.url || '').toLowerCase();
      return type.includes('webrtc') || url.includes('/webrtc/');
    });

    const readyHlsResults = await Promise.all(
      hlsSources.map(async (source) => ({
        source,
        ready: await isHlsReady(source),
      })),
    );
    const readyHlsSources = readyHlsResults
      .filter((result) => result.ready)
      .map((result) => result.source);
    const fallbackHlsSources = hlsSources;

    // Prefer stable HLS first for viewers. Keep WebRTC only when HLS is absent.
    const reliableHlsSources =
      readyHlsSources.length > 0 ? readyHlsSources : fallbackHlsSources;
    const orderedSources =
      reliableHlsSources.length > 0 ? reliableHlsSources : webrtcSources;

    return NextResponse.json(
      {
        status: orderedSources.length > 0 ? 'ready' : 'starting',
        sources: orderedSources,
        message:
          orderedSources.length > 0
            ? undefined
            : 'Livestream is live but playback sources are still warming up.',
      },
      { status: orderedSources.length > 0 ? 200 : 202 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch livestream playback sources' },
      { status: 500 },
    );
  }
}
