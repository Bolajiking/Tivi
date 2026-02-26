/**
 * TypeScript interfaces for Supabase database tables
 * Based on actual Supabase schema
 */

// Stream table types
export interface SupabaseStream {
  id?: string; // UUID primary key (auto-generated)
  playbackId: string;
  isActive?: boolean | null;
  viewMode: 'free' | 'one-time' | 'monthly';
  description: string | null;
  amount: number | null;
  streamName: string;
  streamMode?: 'free' | 'one-time' | 'monthly' | null; // Stream mode for session
  streamAmount?: number | null; // Amount for one-time or monthly streams
  Record?: boolean | null; // Whether to record the stream
  creatorId: string;
  logo: string | null;
  title: string | null;
  bgcolor: string | null;
  color: string | null;
  fontSize: number | null;
  fontFamily?: string | null;
  socialLinks?: string[] | null; // Array of JSON strings like ["{\"twitter\":\"https://...\"}", "{\"instagram\":\"https://...\"}"]
  Users: string[]; // Array of paying user wallet addresses
  donations: number[]; // Array of donation preset amounts
  subscriptions?: Subscription[] | null; // Array of subscription objects
  notifications?: Notification[] | null; // Array of notification objects
  created_at?: string; // ISO timestamp
}

// Subscription object type
export interface Subscription {
  subscriberAddress: string; // Wallet address of the subscriber
  viewMode: 'free' | 'one-time' | 'monthly'; // Type of subscription
  amount: number; // Amount paid
  txHash: string; // Transaction hash
  subscribedAt: string; // ISO timestamp
  expiresAt?: string | null; // ISO timestamp (null for one-time, set for monthly)
}

// Notification object type
export interface Notification {
  type: 'payment' | 'subscription' | 'donation' | 'other'; // Type of notification
  title: string; // Notification title
  message: string; // Notification message
  walletAddress: string; // Wallet address related to the notification
  txHash?: string | null; // Transaction hash if applicable
  amount?: number | null; // Amount if applicable
  createdAt: string; // ISO timestamp
  read?: boolean; // Whether the notification has been read
}

// User/Profile table types
export interface SupabaseUser {
  id?: string; // UUID primary key (auto-generated)
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  socialLinks: string[]; // Array of JSON strings like ["{\"twitter\":\"https://...\"}", "{\"instagram\":\"https://...\"}"]
  creatorId: string; // Wallet address (unique)
  Channels: string[]; // Array of stream playback IDs
  created_at?: string; // ISO timestamp
}

// Creator invite code table types
export interface CreatorInviteCode {
  id?: string; // UUID primary key (auto-generated)
  code: string; // Unique invite code (recommended uppercase)
  is_active?: boolean | null;
  max_uses?: number | null;
  used_count?: number | null;
  expires_at?: string | null; // ISO timestamp
  created_at?: string; // ISO timestamp
}

// Creator access grant table types
export interface CreatorAccessGrant {
  creator_id: string; // Wallet address
  invite_code: string; // Invite code used to unlock creator access
  granted_at?: string; // ISO timestamp
  created_at?: string; // ISO timestamp
}

// Channel chat group mapping table (optional migration-backed table)
export interface ChannelChatGroup {
  playback_id: string;
  creator_id: string;
  xmtp_group_id: string;
  created_at?: string;
  updated_at?: string;
}

// Video table types (inferred from code usage)
export interface SupabaseVideo {
  id?: string; // UUID primary key (auto-generated)
  playbackId: string;
  viewMode: 'free' | 'one-time' | 'monthly';
  description?: string | null;
  amount: number | null;
  assetName: string;
  creatorId: string;
  logo?: string | null;
  title?: string | null;
  bgcolor?: string | null;
  color?: string | null;
  fontSize?: number | null;
  fontFamily?: string | null;
  Users: string[]; // Array of paying user wallet addresses
  donations: number[]; // Array of donation preset amounts
  subscriptions?: Subscription[] | null; // Array of subscription objects
  notifications?: Notification[] | null; // Array of notification objects
  disabled?: boolean;
  created_at?: string; // ISO timestamp
}

// Chat table types (inferred from code usage)
export interface SupabaseChat {
  id?: string; // UUID primary key (auto-generated)
  stream_id: string; // playbackId
  sender: string; // Shortened wallet address
  wallet_address: string; // Full wallet address
  message: string;
  timestamp?: string; // ISO timestamp
  created_at?: string; // ISO timestamp
}

// Helper types for database operations
export type StreamInsert = Omit<SupabaseStream, 'id' | 'created_at'>;
export type StreamUpdate = Partial<Omit<SupabaseStream, 'id' | 'playbackId' | 'created_at'>>;

export type UserInsert = Omit<SupabaseUser, 'id' | 'created_at'>;
export type UserUpdate = Partial<Omit<SupabaseUser, 'id' | 'creatorId' | 'created_at'>>;

export type CreatorInviteCodeInsert = Omit<CreatorInviteCode, 'id' | 'created_at'>;
export type CreatorInviteCodeUpdate = Partial<Omit<CreatorInviteCode, 'id' | 'code' | 'created_at'>>;

export type CreatorAccessGrantInsert = Omit<CreatorAccessGrant, 'granted_at' | 'created_at'> & {
  granted_at?: string;
};

export type VideoInsert = Omit<SupabaseVideo, 'id' | 'created_at'>;
export type VideoUpdate = Partial<Omit<SupabaseVideo, 'id' | 'playbackId' | 'created_at'>>;

export type ChatInsert = Omit<SupabaseChat, 'id' | 'created_at' | 'timestamp'>;
