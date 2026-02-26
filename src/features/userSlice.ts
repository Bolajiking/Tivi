import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  walletAddress: string | null;
}

const initialState: UserState = {
  walletAddress: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setWalletAddress: (state, action: PayloadAction<string>) => {
      state.walletAddress = action.payload;
    },
  },
});

export const { setWalletAddress } = userSlice.actions;
export default userSlice.reducer;
