import { useEffect, useState } from 'react';
import { getVideoByPlaybackId } from '@/lib/supabase-service';
import type { SupabaseVideo } from '@/lib/supabase-types';

export interface Video {
  playbackId: string;
  viewMode: string;
  amount: number;
  assetName: string;
  creatorId: string;
  donation: number[];
  Users: string[]; // Updated to match Supabase structure
}

export function useGetAssetGate(playbackId: string) {
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  
  useEffect(() => {
    if (!playbackId) return;
    setLoading(true);
    setError(null);

    getVideoByPlaybackId(playbackId)
      .then((supabaseVideo) => {
        if (supabaseVideo) {
          // Convert Supabase video to Video interface
          const videoData: Video = {
            playbackId: supabaseVideo.playbackId,
            viewMode: supabaseVideo.viewMode,
            amount: supabaseVideo.amount || 0,
            assetName: supabaseVideo.assetName,
            creatorId: supabaseVideo.creatorId,
            donation: supabaseVideo.donations || [],
            Users: supabaseVideo.Users || [],
          };
          setVideo(videoData);
          // auto‑open if free:
          if (videoData.viewMode === 'free') {
            setHasAccess(true);
          }
        } else {
          setError('Video not found');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch video');
        console.error('Error fetching video:', err);
      })
      .finally(() => setLoading(false));
  }, [playbackId]);
  
  // 2️⃣ If the user list already contains them, grant access (you'll call markPaid later)
  const markPaid = (userAddress: string) => {
    if (video?.Users?.some((addr) => addr.toLowerCase() === userAddress.toLowerCase())) {
      setHasAccess(true);
    }
  };
  
  return { video, loading, error, hasAccess, setHasAccess, markPaid };
}
