import api from '@/utils/api';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getAllVideos } from '@/lib/supabase-service';

interface uploaAssetProps {
  name: string;
  staticMP4: boolean;
  creatorId: string;
}

interface RootStateLike {
  user?: {
    walletAddress?: string | null;
  };
}

const normalizeWalletAddress = (value: string | null | undefined): string =>
  String(value || '').trim().toLowerCase();

const isLikelyWalletAddress = (value: string | null | undefined): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());

export const requestAssetUpload = createAsyncThunk(
  'assets/requestAssetUpload',
  async ({ name, staticMP4 = true, creatorId }: uploaAssetProps, { rejectWithValue }) => {
    const requesterCreatorId = normalizeWalletAddress(creatorId);
    if (!isLikelyWalletAddress(requesterCreatorId)) {
      return rejectWithValue('Wallet address is required to upload an asset.');
    }

    try {
      const response = await api.post(
        '/asset/request-upload',
        {
          name,
          staticMP4,
          creatorId: {
            type: 'Unverified',
            value: creatorId,
          },
        },
        {
          headers: {
            'x-creator-id': requesterCreatorId,
          },
        },
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

export const getAssets = createAsyncThunk('assets/getAssets', async () => {
  const response = await api.get('/asset');
  const assets = response.data;

  let supabaseVideos: any[] = [];
  let supabaseVideosMap: Map<string, any> = new Map();
  try {
    supabaseVideos = await getAllVideos();
    supabaseVideos.forEach((video) => {
      if (video.playbackId) {
        supabaseVideosMap.set(video.playbackId, video);
      }
    });
  } catch (error) {
    console.warn('Failed to fetch videos from Supabase:', error);
  }

  const enrichedLivepeerAssets = assets.map((asset: any) => {
    const playbackId = asset?.playbackId;
    if (!playbackId) {
      return asset;
    }

    const supabaseVideo = supabaseVideosMap.get(playbackId);
    if (!supabaseVideo) {
      return asset;
    }

    return {
      ...asset,
      name: supabaseVideo.title || supabaseVideo.assetName || asset.name || '',
      title: supabaseVideo.title || supabaseVideo.assetName || asset.title || asset.name || '',
      description: supabaseVideo.description || asset.description || '',
      viewMode: supabaseVideo.viewMode || asset.viewMode || 'free',
      amount: supabaseVideo.amount || asset.amount || 0,
      logo: supabaseVideo.logo || asset.logo || '',
      bgcolor: supabaseVideo.bgcolor || asset.bgcolor || '',
      color: supabaseVideo.color || asset.color || '',
      fontSize: supabaseVideo.fontSize?.toString() || asset.fontSize || '',
      fontFamily: supabaseVideo.fontFamily || asset.fontFamily || '',
      Users: supabaseVideo.Users || asset.Users || [],
      donation: supabaseVideo.donations || asset.donation || [],
      creatorId: asset.creatorId || (supabaseVideo.creatorId ? { type: 'Unverified', value: supabaseVideo.creatorId } : null),
      creatorWalletAddress: supabaseVideo.creatorId || asset.creatorWalletAddress || '',
    };
  });

  // Include videos that exist in Supabase but are not yet returned by Livepeer /asset.
  // This keeps creator dashboards consistent right after upload metadata is saved.
  const livepeerPlaybackIds = new Set(
    enrichedLivepeerAssets.map((asset: any) => asset?.playbackId).filter(Boolean),
  );

  const supabaseOnlyAssets = supabaseVideos
    .filter((video) => video.playbackId && !livepeerPlaybackIds.has(video.playbackId))
    .map((video) => ({
      id: video.id || `supabase-${video.playbackId}`,
      name: video.title || video.assetName || 'Untitled Video',
      title: video.title || video.assetName || 'Untitled Video',
      size: 0,
      source: { type: 'url' },
      status: { phase: 'ready', updatedAt: Date.now() },
      userId: '',
      createdAt: video.created_at ? Date.parse(video.created_at) : Date.now(),
      creatorId: { type: 'Unverified', value: video.creatorId },
      projectId: '',
      videoSpec: { format: 'mp4', bitrate: 0, duration: 0 },
      playbackId: video.playbackId,
      createdByTokenName: '',
      downloadUrl: '',
      playbackUrl: '',
      assetId: video.id || video.playbackId,
      duration: 0,
      description: video.description || '',
      viewMode: video.viewMode || 'free',
      amount: video.amount || 0,
      logo: video.logo || '',
      bgcolor: video.bgcolor || '',
      color: video.color || '',
      fontSize: video.fontSize?.toString() || '',
      fontFamily: video.fontFamily || '',
      Users: video.Users || [],
      donation: video.donations || [],
      creatorWalletAddress: video.creatorId || '',
    }));

  return [...enrichedLivepeerAssets, ...supabaseOnlyAssets].sort(
    (a: any, b: any) => (b?.createdAt || 0) - (a?.createdAt || 0),
  );
});

export const deleteAsset = createAsyncThunk(
  'assets/deleteAsset',
  async (assetId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootStateLike;
      const requesterCreatorId = normalizeWalletAddress(state?.user?.walletAddress);
      if (!isLikelyWalletAddress(requesterCreatorId)) {
        return rejectWithValue('Wallet address is required to delete an asset.');
      }

      await api.delete(`/asset/${assetId}`, {
        headers: {
          'x-creator-id': requesterCreatorId,
        },
      });
      return assetId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);
