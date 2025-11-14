import { createAsyncThunk } from '@reduxjs/toolkit';
import { getUserProfile, upsertUserProfile, updateUserProfile } from '../lib/supabase-service';
import type { SupabaseUser } from '../lib/supabase-types';

export interface ProfileData {
  displayName: string;
  bio: string;
  avatar: string;
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    website?: string;
  };
  theme: {
    backgroundColor: string;
    textColor: string;
    accentColor: string;
  };
  isPublic: boolean;
}

// Helper function to convert ProfileData to Supabase format
function profileDataToSupabase(creatorAddress: string, profileData: ProfileData): {
  creatorId: string;
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  socialLinks: string[];
  Channels: string[];
} {
  // Convert socialLinks object to array of JSON strings
  // Format: ["{\"twitter\":\"https://...\"}", "{\"instagram\":\"https://...\"}"]
  const socialLinksArray: string[] = [];
  if (profileData.socialLinks.twitter) {
    socialLinksArray.push(JSON.stringify({ twitter: profileData.socialLinks.twitter }));
  }
  if (profileData.socialLinks.instagram) {
    socialLinksArray.push(JSON.stringify({ instagram: profileData.socialLinks.instagram }));
  }
  if (profileData.socialLinks.youtube) {
    socialLinksArray.push(JSON.stringify({ youtube: profileData.socialLinks.youtube }));
  }
  if (profileData.socialLinks.website) {
    socialLinksArray.push(JSON.stringify({ website: profileData.socialLinks.website }));
  }

  return {
    creatorId: creatorAddress,
    displayName: profileData.displayName || null,
    bio: profileData.bio || null,
    avatar: profileData.avatar || null,
    socialLinks: socialLinksArray,
    Channels: [], // Will be populated separately if needed
  };
}

// Helper function to convert Supabase format to ProfileData
function supabaseToProfileData(supabaseUser: SupabaseUser | null): ProfileData | null {
  if (!supabaseUser) return null;

  // Convert socialLinks from array of JSON strings to object format
  // Input format: ["{\"twitter\":\"https://...\"}", "{\"instagram\":\"https://...\"}"]
  // Output format: {twitter: "https://...", instagram: "https://..."}
  const socialLinks: ProfileData['socialLinks'] = {};
  
  if (Array.isArray(supabaseUser.socialLinks)) {
    supabaseUser.socialLinks.forEach((jsonString) => {
      if (typeof jsonString === 'string') {
        try {
          const parsed = JSON.parse(jsonString);
          // Each parsed object has one key-value pair like {"twitter": "https://..."}
          Object.keys(parsed).forEach((key) => {
            const value = parsed[key];
            if (key === 'twitter' && value) {
              socialLinks.twitter = value;
            } else if (key === 'instagram' && value) {
              socialLinks.instagram = value;
            } else if (key === 'youtube' && value) {
              socialLinks.youtube = value;
            } else if (key === 'website' && value) {
              socialLinks.website = value;
            }
          });
        } catch (e) {
          // If parsing fails, skip this entry
          console.warn('Failed to parse social link JSON:', jsonString);
        }
      }
    });
  }

  return {
    displayName: supabaseUser.displayName || '',
    bio: supabaseUser.bio || '',
    avatar: supabaseUser.avatar || '',
    socialLinks,
    theme: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      accentColor: '#0000ff',
    },
    isPublic: true, // Default to public
  };
}

// Fetch profile by creator address
export const fetchProfile = createAsyncThunk(
  'profile/fetchProfile',
  async (creatorAddress: string, { rejectWithValue }) => {
    try {
      const supabaseUser = await getUserProfile(creatorAddress);
      const profileData = supabaseToProfileData(supabaseUser);
      return profileData;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch profile');
    }
  }
);

// Update profile
export const updateProfile = createAsyncThunk(
  'profile/updateProfile',
  async ({ creatorAddress, profileData }: { creatorAddress: string; profileData: ProfileData }, { rejectWithValue }) => {
    try {
      // First, get existing profile to preserve Channels
      const existingProfile = await getUserProfile(creatorAddress);
      const existingChannels = existingProfile?.Channels || [];
      
      // Convert profile data to Supabase format, preserving existing Channels
      const supabaseData = profileDataToSupabase(creatorAddress, profileData);
      supabaseData.Channels = existingChannels; // Preserve existing channels
      
      // Update the profile
      await updateUserProfile(creatorAddress, supabaseData);
      
      // Refetch the profile from Supabase to get the actual saved data
      const updatedUser = await getUserProfile(creatorAddress);
      const convertedProfile = supabaseToProfileData(updatedUser);
      
      return convertedProfile || profileData;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update profile');
    }
  }
);

// Create new profile
export const createProfile = createAsyncThunk(
  'profile/createProfile',
  async ({ creatorAddress, profileData }: { creatorAddress: string; profileData: ProfileData }, { rejectWithValue }) => {
    try {
      // First, get existing profile to preserve Channels if profile already exists
      const existingProfile = await getUserProfile(creatorAddress);
      const existingChannels = existingProfile?.Channels || [];
      
      // Convert profile data to Supabase format, preserving existing Channels
      const supabaseData = profileDataToSupabase(creatorAddress, profileData);
      supabaseData.Channels = existingChannels; // Preserve existing channels
      
      // Upsert the profile
      await upsertUserProfile(supabaseData);
      
      // Refetch the profile from Supabase to get the actual saved data
      const createdUser = await getUserProfile(creatorAddress);
      const convertedProfile = supabaseToProfileData(createdUser);
      
      return convertedProfile || profileData;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create profile');
    }
  }
);

