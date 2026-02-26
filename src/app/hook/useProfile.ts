import { useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { usePrivy } from '@privy-io/react-auth';
import { RootState, AppDispatch } from '@/store/store';
import { fetchProfile } from '@/features/profileAPI';

/**
 * Custom hook to access and manage profile data from Redux store
 * Automatically fetches profile if not already loaded for the current creator address
 */
export function useProfile() {
  const { user } = usePrivy();
  const dispatch = useDispatch<AppDispatch>();
  const walletAddress = useSelector((state: RootState) => state.user.walletAddress);
  const { profile, loading, error, lastFetchedAddress } = useSelector((state: RootState) => state.profile);

  const creatorAddress = useMemo(
    () => (user?.wallet?.chainType === 'solana' ? user.wallet.address : walletAddress),
    [user?.wallet?.address, walletAddress]
  );

  // Automatically fetch profile if not already loaded for this address
  useEffect(() => {
    if (!creatorAddress) return;
    
    // Only fetch if address changed or profile not loaded
    if (lastFetchedAddress !== creatorAddress) {
      dispatch(fetchProfile(creatorAddress));
    }
  }, [creatorAddress, lastFetchedAddress, dispatch]);

  return {
    profile,
    loading,
    error,
    hasProfile: !!profile,
    creatorAddress,
  };
}
