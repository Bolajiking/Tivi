'use client';

import { Copy, User, Settings } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useMemo, useState } from 'react';
import { getUserProfile } from '@/lib/supabase-service';
import { SupabaseUser } from '@/lib/supabase-types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

export function ProfileColumn() {
  const { user } = usePrivy();
  const [userProfile, setUserProfile] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Get creator address (wallet address)
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const creatorAddress = useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length === 0) return null;
    
    // Check if primary login method is a wallet
    const firstAccount = user.linkedAccounts[0];
    if (firstAccount.type === 'wallet' && 'address' in firstAccount && firstAccount.address) {
      return firstAccount.address;
    }
    
    // Find a wallet from linked accounts
    const walletAccount = user.linkedAccounts.find((account: any) => account.type === 'wallet' && 'address' in account && account.address);
    if (walletAccount && 'address' in walletAccount && walletAccount.address) {
      return walletAccount.address;
    }
    
    return null;
  }, [user?.linkedAccounts]);

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

      {/* Wallet Address */}
      {creatorAddress && (
        <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-sm font-mono">{formatAddress(creatorAddress)}</span>
          </div>
          <button
            onClick={handleCopyAddress}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Copy address"
          >
            <Copy className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Profile Link */}
      <Link
        href="/dashboard/profile"
        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors text-sm font-medium"
      >
        <Settings className="w-4 h-4" />
      
      </Link>

      {/* Tabs */}
      <Tabs defaultValue="archives" className="w-full">
        <TabsList className="w-full bg-white/5 border border-white/10 rounded-lg p-1">
          <TabsTrigger 
            value="archives" 
            className="flex-1 text-gray-400 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-md transition-colors"
          >
            Archives
          </TabsTrigger>
          <TabsTrigger 
            value="transactions" 
            className="flex-1 text-gray-400 data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-md transition-colors"
          >
            Transactions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="archives" className="mt-4 text-center py-8">
          <p className="text-gray-400 text-sm">Not archived yet</p>
        </TabsContent>
        <TabsContent value="transactions" className="mt-4 text-center py-8">
          <p className="text-gray-400 text-sm">Not transacted yet</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

