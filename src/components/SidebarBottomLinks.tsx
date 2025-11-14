'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { useEffect, useMemo } from 'react';
import { getAllStreams } from '@/features/streamAPI';
import { RiVideoAddLine } from 'react-icons/ri';
import { MdExplore } from 'react-icons/md';

interface SidebarBottomLinksProps {
  sidebarCollapsed?: boolean;
  onCreateChannel?: () => void; // Optional callback for create channel action
}

const SidebarBottomLinks = ({ sidebarCollapsed, onCreateChannel }: SidebarBottomLinksProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const { user, authenticated, ready } = usePrivy();
  const solanaWalletAddress = useSelector((state: RootState) => state.user.solanaWalletAddress);
  const { streams } = useSelector((state: RootState) => state.streams);
  const isDashboard = pathname === '/dashboard';

  // Get current user's wallet address
  const currentUserAddress =
    user?.wallet?.chainType === 'solana' && user?.wallet?.address
      ? user.wallet.address
      : solanaWalletAddress || '';

  const isLoggedIn = authenticated && ready && !!currentUserAddress;

  // Fetch streams to check if user has created one
  useEffect(() => {
    if (isLoggedIn) {
      dispatch(getAllStreams());
    }
  }, [dispatch, isLoggedIn]);

  // Check if user has created a stream
  const hasCreatedStream = useMemo(() => {
    if (!currentUserAddress || !streams.length) return false;
    const userStreams = streams.filter(
      (stream: any) => !!stream.playbackId && stream.creatorId?.value === currentUserAddress
    );
    return userStreams.length > 0;
  }, [streams, currentUserAddress]);

  const handleCreateChannel = () => {
    if (isDashboard) {
      // If on dashboard page, dispatch custom event to open modal
      window.dispatchEvent(new CustomEvent('openCreateChannelModal'));
    } else {
      // If on public page (creator profile), redirect to dashboard
      // If not logged in, they'll be redirected to login by AuthGuard
      router.push('/dashboard');
    }
  };

  return (
    <div className="p-4">
      {/* Create Channel Link - Only visible if user hasn't created a stream */}
      {!hasCreatedStream && (
        <button
          onClick={handleCreateChannel}
          className={clsx(
            'w-full flex items-center rounded-md py-3 gap-3 px-4 transition-all duration-200 mb-2',
            'text-gray-50 hover:text-gray-50 hover:bg-white/20',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <RiVideoAddLine className="inline-block h-5 w-5" />
          {!sidebarCollapsed && <p className="font-bold">Create Channel</p>}
        </button>
      )}
      
      {/* Explore Link */}
      <Link
        href="/streamviews"
        className={clsx(
          'flex items-center rounded-md py-3 gap-3 px-4 transition-all duration-200',
          'text-gray-50 hover:text-gray-50 hover:bg-white/20',
          sidebarCollapsed && 'justify-center'
        )}
      >
        <MdExplore className="inline-block h-5 w-5" />
        {!sidebarCollapsed && <p className="font-bold">Explore</p>}
      </Link>
    </div>
  );
};

export default SidebarBottomLinks;

