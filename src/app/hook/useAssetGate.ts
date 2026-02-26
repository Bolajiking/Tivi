import { useEffect, useState } from 'react';
import { getVideoByPlaybackId } from '@/lib/supabase-service';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import type { Subscription } from '@/lib/supabase-types';

export interface Video {
  playbackId: string;
  viewMode: 'free' | 'one-time' | 'monthly';
  amount: number;
  assetName: string;
  creatorId: string;
  donation: number[];
  Users: string[]; // Updated to match Supabase structure
  subscriptions?: Subscription[];
}

export function useGetAssetGate(playbackId: string) {
  const { walletAddress } = useWalletAddress();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  const hasValidLocalPayment = (key: string, viewMode: Video['viewMode']) => {
    const paymentRecord = localStorage.getItem(key);
    if (!paymentRecord) return false;

    try {
      const record = JSON.parse(paymentRecord);
      if (viewMode === 'one-time') {
        return true;
      }
      return Boolean(record?.expiresAt && Number(record.expiresAt) > Date.now());
    } catch {
      return false;
    }
  };

  const hasValidSubscription = (
    subscriptions: Subscription[] | undefined,
    viewerAddress: string,
    viewMode: Video['viewMode'],
  ) => {
    if (!subscriptions || subscriptions.length === 0) return false;

    const viewer = viewerAddress.toLowerCase();
    return subscriptions.some((sub) => {
      const sameViewer =
        String(sub?.subscriberAddress || '').toLowerCase() === viewer;
      if (!sameViewer) return false;

      if (viewMode === 'one-time') return true;
      if (viewMode === 'monthly') {
        return Boolean(sub?.expiresAt && new Date(sub.expiresAt).getTime() > Date.now());
      }
      return true;
    });
  };
  
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
            subscriptions: supabaseVideo.subscriptions || [],
          };
          setVideo(videoData);
        } else {
          // Missing video metadata is valid for newly created or unsynced assets.
          setVideo(null);
        }
      })
      .catch((err) => {
        if (err.message && !err.message.includes('not found') && !err.message.includes('406')) {
          setError(err.message || 'Failed to fetch video');
          console.error('Error fetching video:', err);
        } else {
          setVideo(null);
        }
      })
      .finally(() => setLoading(false));
  }, [playbackId]);

  useEffect(() => {
    if (!video) {
      setHasAccess(false);
      return;
    }

    if (video.viewMode === 'free' || Number(video.amount || 0) <= 0) {
      setHasAccess(true);
      return;
    }

    if (!walletAddress) {
      setHasAccess(false);
      return;
    }

    const viewer = walletAddress.toLowerCase();
    const isCreator = video.creatorId.toLowerCase() === viewer;
    const isInUsers = Boolean(
      video.Users?.some((addr) => String(addr).toLowerCase() === viewer),
    );
    const hasVideoAccessRecord = hasValidLocalPayment(
      `video_access_${video.playbackId}`,
      video.viewMode,
    );
    const hasCreatorAccessRecord = hasValidLocalPayment(
      `creator_access_${video.creatorId}`,
      video.viewMode,
    );
    const hasSubscription = hasValidSubscription(
      video.subscriptions,
      walletAddress,
      video.viewMode,
    );

    setHasAccess(
      isCreator ||
        isInUsers ||
        hasVideoAccessRecord ||
        hasCreatorAccessRecord ||
        hasSubscription,
    );
  }, [video, walletAddress]);
  
  // 2️⃣ If the user list already contains them, grant access (you'll call markPaid later)
  const markPaid = (userAddress: string) => {
    setHasAccess(true);
    setVideo((prev) => {
      if (!prev) return prev;
      const existingUsers = prev.Users || [];
      const alreadyPresent = existingUsers.some(
        (addr) => addr.toLowerCase() === userAddress.toLowerCase(),
      );
      if (alreadyPresent) return prev;
      return {
        ...prev,
        Users: [...existingUsers, userAddress],
      };
    });
  };
  
  return { video, loading, error, hasAccess, setHasAccess, markPaid };
}
