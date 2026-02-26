/**
 * Supabase service layer with helper functions for database operations
 */
import supabase from '../../supabase';
import type {
  SupabaseStream,
  SupabaseUser,
  SupabaseVideo,
  SupabaseChat,
  CreatorInviteCode,
  CreatorAccessGrant,
  ChannelChatGroup,
  StreamInsert,
  StreamUpdate,
  UserInsert,
  UserUpdate,
  VideoInsert,
  VideoUpdate,
  ChatInsert,
  Subscription,
  Notification,
} from './supabase-types';

// ==================== IMAGE UPLOAD OPERATIONS ====================

const STORAGE_BUCKET_FALLBACKS = ['user-avatars', 'stream-logos'];
let cachedWorkingStorageBucket: string | null = null;

const isStorageBucketNotFoundError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 404 ||
    message.includes('not found') ||
    message.includes('bucket not found') ||
    message.includes('storage bucket') && message.includes('not found')
  );
};

const isStoragePermissionError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 401 ||
    error?.status === 403 ||
    message.includes('row-level security') ||
    message.includes('rls') ||
    message.includes('permission denied')
  );
};

const buildStorageBucketCandidates = (preferredBucket: string): string[] => {
  const normalizedPreferred = String(preferredBucket || '').trim() || 'images';
  const candidates = [
    normalizedPreferred,
    cachedWorkingStorageBucket || '',
    ...STORAGE_BUCKET_FALLBACKS,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
};

/**
 * Upload an image file to Supabase Storage
 * @param img - The image file to upload
 * @param bucketName - The storage bucket name (default: 'images')
 * @returns The public URL of the uploaded image, or empty string on error
 */
export async function uploadImage(img: File, bucketName: string = 'images'): Promise<string> {
  // Sanitize filename to avoid issues
  const sanitizedFileName = img.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = `uploads/${uploadId}-${sanitizedFileName}`;
  const candidates = buildStorageBucketCandidates(bucketName);
  const errors: Array<{ bucket: string; error: any }> = [];

  for (const candidateBucket of candidates) {
    const { error } = await supabase.storage
      .from(candidateBucket)
      .upload(filePath, img, {
        cacheControl: '3600',
        upsert: false,
      });

    if (!error) {
      cachedWorkingStorageBucket = candidateBucket;
      const { data: urlData } = await supabase.storage.from(candidateBucket).getPublicUrl(filePath);
      return urlData.publicUrl || '';
    }

    errors.push({ bucket: candidateBucket, error });
    if (isStorageBucketNotFoundError(error) || isStoragePermissionError(error)) {
      continue;
    }

    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const hadPermissionError = errors.some(({ error }) => isStoragePermissionError(error));
  if (hadPermissionError) {
    throw new Error(
      'Image upload is blocked by storage permissions. Please enable insert access on at least one public bucket (for example: user-avatars or stream-logos).',
    );
  }

  throw new Error(
    'No usable storage bucket found for image uploads. Create a public bucket (for example: user-avatars or stream-logos) or configure the "images" bucket.',
  );
}

// ==================== STREAM OPERATIONS ====================

/**
 * Create a new stream in Supabase
 */
export async function createStream(streamData: StreamInsert): Promise<SupabaseStream> {
  // Validate required fields
  if (!streamData.playbackId) {
    throw new Error('playbackId is required');
  }
  if (!streamData.creatorId) {
    throw new Error('creatorId is required');
  }
  if (!streamData.streamName) {
    throw new Error('streamName is required');
  }

  // Log what we're trying to insert
  console.log('Inserting stream to Supabase:', streamData);

  const { data, error } = await supabase
    .from('streams')
    .insert(streamData)
    .select()
    .single();

  if (error) {
    // Log full error details for debugging
    console.error('Supabase insert error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      data: streamData,
    });
    
    // Provide more helpful error message
    let errorMessage = `Failed to create stream: ${error.message}`;
    if (error.details) {
      errorMessage += ` (Details: ${error.details})`;
    }
    if (error.hint) {
      errorMessage += ` (Hint: ${error.hint})`;
    }
    
    throw new Error(errorMessage);
  }

  console.log('Successfully inserted stream to Supabase:', data);
  return data;
}

/**
 * Get stream by playback ID
 */
export async function getStreamByPlaybackId(playbackId: string): Promise<SupabaseStream | null> {
  if (!playbackId) {
    return null;
  }

  const { data, error } = await supabase
    .from('streams')
    .select('*')
    .eq('playbackId', playbackId)
    .maybeSingle();

  if (error) {
    // PGRST116 means no rows found - this is normal for streams that haven't been saved to Supabase yet
    if (error.code === 'PGRST116') {
      return null;
    }
    
    // 406 errors might indicate column name issues - log but don't throw for missing streams
    if (error.code === 'PGRST301' || error.message?.includes('406') || error.message?.includes('does not exist')) {
      console.warn(`Stream ${playbackId} not found in Supabase (may not be created yet):`, error.message);
      return null;
    }
    
    // Only log and throw for actual errors (not just missing streams)
    console.error('Supabase query error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Failed to fetch stream: ${error.message}`);
  }

  return data;
}

/**
 * Get all streams for a creator
 */
export async function getStreamsByCreator(creatorId: string): Promise<SupabaseStream[]> {
  if (!creatorId || !creatorId.trim()) return [];

  const { data, error } = await supabase
    .from('streams')
    .select('*')
    .ilike('creatorId', creatorId.trim());

  if (error) {
    throw new Error(`Failed to fetch streams: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all streams
 */
export async function getAllStreams(): Promise<SupabaseStream[]> {
  const { data, error } = await supabase
    .from('streams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch streams: ${error.message}`);
  }

  return data || [];
}

/**
 * Update stream by playback ID
 */
export async function updateStream(
  playbackId: string,
  updates: StreamUpdate
): Promise<SupabaseStream> {
  const { data, error } = await supabase
    .from('streams')
    .update(updates)
    .eq('playbackId', playbackId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update stream: ${error.message}`);
  }

  return data;
}

/**
 * Delete stream by playback ID
 */
export async function deleteStream(playbackId: string): Promise<void> {
  const { error } = await supabase
    .from('streams')
    .delete()
    .eq('playbackId', playbackId);

  if (error) {
    throw new Error(`Failed to delete stream: ${error.message}`);
  }
}

/**
 * Add paying user to stream
 */
export async function addPayingUserToStream(
  playbackId: string,
  userAddress: string
): Promise<SupabaseStream> {
  // First, get the current stream
  const stream = await getStreamByPlaybackId(playbackId);
  
  if (!stream) {
    throw new Error('Stream not found');
  }

  // Check if user is already in the Users array
  const currentUsers = stream.Users || [];
  if (currentUsers.includes(userAddress)) {
    // User already added, return existing stream
    return stream;
  }

  // Add user to the array
  const updatedUsers = [...currentUsers, userAddress];

  // Update the stream
  const { data, error } = await supabase
    .from('streams')
    .update({
      Users: updatedUsers,
    })
    .eq('playbackId', playbackId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add paying user: ${error.message}`);
  }

  return data;
}

/**
 * Add subscription to a stream
 */
export async function addSubscriptionToStream(
  playbackId: string,
  subscription: Subscription
): Promise<SupabaseStream> {
  // First, get the current stream
  const stream = await getStreamByPlaybackId(playbackId);
  
  if (!stream) {
    throw new Error('Stream not found');
  }

  // Get current subscriptions array
  const currentSubscriptions = stream.subscriptions || [];

  // Check if subscription already exists (same subscriber and txHash)
  const existingSubscription = currentSubscriptions.find(
    (sub: Subscription) => 
      sub.subscriberAddress.toLowerCase() === subscription.subscriberAddress.toLowerCase() &&
      sub.txHash === subscription.txHash
  );

  if (existingSubscription) {
    // Subscription already exists, return existing stream
    return stream;
  }

  // Add new subscription to the array
  const updatedSubscriptions = [...currentSubscriptions, subscription];

  // Update the stream
  const { data, error } = await supabase
    .from('streams')
    .update({
      subscriptions: updatedSubscriptions,
    })
    .eq('playbackId', playbackId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add subscription: ${error.message}`);
  }

  return data;
}

/**
 * Add notification to a stream
 */
export async function addNotificationToStream(
  playbackId: string,
  notification: Notification
): Promise<SupabaseStream> {
  // First, get the current stream
  const stream = await getStreamByPlaybackId(playbackId);
  
  if (!stream) {
    throw new Error('Stream not found');
  }

  // Get current notifications array
  const currentNotifications = stream.notifications || [];

  // Add new notification to the beginning of the array (most recent first)
  const updatedNotifications = [notification, ...currentNotifications];

  // Update the stream
  const { data, error } = await supabase
    .from('streams')
    .update({
      notifications: updatedNotifications,
    })
    .eq('playbackId', playbackId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add notification: ${error.message}`);
  }

  return data;
}

