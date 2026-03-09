'use client';

import Image from 'next/image';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy, useLogout } from '@privy-io/react-auth';
import { formatEther } from 'viem';
import { toast } from 'sonner';
import { FaRegUserCircle, FaShoppingBag } from 'react-icons/fa';
import { IoSettingsOutline } from 'react-icons/io5';
import { MdOutlineLogout } from 'react-icons/md';
import { Wallet, RefreshCw, Copy, X } from 'lucide-react';
import { setWalletAddress } from '@/features/userSlice';
import { useDispatch } from 'react-redux';
import { getUserProfile } from '@/lib/supabase-service';
import type { SupabaseUser } from '@/lib/supabase-types';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

interface SidebarUserPanelProps {
  onClose: () => void;
  variant?: 'full' | 'sheet';
  open?: boolean;
}

export default function SidebarUserPanel({
  onClose,
  variant = 'full',
  open = true,
}: SidebarUserPanelProps) {
  const navigate = useRouter();
  const dispatch = useDispatch();
  const { user, ready, login, authenticated } = usePrivy();
  const { logout } = useLogout({
    onSuccess: () => {
      toast.success('Successfully logged out');
      navigate.push('/dashboard');
    },
  });
  const { walletAddress: resolvedWalletAddress, wallets } = useWalletAddress();

  const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>('profile');
  const [userProfile, setUserProfile] = useState<SupabaseUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [walletBalance, setWalletBalance] = useState('0.0000');
  const [loadingBalance, setLoadingBalance] = useState(false);

  const creatorAddress = useMemo(() => resolvedWalletAddress || null, [resolvedWalletAddress]);

  useEffect(() => {
    if (!ready || !resolvedWalletAddress) return;
    dispatch(setWalletAddress(resolvedWalletAddress));
  }, [dispatch, ready, resolvedWalletAddress]);

  useEffect(() => {
    const fetchUser = async () => {
      if (!creatorAddress || !ready) return;

      try {
        setLoadingProfile(true);
        const profile = await getUserProfile(creatorAddress);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUser();

    const handleProfileUpdate = () => {
      fetchUser();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [creatorAddress, ready]);

  const fetchWalletBalance = useCallback(async () => {
    if (!resolvedWalletAddress || !ready) return;

    try {
      setLoadingBalance(true);
      const walletObj: any =
        wallets.find(
          (wallet: any) =>
            wallet.walletClientType === 'privy' || wallet.clientType === 'privy',
        ) || wallets[0];

      if (!walletObj) {
        setWalletBalance('0.0000');
        return;
      }

      const provider = await walletObj.getEthereumProvider();
      if (!provider) {
        setWalletBalance('0.0000');
        return;
      }

      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [resolvedWalletAddress, 'latest'],
      });

      const balanceInEth = formatEther(BigInt(balance));
      setWalletBalance(parseFloat(balanceInEth).toFixed(4));
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setWalletBalance('0.0000');
    } finally {
      setLoadingBalance(false);
    }
  }, [ready, resolvedWalletAddress, wallets]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const panelClasses =
    variant === 'sheet'
      ? clsx(
          'absolute inset-x-0 bottom-0 z-40 flex h-auto max-h-[calc(100%-8px)] flex-col rounded-t-2xl border border-white/[0.07] bg-[#0f0f0f] shadow-2xl transition-all duration-300 ease-out',
          open
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none',
        )
      : 'flex h-full flex-col rounded-xl border border-white/[0.07] bg-[#0f0f0f]';

  const bodyClasses = clsx('flex-1 p-3 overflow-y-auto');

  return (
    <div className={panelClasses}>
      <div className="flex items-center justify-between border-b border-white/[0.07] px-2 py-2">
        <div className="inline-flex rounded-lg border border-white/[0.07] bg-[#141414] p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={clsx(
              'px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors',
              activeTab === 'profile' ? 'bg-[#1f1f1f] text-white' : 'text-gray-300 hover:text-white',
            )}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className={clsx(
              'px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors',
              activeTab === 'wallet' ? 'bg-[#1f1f1f] text-white' : 'text-gray-300 hover:text-white',
            )}
          >
            Mobile Purse
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.07] bg-[#181818] text-gray-300 hover:text-white hover:bg-[#222] transition-colors"
          aria-label="Close profile panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className={bodyClasses}>
        {activeTab === 'profile' ? (
          <div className="flex h-full flex-col">
            {!ready || !authenticated ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <FaRegUserCircle className="mb-3 text-4xl text-gray-500" />
                <p className="text-sm text-gray-300">Sign in to manage your profile.</p>
                <button
                  type="button"
                  onClick={() => login()}
                  className="mt-4 w-full rounded-lg bg-gradient-to-r from-yellow-400 to-teal-500 px-3 py-2 text-sm font-semibold text-black"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <>
                <div className="mb-2 rounded-lg border border-white/[0.07] bg-[#161616] p-3 text-center">
                  {loadingProfile ? (
                    <div className="mx-auto h-14 w-14 animate-pulse rounded-full bg-white/10" />
                  ) : userProfile?.avatar ? (
                    <div className="mx-auto h-14 w-14 overflow-hidden rounded-full border border-white/[0.07]">
                      <Image
                        src={userProfile.avatar}
                        alt="Profile"
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.07] bg-[#101010]">
                      <FaRegUserCircle className="text-2xl text-yellow-400" />
                    </div>
                  )}
                  <p className="mt-2 truncate text-sm font-semibold text-white">
                    {userProfile?.displayName ||
                      user?.email?.address?.split('@')[0] ||
                      user?.google?.email?.split('@')[0] ||
                      'Member'}
                  </p>
                  <p className="truncate text-[11px] text-gray-400">
                    {user?.email?.address || user?.google?.email || 'Wallet user'}
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => navigate.push('/dashboard/profile')}
                    className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-[#161616] px-3 py-2 text-left text-sm text-white hover:bg-[#202020] transition-colors"
                  >
                    <IoSettingsOutline className="text-base text-gray-300" />
                    <span>Account Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate.push('/dashboard/order-history')}
                    className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-[#161616] px-3 py-2 text-left text-sm text-white hover:bg-[#202020] transition-colors"
                  >
                    <FaShoppingBag className="text-sm text-gray-300" />
                    <span>Order History</span>
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <MdOutlineLogout className="text-base" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {!ready || !authenticated ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Wallet className="mb-3 h-7 w-7 text-yellow-400" />
                <p className="text-sm text-gray-300">Sign in to access your mobile purse.</p>
                <button
                  type="button"
                  onClick={() => login()}
                  className="mt-4 w-full rounded-lg bg-gradient-to-r from-yellow-400 to-teal-500 px-3 py-2 text-sm font-semibold text-black"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-white/[0.07] bg-[#161616] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">Balance</span>
                    <button
                      type="button"
                      onClick={() => fetchWalletBalance()}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.07] bg-[#101010] text-gray-300 hover:text-white transition-colors"
                      aria-label="Refresh wallet balance"
                    >
                      <RefreshCw className={clsx('h-3.5 w-3.5', loadingBalance && 'animate-spin')} />
                    </button>
                  </div>
                  <p className="text-xl font-semibold text-white">
                    {loadingBalance ? 'Loading...' : `${walletBalance} ETH`}
                  </p>
                </div>

                {resolvedWalletAddress ? (
                  <div className="mt-3 rounded-lg border border-white/[0.07] bg-[#161616] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-wide text-gray-400">
                        Wallet
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(resolvedWalletAddress);
                          toast.success('Wallet copied');
                        }}
                        className="inline-flex h-6 items-center gap-1 rounded-md border border-white/[0.07] bg-[#101010] px-2 text-[10px] text-gray-200 hover:text-white"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                    <p className="break-all text-[11px] text-gray-300">{resolvedWalletAddress}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
