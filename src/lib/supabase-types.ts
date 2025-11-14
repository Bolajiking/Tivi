/**
 * TypeScript interfaces for Supabase database tables
 * Based on actual Supabase schema
 */

// Stream table types
export interface SupabaseStream {
  id?: string; // UUID primary key (auto-generated)
  playbackId: string;
  viewMode: 'free' | 'one-time' | 'monthly';
  description: string | null;
  amount: number | null;
  streamName: string;
  creatorId: string;
  logo: string | null;
  title: string | null;
  bgcolor: string | null;
  color: string | null;
  fontSize: number | null;
  fontFamily?: string | null;
  Users: string[]; // Array of paying user wallet addresses
  donations: number[]; // Array of donation preset amounts
  created_at?: string; // ISO timestamp
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
  disabled?: boolean;
  created_at?: string; // ISO timestamp
}

// Chat table types (inferred from code usage)
export interface SupabaseChat {
  id?: string; // UUID primary key (auto-generated)
  streamId: string; // playbackId
  sender: string; // Shortened wallet address
  walletAddress: string; // Full wallet address
  message: string;
  timestamp?: string; // ISO timestamp
  created_at?: string; // ISO timestamp
}

// Helper types for database operations
export type StreamInsert = Omit<SupabaseStream, 'id' | 'created_at'>;
export type StreamUpdate = Partial<Omit<SupabaseStream, 'id' | 'playbackId' | 'created_at'>>;

export type UserInsert = Omit<SupabaseUser, 'id' | 'created_at'>;
export type UserUpdate = Partial<Omit<SupabaseUser, 'id' | 'creatorId' | 'created_at'>>;

export type VideoInsert = Omit<SupabaseVideo, 'id' | 'created_at'>;
export type VideoUpdate = Partial<Omit<SupabaseVideo, 'id' | 'playbackId' | 'created_at'>>;

export type ChatInsert = Omit<SupabaseChat, 'id' | 'created_at' | 'timestamp'>;

