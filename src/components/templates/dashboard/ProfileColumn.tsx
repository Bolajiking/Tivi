'use client';

import { Copy, User } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useProfile } from '@/app/hook/useProfile';

export function ProfileColumn() {
  const { profile: profileData, loading, hasProfile, creatorAddress } = useProfile();
  const solanaWalletAddress = useSelector((state: RootState) => state.user.solanaWalletAddress);

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
      <div className="w-64 p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-white/20 rounded-lg"></div>
          <div className="h-4 bg-white/20 rounded w-3/4"></div>
          <div className="h-4 bg-white/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[400px] p-4 px-10  bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg space-y-4">
      {hasProfile && profileData ? (
        <>
          {/* Profile Image */}
          <div className="flex justify-center">
            {profileData.avatar ? (
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-yellow-400">
                <Image
                  src={profileData.avatar}
                  alt={profileData.displayName || 'Profile'}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-yellow-500/30 to-teal-500/30 flex items-center justify-center border-2 border-yellow-400">
                <User className="w-12 h-12 text-yellow-400" />
              </div>
            )}
          </div>

          {/* Profile Name */}
          <div className="text-center">
            <h3 className="text-white font-bold text-lg">{profileData.displayName}</h3>
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

          {/* Bio Preview */}
          {profileData.bio && (
           <div className='w-full '>Bio : <p className="text-gray-300 text-sm">{profileData.bio}</p></div>
          )}

          {/* View Profile Link */}
          <div className='w-full flex justify-center text-center'>
          <Link
            href='/dashboard/settings'
            className="w-full py-2 px-4 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors text-sm font-medium"
          >
            Edit Profile
          </Link>
          </div>
        </>
      ) : (
        /* No Profile State */
        <div className="text-center flex flex-col space-y-4">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto border-2 border-dashed border-white/30">
            <User className="w-12 h-12 text-white/40" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-semibold">Complete Your Profile</h3>
            <p className="text-gray-400 text-sm">
              Add your display name, bio, and profile image to personalize your channel.
            </p>
          </div>
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
          <Link
            href='/dashboard/settings'
            className="w-[50%] mx-auto py-2 px-4 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors text-sm  font-medium"
          >
            Set Up Profile
          </Link>
        </div>
      )}
    </div>
  );
}

