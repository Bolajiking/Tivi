'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { useEffect, useMemo, useState } from 'react';
import { getAllStreams } from '@/features/streamAPI';
import { RiVideoAddLine } from 'react-icons/ri';
import { MdExplore } from 'react-icons/md';
import * as Dialog from '@radix-ui/react-dialog';
import { IoMdClose } from 'react-icons/io';
import { hasCreatorInviteAccess, redeemCreatorInviteCode } from '@/lib/supabase-service';
import { toast } from 'sonner';

interface SidebarBottomLinksProps {
  sidebarCollapsed?: boolean;
  onCreateChannel?: () => void; // Optional callback for create channel action
}

const SidebarBottomLinks = ({ sidebarCollapsed, onCreateChannel }: SidebarBottomLinksProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const { user, authenticated, ready } = usePrivy();
  const { streams } = useSelector((state: RootState) => state.streams);
  const isDashboard = pathname === '/dashboard';
  const [hasCreatorAccess, setHasCreatorAccess] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);

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

  const isLoggedIn = authenticated && ready && !!creatorAddress;

  // Fetch streams to check if user has created one
  useEffect(() => {
    if (isLoggedIn) {
      dispatch(getAllStreams());
    }
  }, [dispatch, isLoggedIn]);

  // Check if user has created a stream
  const hasCreatedStream = useMemo(() => {
    if (!creatorAddress || !streams.length) return false;
    const userStreams = streams.filter(
      (stream: any) => !!stream.playbackId && stream.creatorId?.value === creatorAddress
    );
    return userStreams.length > 0;
  }, [streams, creatorAddress]);

  useEffect(() => {
    const checkCreatorAccess = async () => {
      if (!creatorAddress) {
        setHasCreatorAccess(false);
        return;
      }

      if (hasCreatedStream) {
        setHasCreatorAccess(true);
        return;
      }

      try {
        const allowed = await hasCreatorInviteAccess(creatorAddress);
        setHasCreatorAccess(allowed);
      } catch (error: any) {
        setHasCreatorAccess(false);
        console.error('Failed to check creator invite access:', error);
      }
    };

    checkCreatorAccess();
  }, [creatorAddress, hasCreatedStream]);

  const navigateToChannelCreationForm = () => {
    // Always route to the channel setup form after invite redemption.
    // Optional callback still fires for side effects, but must not block navigation.
    onCreateChannel?.();
    router.push('/dashboard/settings?openChannelSetup=1');
  };

  const handleRedeemInviteCode = async () => {
    if (!creatorAddress) {
      toast.error('Wallet not connected.');
      return;
    }

    if (!inviteCode.trim()) {
      toast.error('Enter invite code.');
      return;
    }

    try {
      setRedeemingCode(true);
      await redeemCreatorInviteCode(creatorAddress, inviteCode);
      setHasCreatorAccess(true);
      setInviteCode('');
      setInviteModalOpen(false);
      toast.success('Invite code redeemed. Creator access granted.');
      navigateToChannelCreationForm();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to redeem invite code.');
    } finally {
      setRedeemingCode(false);
    }
  };

  const handleCreateChannel = () => {
    if (!isLoggedIn) {
      router.push('/auth/login');
      return;
    }

    if (!hasCreatorAccess) {
      setInviteModalOpen(true);
      return;
    }

    navigateToChannelCreationForm();
  };

  return (
    <div className="p-2">
      {/* Create Channel Link - Only visible if user hasn't created a stream */}
      {!hasCreatedStream && (
        <button
          onClick={handleCreateChannel}
          className={clsx(
            'w-full flex items-center rounded-md py-2 gap-2 px-3 transition-all duration-200 mb-1.5 border border-white/15 bg-white/5',
            'text-gray-50 hover:text-gray-50 hover:bg-white/15',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <RiVideoAddLine className="inline-block h-4 w-4 text-yellow-300" />
          {!sidebarCollapsed && <p className="text-xs font-semibold tracking-wide">Create Channel</p>}
        </button>
      )}
      
      {/* Explore Link */}
      <Link
        href="/streamviews"
        className={clsx(
          'flex items-center rounded-md py-2 gap-2 px-3 transition-all duration-200 border border-white/10',
          'text-gray-50 hover:text-gray-50 hover:bg-white/15',
          sidebarCollapsed && 'justify-center'
        )}
      >
        <MdExplore className="inline-block h-4 w-4 text-teal-300" />
        {!sidebarCollapsed && <p className="text-xs font-semibold tracking-wide">Explore</p>}
      </Link>

      <Dialog.Root open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm" />
          <Dialog.Content
            data-sidebar-dialog="true"
            className="fixed left-1/2 top-1/2 z-[121] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/20 bg-gray-900/95 p-6 shadow-2xl"
          >
            <Dialog.Title className="text-lg font-bold text-white">Creator Invite Required</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-300">
              Enter your invite code to unlock channel creation.
            </Dialog.Description>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleRedeemInviteCode}
                disabled={redeemingCode}
                className="w-full rounded-lg bg-gradient-to-r from-yellow-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black hover:from-yellow-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {redeemingCode ? 'Redeeming...' : 'Continue'}
              </button>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-2.5 top-2.5 inline-flex size-[26px] items-center justify-center rounded-full text-white hover:bg-white/10"
                aria-label="Close"
              >
                <IoMdClose className="text-2xl" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default SidebarBottomLinks;