/**
 * Add subscription and notification to creator's stream(s)
 * This function finds the creator's stream(s) and adds the subscription/notification to all of them
 */
export async function addCreatorSubscriptionAndNotification(
  creatorId: string,
  subscription: Subscription,
  notification: Notification
): Promise<void> {
  try {
    // Get all streams for this creator
    const streams = await getStreamsByCreator(creatorId);
    
    if (!streams || streams.length === 0) {
      console.warn(`No streams found for creator ${creatorId}`);
      return;
    }

    // Update all streams for this creator
    await Promise.all(
      streams.map(async (stream) => {
        try {
          await Promise.all([
            addSubscriptionToStream(stream.playbackId, subscription),
            addNotificationToStream(stream.playbackId, notification),
          ]);
          console.log(`Successfully added subscription and notification to stream ${stream.playbackId}`);
        } catch (error) {
          console.error(`Failed to update stream ${stream.playbackId}:`, error);
          // Continue with other streams even if one fails
        }
      })
    );
    
    console.log(`Successfully processed ${streams.length} stream(s) for creator ${creatorId}`);
  } catch (error) {
    console.error('Failed to add subscription and notification:', error);
    throw error;
  }
}

// ==================== USER/PROFILE OPERATIONS ====================

const INVITE_SCHEMA_SETUP_ERROR =
  'Creator invites are not configured yet. Run supabase/creator-invite-schema.sql in your Supabase SQL editor.';

const isMissingInviteSchemaError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 404 ||
    error?.code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('not found') ||
    message.includes('could not find the table') ||
    message.includes('creator_invite_codes') ||
    message.includes('creator_access_grants')
  );
};

const normalizeInviteCode = (code: string): string => code.trim().toUpperCase();
const isMissingInviteRpcError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST202' ||
    (message.includes('function') &&
      message.includes('does not exist') &&
      (message.includes('has_creator_access') || message.includes('redeem_creator_invite')))
  );
};

/**
 * Check whether a wallet has creator access.
 * Existing creators with at least one stream are treated as granted.
 */
export async function hasCreatorInviteAccess(creatorId: string): Promise<boolean> {
  if (!creatorId) return false;

  // Existing creators remain allowed without requiring a new invite redemption.
  const existingStreams = await getStreamsByCreator(creatorId);
  if (existingStreams.length > 0) {
    return true;
  }

  const rpcAccessCheck = await supabase.rpc('has_creator_access', {
    p_creator_id: creatorId,
  });

  if (!rpcAccessCheck.error) {
    return Boolean(rpcAccessCheck.data);
  }

  if (!isMissingInviteRpcError(rpcAccessCheck.error)) {
    if (isMissingInviteSchemaError(rpcAccessCheck.error)) {
      throw new Error(INVITE_SCHEMA_SETUP_ERROR);
    }
    throw new Error(`Failed to check creator invite access: ${rpcAccessCheck.error.message}`);
  }

  const { data, error } = await supabase
    .from('creator_access_grants')
    .select('creator_id')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (error) {
    if (isMissingInviteSchemaError(error)) {
      throw new Error(INVITE_SCHEMA_SETUP_ERROR);
    }
    throw new Error(`Failed to check creator invite access: ${error.message}`);
  }

  return !!data;
}

