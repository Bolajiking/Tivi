'use client';

import clsx from 'clsx';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { BsFillBarChartLineFill } from 'react-icons/bs';
import { CiStreamOn } from 'react-icons/ci';
import { FaSackDollar } from 'react-icons/fa6';
import { IoSettings } from 'react-icons/io5';
import { RiEditFill, RiVideoAddLine } from 'react-icons/ri';
import { TbHomeFilled } from 'react-icons/tb';
import { usePrivy } from '@privy-io/react-auth';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  getSubscribedChannels,
  getStreamsByCreator,
  getUserProfile,
  getUserProfileByUsername,
  hasCreatorInviteAccess,
  redeemCreatorInviteCode,
  subscribeToCreator,
} from '@/lib/supabase-service';
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
import { MdExplore } from 'react-icons/md';
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
  const { authenticated, ready, login } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const { selectedChannelId, setSelectedChannelId } = useChannel();
  const isInDashboard = pathname?.startsWith('/dashboard');
  const [subscribedChannels, setSubscribedChannels] = useState<SupabaseStream[]>([]);
  const [ownedChannels, setOwnedChannels] = useState<SupabaseStream[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingOwnedChannels, setLoadingOwnedChannels] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [hasCreatorAccess, setHasCreatorAccess] = useState(false);
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

    const channelUrl = `${window.location.origin}/${encodeURIComponent(creatorRouteId)}`;
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
  const hasCreatedStream = useMemo(
    () => ownedChannels.some((channel) => !!channel.playbackId),
    [ownedChannels],
  );

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

  useEffect(() => {
    const checkCreatorAccess = async () => {
      if (!currentUserAddress) {
        setHasCreatorAccess(false);
        return;
      }

      if (hasCreatedStream) {
        setHasCreatorAccess(true);
        return;
      }

      try {
        const allowed = await hasCreatorInviteAccess(currentUserAddress);
        setHasCreatorAccess(allowed);
      } catch (error: any) {
        setHasCreatorAccess(false);
        console.error('Failed to check creator invite access:', error);
      }
    };

    checkCreatorAccess();
  }, [currentUserAddress, hasCreatedStream]);

  const navigateToChannelCreationForm = () => {
    router.push('/dashboard/settings?openChannelSetup=1');
  };

  const handleRedeemInviteCode = async () => {
    if (!currentUserAddress) {
      toast.error('Wallet not connected.');
      return;
    }

    if (!inviteCode.trim()) {
      toast.error('Enter invite code.');
      return;
    }

    try {
      setRedeemingCode(true);
      await redeemCreatorInviteCode(currentUserAddress, inviteCode);
      setHasCreatorAccess(true);
      setInviteCode('');
      setShowInviteModal(false);
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
      setShowSignupModal(true);
      return;
    }

    if (!hasCreatorAccess) {
      setShowInviteModal(true);
      return;
    }

    navigateToChannelCreationForm();
  };

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

      const parsePath = (input: string): string => {
        if (input.startsWith('http://') || input.startsWith('https://')) {
          return new URL(input).pathname.replace(/\/$/, '');
        }
        return input;
      };

      const path = parsePath(cleanUrl);

      // Legacy format: /creator/[id]
      const legacyMatch = path.match(/^\/creator\/([^\/\?]+)/);
      if (legacyMatch && legacyMatch[1]) {
        return decodeURIComponent(legacyMatch[1]);
      }

      // New format: /[id]
      const rootMatch = path.match(/^\/([^\/\?]+)$/);
      if (rootMatch && rootMatch[1]) {
        const candidate = decodeURIComponent(rootMatch[1]);
        const reservedRoutes = new Set([
          'api',
          'auth',
          'creator',
          'dashboard',
          'player',
          'streamviews',
          'testin',
          'view',
          '_next',
        ]);
        if (!reservedRoutes.has(candidate.toLowerCase())) {
          return candidate;
        }
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
        toast.error('Invalid URL format. Please use: /[username] or https://origin/[username]');
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
    login();
  };

  const openOwnedChannel = (channel: SupabaseStream) => {
    if (channel.playbackId) {
      setSelectedChannelId(channel.playbackId);

      // When already in dashboard, context update alone triggers re-render — no navigation needed.
      if (isInDashboard) return;

      const dashboardRouteId = currentUsername || creatorIdToUsername[channel.creatorId] || '';
      if (dashboardRouteId) {
        router.push(`/dashboard/${encodeURIComponent(dashboardRouteId)}`);
        return;
      }

      router.push('/dashboard');
      return;
    }

    setSelectedChannelId(null);
    if (!isInDashboard) {
      router.push('/dashboard');
    }
  };

  const openSubscribedChannel = (channel: SupabaseStream, profileIdentifier: string) => {
    if (!profileIdentifier) return;
    if (channel.playbackId) {
      setSelectedChannelId(channel.playbackId);
    }
    router.push(`/${encodeURIComponent(profileIdentifier)}`);
  };

  const activeCreatorRouteId = useMemo(() => {
    if (!pathname) return null;

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    if (segments[0] === 'creator' && segments[1]) {
      return decodeURIComponent(segments[1]).toLowerCase();
    }

    if (segments[0] === 'dashboard' && segments[1]) {
      const reservedDashboardRoutes = new Set([
        'analytics',
        'customise-channel',
        'monetization',
        'order-history',
        'profile',
        'settings',
        'stream',
      ]);
      if (!reservedDashboardRoutes.has(segments[1].toLowerCase())) {
        return decodeURIComponent(segments[1]).toLowerCase();
      }
      return null;
    }

    if (segments.length === 1) {
      const reservedRootRoutes = new Set([
        'api',
        'auth',
        'creator',
        'dashboard',
        'player',
        'streamviews',
        'testin',
        'view',
        '_next',
      ]);
      if (!reservedRootRoutes.has(segments[0].toLowerCase())) {
        return decodeURIComponent(segments[0]).toLowerCase();
      }
    }

    return null;
  }, [pathname]);

  const isChannelActive = (channel: SupabaseStream, profileIdentifier?: string) => {
    // When a channel is explicitly selected, use exact playbackId match only.
    // This prevents all channels of the same creator from highlighting.
    if (selectedChannelId) {
      return channel.playbackId === selectedChannelId;
    }
    // Fallback: route-based match when no explicit selection exists
    if (!activeCreatorRouteId) {
      return false;
    }
    const routeId = (profileIdentifier || currentUsername || creatorIdToUsername[channel.creatorId] || '')
      .trim()
      .toLowerCase();
    return !!routeId && routeId === activeCreatorRouteId;
  };

  // Sync route → context: when user navigates via URL, set selectedChannelId to match.
  // selectedChannelId is read inside but excluded from deps to prevent override loops
  // when the user explicitly selects a channel via sidebar click.
  useEffect(() => {
    if (!activeCreatorRouteId) return;

    // If current selection already belongs to a channel on this route, don't override.
    if (selectedChannelId) {
      const currentMatchesRoute = [...ownedChannels, ...subscribedChannels].some((ch) => {
        if (ch.playbackId !== selectedChannelId) return false;
        const routeId = (currentUsername || creatorIdToUsername[ch.creatorId] || '').toLowerCase();
        return routeId === activeCreatorRouteId;
      });
      if (currentMatchesRoute) return;
    }

    const matchedOwned = ownedChannels.find((channel) => {
      const ownerRouteId = (currentUsername || creatorIdToUsername[channel.creatorId] || '').toLowerCase();
      return ownerRouteId === activeCreatorRouteId;
    });

    const matchedSubscribed = subscribedChannels.find((channel) => {
      const subscribedRouteId = (creatorIdToUsername[channel.creatorId] || '').toLowerCase();
      return subscribedRouteId === activeCreatorRouteId;
    });

    const matchedChannel = matchedOwned || matchedSubscribed;
    if (!matchedChannel?.playbackId) return;
    setSelectedChannelId(matchedChannel.playbackId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    creatorIdToUsername,
    currentUsername,
    ownedChannels,
    activeCreatorRouteId,
    setSelectedChannelId,
    subscribedChannels,
  ]);

  const links = [
    { href: '/', icon: TbHomeFilled, text: 'Home' },
    { href: '/dashboard', icon: BsFillBarChartLineFill, text: 'Dashboard' },
    { href: '/dashboard/settings', icon: IoSettings, text: 'Profile' },
  ];

  return (
    <>
      {/* Owned Channels Section */}
      {!sidebarCollapsed && (
        <div className="w-full mt-3">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-[10px] uppercase tracking-widest text-[#555]">Owned Channels</h3>
          </div>
          <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
            {loadingOwnedChannels ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">Loading...</div>
            ) : !isLoggedIn ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">Sign in to see channels</div>
            ) : ownedChannels.length === 0 ? (
              <div className="text-gray-400 text-xs px-1.5 py-1.5">No owned channels</div>
            ) : (
              ownedChannels.map((channel) => {
                const profileIdentifier = currentUsername || creatorIdToUsername[channel.creatorId] || '';
                const isActiveChannel = isChannelActive(channel, profileIdentifier);
                return (
                <div
                  key={channel.playbackId}
                  className={clsx(
                    'flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors group',
                    isActiveChannel
                      ? 'border border-[#facc15]/45 bg-[#facc15]/12 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.12)]'
                      : 'hover:bg-[#1a1a1a]',
                  )}
                >
                  <button
                    onClick={() => openOwnedChannel(channel)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  >
                    {channel.logo ? (
                      <Image
                        src={channel.logo}
                        alt={channel.title || channel.streamName || 'Channel'}
                        width={28}
                        height={28}
                        unoptimized
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-[10px] font-bold flex-shrink-0">
                        {(channel.title || channel.streamName || channel.creatorId?.slice(0, 2) || 'CH').toUpperCase().slice(0, 2)}
                      </div>
                    )}
                    <span className={`text-sm truncate flex-1 ${isActiveChannel ? 'text-white font-semibold' : 'text-[#888] font-normal'}`}>
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
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors touch-manipulation"
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
        <div className="w-full mt-3">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-[10px] uppercase tracking-widest text-[#555]">Subscribed Channels</h3>
          </div>
          <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
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
                const isActiveChannel = isChannelActive(channel, profileIdentifier);
                return (
                <div
                  key={channel.creatorId}
                  className={clsx(
                    'flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group',
                    isActiveChannel
                      ? 'border border-[#facc15]/45 bg-[#facc15]/12 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.12)]'
                      : 'hover:bg-[#1a1a1a]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openSubscribedChannel(channel, profileIdentifier)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  >
                    {channel.logo ? (
                      <Image
                        src={channel.logo}
                        alt={channel.title || channel.streamName || 'Channel'}
                        width={28}
                        height={28}
                        unoptimized
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-[10px] font-bold flex-shrink-0">
                        {((channel.title || channel.streamName || channel.creatorId)?.slice(0, 2) || '??').toUpperCase()}
                      </div>
                    )}
                    <span className={clsx(
                      'text-sm truncate flex-1',
                      isActiveChannel ? 'text-white font-semibold' : 'text-[#888] font-normal',
                    )}>
                      {channel.title || channel.streamName || (channel.creatorId?.slice(0, 8) + '...') || 'Untitled Channel'}
                    </span>
                  </button>
                  {/* Three-dot options menu - always visible on mobile, hover on desktop */}
                  {isMobileView ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onChannelOptionsClick?.(channel, { isOwned: false, profileIdentifier });
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors touch-manipulation"
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
          {!hasCreatedStream ? (
            <button
              onClick={handleCreateChannel}
              className="w-full mt-2 flex items-center rounded-lg py-2 gap-2.5 px-3 transition-colors text-[#888] hover:text-white hover:bg-[#1a1a1a]"
            >
              <RiVideoAddLine className="w-4 h-4" />
              <span className="text-xs font-medium">Create Channel</span>
            </button>
          ) : null}
          <button
            onClick={handleAddChannel}
            className="w-full mt-1 flex items-center rounded-lg py-2 gap-2.5 px-3 transition-colors text-[#888] hover:text-white hover:bg-[#1a1a1a]"
          >
            <HiPlus className="w-4 h-4" />
            <span className="text-xs font-medium">Add Channel</span>
          </button>
          <Link
            href="/streamviews"
            className="w-full mt-1 flex items-center rounded-lg py-2 gap-2.5 px-3 transition-colors text-[#888] hover:text-white hover:bg-[#1a1a1a]"
          >
            <MdExplore className="w-4 h-4" />
            <span className="text-xs font-medium">Explore</span>
          </Link>
        </div>
      )}


      {/* Collapsed Channel Icons (PC and Mobile) */}
      {sidebarCollapsed && (
        <div className="w-full mt-3 flex flex-col items-center gap-2 py-2">
          {/* Owned Channels Icons */}
          {loadingOwnedChannels ? (
            <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse" />
          ) : ownedChannels.length > 0 && (
            <>
              <div className="w-full border-b border-white/[0.07] pb-1.5 mb-1">
                <p className="text-[10px] uppercase tracking-widest text-[#555] text-center">Owned</p>
              </div>
              {ownedChannels.map((channel) => {
                const profileIdentifier = currentUsername || creatorIdToUsername[channel.creatorId] || '';
                const isActiveChannel = isChannelActive(channel, profileIdentifier);
                return (
                  <button
                    key={channel.playbackId}
                    onClick={() => openOwnedChannel(channel)}
                    className="group relative"
                    title={channel.title || channel.streamName || 'Channel'}
                  >
                    {channel.logo ? (
                      <Image
                        src={channel.logo}
                        alt={channel.title || channel.streamName || 'Channel'}
                        width={36}
                        height={36}
                        unoptimized
                        className={clsx(
                          'w-9 h-9 rounded-full object-cover transition-all',
                          isActiveChannel
                            ? 'ring-2 ring-[#facc15] ring-offset-1 ring-offset-[#0a0a0a]'
                            : 'hover:ring-2 hover:ring-[#facc15]',
                        )}
                      />
                    ) : (
                      <div className={clsx(
                        'w-9 h-9 rounded-full bg-gradient-to-r from-yellow-400 to-teal-500 flex items-center justify-center text-black text-[10px] font-bold transition-all',
                        isActiveChannel
                          ? 'ring-2 ring-[#facc15] ring-offset-1 ring-offset-[#0a0a0a]'
                          : 'hover:ring-2 hover:ring-[#facc15]',
                      )}>
                        {(channel.title || channel.streamName || channel.creatorId?.slice(0, 2) || 'CH').toUpperCase().slice(0, 2)}
                      </div>
                    )}
                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {channel.title || channel.streamName || 'Channel'}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Subscribed Channels Icons */}
          {loadingChannels ? (
            <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse" />
          ) : subscribedChannels.length > 0 && (
            <>
              <div className="w-full border-b border-white/[0.07] pb-1.5 mb-1 mt-1.5">
                <p className="text-[10px] uppercase tracking-widest text-[#555] text-center">Subscribed</p>
              </div>
              {subscribedChannels.map((channel) => {
                const profileIdentifier = creatorIdToUsername[channel.creatorId];
                if (!profileIdentifier) return null;
                const isActiveChannel = isChannelActive(channel, profileIdentifier);
                return (
                  <button
                    key={channel.creatorId}
                    onClick={() => openSubscribedChannel(channel, profileIdentifier)}
                    className="group relative"
                    title={channel.title || channel.streamName || 'Channel'}
                  >
                    {channel.logo ? (
                      <Image
                        src={channel.logo}
                        alt={channel.title || channel.streamName || 'Channel'}
                        width={36}
                        height={36}
                        unoptimized
                        className={clsx(
                          'w-9 h-9 rounded-full object-cover transition-all',
                          isActiveChannel
                            ? 'ring-2 ring-[#facc15] ring-offset-1 ring-offset-[#0a0a0a]'
                            : 'hover:ring-2 hover:ring-[#facc15]',
                        )}
                      />
                    ) : (
                      <div className={clsx(
                        'w-9 h-9 rounded-full bg-gradient-to-r from-yellow-400 to-teal-500 flex items-center justify-center text-black text-[10px] font-bold transition-all',
                        isActiveChannel
                          ? 'ring-2 ring-[#facc15] ring-offset-1 ring-offset-[#0a0a0a]'
                          : 'hover:ring-2 hover:ring-[#facc15]',
                      )}>
                        {((channel.title || channel.streamName || channel.creatorId)?.slice(0, 2) || '??').toUpperCase()}
                      </div>
                    )}
                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {channel.title || channel.streamName || 'Channel'}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Add Channel Button */}
          {!hasCreatedStream ? (
            <button
              onClick={handleCreateChannel}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-white/[0.07] bg-[#0f0f0f] text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors mt-1.5"
              title="Create Channel"
            >
              <RiVideoAddLine className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={handleAddChannel}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-white/[0.07] bg-[#0f0f0f] text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors mt-1.5"
            title="Add Channel"
          >
            <HiPlus className="w-4 h-4" />
          </button>
          <Link
            href="/streamviews"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-white/[0.07] bg-[#0f0f0f] text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            title="Explore"
          >
            <MdExplore className="w-4 h-4" />
          </Link>
        </div>
      )}



      {/* Signup Modal */}
      <AlertDialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <AlertDialogContent className="bg-[#0f0f0f] border border-white/[0.07]">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign In Required</AlertDialogTitle>
            <AlertDialogDescription>
              You need to sign in to add channels. Would you like to sign in now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSignupModal(false)} className="bg-[#1a1a1a] text-[#888] hover:bg-[#242424] border-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignup}
              className="bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black font-semibold"
            >
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <AlertDialogContent className="bg-[#0f0f0f] border border-white/[0.07]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Creator Invite Required</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Enter your invite code to unlock channel creation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code"
              className="w-full rounded-lg border border-white/[0.07] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-[#555] focus:border-[#facc15] focus:outline-none"
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
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowInviteModal(false)}
              className="bg-[#1a1a1a] text-[#888] hover:bg-[#242424] border-0"
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Channel Modal */}
      <AlertDialog open={showAddChannelModal} onOpenChange={setShowAddChannelModal}>
        <AlertDialogContent className="bg-[#0f0f0f] border border-white/[0.07]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Add Channel</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Enter the creator profile URL to subscribe to their channel.
              <br />
              Format: <span className="text-yellow-400">/[username]</span> or <span className="text-yellow-400">https://origin/[username]</span>
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
              placeholder="e.g., /jammy or https://example.com/jammy"
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-white/[0.07] rounded-lg text-white placeholder-[#555] focus:outline-none focus:ring-1 focus:ring-[#facc15]"
              disabled={isValidatingUrl}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowAddChannelModal(false);
                setChannelUrl('');
              }}
              className="bg-[#1a1a1a] text-[#888] hover:bg-[#242424] border-0"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleValidateUrl}
              disabled={isValidatingUrl || !channelUrl.trim()}
              className="bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
        <AlertDialogContent className="bg-[#0f0f0f] border border-white/[0.07]">
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
                  <Image
                    src={foundChannel.logo}
                    alt={foundChannel.title || foundChannel.streamName || 'Channel'}
                    width={48}
                    height={48}
                    unoptimized
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : foundCreator.avatar ? (
                  <Image
                    src={foundCreator.avatar}
                    alt={foundCreator.displayName || 'Creator'}
                    width={48}
                    height={48}
                    unoptimized
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
              className="bg-[#1a1a1a] text-[#888] hover:bg-[#242424] border-0"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubscribe}
              disabled={isSubscribing}
              className="bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
