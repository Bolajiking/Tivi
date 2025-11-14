import { createSlice } from '@reduxjs/toolkit';
import { fetchProfile, updateProfile, createProfile, ProfileData } from './profileAPI';

interface ProfileState {
  profile: ProfileData | null;
  loading: boolean;
  error: string | null;
  lastFetchedAddress: string | null;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  error: null,
  lastFetchedAddress: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearProfile: (state) => {
      state.profile = null;
      state.error = null;
      state.lastFetchedAddress = null;
    },
    updateLocalProfile: (state, action) => {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch profile
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.error = null;
        state.lastFetchedAddress = action.meta.arg;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch profile';
        state.profile = null;
      })
      // Update profile
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.error = null;
        // Update lastFetchedAddress to match the updated profile
        state.lastFetchedAddress = action.meta.arg.creatorAddress;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to update profile';
      })
      // Create profile
      .addCase(createProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.error = null;
        state.lastFetchedAddress = action.meta.arg.creatorAddress;
      })
      .addCase(createProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to create profile';
      });
  },
});

export const { clearProfile, updateLocalProfile } = profileSlice.actions;
export default profileSlice.reducer;