/**
 * Redeem creator invite code for a wallet address.
 */
export async function redeemCreatorInviteCode(
  creatorId: string,
  inviteCode: string,
): Promise<{ alreadyGranted: boolean; grant: CreatorAccessGrant }> {
  if (!creatorId) {
    throw new Error('Wallet address is required.');
  }

  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) {
    throw new Error('Invite code is required.');
  }

  const rpcRedeemResult = await supabase.rpc('redeem_creator_invite', {
    p_creator_id: creatorId,
    p_code: normalizedCode,
  });

  if (!rpcRedeemResult.error) {
    const payload = (rpcRedeemResult.data || {}) as any;
    return {
      alreadyGranted: Boolean(payload?.alreadyGranted ?? payload?.already_granted ?? false),
      grant: {
        creator_id: creatorId,
        invite_code: String(payload?.inviteCode ?? payload?.invite_code ?? normalizedCode),
        granted_at: String(payload?.grantedAt ?? payload?.granted_at ?? new Date().toISOString()),
      },
    };
  }

  if (!isMissingInviteRpcError(rpcRedeemResult.error)) {
    if (isMissingInviteSchemaError(rpcRedeemResult.error)) {
      throw new Error(INVITE_SCHEMA_SETUP_ERROR);
    }
    throw new Error(rpcRedeemResult.error.message || 'Failed to redeem invite code.');
  }

  const existingGrantResult = await supabase
    .from('creator_access_grants')
    .select('*')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (existingGrantResult.error) {
    if (isMissingInviteSchemaError(existingGrantResult.error)) {
      throw new Error(INVITE_SCHEMA_SETUP_ERROR);
    }
    throw new Error(`Failed to check existing creator grant: ${existingGrantResult.error.message}`);
  }

  if (existingGrantResult.data) {
    return {
      alreadyGranted: true,
      grant: existingGrantResult.data as CreatorAccessGrant,
    };
  }

  const inviteLookup = await supabase
    .from('creator_invite_codes')
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (inviteLookup.error) {
    if (isMissingInviteSchemaError(inviteLookup.error)) {
      throw new Error(INVITE_SCHEMA_SETUP_ERROR);
    }
    throw new Error(`Failed to validate invite code: ${inviteLookup.error.message}`);
  }

  const invite = inviteLookup.data as CreatorInviteCode | null;
  if (!invite) {
    throw new Error('Invalid invite code.');
  }

  if (invite.is_active === false) {
    throw new Error('This invite code is inactive.');
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new Error('This invite code has expired.');
  }

  const usedCount = Number(invite.used_count || 0);
  const maxUses = invite.max_uses == null ? null : Number(invite.max_uses);
  if (maxUses !== null && usedCount >= maxUses) {
    throw new Error('This invite code has reached its usage limit.');
  }

  const grantPayload = {
    creator_id: creatorId,
    invite_code: normalizedCode,
    granted_at: new Date().toISOString(),
  };

  const grantInsert = await supabase
    .from('creator_access_grants')
    .insert(grantPayload)
    .select('*')
    .single();

  if (grantInsert.error) {
    if (isMissingInviteSchemaError(grantInsert.error)) {
      throw new Error(INVITE_SCHEMA_SETUP_ERROR);
    }
    throw new Error(`Failed to grant creator access: ${grantInsert.error.message}`);
  }

  const incrementUsage = await supabase
    .from('creator_invite_codes')
    .update({
      used_count: usedCount + 1,
    })
    .eq('code', normalizedCode);

  if (incrementUsage.error) {
    // Non-fatal for grant continuity, but report for ops visibility.
    console.error('Failed to increment invite usage count:', incrementUsage.error);
  }

  return {
    alreadyGranted: false,
    grant: grantInsert.data as CreatorAccessGrant,
  };
}

/**
 * Get user profile by creator ID (wallet address)
 */
export async function getUserProfile(creatorId: string): Promise<SupabaseUser | null> {
  if (!creatorId || !creatorId.trim()) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('creatorId', creatorId.trim())
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }

  return data;
}

/**
 * Get user profile by username (displayName)
 * Uses case-insensitive matching since Next.js converts URL params to lowercase
 */
export async function getUserProfileByUsername(username: string): Promise<SupabaseUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('displayName', username) // Case-insensitive match
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch user profile by username: ${error.message}`);
  }

  return data;
}

/**
 * Create user profile
 */
export async function createUserProfile(userData: UserInsert): Promise<SupabaseUser> {
  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user profile: ${error.message}`);
  }

  return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  creatorId: string,
  updates: UserUpdate
): Promise<SupabaseUser> {
  if (!creatorId || !creatorId.trim()) {
    throw new Error('creatorId is required');
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .ilike('creatorId', creatorId.trim())
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }

  return data;
}

/**
 * Upsert user profile (create or update)
 * Manually checks if profile exists and inserts or updates accordingly
 */
export async function upsertUserProfile(userData: UserInsert): Promise<SupabaseUser> {
  // First, check if profile exists
  const existingProfile = await getUserProfile(userData.creatorId);
  
  if (existingProfile) {
    // Profile exists, update it
    return await updateUserProfile(userData.creatorId, userData);
  } else {
    // Profile doesn't exist, create it
    return await createUserProfile(userData);
  }
}

/**
 * Get all creators (users with displayName)
 */
export async function getAllCreators(): Promise<SupabaseUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .not('displayName', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch all creators: ${error.message}`);
  }

  return data || [];
}

/**
 * Check if displayName is unique (not taken by another user)
 */
export async function isDisplayNameUnique(displayName: string, excludeCreatorId?: string): Promise<boolean> {
  if (!displayName || !displayName.trim()) {
    return false;
  }

  let query = supabase
    .from('users')
    .select('creatorId')
    .ilike('displayName', displayName.trim()); // Case-insensitive match

  // Exclude current user if updating
  if (excludeCreatorId) {
    query = query.neq('creatorId', excludeCreatorId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to check display name uniqueness: ${error.message}`);
  }

  // If no results, the name is unique
  return !data || data.length === 0;
}

