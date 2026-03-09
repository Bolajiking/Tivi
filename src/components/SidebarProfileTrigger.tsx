'use client';

import Image from 'next/image';
import { FaRegUserCircle } from 'react-icons/fa';
import { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getUserProfile } from '@/lib/supabase-service';
import type { SupabaseUser } from '@/lib/supabase-types';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

interface SidebarProfileTriggerProps {
  onClick: () => void;
  compact?: boolean;
}

export default function SidebarProfileTrigger({ onClick, compact = false }: SidebarProfileTriggerProps) {
  const { ready } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const creatorAddress = useMemo(() => walletAddress || null, [walletAddress]);
  const [userProfile, setUserProfile] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!creatorAddress || !ready) return;
      try {
        const profile = await getUserProfile(creatorAddress);
        setUserProfile(profile);
      } catch {
        setUserProfile(null);
      }
    };

    fetchUserProfile();
  }, [creatorAddress, ready]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center rounded-full border border-white/[0.07] bg-[#0f0f0f] hover:bg-[#1a1a1a] transition-colors ${
        compact ? 'p-0.5' : 'p-1'
      }`}
      aria-label="Open profile panel"
      title="Profile"
    >
      {ready && userProfile?.avatar ? (
        <div className={`rounded-full overflow-hidden border-2 border-white/[0.07] ${compact ? 'w-7 h-7' : 'w-8 h-8'}`}>
          <Image
            src={userProfile.avatar}
            alt="Profile"
            width={compact ? 28 : 32}
            height={compact ? 28 : 32}
            className="object-cover w-full h-full"
            unoptimized
          />
        </div>
      ) : (
        <FaRegUserCircle className={compact ? 'text-xl text-yellow-400' : 'text-2xl text-yellow-400'} />
      )}
    </button>
  );
}

