import { useEffect, useRef, useState } from 'react';
import type { Src } from '@livepeer/react';
import { subscribeToStreamStatus } from '@/lib/supabase-service';

const normalizeSourceUrl = (value: string) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    // Ignore token/search churn so we don't reload the player on every poll.
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split('?')[0] || value;
  }
};

const sourcesSignature = (sources: Src[] | null) =>
  (sources || [])
    .map((source) => {
      const type = String((source as any)?.type || '');
      const srcValue = String((source as any)?.src || (source as any)?.url || '');
      return `${type}|${normalizeSourceUrl(srcValue)}`;
    })
    .sort()
    .join('||');

type LivePlaybackStatus = 'idle' | 'ready' | 'starting' | 'offline';

const getStreamActiveFlag = (streamRow: any): boolean | null => {
  if (typeof streamRow?.isActive === 'boolean') return streamRow.isActive;
  if (typeof streamRow?.Record === 'boolean') return streamRow.Record;
  return null;
};

export function useLivePlaybackInfo(playbackId: string | null) {
  const [src, setSrc] = useState<Src[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LivePlaybackStatus>('idle');
  const sourceSigRef = useRef<string>('');
  const missCountRef = useRef<number>(0);
  const offlineCountRef = useRef<number>(0);
  const fetchInFlightRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!playbackId) {
      setSrc(null);
      setLoading(false);
      setError(null);
      setStatus('idle');
      sourceSigRef.current = '';
      missCountRef.current = 0;
      offlineCountRef.current = 0;
      fetchInFlightRef.current = false;
      initializedRef.current = false;
      return;
    }

    let cancelled = false;
    const clearSources = () => {
      sourceSigRef.current = '';
      setSrc(null);
    };

    const fetchSources = async () => {
      if (fetchInFlightRef.current) {
        return;
      }
      fetchInFlightRef.current = true;

      if (!cancelled && !initializedRef.current) {
        setLoading(true);
      }

      try {
        const response = await fetch(`/api/livestream-playback/${playbackId}`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (response.ok || response.status === 202) {
          const payload = await response.json().catch(() => ({}));
          const sources = (payload?.sources || []) as Src[];
          const nextStatus = (payload?.status || (sources.length > 0 ? 'ready' : 'starting')) as LivePlaybackStatus;

          if (!cancelled) {
            if (sources.length > 0) {
              missCountRef.current = 0;
              offlineCountRef.current = 0;
              const currentSig = sourceSigRef.current;
              const nextSig = sourcesSignature(sources);
              // Avoid forcing player reloads when the source list is unchanged.
              if (currentSig !== nextSig) {
                sourceSigRef.current = nextSig;
                setSrc(sources);
              }
              setError(null);
              setStatus('ready');
            } else if (nextStatus === 'offline') {
              missCountRef.current = 0;
              offlineCountRef.current += 1;
              // Require repeated offline confirmations before dropping active playback.
              if (offlineCountRef.current >= 3) {
                clearSources();
                setStatus('offline');
              } else {
                setStatus(sourceSigRef.current ? 'ready' : 'starting');
              }
              setError(null);
            } else {
              missCountRef.current += 1;
              offlineCountRef.current = 0;
              // Keep previous sources across transient "starting" responses to prevent player resets.
              if (!sourceSigRef.current) {
                setStatus('starting');
              } else {
                setStatus('ready');
              }
              setError(null);
            }
            initializedRef.current = true;
            setLoading(false);
          }
          return;
        }

        if (!cancelled && response.status >= 400 && response.status < 500 && response.status !== 202) {
          const payload = await response.json().catch(() => ({}));
          setError(payload?.error || 'Livestream playback unavailable.');
          setStatus('offline');
        }
      } catch (err: any) {
        if (!cancelled) {
          missCountRef.current += 1;
          // Do not drop current sources on transient fetch failures.
          if (!sourceSigRef.current) {
            setError(err?.message || 'Failed to fetch livestream playback info.');
            setStatus('starting');
          } else {
            setError(null);
            setStatus('ready');
          }
        }
      } finally {
        fetchInFlightRef.current = false;
        if (!cancelled) {
          initializedRef.current = true;
          setLoading(false);
        }
      }
    };

    fetchSources();
    const interval = setInterval(fetchSources, 2000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSources();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const unsubscribeStreamStatus = subscribeToStreamStatus(playbackId, (streamRow) => {
      const isActive = getStreamActiveFlag(streamRow);

      if (isActive === true) {
        missCountRef.current = 0;
        offlineCountRef.current = 0;
        setStatus((prev) => (prev === 'ready' ? prev : 'starting'));
        fetchSources();
        return;
      }

      if (isActive === false) {
        // Don't immediately clear sources on metadata flaps; confirm via playback polling.
        missCountRef.current = 0;
        setError(null);
        setStatus(sourceSigRef.current ? 'ready' : 'offline');
        fetchSources();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribeStreamStatus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackId]);

  return { src, loading, error, status };
}