/**
 * Subscribe to a creator (add creatorId to user's Channels array)
 */
export async function subscribeToCreator(userWalletAddress: string, creatorId: string): Promise<SupabaseUser> {
  // Get current user profile
  const userProfile = await getUserProfile(userWalletAddress);
  const normalizedCreatorId = creatorId.trim();
  
  if (!userProfile) {
    // Create a new profile if it doesn't exist
    const newProfile: UserInsert = {
      creatorId: userWalletAddress,
      displayName: null,
      bio: null,
      avatar: null,
      socialLinks: [],
      Channels: [normalizedCreatorId],
    };
    return await createUserProfile(newProfile);
  }
  
  // Check if already subscribed
  const currentChannels = userProfile.Channels || [];
  if (currentChannels.some((channelCreatorId) => sameWalletAddress(channelCreatorId, normalizedCreatorId))) {
    // Already subscribed, return existing profile
    return userProfile;
  }
  
  // Add creatorId to Channels array
  const updatedChannels = [...currentChannels, normalizedCreatorId];
  
  // Update user profile
  return await updateUserProfile(userProfile.creatorId, {
    Channels: updatedChannels,
  });
}

/**
 * Unsubscribe from a creator (remove creatorId from user's Channels array)
 */
export async function unsubscribeFromCreator(userWalletAddress: string, creatorId: string): Promise<SupabaseUser> {
  // Get current user profile
  const userProfile = await getUserProfile(userWalletAddress);
  const normalizedCreatorId = creatorId.trim();
  
  if (!userProfile) {
    throw new Error('User profile not found');
  }
  
  // Check if subscribed
  const currentChannels = userProfile.Channels || [];
  if (!currentChannels.some((channelCreatorId) => sameWalletAddress(channelCreatorId, normalizedCreatorId))) {
    // Not subscribed, return existing profile
    return userProfile;
  }
  
  // Remove creatorId from Channels array
  const updatedChannels = currentChannels.filter((id) => !sameWalletAddress(id, normalizedCreatorId));
  
  // Update user profile
  return await updateUserProfile(userProfile.creatorId, {
    Channels: updatedChannels,
  });
}

/**
 * Get subscribed channels for a user (returns array of stream data)
 */
export async function getSubscribedChannels(userWalletAddress: string): Promise<SupabaseStream[]> {
  const userProfile = await getUserProfile(userWalletAddress);
  
  if (!userProfile || !userProfile.Channels || userProfile.Channels.length === 0) {
    return [];
  }

  const uniqueCreatorIds = Array.from(
    new Set(userProfile.Channels.map((channelCreatorId) => normalizeWalletAddress(channelCreatorId)).filter(Boolean)),
  );
  
  // Fetch stream data for all subscribed creator IDs
  const creatorStreams = await Promise.all(
    uniqueCreatorIds.map(async (creatorId) => {
      try {
        const streams = await getStreamsByCreator(creatorId);
        // Return the first stream (or most recent one) for each creator
        return streams && streams.length > 0 ? streams[0] : null;
      } catch (error) {
        console.error(`Failed to fetch stream for creator ${creatorId}:`, error);
        return null;
      }
    })
  );
  
  // Filter out null values (failed fetches or creators with no streams)
  return creatorStreams.filter((stream): stream is SupabaseStream => stream !== null);
}

/**
 * Get subscribers for a creator
 */
