import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MdOutlineLogout } from 'react-icons/md';
import { useRouter } from 'next/navigation';
import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { FaRegUserCircle, FaShoppingBag } from 'react-icons/fa';
import { IoSettingsOutline } from 'react-icons/io5';
import { toast } from 'sonner';
import { formatEther } from 'viem';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useDispatch } from 'react-redux';
import { setWalletAddress } from '@/features/userSlice';
import { getUserProfile } from '@/lib/supabase-service';
import type { SupabaseUser } from '@/lib/supabase-types';
import Image from 'next/image';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

const Header = ({ toggleMenu, mobileOpen }: { toggleMenu: () => void; mobileOpen: boolean; title?: string }) => {
  const navigate = useRouter();
  const { user, ready, login, authenticated } = usePrivy();
  const { walletAddress: resolvedWalletAddress, wallets } = useWalletAddress();
  const [walletAddress, setLocalWalletAddress] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>('profile');
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [showTopUp, setShowTopUp] = useState(false);
  const [userProfile, setUserProfile] = useState<SupabaseUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string>('0.00');
  const [loadingBalance, setLoadingBalance] = useState(false);
  const dispatch = useDispatch();

  // Get creator address from linked accounts
  const creatorAddress = useMemo(() => resolvedWalletAddress || null, [resolvedWalletAddress]);

  // Get existing Ethereum wallet on login/ready (no creation - Privy handles that automatically)
  useEffect(() => {
    if (!ready || !resolvedWalletAddress) return;
    setLocalWalletAddress(resolvedWalletAddress);
    dispatch(setWalletAddress(resolvedWalletAddress));
  }, [ready, resolvedWalletAddress, dispatch]);

  // Fetch user profile from Supabase
  useEffect(() => {
    const fetchUserProfile = async () => {
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

    fetchUserProfile();

    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchUserProfile();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [creatorAddress, ready]);

  // Fetch wallet balance
  const fetchWalletBalance = useCallback(async () => {
    if (!walletAddress || !ready) return;

    try {
      setLoadingBalance(true);
      // Find the wallet to get provider
      const walletObj: any = wallets.find((wallet: any) =>
        wallet.walletClientType === 'privy' || wallet.clientType === 'privy'
      ) || wallets[0];

      if (walletObj) {
        const provider = await walletObj.getEthereumProvider();
        if (provider) {
          const balance = await provider.request({
            method: 'eth_getBalance',
            params: [walletAddress, 'latest'],
          });
          // Convert from wei to ETH and format
          const balanceInEth = formatEther(BigInt(balance));
          setWalletBalance(parseFloat(balanceInEth).toFixed(4));
        }
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setWalletBalance('0.00');
    } finally {
      setLoadingBalance(false);
    }
  }, [walletAddress, wallets, ready]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const { logout: handleLogout } = useLogout({
    onSuccess: () => {
      toast.success('Successfully logged out');
      navigate.push('/');
    },
  });

  return (
    <>
      <header className="fixed top-3 left-3 right-3 z-30 pointer-events-none">
        <div className="flex justify-between items-start">
          <div className="pointer-events-auto">
            <button
              onClick={toggleMenu}
              className="md:hidden inline-flex items-center justify-center rounded-full border border-white/20 bg-black/45 p-2 text-white backdrop-blur-sm"
            >
              {mobileOpen ? <X className="h-7 w-7 text-white" /> : <Menu className="h-7 w-7 text-white" />}
            </button>
          </div>

          <div className="flex items-center justify-end gap-4 pointer-events-auto ml-auto">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center justify-center rounded-full border border-white/20 bg-black/45 p-1 hover:bg-white/10 transition-colors backdrop-blur-sm">
                  {ready && walletAddress ? (
                    userProfile?.avatar ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-yellow-400">
                        <Image
                          src={userProfile.avatar}
                          alt="Profile"
                          width={32}
                          height={32}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <FaRegUserCircle className="text-2xl text-yellow-400" />
                    )
                  ) : (
                    <FaRegUserCircle className="text-2xl text-gray-400" />
                  )}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[450px] max-w-[500px] rounded-2xl mr-2 z-10 bg-black/95 backdrop-blur-sm border border-white/20 p-0 shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade data-[side=right]:animate-slideLeftAndFade data-[side=top]:animate-slideDownAndFade"
                  sideOffset={5}
                >
                  {/* Tab Headers */}
                  <div className="flex border-b border-white/20">
                    <button
                      onClick={() => setActiveTab('profile')}
                      className={clsx(
                        'flex-1 px-6 py-4 text-base font-medium transition-colors relative',
                        activeTab === 'profile'
                          ? 'text-white'
                          : 'text-gray-400 hover:text-gray-300'
                      )}
                    >
                      Profile
                      {activeTab === 'profile' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('wallet')}
                      className={clsx(
                        'flex-1 px-6 py-4 text-base font-medium transition-colors relative',
                        activeTab === 'wallet'
                          ? 'text-white'
                          : 'text-gray-400 hover:text-gray-300'
                      )}
                    >
                      Mobile Purse
                      {activeTab === 'wallet' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                      )}
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-4 min-h-[300px]">
                    {activeTab === 'profile' ? (
                      /* Profile Tab */
                      <div className="flex flex-col items-center">
                        {!ready || !authenticated ? (
                          /* Sign In State for Unauthenticated Users */
                          <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 flex items-center justify-center">
                              <FaRegUserCircle className="text-4xl text-gray-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Welcome to TVinBio</h3>
                            <p className="text-gray-400 text-sm text-center mb-6 max-w-xs">
                              Sign in to create your channel, go live, and start earning from your content.
                            </p>
                            <button
                              onClick={() => login()}
                              className="w-full max-w-xs bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold py-3 px-6 rounded-xl transition-colors text-base"
                            >
                              Sign In
                            </button>
                            <p className="text-gray-500 text-xs mt-3">
                              Connect with wallet, email, or Farcaster
                            </p>
                          </div>
                        ) : (
                          /* Authenticated User Profile */
                          <>
                            {/* User Avatar and Info */}
                            <div className="mb-6 text-center">
                              {loadingProfile ? (
                                <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white/10 animate-pulse" />
                              ) : userProfile?.avatar ? (
                                <div className="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden border-2 border-yellow-400">
                                  <Image
                                    src={userProfile.avatar}
                                    alt="Profile"
                                    width={80}
                                    height={80}
                                    className="object-cover w-full h-full"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center">
                                  <FaRegUserCircle className="text-4xl text-black" />
                                </div>
                              )}
                              <h3 className="text-xl font-semibold text-white mb-1">
                                {userProfile?.displayName || user?.email?.address?.split('@')[0] || user?.google?.email?.split('@')[0] || 'Member'}
                              </h3>
                              <p className="text-gray-400 text-xs">
                                {user?.email?.address || user?.google?.email || 'No email connected'}
                              </p>
                              <div className="mt-2 inline-block px-3 py-1 bg-yellow-900/30 border border-yellow-700/50 rounded-full">
                                <span className="text-yellow-400 text-xs font-medium">Member</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="w-full space-y-2">
                              <button
                                onClick={() => {
                                  navigate.push('/dashboard/profile');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                              >
                                <IoSettingsOutline className="text-lg text-white" />
                                <span className="text-white text-sm font-medium">Account Settings</span>
                              </button>

                              <button
                                onClick={() => {
                                  navigate.push('/dashboard/order-history');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                              >
                                <FaShoppingBag className="text-lg text-white" />
                                <span className="text-white text-sm font-medium">Order History</span>
                              </button>

                              <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/20 hover:bg-red-900/30 border border-red-700/50 transition-colors"
                              >
                                <MdOutlineLogout className="text-lg text-red-400" />
                                <span className="text-red-400 text-sm font-medium">Sign Out</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      /* Mobile Purse Tab */
                      <div className="flex flex-col">
                        {!ready || !authenticated ? (
                          /* Sign In State for Unauthenticated Users */
                          <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 border border-yellow-700/30 flex items-center justify-center">
                              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Mobile Purse</h3>
                            <p className="text-gray-400 text-sm text-center mb-6 max-w-xs">
                              Sign in to access your wallet, view balances, and manage your funds.
                            </p>
                            <button
                              onClick={() => login()}
                              className="w-full max-w-xs bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold py-3 px-6 rounded-xl transition-colors text-base"
                            >
                              Sign In to Continue
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Available Balance Card */}
                            <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 border border-yellow-700/30 rounded-xl p-4 mb-4">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-gray-300 text-xs">Available Balance</p>
                                <button
                                  onClick={() => fetchWalletBalance()}
                                  disabled={loadingBalance}
                                  className="text-gray-400 hover:text-white transition-colors p-1"
                                  title="Refresh balance"
                                >
                                  <svg className={`w-4 h-4 ${loadingBalance ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                              </div>
                              <div className="flex items-baseline gap-2 mb-4">
                                {loadingBalance ? (
                                  <div className="h-9 w-32 bg-white/10 animate-pulse rounded" />
                                ) : (
                                  <>
                                    <h2 className="text-3xl font-bold text-white">{walletBalance}</h2>
                                    <span className="text-gray-400 text-sm">ETH</span>
                                  </>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setShowTopUp(!showTopUp)}
                                  className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-black font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 text-sm"
                                >
                                  <span className="text-lg">{showTopUp ? '−' : '+'}</span>
                                  Add Funds
                                </button>
                                <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 border border-white/20 text-sm">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                  Send
                                </button>
                              </div>
                            </div>

                            {/* Wallet Address */}
                            {walletAddress && (
                          <div className="mb-4">
                            <p className="text-gray-400 text-xs mb-2">Wallet Address</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                value={walletAddress}
                                className="flex-1 border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs font-mono"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(walletAddress);
                                  toast.success('Copied to clipboard');
                                }}
                                className="px-3 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black font-semibold rounded-lg transition-colors whitespace-nowrap text-xs"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Quick Top Up - Expandable */}
                        {showTopUp && (
                          <div className="animate-in slide-in-from-top-2 duration-200">
                            <h3 className="text-gray-300 text-xs font-semibold mb-2 uppercase tracking-wide">Quick Top Up</h3>
                            <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-400 text-xl">$</span>
                                <input
                                  type="text"
                                  value={topUpAmount}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                      setTopUpAmount(value);
                                    }
                                  }}
                                  placeholder="0.00"
                                  className="flex-1 bg-transparent text-gray-400 text-2xl font-light outline-none"
                                />
                              </div>
                            </div>

                            {/* Quick Amount Buttons */}
                            <div className="flex gap-2 mb-3">
                              {['10', '20', '50'].map((amount) => (
                                <button
                                  key={amount}
                                  onClick={() => setTopUpAmount(amount)}
                                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/20 text-white py-2 rounded-lg transition-colors text-sm"
                                >
                                  +${amount}
                                </button>
                              ))}
                            </div>

                            {/* Pay Button */}
                            <button className="w-full bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold py-3 rounded-xl transition-colors text-base">
                              Pay
                            </button>

                            <p className="text-center text-gray-500 text-xs mt-2">
                              Secured by Stripe & Circle. Funds available instantly.
                            </p>
                          </div>
                        )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
