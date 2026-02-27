'use client';

import { Copy, User, Settings, LogOut, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { useLogout } from '@privy-io/react-auth';
import { useEffect, useMemo, useState } from 'react';
import { getUserProfile } from '@/lib/supabase-service';
import { SupabaseUser } from '@/lib/supabase-types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useRouter } from 'next/navigation';
import { formatEther } from 'viem';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

export function ProfileColumn() {
  const { walletAddress } = useWalletAddress();
  const router = useRouter();
  const { logout } = useLogout({
    onSuccess: () => {
      toast.success('Successfully logged out');
      router.push('/');
    },
  });
  const [userProfile, setUserProfile] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Get creator address (wallet address)
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const creatorAddress = useMemo(() => walletAddress || null, [walletAddress]);

  // Fetch user profile from users table
  useEffect(() => {
    if (!creatorAddress) {
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const profile = await getUserProfile(creatorAddress);
        setUserProfile(profile);
      } catch (error: any) {
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchUserProfile();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [creatorAddress]);

  const handleCopyAddress = async () => {
    if (!creatorAddress) return;
    try {
      await navigator.clipboard.writeText(creatorAddress);
      toast.success('Wallet address copied!');
    } catch {
      toast.error('Failed to copy address');
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!creatorAddress) return;
      
      try {
        setLoadingBalance(true);
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        });
        
        const balance = await publicClient.getBalance({
          address: creatorAddress as `0x${string}`,
        });
        
        const formattedBalance = formatEther(balance);
        setWalletBalance(parseFloat(formattedBalance).toFixed(4));
      } catch (error) {
        console.error('Error fetching wallet balance:', error);
        setWalletBalance('0');
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [creatorAddress]);

  const handleSignOut = () => {
    logout();
  };

  if (loading) {
    return (
      <div className="w-[400px] p-4 px-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-white/20 rounded-full mx-auto w-24"></div>
          <div className="h-4 bg-white/20 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-white/20 rounded w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-fit p-4 px-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg space-y-4">
      {/* Profile Image */}
      <div className="flex flex-col items-center gap-2">
        {userProfile?.avatar ? (
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-yellow-400">
            <Image
              src={userProfile.avatar}
              alt="Profile"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-yellow-500/30 to-teal-500/30 flex items-center justify-center border-2 border-yellow-400">
            <User className="w-12 h-12 text-yellow-400" />
          </div>
        )}
        {/* Display Name */}
        {userProfile?.displayName && (
          <h3 className="text-white font-bold text-lg">{userProfile.displayName}</h3>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full bg-white/5 border border-white/10 rounded-lg p-1">
          <TabsTrigger 
            value="profile" 
            className="flex-1 text-gray-400 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="wallet" 
            className="flex-1 text-gray-400 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            Wallet
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab Content */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          {/* Profile Settings Link */}
          <Link
            href="/dashboard/profile"
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors text-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2 px-4  hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </TabsContent>

        {/* Wallet Tab Content */}
        <TabsContent value="wallet" className="mt-4 space-y-4">
          {/* Wallet Address */}
          {creatorAddress && (
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Wallet Address</label>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-gray-300 text-sm font-mono truncate">{formatAddress(creatorAddress)}</span>
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="p-2 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  <Copy className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          )}

          {/* Wallet Balance */}
          {creatorAddress && (
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wide">Balance</label>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                {loadingBalance ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-pulse h-4 w-20 bg-white/20 rounded"></div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-white text-lg font-semibold">{walletBalance}</span>
                    <span className="text-gray-400 text-sm">ETH</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