export async function getSubscribers(creatorId: string): Promise<SupabaseUser[]> {
  const creatorIdNormalized = normalizeWalletAddress(creatorId);
  if (!creatorIdNormalized) return [];

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .contains('Channels', [creatorId])
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch subscribers: ${error.message}`);
  }

  const exactMatches = data || [];
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // Fallback for legacy rows where channel creator IDs are mixed-case in array values.
  const fallback = await supabase
    .from('users')
    .select('*')
    .not('Channels', 'is', null)
    .order('created_at', { ascending: false });

  if (fallback.error) {
    throw new Error(`Failed to fetch subscribers: ${fallback.error.message}`);
  }

  return (fallback.data || []).filter((user) => {
    const channels = Array.isArray(user?.Channels) ? user.Channels : [];
    return channels.some((channelCreatorId: string) => sameWalletAddress(channelCreatorId, creatorIdNormalized));
  });
}

export async function isUserSubscribedToCreator(
  userWalletAddress: string,
  creatorId: string,
): Promise<boolean> {
  if (!userWalletAddress || !creatorId) return false;

  const profile = await getUserProfile(userWalletAddress);
  const channels = profile?.Channels || [];

  return channels.some((channelCreatorId) => sameWalletAddress(channelCreatorId, creatorId));
}

export async function hasActiveStreamSubscription(
  playbackId: string,
  walletAddress: string,
): Promise<boolean> {
  if (!playbackId || !walletAddress) return false;

  const stream = await getStreamByPlaybackId(playbackId);
  if (!stream) return false;

  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);

  const paidUsers = Array.isArray(stream.Users) ? stream.Users : [];
  if (paidUsers.some((address) => sameWalletAddress(address, normalizedWalletAddress))) {
    return true;
  }

  const subscriptions = Array.isArray(stream.subscriptions) ? stream.subscriptions : [];
  if (subscriptions.length === 0) return false;

  const now = Date.now();
  return subscriptions.some((subscription) => {
    if (!sameWalletAddress(subscription?.subscriberAddress, normalizedWalletAddress)) {
      return false;
    }

    if (!subscription?.expiresAt) {
      return true;
    }

    const expiresAt = new Date(subscription.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

export async function getChannelChatEligibleAddresses(
  playbackId: string,
  creatorId: string,
): Promise<string[]> {
  const normalizedCreatorId = normalizeWalletAddress(creatorId);
  if (!normalizedCreatorId) return [];

  const isLikelyWalletAddress = (value: string | null | undefined) =>
    /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());

  const eligible = new Set<string>([normalizedCreatorId]);

  const followerSubscribers = await getSubscribers(normalizedCreatorId);
  for (const subscriber of followerSubscribers) {
    const address = normalizeWalletAddress(subscriber?.creatorId);
    if (isLikelyWalletAddress(address)) {
      eligible.add(address);
    }
  }

  const stream = await getStreamByPlaybackId(playbackId);
  if (stream) {
    const paidUsers = Array.isArray(stream.Users) ? stream.Users : [];
    for (const address of paidUsers) {
      const normalizedAddress = normalizeWalletAddress(address);
      if (isLikelyWalletAddress(normalizedAddress)) {
        eligible.add(normalizedAddress);
      }
    }

    const now = Date.now();
    const streamSubscriptions = Array.isArray(stream.subscriptions) ? stream.subscriptions : [];
    for (const subscription of streamSubscriptions) {
      const address = normalizeWalletAddress(subscription?.subscriberAddress);
      if (!isLikelyWalletAddress(address)) continue;

      if (!subscription?.expiresAt) {
        eligible.add(address);
        continue;
      }

      const expiresAt = new Date(subscription.expiresAt).getTime();
      if (Number.isFinite(expiresAt) && expiresAt > now) {
        eligible.add(address);
      }
    }
  }

  return Array.from(eligible);
}

/**
 * Get subscriber count for a creator (counts users who have this creatorId in their Channels array)
 */
export async function getSubscriberCount(creatorId: string): Promise<number> {
  try {
    const subscribers = await getSubscribers(creatorId);
    return subscribers.length;
  } catch (error) {
    console.error('Error getting subscriber count:', error);
    return 0;
  }
}

const CHANNEL_CHAT_MARKER_TITLE = '__xmtp_channel_group__';
const CHANNEL_CHAT_CLEARED_MARKER_TITLE = '__xmtp_channel_cleared_at__';
let channelChatGroupsTableUnavailable = false;
const CHANNEL_CHAT_TABLE_UNAVAILABLE_SESSION_KEY = 'tivibio_channel_chat_groups_table_unavailable';

export interface ChannelChatGroupMapping {
  playbackId: string;
  creatorId: string;
  xmtpGroupId: string;
}

const normalizeWalletAddress = (value: string | null | undefined): string =>
  String(value || '').trim().toLowerCase();

const sameWalletAddress = (left: string | null | undefined, right: string | null | undefined): boolean => {
  const normalizedLeft = normalizeWalletAddress(left);
  const normalizedRight = normalizeWalletAddress(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

function hydrateChannelChatTableAvailability() {
  if (channelChatGroupsTableUnavailable) return;
  if (typeof window === 'undefined') return;
  try {
    channelChatGroupsTableUnavailable =
      window.sessionStorage.getItem(CHANNEL_CHAT_TABLE_UNAVAILABLE_SESSION_KEY) === '1';
  } catch {
    // no-op
  }
}

function markChannelChatTableUnavailable() {
  channelChatGroupsTableUnavailable = true;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CHANNEL_CHAT_TABLE_UNAVAILABLE_SESSION_KEY, '1');
  } catch {
    // no-op
  }
}

function isMissingChannelChatTableError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  const status = Number(error?.status || error?.statusCode || 0);

  return (
    code === 'PGRST205' ||
    status === 404 ||
    message.includes('channel_chat_groups') ||
    details.includes('channel_chat_groups') ||
    message.includes('relation') && message.includes('does not exist')
  );
}

function parseMappedGroupFromNotifications(
  playbackId: string,
  notifications: Notification[] | null | undefined,
): ChannelChatGroupMapping | null {
  if (!Array.isArray(notifications)) return null;
  const marker = notifications.find((notification) => notification?.title === CHANNEL_CHAT_MARKER_TITLE);
  if (!marker) return null;

  const xmtpGroupId = String(marker.message || '').trim();
  const creatorId = String(marker.walletAddress || '').trim();
  if (!xmtpGroupId || !creatorId) return null;

  return {
    playbackId,
    creatorId,
    xmtpGroupId,
  };
}

async function getChannelChatGroupFromStreamMetadata(
  playbackId: string,
): Promise<ChannelChatGroupMapping | null> {
  const stream = await getStreamByPlaybackId(playbackId);
  if (!stream) return null;
  return parseMappedGroupFromNotifications(playbackId, stream.notifications as Notification[] | undefined);
}

async function persistChannelChatGroupOnStreamMetadata(
  payload: ChannelChatGroupMapping,
): Promise<ChannelChatGroupMapping> {
  const stream = await getStreamByPlaybackId(payload.playbackId);
  if (!stream) {
    throw new Error(`Failed to persist chat group mapping: stream ${payload.playbackId} not found.`);
  }

  const existingNotifications = Array.isArray(stream.notifications)
    ? [...(stream.notifications as Notification[])]
    : [];
  const filtered = existingNotifications.filter((notification) => notification?.title !== CHANNEL_CHAT_MARKER_TITLE);

  const marker: Notification = {
    type: 'other',
    title: CHANNEL_CHAT_MARKER_TITLE,
    message: payload.xmtpGroupId,
    walletAddress: payload.creatorId,
    createdAt: new Date().toISOString(),
    read: true,
  };

  filtered.unshift(marker);

  await updateStream(payload.playbackId, {
    notifications: filtered,
  } as any);

  return payload;
}

function parseChannelChatClearedAtFromNotifications(
  notifications: Notification[] | null | undefined,
): string | null {
  if (!Array.isArray(notifications)) return null;

  let latestMarker: Notification | null = null;
  for (const notification of notifications) {
    if (notification?.title !== CHANNEL_CHAT_CLEARED_MARKER_TITLE) continue;
    if (!latestMarker) {
      latestMarker = notification;
      continue;
    }

    const currentTs = new Date(String(notification.createdAt || notification.message || '')).getTime();
    const latestTs = new Date(String(latestMarker.createdAt || latestMarker.message || '')).getTime();
    if (Number.isFinite(currentTs) && (!Number.isFinite(latestTs) || currentTs > latestTs)) {
      latestMarker = notification;
    }
  }

  if (!latestMarker) return null;
  const candidate = String(latestMarker.message || latestMarker.createdAt || '').trim();
  const parsed = new Date(candidate).getTime();
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

/**
 * Get the channel chat clear marker timestamp.
 * Messages older than this timestamp should be hidden from UI history.
 */
export async function getChannelChatClearedAt(playbackId: string): Promise<string | null> {
  if (!playbackId) return null;
  const stream = await getStreamByPlaybackId(playbackId);
  if (!stream) return null;
  return parseChannelChatClearedAtFromNotifications(stream.notifications as Notification[] | undefined);
}

/**
 * Resolve channel-to-XMTP group mapping.
 * Prefers a dedicated mapping table and falls back to stream metadata marker.
 */
export async function getChannelChatGroupMapping(
  playbackId: string,
): Promise<ChannelChatGroupMapping | null> {
  if (!playbackId) return null;

  hydrateChannelChatTableAvailability();

  if (!channelChatGroupsTableUnavailable) {
    try {
      const { data, error } = await supabase
        .from('channel_chat_groups')
        .select('playback_id, creator_id, xmtp_group_id')
        .eq('playback_id', playbackId)
        .maybeSingle();

      if (error) {
        if (isMissingChannelChatTableError(error)) {
          markChannelChatTableUnavailable();
        } else {
          throw new Error(`Failed to fetch channel chat group mapping: ${error.message}`);
        }
      } else if (data) {
        const row = data as ChannelChatGroup;
        return {
          playbackId: row.playback_id,
          creatorId: row.creator_id,
          xmtpGroupId: row.xmtp_group_id,
        };
      }
    } catch (error: any) {
      if (isMissingChannelChatTableError(error)) {
        markChannelChatTableUnavailable();
      } else {
        throw error;
      }
    }
  }

  return await getChannelChatGroupFromStreamMetadata(playbackId);
}

/**
 * Persist channel-to-XMTP group mapping.
 * Uses dedicated table when available, otherwise stores hidden marker in stream notifications.
 */
export async function saveChannelChatGroupMapping(
  payload: ChannelChatGroupMapping,
): Promise<ChannelChatGroupMapping> {
  if (!payload?.playbackId || !payload?.creatorId || !payload?.xmtpGroupId) {
    throw new Error('Invalid channel chat mapping payload.');
  }

  hydrateChannelChatTableAvailability();

  if (!channelChatGroupsTableUnavailable) {
    try {
      const { error } = await supabase
        .from('channel_chat_groups')
        .upsert(
          {
            playback_id: payload.playbackId,
            creator_id: payload.creatorId,
            xmtp_group_id: payload.xmtpGroupId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'playback_id' },
        );

      if (error) {
        if (isMissingChannelChatTableError(error)) {
          markChannelChatTableUnavailable();
        } else {
          throw new Error(`Failed to save channel chat group mapping: ${error.message}`);
        }
      } else {
        return payload;
      }
    } catch (error: any) {
      if (isMissingChannelChatTableError(error)) {
        markChannelChatTableUnavailable();
      } else {
        throw error;
      }
    }
  }

  return await persistChannelChatGroupOnStreamMetadata(payload);
}

/**
 * Clear persisted channel chat history and set a clear marker timestamp.
 * XMTP network messages are not deleted; the marker is used to hide pre-clear history.
 */
export async function clearChannelChatHistory(
  playbackId: string,
  requesterCreatorId: string,
): Promise<string> {
  if (!playbackId) {
    throw new Error('Playback ID is required.');
  }
  if (!requesterCreatorId) {
    throw new Error('Creator wallet is required.');
  }

  const stream = await getStreamByPlaybackId(playbackId);
  if (!stream) {
    throw new Error('Stream not found.');
  }
  if (!sameWalletAddress(stream.creatorId, requesterCreatorId)) {
    throw new Error('Only the channel creator can clear chat history.');
  }

  await clearChatMessages(playbackId);

  const clearedAt = new Date().toISOString();
  const existingNotifications = Array.isArray(stream.notifications)
    ? [...(stream.notifications as Notification[])]
    : [];
  const filteredNotifications = existingNotifications.filter(
    (notification) => notification?.title !== CHANNEL_CHAT_CLEARED_MARKER_TITLE,
  );

  const marker: Notification = {
    type: 'other',
    title: CHANNEL_CHAT_CLEARED_MARKER_TITLE,
    message: clearedAt,
    walletAddress: requesterCreatorId,
    createdAt: clearedAt,
    read: true,
  };

  filteredNotifications.unshift(marker);

  await updateStream(playbackId, {
    notifications: filteredNotifications,
  } as any);

  return clearedAt;
}

/**
 * Mark a stream as terminated in Supabase.
 * Falls back gracefully if the isActive column isn't present.
 */
export async function markStreamTerminated(playbackId: string): Promise<void> {
  const primaryUpdate = await supabase
    .from('streams')
    .update({
      isActive: false,
      Record: false,
    } as any)
    .eq('playbackId', playbackId);

  if (!primaryUpdate.error) {
    return;
  }

  console.warn(`Primary stream termination update failed for ${playbackId}:`, primaryUpdate.error.message);

  const fallbackUpdate = await supabase
    .from('streams')
    .update({
      Record: false,
    } as any)
    .eq('playbackId', playbackId);

  if (fallbackUpdate.error) {
    throw new Error(`Failed to mark stream terminated: ${fallbackUpdate.error.message}`);
  }
}

/**
 * Set stream active state in Supabase with retry/fallback behavior.
 * This is used to sync creator broadcast status to viewer-facing UIs.
 */
export async function setStreamActiveStatus(playbackId: string, isActive: boolean): Promise<void> {
  if (!playbackId) return;

  const maxAttempts = 3;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await supabase
      .from('streams')
      .update({
        isActive,
        Record: isActive ? true : false,
      } as any)
      .eq('playbackId', playbackId);

    if (!error) return;
    lastError = error;

    if (attempt < maxAttempts) {
      await sleep(attempt * 350);
    }
  }

  // Fallback for schemas where isActive does not exist.
  const fallback = await supabase
    .from('streams')
    .update({
      Record: isActive ? true : false,
    } as any)
    .eq('playbackId', playbackId);

  if (fallback.error) {
    throw new Error(
      `Failed to set stream active status for ${playbackId}: ${fallback.error.message || lastError?.message || 'unknown error'}`,
    );
  }
}

// ==================== VIDEO OPERATIONS ====================

/**
 * Create a new video in Supabase
 */
export async function createVideo(videoData: VideoInsert): Promise<SupabaseVideo> {
  const { data, error } = await supabase
    .from('videos')
    .insert(videoData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create video: ${error.message}`);
  }

  return data;
}

