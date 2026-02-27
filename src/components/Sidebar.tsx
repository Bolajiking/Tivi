'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BsFillBarChartLineFill } from 'react-icons/bs';
import { CiStreamOn } from 'react-icons/ci';
import { FaSackDollar } from 'react-icons/fa6';
import { IoSettings } from 'react-icons/io5';
import { RiEditFill } from 'react-icons/ri';
import { TbHomeFilled } from 'react-icons/tb';
import { usePrivy } from '@privy-io/react-auth';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getSubscribedChannels, getStreamsByCreator, getUserProfile, getUserProfileByUsername, subscribeToCreator } from '@/lib/supabase-service';
import { SupabaseStream, SupabaseUser } from '@/lib/supabase-types';
import { useChannel } from '@/context/ChannelContext';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HiPlus, HiDotsVertical } from 'react-icons/hi';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import dynamic from 'next/dynamic';

// Dynamically import ChannelOptionsMenu to avoid SSR issues with Radix useContext
const ChannelOptionsMenu = dynamic(() => import('./ChannelOptionsMenu'), {
  ssr: false,
  loading: () => <div className="w-4 h-4" />,
});

interface SidebarProps {
  sidebarCollapsed?: boolean;
  isInstallable?: boolean;
  onInstallClick?: () => void;
  isMobileView?: boolean;
  onChannelOptionsClick?: (
    channel: SupabaseStream,
    options?: { isOwned?: boolean; profileIdentifier?: string },
  ) => void;
}

