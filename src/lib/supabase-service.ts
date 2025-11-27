/**
 * Supabase service layer with helper functions for database operations
 */
import supabase from '../../supabase';
import type {
  SupabaseStream,
  SupabaseUser,
  SupabaseVideo,
  SupabaseChat,
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

/**
 * Upload an image file to Supabase Storage
 * @param img - The image file to upload
 * @param bucketName - The storage bucket name (default: 'images')
 * @returns The public URL of the uploaded image, or empty string on error
 */
export async function uploadImage(img: File, bucketName: string = 'images'): Promise<string> {
  // Sanitize filename to avoid issues
  const sanitizedFileName = img.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${sanitizedFileName}-${Date.now()}`;
  
  // Upload with public access
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, img, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) {
    console.error('Image upload error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name
    });
    
    // Provide more helpful error message
    if (error.message.includes('row-level security') || error.message.includes('RLS')) {
      throw new Error(`Storage bucket "${bucketName}" has RLS enabled. Please disable RLS on the storage bucket in Supabase dashboard, or add a policy that allows uploads.`);
    }
    if (error.message.includes('not found') || error.message.includes('404')) {
      throw new Error(`Storage bucket "${bucketName}" not found. Please create the bucket in Supabase dashboard.`);
    }
    
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  // Get public URL
  const { data: urlData } = await supabase.storage.from(bucketName).getPublicUrl(filePath);
  return urlData.publicUrl || '';
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
  const { data, error } = await supabase
    .from('streams')
    .select('*')
    .eq('creatorId', creatorId);

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

/**
 * Get user profile by creator ID (wallet address)
 */
export async function getUserProfile(creatorId: string): Promise<SupabaseUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('creatorId', creatorId)
    .single();

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
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('creatorId', creatorId)
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
  
  if (!userProfile) {
    // Create a new profile if it doesn't exist
    const newProfile: UserInsert = {
      creatorId: userWalletAddress,
      displayName: null,
      bio: null,
      avatar: null,
      socialLinks: [],
      Channels: [creatorId],
    };
    return await createUserProfile(newProfile);
  }
  
  // Check if already subscribed
  const currentChannels = userProfile.Channels || [];
  if (currentChannels.includes(creatorId)) {
    // Already subscribed, return existing profile
    return userProfile;
  }
  
  // Add creatorId to Channels array
  const updatedChannels = [...currentChannels, creatorId];
  
  // Update user profile
  return await updateUserProfile(userWalletAddress, {
    Channels: updatedChannels,
  });
}

/**
 * Unsubscribe from a creator (remove creatorId from user's Channels array)
 */
export async function unsubscribeFromCreator(userWalletAddress: string, creatorId: string): Promise<SupabaseUser> {
  // Get current user profile
  const userProfile = await getUserProfile(userWalletAddress);
  
  if (!userProfile) {
    throw new Error('User profile not found');
  }
  
  // Check if subscribed
  const currentChannels = userProfile.Channels || [];
  if (!currentChannels.includes(creatorId)) {
    // Not subscribed, return existing profile
    return userProfile;
  }
  
  // Remove creatorId from Channels array
  const updatedChannels = currentChannels.filter((id) => id !== creatorId);
  
  // Update user profile
  return await updateUserProfile(userWalletAddress, {
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
  
  // Fetch stream data for all subscribed creator IDs
  const creatorStreams = await Promise.all(
    userProfile.Channels.map(async (creatorId) => {
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

/**
 * Send a chat message
 */
export async function sendChatMessage(chatData: ChatInsert): Promise<SupabaseChat> {
  const { data, error } = await supabase
    .from('chats')
    .insert({
      ...chatData,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to send chat message: ${error.message}`);
  }

  return data;
}

/**
 * Get chat messages for a stream
 */
export async function getChatMessages(streamId: string): Promise<SupabaseChat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('stream_id', streamId)
    .order('timestamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch chat messages: ${error.message}`);
  }

  return data || [];
}

/**
 * Get recent chat messages (with optional pagination)
 */
export async function getRecentChatMessages(
  streamId: string,
  limit: number = 50,
  lastMessageId?: string
): Promise<SupabaseChat[]> {
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
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