/**
 * Get video by playback ID
 */
export async function getVideoByPlaybackId(playbackId: string): Promise<SupabaseVideo | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('playbackId', playbackId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch video: ${error.message}`);
  }

  return data;
}

/**
 * Get all videos for a creator
 */
export async function getVideosByCreator(creatorId: string): Promise<SupabaseVideo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('creatorId', creatorId);

  if (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all videos
 */
export async function getAllVideos(): Promise<SupabaseVideo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }

  return data || [];
}

/**
 * Update video by playback ID
 */
export async function updateVideo(
  playbackId: string,
  updates: VideoUpdate
): Promise<SupabaseVideo> {
  const { data, error } = await supabase
    .from('videos')
    .update(updates)
    .eq('playbackId', playbackId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update video: ${error.message}`);
  }

  return data;
}

/**
 * Delete video by playback ID
 */
export async function deleteVideo(playbackId: string): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .delete()
    .eq('playbackId', playbackId);

  if (error) {
    throw new Error(`Failed to delete video: ${error.message}`);
  }
}

/**
 * Add paying user to video
 */
export async function addPayingUserToVideo(
  playbackId: string,
  userAddress: string
): Promise<SupabaseVideo> {
  // First, get the current video
  const video = await getVideoByPlaybackId(playbackId);
  
  if (!video) {
    throw new Error('Video not found');
  }

  // Check if user is already in the Users array
  const currentUsers = video.Users || [];
  if (currentUsers.includes(userAddress)) {
    // User already added, return existing video
    return video;
  }

  // Add user to the array
  const updatedUsers = [...currentUsers, userAddress];

  // Update the video
  const { data, error } = await supabase
    .from('videos')
    .update({
      Users: updatedUsers,
    })
    .eq('playbackId', playbackId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add paying user: ${error.message}`);
  }

  return data;
}

/**
 * Add subscription to a video
 */
export async function addSubscriptionToVideo(
  playbackId: string,
  subscription: Subscription
): Promise<SupabaseVideo> {
  // First, get the current video
  const video = await getVideoByPlaybackId(playbackId);
  
  if (!video) {
    throw new Error('Video not found');
  }

  // Get current subscriptions array
  const currentSubscriptions = video.subscriptions || [];

  // Check if subscription already exists (same subscriber and txHash)
  const existingSubscription = currentSubscriptions.find(
    (sub: Subscription) => 
      sub.subscriberAddress.toLowerCase() === subscription.subscriberAddress.toLowerCase() &&
      sub.txHash === subscription.txHash
  );

  if (existingSubscription) {
    // Subscription already exists, return existing video
    return video;
  }

  // Add new subscription to the array
  const updatedSubscriptions = [...currentSubscriptions, subscription];

  // Update the video
  const { data, error } = await supabase
    .from('videos')
    .update({
      subscriptions: updatedSubscriptions,
    })
    .eq('playbackId', playbackId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add subscription: ${error.message}`);
  }

  return data;
}

