// assetsSlice.ts
import { createSlice } from '@reduxjs/toolkit';
import { getAssets, requestAssetUpload, deleteAsset } from './assetsAPI';
import { deleteStream } from './streamAPI';
import { Asset } from '@/interfaces/index';

interface AssetsState {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AssetsState = {
  assets: [],
  loading: false,
  error: null,
  success: false,
};

const assetsSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {
    resetAssetStatus: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAssets.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAssets.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.assets = action.payload;
      })
      .addCase(deleteStream.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteStream.fulfilled, (state, action) => {
        state.assets = state.assets.filter((asset) => asset.id !== action.payload);
        state.loading = false;
        state.success = true;
        // Add logic to remove the asset from the state when a stream is deleted
      })
      .addCase(deleteStream.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to delete asset';
      })

      .addCase(getAssets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch assets';
      })
      .addCase(deleteAsset.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteAsset.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.assets = state.assets.filter((asset) => asset.id !== action.payload);
      })
      .addCase(deleteAsset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete asset';
      })
      .addCase(requestAssetUpload.pending, (state) => {
        state.loading = true;
      })
      .addCase(requestAssetUpload.fulfilled, (state) => {
        state.loading = false;
        // Optionally update state here if you want to track the upload request status
      })
      .addCase(requestAssetUpload.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to request asset upload';
      });
  },
});
export const { resetAssetStatus } = assetsSlice.actions;
export default assetsSlice.reducer;
