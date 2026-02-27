import { createAsyncThunk } from '@reduxjs/toolkit';
import { InputCreatorIdType } from 'livepeer/models/components';
import axios from 'axios';
import {
  createStream,
  getAllStreams as getAllStreamsFromSupabase,
  hasCreatorInviteAccess,
  markStreamTerminated,
  updateStream as updateSupabaseStream,
} from '../lib/supabase-service';

interface CreateLivestreamProps {
  streamName: string;
  record: boolean;
  creatorId: string;
  viewMode?: 'free' | 'one-time' | 'monthly';
  amount?: number;
  description: string;
  bgcolor: string;
  color: string;
  fontSize: string;
  logo: string;
  donation?: number[];
  socialLinks?: string[];
}

interface UpdateLivestreamProps {
  id: string;
  record?: boolean;
  creatorId?: string;
  name?: string;
  suspended?: boolean;
}

interface RootStateLike {
  user?: {
    walletAddress?: string | null;
  };
}

const PUBLIC_PLAYBACK_POLICY = { type: 'public' as const };
const isLikelyWalletAddress = (value: string | null | undefined) =>
  /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
const normalizeWalletAddress = (value: string | null | undefined) =>
  String(value || '').trim().toLowerCase();

const resolveRequesterCreatorId = (explicitCreatorId: string | null | undefined, state: any): string => {
  const fromArg = normalizeWalletAddress(explicitCreatorId);
  if (isLikelyWalletAddress(fromArg)) return fromArg;

  const fromState = normalizeWalletAddress(state?.user?.walletAddress);
  if (isLikelyWalletAddress(fromState)) return fromState;

  return '';
};

const buildCreatorHeaders = (creatorId: string) =>
  creatorId ? { headers: { 'x-creator-id': creatorId } } : undefined;

const isPublicPlaybackPolicy = (playbackPolicy: any): boolean => {
  const type = String(playbackPolicy?.type || '').toLowerCase();
  return type === 'public';
};

const extractCreatorIdFromStream = (stream: any): string => {
  const directCreator = normalizeWalletAddress(stream?.creatorId);
  if (isLikelyWalletAddress(directCreator)) return directCreator;

  const nestedCreator = normalizeWalletAddress(stream?.creatorId?.value);
  if (isLikelyWalletAddress(nestedCreator)) return nestedCreator;

  return '';
};

const getMergedActiveState = (livepeerStream: any, supabaseStream: any): boolean => {
  const livepeerIsActive =
    typeof livepeerStream?.isActive === 'boolean' ? livepeerStream.isActive : null;
  const supabaseIsActive =
    typeof supabaseStream?.isActive === 'boolean'
      ? supabaseStream.isActive
      : typeof supabaseStream?.Record === 'boolean'
      ? supabaseStream.Record
      : null;

  // Trust Livepeer when it explicitly reports active.
  if (livepeerIsActive === true) return true;

  // If Livepeer reports inactive, only keep Supabase "active" briefly while
  // status propagation settles to avoid stale active badges.
  if (livepeerIsActive === false) {
    const lastSeenMs = Number(livepeerStream?.lastSeen || 0);
    const recentlySeen = Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs < 15_000;
    return Boolean(supabaseIsActive && recentlySeen);
  }

  // Fallback when Livepeer activity flag is unavailable.
  return Boolean(supabaseIsActive);
};