/**
 * Add notification to a video
 */
export async function addNotificationToVideo(
  playbackId: string,
  notification: Notification
): Promise<SupabaseVideo> {
  // First, get the current video
  const video = await getVideoByPlaybackId(playbackId);
  
  if (!video) {
    throw new Error('Video not found');
  }

  // Get current notifications array
  const currentNotifications = video.notifications || [];

  // Add new notification to the beginning of the array (most recent first)
  const updatedNotifications = [notification, ...currentNotifications];

  // Update the video
  const { data, error } = await supabase
    .from('videos')
    .update({
      notifications: updatedNotifications,
    })
    .eq('playbackId', playbackId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add notification: ${error.message}`);
  }

  return data;
}

// ==================== CHAT OPERATIONS ====================

let chatsTableUnavailable = false;
const CHAT_UNAVAILABLE_SESSION_KEY = 'tivibio_chats_table_unavailable';

const syncChatsUnavailableFromSession = () => {
  if (chatsTableUnavailable) return;
  if (typeof window === 'undefined') return;
  try {
    chatsTableUnavailable = window.sessionStorage.getItem(CHAT_UNAVAILABLE_SESSION_KEY) === '1';
  } catch {
    // ignore sessionStorage access failures
  }
};

const markChatsUnavailable = () => {
  chatsTableUnavailable = true;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CHAT_UNAVAILABLE_SESSION_KEY, '1');
  } catch {
    // ignore sessionStorage access failures
  }
};

const isMissingChatsTableError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 404 ||
    error?.code === 'PGRST205' ||
    message.includes('404') ||
    message.includes('not found') ||
    (message.includes('relation') && message.includes('chats') && message.includes('does not exist')) ||
    message.includes('could not find the table')
  );
};

const isChatPermissionError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  const status = Number(error?.status || error?.statusCode || 0);

  return (
    status === 401 ||
    status === 403 ||
    code === '42501' ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    details.includes('row-level security') ||
    hint.includes('row-level security')
  );
};

const isChatsUnavailableError = (error: any): boolean =>
  isMissingChatsTableError(error) || isChatPermissionError(error);

export interface PersistChannelChatMessagePayload {
  streamId: string;
  sender: string;
  senderIdentifier: string;
  message: string;
  timestamp: string;
}

const shortIdentifier = (value: string): string => {
  const normalized = String(value || '').trim();
  if (normalized.length >= 10) {
    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  }
  return normalized || 'user';
};

const normalizeChatTimestamp = (value: string): string => {
  const candidate = new Date(String(value || '').trim());
  if (!Number.isFinite(candidate.getTime())) {
    return new Date().toISOString();
  }
  return candidate.toISOString();
};

/**
 * Persist a channel chat message with duplicate guard.
 */
export async function persistChannelChatMessage(
  payload: PersistChannelChatMessagePayload,
): Promise<void> {
  syncChatsUnavailableFromSession();
  if (chatsTableUnavailable) return;

  const streamId = String(payload.streamId || '').trim();
  const senderIdentifier = String(payload.senderIdentifier || '').trim();
  const message = String(payload.message || '').trim();
  const sender = String(payload.sender || '').trim() || shortIdentifier(senderIdentifier);
  const timestamp = normalizeChatTimestamp(payload.timestamp);

  if (!streamId || !senderIdentifier || !message) return;

  const duplicateLookup = await supabase
    .from('chats')
    .select('id')
    .eq('stream_id', streamId)
    .eq('wallet_address', senderIdentifier)
    .eq('message', message)
    .eq('timestamp', timestamp)
    .maybeSingle();

  if (duplicateLookup.error) {
    if (isChatsUnavailableError(duplicateLookup.error)) {
      markChatsUnavailable();
      return;
    }
    throw new Error(`Failed to check duplicate chat message: ${duplicateLookup.error.message}`);
  }

  if (duplicateLookup.data) {
    return;
  }

  const { error } = await supabase
    .from('chats')
    .insert({
      stream_id: streamId,
      sender,
      wallet_address: senderIdentifier,
      message,
      timestamp,
    });

  if (error) {
    if (isChatsUnavailableError(error)) {
      markChatsUnavailable();
      return;
    }
    throw new Error(`Failed to persist channel chat message: ${error.message}`);
  }
}

/**
 * Send a chat message
 */
export async function sendChatMessage(chatData: ChatInsert): Promise<SupabaseChat> {
  syncChatsUnavailableFromSession();
  if (chatsTableUnavailable) {
    throw new Error('Chat is unavailable in this environment.');
  }

  const { data, error } = await supabase
    .from('chats')
    .insert({
      ...chatData,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isChatsUnavailableError(error)) {
      markChatsUnavailable();
      throw new Error('Chat is unavailable in this environment.');
    }
    throw new Error(`Failed to send chat message: ${error.message}`);
  }

  return data;
}

/**
 * Get chat messages for a stream
 */
export async function getChatMessages(streamId: string): Promise<SupabaseChat[]> {
  syncChatsUnavailableFromSession();
  if (chatsTableUnavailable) {
    return [];
  }

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('stream_id', streamId)
    .order('timestamp', { ascending: true });

  if (error) {
    // Fail open for environments where chat table/migration is not present yet.
    if (isChatsUnavailableError(error)) {
      markChatsUnavailable();
      return [];
    }

    throw new Error(`Failed to fetch chat messages: ${error.message}`);
  }

  return data || [];
}

/**
 * Clear persisted chat rows for a stream.
 */
export async function clearChatMessages(streamId: string): Promise<void> {
  syncChatsUnavailableFromSession();
  if (chatsTableUnavailable) return;

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('stream_id', streamId);

  if (error) {
    if (isChatsUnavailableError(error)) {
      markChatsUnavailable();
      return;
    }
    throw new Error(`Failed to clear chat messages: ${error.message}`);
  }
}

/**
 * Get recent chat messages (with optional pagination)
 */
export async function getRecentChatMessages(
  streamId: string,
  limit: number = 50,
  lastMessageId?: string
): Promise<SupabaseChat[]> {
  syncChatsUnavailableFromSession();
  if (chatsTableUnavailable) {
    return [];
  }

  let query = supabase
    .from('chats')
    .select('*')
    .eq('stream_id', streamId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  // If lastMessageId is provided, fetch messages after that ID
  if (lastMessageId) {
    const lastMessage = await supabase
      .from('chats')
      .select('timestamp')
      .eq('id', lastMessageId)
      .single();

    if (lastMessage.data) {
      query = query.gt('timestamp', lastMessage.data.timestamp);
    }
  }

  const { data, error } = await query;

  if (error) {
    if (isChatsUnavailableError(error)) {
      markChatsUnavailable();
      return [];
    }
    throw new Error(`Failed to fetch recent chat messages: ${error.message}`);
  }

  // Reverse to get chronological order
  return (data || []).reverse();
}

/**
 * Subscribe to real-time chat messages for a stream
 */
export function subscribeToChatMessages(
  streamId: string,
  callback: (message: SupabaseChat) => void
) {
  syncChatsUnavailableFromSession();
  if (chatsTableUnavailable) {
    return () => {};
  }

  const channel = supabase
    .channel(`chat:${streamId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: `stream_id=eq.${streamId}`,
      },
      (payload) => {
        callback(payload.new as SupabaseChat);
      }
    )
    .subscribe((status, error) => {
      if (!error) return;
      if (isChatsUnavailableError(error)) {
        markChatsUnavailable();
      }
      if (status === 'CHANNEL_ERROR') {
        console.warn('Chat realtime subscription error:', error);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to stream row updates for a specific playback ID.
 */
export function subscribeToStreamStatus(
  playbackId: string,
  callback: (stream: SupabaseStream) => void,
) {
  const channel = supabase
    .channel(`stream:${playbackId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'streams',
        filter: `playbackId=eq.${playbackId}`,
      },
      (payload) => {
        callback((payload.new || payload.old) as SupabaseStream);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to stream row updates for every stream belonging to a creator.
 */
export function subscribeToCreatorStreamUpdates(
  creatorId: string,
  callback: (stream: SupabaseStream) => void,
) {
  const channel = supabase
    .channel(`creator-streams:${creatorId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'streams',
        filter: `creatorId=eq.${creatorId}`,
      },
      (payload) => {
        callback((payload.new || payload.old) as SupabaseStream);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