const Sidebar = ({ sidebarCollapsed, isInstallable, onInstallClick, isMobileView = false, onChannelOptionsClick }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const { selectedChannelId, setSelectedChannelId } = useChannel();
  // Check if we're in the dashboard context
  const isInDashboard = pathname?.startsWith('/dashboard');
  const [subscribedChannels, setSubscribedChannels] = useState<SupabaseStream[]>([]);
  const [ownedChannels, setOwnedChannels] = useState<SupabaseStream[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingOwnedChannels, setLoadingOwnedChannels] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [creatorIdToUsername, setCreatorIdToUsername] = useState<Record<string, string>>({});
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [channelUrl, setChannelUrl] = useState('');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [foundCreator, setFoundCreator] = useState<SupabaseUser | null>(null);
  const [foundChannel, setFoundChannel] = useState<SupabaseStream | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [selectedChannelForOptions, setSelectedChannelForOptions] = useState<SupabaseStream | null>(null);
  const deferredPromptRef = useRef<any>(null);

  // Keep ref in sync with state
  useEffect(() => {
    deferredPromptRef.current = deferredPrompt;
  }, [deferredPrompt]);

  // Handle PWA install for a specific channel
  const handleInstallPWA = async (channel: SupabaseStream) => {
    const prompt = deferredPromptRef.current;
    if (prompt) {
      try {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          toast.success(`Installing ${channel.title || channel.streamName || 'channel'}...`);
        }
        setDeferredPrompt(null);
        deferredPromptRef.current = null;
      } catch (error) {
        console.error('PWA install error:', error);
        toast.error('Unable to install. Try adding to home screen from browser menu.');
      }
    } else {
      // Fallback: show instructions for manual install
      toast.info('To install: Open browser menu → "Add to Home Screen" or "Install App"');
    }
    setSelectedChannelForOptions(null);
  };

  // Listen for PWA install prompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      deferredPromptRef.current = e;
    };

    const handleInstallChannel = (e: Event) => {
      const customEvent = e as CustomEvent<SupabaseStream>;
      if (customEvent.detail) {
        handleInstallPWA(customEvent.detail);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('installChannel', handleInstallChannel);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('installChannel', handleInstallChannel);
    };
  }, []);

  // Handle share channel
  const handleShareChannel = async (channel: SupabaseStream, profileIdentifier: string) => {
    let creatorRouteId = profileIdentifier;
    if (!creatorRouteId || creatorRouteId === channel.creatorId) {
      try {
        const profile = await getUserProfile(channel.creatorId);
        creatorRouteId = profile?.displayName?.trim() || '';
      } catch (error) {
        console.error('Error resolving creator username for share:', error);
      }
    }

    if (!creatorRouteId) {
      toast.error('Creator username unavailable for this channel.');
      return;
    }

    const channelUrl = `${window.location.origin}/creator/${encodeURIComponent(creatorRouteId)}`;
    const channelName = channel.title || channel.streamName || 'Channel';

    if (navigator.share) {
      try {
        await navigator.share({
          title: channelName,
          text: `Check out ${channelName} on TVinBio!`,
          url: channelUrl,
        });
      } catch (error) {
        // User cancelled or error
        if ((error as Error).name !== 'AbortError') {
          navigator.clipboard.writeText(channelUrl);
          toast.success('Link copied to clipboard!');
        }
      }
    } else {
      navigator.clipboard.writeText(channelUrl);
      toast.success('Link copied to clipboard!');
    }
    setSelectedChannelForOptions(null);
  };

  const handleChannelSettings = (channel: SupabaseStream) => {
    if (channel.playbackId) {
      setSelectedChannelId(channel.playbackId);
    }

    router.push(
      channel.playbackId
        ? `/dashboard/settings?channelId=${encodeURIComponent(channel.playbackId)}`
        : '/dashboard/settings',
    );
  };

  // Get current user's wallet address
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const currentUserAddress = useMemo(() => walletAddress || '', [walletAddress]);

  const isLoggedIn = authenticated && ready && !!currentUserAddress;

  useEffect(() => {
    const fetchCurrentUsername = async () => {
      if (!isLoggedIn || !currentUserAddress) {
        setCurrentUsername('');
        return;
      }

      try {
        const profile = await getUserProfile(currentUserAddress);
        setCurrentUsername(profile?.displayName?.trim() || '');
      } catch (error) {
        console.error('Failed to fetch current username:', error);
        setCurrentUsername('');
      }
    };

    fetchCurrentUsername();
  }, [isLoggedIn, currentUserAddress]);

  // Fetch subscribed channels
  useEffect(() => {
    const fetchSubscribedChannels = async () => {
      if (!isLoggedIn || !currentUserAddress) {
        setSubscribedChannels([]);
        return;
      }

      setLoadingChannels(true);
      try {
        const channels = await getSubscribedChannels(currentUserAddress);
        // console.log('channels', channels);
        setSubscribedChannels(channels);
        
        // Fetch usernames for all unique creator IDs
        const uniqueCreatorIds = Array.from(new Set(channels.map(ch => ch.creatorId)));
        const usernameMap: Record<string, string> = {};
        
        await Promise.all(
          uniqueCreatorIds.map(async (creatorId) => {
            try {
              const profile = await getUserProfile(creatorId);
              if (profile?.displayName) {
                usernameMap[creatorId] = profile.displayName;
              }
            } catch (error) {
              console.error(`Failed to fetch username for ${creatorId}:`, error);
            }
          })
        );
        
        setCreatorIdToUsername(usernameMap);
      } catch (error) {
        console.error('Failed to fetch subscribed channels:', error);
      } finally {
        setLoadingChannels(false);
      }
    };

    fetchSubscribedChannels();
  }, [isLoggedIn, currentUserAddress]);

  // Fetch owned channels
  useEffect(() => {
    const fetchOwnedChannels = async () => {
      if (!isLoggedIn || !currentUserAddress) {
        setOwnedChannels([]);
        return;
      }

      setLoadingOwnedChannels(true);
      try {
        const channels = await getStreamsByCreator(currentUserAddress);
        setOwnedChannels(channels);
      } catch (error) {
        console.error('Failed to fetch owned channels:', error);
      } finally {
        setLoadingOwnedChannels(false);
      }
    };

    fetchOwnedChannels();
  }, [isLoggedIn, currentUserAddress, pathname]);

  const handleAddChannel = () => {
    if (!isLoggedIn) {
      setShowSignupModal(true);
      return;
    }
    setShowAddChannelModal(true);
  };

  // Parse URL to extract creator identifier
  const parseCreatorUrl = (url: string): string | null => {
    try {
      // Remove any trailing slashes and whitespace
      const cleanUrl = url.trim().replace(/\/$/, '');
      
      // Match pattern: /creator/[id] or /creator/[id]/
      const match = cleanUrl.match(/\/creator\/([^\/\?]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
      
      // If it's just the ID without the full URL, return it
      if (!cleanUrl.includes('/')) {
        return cleanUrl;
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing URL:', error);
      return null;
    }
  };

  // Validate and fetch creator profile
  const handleValidateUrl = async () => {
    if (!channelUrl.trim()) {
      toast.error('Please enter a channel URL');
      return;
    }

    setIsValidatingUrl(true);
    setFoundCreator(null);
    setFoundChannel(null);

    try {
      const creatorIdentifier = parseCreatorUrl(channelUrl);
      
      if (!creatorIdentifier) {
        toast.error('Invalid URL format. Please use: /creator/[id] or https://origin/creator/[id]');
        setIsValidatingUrl(false);
        return;
      }

      // Try to get user profile by username first, then by wallet address
      let creatorProfile: SupabaseUser | null = null;
      
      try {
        creatorProfile = await getUserProfileByUsername(creatorIdentifier);
      } catch (error) {
        // If username lookup fails, try wallet address
        try {
          creatorProfile = await getUserProfile(creatorIdentifier);
        } catch (err) {
          console.error('Error fetching creator profile:', err);
        }
      }

      if (!creatorProfile) {
        toast.error('Creator profile not found. Please check the URL.');
        setIsValidatingUrl(false);
        return;
      }

      // Get the actual creatorId (wallet address)
      const actualCreatorId = creatorProfile.creatorId;

      // Check if user is trying to subscribe to themselves
      if (currentUserAddress && currentUserAddress.toLowerCase() === actualCreatorId.toLowerCase()) {
        toast.error('You cannot subscribe to your own channel');
        setIsValidatingUrl(false);
        return;
      }

      // Check if already subscribed
      const currentChannels = subscribedChannels.map(ch => ch.creatorId);
      if (currentChannels.includes(actualCreatorId)) {
        toast.error('You are already subscribed to this channel');
        setIsValidatingUrl(false);
        return;
      }

      // Fetch channel details
      const channels = await getStreamsByCreator(actualCreatorId);
      const channel = channels && channels.length > 0 ? channels[0] : null;

      setFoundCreator(creatorProfile);
      setFoundChannel(channel);
      setShowAddChannelModal(false);
      setShowConfirmModal(true);
    } catch (error: any) {
      console.error('Error validating URL:', error);
      toast.error(error.message || 'Failed to validate URL. Please try again.');
    } finally {
      setIsValidatingUrl(false);
    }
  };

  // Handle subscription confirmation
  const handleConfirmSubscribe = async () => {
    if (!foundCreator || !currentUserAddress) {
      toast.error('Missing required information');
      return;
    }

    setIsSubscribing(true);
    try {
      await subscribeToCreator(currentUserAddress, foundCreator.creatorId);
      toast.success(`Subscribed to ${foundCreator.displayName || foundChannel?.title || 'channel'}!`);
      
      // Refresh subscribed channels
      const channels = await getSubscribedChannels(currentUserAddress);
      setSubscribedChannels(channels);
      
      // Update username map
      if (foundCreator.displayName) {
        setCreatorIdToUsername(prev => ({
          ...prev,
          [foundCreator!.creatorId]: foundCreator!.displayName!
        }));
      }
      
      // Reset state
      setChannelUrl('');
      setFoundCreator(null);
      setFoundChannel(null);
      setShowConfirmModal(false);
    } catch (error: any) {
      console.error('Error subscribing:', error);
      toast.error(error.message || 'Failed to subscribe. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSignup = () => {
    setShowSignupModal(false);
    router.push('/auth/login');
  };

  const links = [
    { href: '/', icon: TbHomeFilled, text: 'Home' },
    { href: '/dashboard', icon: BsFillBarChartLineFill, text: 'Dashboard' },
    { href: '/dashboard/settings', icon: IoSettings, text: 'Profile' },
  ];

  return (
    <>
      {/* Owned Channels Section */}
      {!sidebarCollapsed && (
        <div className="w-full mt-3 backdrop-blur-sm border border-white/15 rounded-lg p-1.5 bg-gradient-to-b from-white/10 to-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between mb-1.5 px-1.5">
            <h3 className="text-gray-200 font-semibold text-[10px] uppercase tracking-[0.14em]">Owned Channels</h3>
            {isLoggedIn && ownedChannels.length > 0 && (
              <span className="rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] text-gray-300">
                {ownedChannels.length}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {loadingOwnedChannels ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">Loading...</div>
            ) : !isLoggedIn ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">Sign in to see channels</div>
            ) : ownedChannels.length === 0 ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">No owned channels</div>
            ) : (
              ownedChannels.map((channel) => {
                const profileIdentifier = currentUsername || creatorIdToUsername[channel.creatorId] || '';
                return (
                <div
                  key={channel.playbackId}
                  className={clsx(
                    'flex items-center gap-1.5 px-1.5 py-1.5 rounded-md transition-colors group border',
                    selectedChannelId === channel.playbackId
                      ? 'bg-gradient-to-r from-yellow-500/20 to-teal-500/20 border-yellow-400/30'
                      : 'border-transparent hover:border-white/10 hover:bg-white/10',
                  )}
                >
                  <button
                    onClick={() => {
                      if (channel.playbackId) {
                        if (isInDashboard) {
                          // If in dashboard, use context to update state
                          setSelectedChannelId(channel.playbackId);
                        } else {
                          // If outside dashboard, navigate to dashboard with channelId
                          const dashboardRouteId = currentUsername || creatorIdToUsername[channel.creatorId] || '';
                          if (!dashboardRouteId) {
                            toast.error('Set a username in profile settings to open channel dashboard URLs.');
                            return;
                          }
                          router.push(`/dashboard/${encodeURIComponent(dashboardRouteId)}?channelId=${channel.playbackId}`);
                        }
                      } else {
                        if (isInDashboard) {
                          setSelectedChannelId(null);
                        } else {
                          router.push('/dashboard');
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  >
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.title || channel.streamName || 'Channel'}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-[10px] font-bold flex-shrink-0">
                        {(channel.title || channel.streamName || channel.creatorId?.slice(0, 2) || 'CH').toUpperCase().slice(0, 2)}
                      </div>
                    )}
                    <span className="text-gray-300 text-xs truncate flex-1">
                      {channel.title || channel.streamName || channel.creatorId?.slice(0, 8) + '...' || 'Untitled Channel'}
                    </span>
                  </button>
                  {/* Three-dot options menu - always visible on mobile, hover on desktop */}
                  {isMobileView ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onChannelOptionsClick?.(channel, { isOwned: true, profileIdentifier });
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20 transition-colors touch-manipulation"
                      aria-label="Open owned channel options"
                    >
                      <HiDotsVertical className="w-4 h-4 text-gray-300" />
                    </button>
                  ) : (
                    <ChannelOptionsMenu
                      channel={channel}
                      profileIdentifier={profileIdentifier}
                      onSettings={handleChannelSettings}
                      onInstall={handleInstallPWA}
                      onShare={handleShareChannel}
                    />
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Subscribed Channels Section */}
      {!sidebarCollapsed && (
        <div className="w-full mt-3 backdrop-blur-sm border border-white/15 rounded-lg p-1.5 bg-gradient-to-b from-white/10 to-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between mb-1.5 px-1.5">
            <h3 className="text-gray-200 font-semibold text-[10px] uppercase tracking-[0.14em]">Subscribed Channels</h3>
            {isLoggedIn && subscribedChannels.length > 0 && (
              <span className="rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] text-gray-300">
                {subscribedChannels.length}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {loadingChannels ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">Loading...</div>
            ) : !isLoggedIn ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">Sign in to see channels</div>
            ) : subscribedChannels.length === 0 ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">No subscribed channels</div>
            ) : (
              subscribedChannels.map((channel) => {
                const profileIdentifier = creatorIdToUsername[channel.creatorId];
                if (!profileIdentifier) return null;
                return (
                <div key={channel.creatorId} className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-md hover:bg-white/10 transition-colors group border border-transparent hover:border-white/10">
                  <Link
                    href={`/creator/${encodeURIComponent(profileIdentifier)}`}
                    className="flex items-center gap-1.5 flex-1 min-w-0"
                  >
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.title || channel.streamName || 'Channel'}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-[10px] font-bold flex-shrink-0">
                        {((channel.title || channel.streamName || channel.creatorId)?.slice(0, 2) || '??').toUpperCase()}
                      </div>
                    )}
                    <span className="text-gray-300 text-xs truncate flex-1">
                      {channel.title || channel.streamName || (channel.creatorId?.slice(0, 8) + '...') || 'Untitled Channel'}
                    </span>
                  </Link>
                  {/* Three-dot options menu - always visible on mobile, hover on desktop */}
                  {isMobileView ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onChannelOptionsClick?.(channel, { isOwned: false, profileIdentifier });
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20 transition-colors touch-manipulation"
                      aria-label="Open subscribed channel options"
                    >
                      <HiDotsVertical className="w-4 h-4 text-gray-300" />
                    </button>
                  ) : (
                    <ChannelOptionsMenu
                      channel={channel}
                      profileIdentifier={profileIdentifier}
                      onInstall={handleInstallPWA}
                      onShare={handleShareChannel}
                    />
                  )}
                </div>
                );
              })
            )}
          </div>
          <button
            onClick={handleAddChannel}
            className="w-full mt-1.5 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-md transition-all duration-200 text-xs font-semibold"
          >
            <HiPlus className="w-3.5 h-3.5" />
            Add Channel
          </button>
        </div>
      )}


      {/* Collapsed Channel Icons (PC and Mobile) */}
      {sidebarCollapsed && (
        <div className="w-full mt-3 flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2.5">
          {/* Owned Channels Icons */}
          {loadingOwnedChannels ? (
            <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse" />
          ) : ownedChannels.length > 0 && (
            <>
              <div className="w-full border-b border-white/20 pb-1.5 mb-1">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 text-center">Owned</p>
              </div>
              {ownedChannels.map((channel) => (
                <button
                  key={channel.playbackId}
                  onClick={() => {
                      if (channel.playbackId) {
                        if (isInDashboard) {
                          setSelectedChannelId(channel.playbackId);
                        } else {
                          const dashboardRouteId = currentUsername || creatorIdToUsername[channel.creatorId] || '';
                          if (!dashboardRouteId) {
                            toast.error('Set a username in profile settings to open channel dashboard URLs.');
                            return;
                          }
                          router.push(`/dashboard/${encodeURIComponent(dashboardRouteId)}?channelId=${channel.playbackId}`);
                        }
                      } else {
                      if (isInDashboard) {
                        setSelectedChannelId(null);
                      } else {
                        router.push('/dashboard');
                      }
                    }
                  }}
                  className="group relative"
                  title={channel.title || channel.streamName || 'Channel'}
                >
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.title || channel.streamName || 'Channel'}
                      className="w-9 h-9 rounded-full object-cover border-2 border-transparent hover:border-yellow-500 transition-all"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-[10px] font-bold border-2 border-transparent hover:border-white transition-all">
                      {(channel.title || channel.streamName || channel.creatorId?.slice(0, 2) || 'CH').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  {/* Tooltip */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {channel.title || channel.streamName || 'Channel'}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Subscribed Channels Icons */}
          {loadingChannels ? (
            <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse" />
          ) : subscribedChannels.length > 0 && (
            <>
              <div className="w-full border-b border-white/20 pb-1.5 mb-1 mt-1.5">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 text-center">Subscribed</p>
              </div>
              {subscribedChannels.map((channel) => {
                const profileIdentifier = creatorIdToUsername[channel.creatorId];
                if (!profileIdentifier) return null;
                return (
                  <Link
                    key={channel.creatorId}
                    href={`/creator/${encodeURIComponent(profileIdentifier)}`}
                    className="group relative"
                    title={channel.title || channel.streamName || 'Channel'}
                  >
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.title || channel.streamName || 'Channel'}
                        className="w-9 h-9 rounded-full object-cover border-2 border-transparent hover:border-yellow-500 transition-all"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-[10px] font-bold border-2 border-transparent hover:border-white transition-all">
                        {((channel.title || channel.streamName || channel.creatorId)?.slice(0, 2) || '??').toUpperCase()}
                      </div>
                    )}
                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {channel.title || channel.streamName || 'Channel'}
                    </div>
                  </Link>
                );
              })}
            </>
          )}

          {/* Add Channel Button */}
          <button
            onClick={handleAddChannel}
            className="w-9 h-9 flex items-center justify-center bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-full transition-all duration-200 mt-1.5"
            title="Add Channel"
          >
            <HiPlus className="w-4 h-4" />
          </button>
        </div>
      )}



      {/* Signup Modal */}
      <AlertDialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign In Required</AlertDialogTitle>
            <AlertDialogDescription>
              You need to sign in to add channels. Would you like to sign in now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSignupModal(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignup}
              className="bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black"
            >
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Channel Modal */}
      <AlertDialog open={showAddChannelModal} onOpenChange={setShowAddChannelModal}>
        <AlertDialogContent className="bg-gray-900 border border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Add Channel</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Enter the creator profile URL to subscribe to their channel.
              <br />
              Format: <span className="text-yellow-400">/creator/[id]</span> or <span className="text-yellow-400">https://origin/creator/[id]</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <input
              type="text"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isValidatingUrl) {
                  handleValidateUrl();
                }
              }}
              placeholder="e.g., /creator/username or https://example.com/creator/username"
              className="w-full px-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              disabled={isValidatingUrl}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowAddChannelModal(false);
                setChannelUrl('');
              }}
              className="bg-gray-700 text-white hover:bg-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleValidateUrl}
              disabled={isValidatingUrl || !channelUrl.trim()}
              className="bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidatingUrl ? (
                <div className="flex items-center gap-2">
                  <Bars width={14} height={14} color="#000000" />
                  <span>Validating...</span>
                </div>
              ) : (
                'Validate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Modal */}
      <AlertDialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <AlertDialogContent className="bg-gray-900 border border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirm Subscription</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Do you want to subscribe to this channel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {foundCreator && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                {foundChannel?.logo ? (
                  <img
                    src={foundChannel.logo}
                    alt={foundChannel.title || foundChannel.streamName || 'Channel'}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : foundCreator.avatar ? (
                  <img
                    src={foundCreator.avatar}
                    alt={foundCreator.displayName || 'Creator'}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-sm font-bold">
                    {((foundCreator.displayName || foundChannel?.title || foundCreator.creatorId)?.slice(0, 2) || '??').toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold">
                    {foundChannel?.title || foundChannel?.streamName || foundCreator.displayName || 'Untitled Channel'}
                  </p>
                  {foundCreator.displayName && (
                    <p className="text-gray-400 text-sm">by {foundCreator.displayName}</p>
                  )}
                </div>
              </div>
              {foundChannel?.description && (
                <p className="text-gray-300 text-sm">{foundChannel.description}</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowConfirmModal(false);
                setFoundCreator(null);
                setFoundChannel(null);
                setChannelUrl('');
              }}
              className="bg-gray-700 text-white hover:bg-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubscribe}
              disabled={isSubscribing}
              className="bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubscribing ? (
                <div className="flex items-center gap-2">
                  <Bars width={14} height={14} color="#000000" />
                  <span>Subscribing...</span>
                </div>
              ) : (
                'Subscribe'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
export default Sidebar;
