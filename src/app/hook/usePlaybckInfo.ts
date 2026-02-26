import { useState, useEffect } from 'react';
import type { Src } from '@livepeer/react';
import api from '@/utils/api';

const isHlsSource = (source: any): boolean => {
  const src = String(source?.src || source?.url || '').toLowerCase();
  const type = String(source?.type || '').toLowerCase();
  const mime = String(source?.mime || '').toLowerCase();
  return src.includes('.m3u8') || type.includes('hls') || mime.includes('mpegurl');
};

const isRawMp4Source = (source: any): boolean => {
  const src = String(source?.src || source?.url || '').toLowerCase();
  return src.includes('/raw/') || src.includes('.mp4');
};

const isRawHlsSource = (source: any): boolean => {
  const src = String(source?.src || source?.url || '').toLowerCase();
  return src.includes('/raw/') && src.includes('.m3u8');
};

export function usePlaybackInfo(playbackId: string | null) {
  const [src, setSrc] = useState<Src[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playbackId) {
      setSrc(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const maxAttempts = 18; // ~90s of retry for just-uploaded assets to finish processing
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (cancelled) return;

          const response = await fetch(`/api/playback/${playbackId}`, {
            method: 'GET',
            cache: 'no-store',
          });

          if (response.ok) {
            const payload = await response.json();
            const allSources = (payload?.sources || []) as Src[];
            const nonRawHlsSources = allSources.filter(
              (source) => isHlsSource(source) && !isRawHlsSource(source),
            );
            const nonRawSources = allSources.filter((source) => !isRawMp4Source(source));
            const hlsSources = allSources.filter((source) => isHlsSource(source));

            const srcData =
              nonRawHlsSources.length > 0
                ? nonRawHlsSources
                : nonRawSources.length > 0
                ? nonRawSources
                : hlsSources.length > 0
                ? hlsSources
                : allSources;

            if (srcData.length > 0) {
              setSrc(srcData);
              setError(null);
              return;
            }
          } else if (response.status >= 400 && response.status < 500 && response.status !== 202) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.error || 'Playback asset is unavailable.');
          }

          if (attempt < maxAttempts) {
            await sleep(5000);
          }
        }

        throw new Error('Video is still processing. Please retry in a moment.');
      } catch (err: any) {
        if (cancelled) return;
        setSrc(null);
        setError(err.message || 'Error fetching playback info');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [playbackId]);

  return { src, loading, error };
}

const getThumbnailUrl = (vttUrl: string) => {
  return vttUrl.replace('thumbnails/thumbnails.vtt', 'thumbnails/keyframes_0.png');
};

export const useFetchPlaybackId = (playbackId: string | null) => {
  const [playbackInfo, setPlaybackInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    if (!playbackId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/playback/${playbackId}`);
        if (response?.data?.meta?.source) {
          const thumbnailSource = response.data.meta.source.find((item: any) => item.hrn === 'Thumbnails');
          if (thumbnailSource) {
            const url = getThumbnailUrl(thumbnailSource.url);
            setThumbnailUrl(url);
          }
        }
        setPlaybackInfo(response?.data || {});
      } catch (err: any) {
        setError(err.message || 'Failed to fetch playback data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [playbackId]);

  return { playbackInfo, thumbnailUrl, loading, error };
};

export const useFetchStreamPlaybackId = (playbackId: string | null) => {
  const [playbackInfo, setPlaybackInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    if (!playbackId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/playback/${playbackId}`);
        if (response?.data?.meta?.source) {
          const thumbnailSource = response.data.meta.source.find((item: any) =>
            item.hrn.toLowerCase().includes('thumbnail'),
          );
          if (thumbnailSource) {
            const url = getThumbnailUrl(thumbnailSource.url);
            setThumbnailUrl(url);
          }
        }
        setPlaybackInfo(response?.data || {});
      } catch (err: any) {
        setError(err.message || 'Failed to fetch playback data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [playbackId]);

  return { playbackInfo, thumbnailUrl, loading, error };
};