const streamApi = axios.create({
  baseURL: '/api/livepeer',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const createLivestream = createAsyncThunk(
  'streams/createLivestream',
  async (
    {
      streamName,
      record,
      creatorId,
      viewMode,
      amount,
      description,
      bgcolor,
      color,
      fontSize,
      logo,
      donation,
      socialLinks,
    }: CreateLivestreamProps,
    { rejectWithValue },
  ) => {
    try {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const canCreateCreatorChannel = await hasCreatorInviteAccess(creatorId);
      if (!canCreateCreatorChannel) {
        return rejectWithValue(
          'Creator access invite required. Redeem a valid invite code in Settings before creating a channel.',
        );
      }

      // Step 1: Create the livestream
      const response = await streamApi.post('/stream', {
        name: streamName,
        record,
        playbackPolicy: PUBLIC_PLAYBACK_POLICY,
        creatorId: {
          type: InputCreatorIdType.Unverified,
          value: creatorId,
        },
      }, buildCreatorHeaders(normalizeWalletAddress(creatorId)));

      const { playbackId, name } = response.data;
      const livepeerStreamId = response.data?.id;

      // Step 2: Save stream metadata to Supabase
      const streamData = {
        playbackId: playbackId,
        viewMode: viewMode || 'free',
        description: description || null,
        amount: amount || null,
        streamName: name || streamName,
        creatorId: creatorId,
        logo: logo || null,
        title: name || streamName || null,
        bgcolor: bgcolor || null,
        color: color || null,
        fontSize: fontSize ? parseInt(fontSize) : null,
        fontFamily: null,
        socialLinks: socialLinks || null,
        Users: [],
        donations: donation || [],
      };

      const maxSupabaseSaveAttempts = 3;
      let saveError: any = null;

      for (let attempt = 1; attempt <= maxSupabaseSaveAttempts; attempt++) {
        try {
          console.log(`Saving stream metadata to Supabase (attempt ${attempt}/${maxSupabaseSaveAttempts})`);
          await createStream(streamData);
          saveError = null;
          break;
        } catch (supabaseError: any) {
          saveError = supabaseError;
          console.error(`Supabase save attempt ${attempt} failed:`, supabaseError);
          if (attempt < maxSupabaseSaveAttempts) {
            await sleep(attempt * 500);
          }
        }
      }

      if (saveError) {
        if (livepeerStreamId) {
          try {
            await streamApi.delete(
              `/stream/${livepeerStreamId}`,
              buildCreatorHeaders(normalizeWalletAddress(creatorId)),
            );
            console.warn(`Rolled back orphaned Livepeer stream ${livepeerStreamId} after Supabase save failure.`);
          } catch (rollbackError) {
            console.error('Failed to rollback orphaned Livepeer stream:', rollbackError);
          }
        }
        throw new Error(
          `Stream created in Livepeer but failed to save metadata to Supabase after ${maxSupabaseSaveAttempts} attempts: ${
            saveError?.message || saveError
          }`,
        );
      }

      return response.data;
    } catch (error: any) {
      console.log('Error creating livestream:', error);
      const responseData = error?.response?.data;
      const errorMessage =
        (typeof responseData === 'string' && responseData) ||
        responseData?.error ||
        responseData?.message ||
        error?.message ||
        'Failed to create livestream';
      return rejectWithValue(errorMessage);
    }
  },
);

export const getAllStreams = createAsyncThunk('streams/getAllStreams', async () => {
  // Step 1: Get all streams from Livepeer
  const response = await streamApi.get('/stream');
  const streams = response.data;

  // Step 2: Get all streams from Supabase in one query (much more efficient)
  let supabaseStreamsMap: Map<string, any> = new Map();
  try {
    const supabaseStreams = await getAllStreamsFromSupabase();
    // Create a map for O(1) lookup by playbackId
    supabaseStreams.forEach((supabaseStream) => {
      if (supabaseStream.playbackId) {
        supabaseStreamsMap.set(supabaseStream.playbackId, supabaseStream);
      }
    });
  } catch (error) {
    // If Supabase fetch fails, log but continue - streams will just have no metadata
    console.warn('Failed to fetch streams from Supabase:', error);
  }

  // Step 3: Enrich each Livepeer stream with metadata from Supabase
  const enrichedStreams = streams.map((stream: any) => {
    if (!stream.playbackId) {
      return { ...stream, logo: '' };
    }

    // Look up Supabase metadata from the map
    const supabaseStream = supabaseStreamsMap.get(stream.playbackId);
    
    if (supabaseStream) {
      // Merge Supabase metadata into the stream
      return {
        ...stream,
        isActive: getMergedActiveState(stream, supabaseStream),
        logo: supabaseStream.logo || stream.logo || '',
        title: supabaseStream.title || supabaseStream.streamName || stream.name || stream.title || '',
        description: supabaseStream.description || stream.description || '',
        viewMode: supabaseStream.viewMode || stream.viewMode || 'free',
        amount: supabaseStream.amount || stream.amount || 0,
        bgcolor: supabaseStream.bgcolor || stream.bgcolor || '',
        color: supabaseStream.color || stream.color || '',
        fontSize: supabaseStream.fontSize?.toString() || stream.fontSize || '',
        fontFamily: supabaseStream.fontFamily || stream.fontFamily || '',
        donation: supabaseStream.donations || stream.donation || [],
        Users: supabaseStream.Users || stream.Users || [],
      };
    }
    
    // If no Supabase data (stream not saved yet), return stream as-is
    // This is normal for newly created streams
    return { ...stream, isActive: stream.isActive ?? false, logo: stream.logo || '' };
  });

  return enrichedStreams;
});

export const deleteStream = createAsyncThunk(
  'streams/deleteStream',
  async (id: string, { getState, rejectWithValue }) => {
    try {
      const creatorId = resolveRequesterCreatorId(undefined, getState() as RootStateLike);
      if (!creatorId) {
        return rejectWithValue('Unable to authorize stream delete: missing creator wallet context.');
      }
      await streamApi.delete(`/stream/${id}`, buildCreatorHeaders(creatorId));
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

export const getStreamById = createAsyncThunk(
  'streams/getStreamById',
  async (id: string, { getState }) => {
    const response = await streamApi.get(`/stream/${id}`);
    const stream = response.data;

    // Backfill legacy/private streams to public playback only when the requester is the owner.
    const requesterCreatorId = resolveRequesterCreatorId(undefined, getState() as RootStateLike);
    const streamCreatorId = extractCreatorIdFromStream(stream);
    if (
      requesterCreatorId &&
      streamCreatorId &&
      requesterCreatorId === streamCreatorId &&
      !isPublicPlaybackPolicy(stream?.playbackPolicy)
    ) {
      try {
        const patched = await streamApi.patch(
          `/stream/${id}`,
          { playbackPolicy: PUBLIC_PLAYBACK_POLICY },
          buildCreatorHeaders(requesterCreatorId),
        );
        return patched.data;
      } catch (error) {
        console.warn(`Failed to enforce public playback policy for stream ${id}:`, error);
      }
    }

    return stream;
  },
);

export const updateLivestream = createAsyncThunk(
  'streams/updateStream',
  async ({ id, record, name, creatorId }: UpdateLivestreamProps, { rejectWithValue, getState }) => {
    try {
      const requesterCreatorId = resolveRequesterCreatorId(creatorId, getState() as RootStateLike);
      if (!requesterCreatorId) {
        return rejectWithValue('Unable to authorize stream update: missing creator wallet context.');
      }

      let response;
      try {
        response = await streamApi.patch(
          `/stream/${id}`,
          {
            name: name,
            record,
            playbackPolicy: PUBLIC_PLAYBACK_POLICY,
          },
          buildCreatorHeaders(requesterCreatorId),
        );
      } catch (error: any) {
        // Some legacy stream records may reject playbackPolicy on patch.
        if (error?.response?.status !== 400) {
          throw error;
        }
        response = await streamApi.patch(
          `/stream/${id}`,
          {
            name: name,
            record,
          },
          buildCreatorHeaders(requesterCreatorId),
        );
      }

      const playbackId = response.data?.playbackId;
      if (playbackId) {
        const updates: Record<string, any> = {};
        if (typeof name === 'string') {
          updates.streamName = name;
          updates.title = name;
        }
        if (typeof record === 'boolean') {
          updates.Record = record;
        }

        if (Object.keys(updates).length > 0) {
          await updateSupabaseStream(playbackId, updates);
        }
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);
//
export const terminateStream = createAsyncThunk(
  'streams/terminateStream',
  async (id: string, { getState, rejectWithValue }) => {
    try {
      const requesterCreatorId = resolveRequesterCreatorId(undefined, getState() as RootStateLike);
      if (!requesterCreatorId) {
        return rejectWithValue('Unable to authorize stream termination: missing creator wallet context.');
      }

      const streamResponse = await streamApi.get(`/stream/${id}`);
      const playbackId = streamResponse.data?.playbackId;

      await streamApi.delete(`/stream/${id}/terminate`, buildCreatorHeaders(requesterCreatorId));

      if (playbackId) {
        try {
          await markStreamTerminated(playbackId);
        } catch (supabaseError) {
          console.warn(
            `Livepeer stream terminated but failed to sync Supabase status for ${playbackId}:`,
            supabaseError,
          );
        }
      }

      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);
