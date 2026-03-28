'use client';
import Header from '@/components/Header';
import SectionCard from '@/components/Card/SectionCard';
import { VideoCard } from '@/components/Card/Card';
import { CreatorChannelCard } from '@/components/templates/creator/CreatorChannelCard';
import { RiVideoAddLine } from 'react-icons/ri';
import * as Dialog from '@radix-ui/react-dialog';
import { IoMdClose } from 'react-icons/io';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrivy } from '@privy-io/react-auth';
import { useDispatch, useSelector } from 'react-redux';
import { getAllStreams } from '@/features/streamAPI';
import { getAssets } from '@/features/assetsAPI';
import type { RootState, AppDispatch } from '@/store/store';
import { useChannel } from '@/context/ChannelContext';
import image1 from '../../../../public/assets/images/image1.png';
import Spinner from '@/components/Spinner';
import UploadVideoAsset, { type VideoUploadNotice } from '@/components/UploadVideoAsset';
import type { Asset, Stream } from '@/interfaces';
import MobileSidebar from '@/components/MobileSidebar';
import BottomNav from '@/components/BottomNav';
import { UserSetupModal } from '@/components/UserSetupModal';
import {
  getUserProfile,
  getStreamsByCreator,
  subscribeToCreatorStreamUpdates,
} from '@/lib/supabase-service';
import { DashboardBroadcast } from '@/components/templates/dashboard/DashboardBroadcast';
import { getStreamById } from '@/features/streamAPI';
import { StreamSetupModal } from '@/components/StreamSetupModal';
import { VideoPaymentGate } from '@/components/VideoPaymentGate';
import { Clapperboard, Radio, Sparkles } from 'lucide-react';
import { ChannelChatExperience } from '@/components/templates/chat/ChannelChatExperience';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

interface DashboardProps {
  initialLivePlaybackId?: string;
  initialChatPlaybackId?: string;
  openChatView?: boolean;
}

const Dashboard = ({ initialLivePlaybackId, initialChatPlaybackId, openChatView }: DashboardProps) => {
  const { ready, authenticated, login } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const navigate = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const dashboardRouteCreatorId = typeof params?.creatorId === 'string' ? decodeURIComponent(params.creatorId) : '';
  const dispatch = useDispatch<AppDispatch>();
  const { streams, loading: streamsLoading, error: streamsError } = useSelector((state: RootState) => state.streams);
  const { assets, loading: assetsLoading, error: assetsError } = useSelector((state: RootState) => state.assets);
  const searchParams = useSearchParams();
  const { selectedChannelId: contextChannelId, setSelectedChannelId } = useChannel();
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [showStreamSetupModal, setShowStreamSetupModal] = useState(false);
  const [pendingStreamId, setPendingStreamId] = useState<string | null>(null);
  const [streamForSetup, setStreamForSetup] = useState<any>(null);
  const [channelSupabaseData, setChannelSupabaseData] = useState<any>(null);
  const [creatorUsername, setCreatorUsername] = useState<string | null>(null);

  // Get channelId from URL query params (for navigation from outside dashboard)
  const urlChannelId = searchParams?.get('channelId');
  const shouldUseContextSelection = Boolean(authenticated);
  
  // In unauthenticated state, ignore persisted context channel selection unless URL explicitly provides one.
  const selectedChannelId =
    urlChannelId || (shouldUseContextSelection ? contextChannelId : null) || initialLivePlaybackId || null;
  
  // Get creator address (wallet address)
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const creatorAddress = useMemo(() => walletAddress || null, [walletAddress]);
  const [isDialogOpen2, setIsDialogOpen2] = useState(false);
  const [videoUploadNotice, setVideoUploadNotice] = useState<(VideoUploadNotice & { minimized: boolean }) | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLiveTileAlert, setShowLiveTileAlert] = useState(false);
  const [showChatLiveTileAlert, setShowChatLiveTileAlert] = useState(false);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousLiveStateRef = useRef(false);
  const previousChatLiveStateRef = useRef(false);

  useEffect(() => {
    if (isDialogOpen2) return;
    if (typeof document === 'undefined') return;
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = 'auto';
    }
  }, [isDialogOpen2]);

  const handleVideoUploadStatusChange = useCallback((status: VideoUploadNotice | null) => {
    if (!status) {
      setVideoUploadNotice((prev) => {
        if (!prev) return null;
        if (prev.phase === 'uploading' || prev.phase === 'saving') {
          return prev;
        }
        return null;
      });
      return;
    }

    setVideoUploadNotice((prev) => ({
      ...status,
      minimized: prev?.minimized ?? false,
    }));
  }, []);

  useEffect(() => {
    if (!videoUploadNotice) return;
    if (videoUploadNotice.phase !== 'completed') return;

    const timer = setTimeout(() => {
      setVideoUploadNotice(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [videoUploadNotice]);

  // Expose navigation function for SidebarBottomLinks
  useEffect(() => {
    const handleOpenCreateChannel = () => {
      navigate.push('/dashboard/settings');
    };
    
    window.addEventListener('openCreateChannelModal', handleOpenCreateChannel);
    return () => {
      window.removeEventListener('openCreateChannelModal', handleOpenCreateChannel);
    };
  }, [navigate]);
  // const [filteredStreams, setFilteredStreams] = useState<Stream[]>([]);

  useEffect(() => {
    
      dispatch(getAllStreams());
      dispatch(getAssets());
    
  }, [dispatch, ready, authenticated]);

  useEffect(() => {
    if (!creatorAddress) return;
    const unsubscribe = subscribeToCreatorStreamUpdates(creatorAddress, (streamUpdate) => {
      if (streamUpdate?.playbackId) {
        const isSelectedStream =
          streamUpdate.playbackId === selectedChannelId ||
          streamUpdate.playbackId === channelSupabaseData?.playbackId;
        if (isSelectedStream) {
          setChannelSupabaseData((prev: any) => ({
            ...(prev || {}),
            ...streamUpdate,
            playbackId: streamUpdate.playbackId,
          }));
        }
      }

      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      realtimeRefreshTimerRef.current = setTimeout(() => {
        dispatch(getAllStreams());
      }, 200);
    });

    return () => {
      unsubscribe();
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
    };
  }, [creatorAddress, dispatch, selectedChannelId, channelSupabaseData?.playbackId]);

  useEffect(() => {
    if (streamsError) {
      toast.error('Failed to fetch streams: ' + streamsError);
    }
    if (assetsError) {
      toast.error('Failed to fetch assets: ' + assetsError);
    }
  }, [streamsError, assetsError]);

  // Check if user has completed profile setup
  useEffect(() => {
    const checkUserProfile = async () => {
      if (!ready || !authenticated || !creatorAddress) {
        setCheckingProfile(false);
        return;
      }

      try {
        const profile = await getUserProfile(creatorAddress);
        setCreatorUsername(profile?.displayName?.trim() || null);
        // Check if user doesn't have displayName (first-time user)
        const isFirstTime = !profile || !profile.displayName;
        setIsFirstTimeUser(isFirstTime);
        
        // Show modal if user doesn't have displayName (required) or avatar (optional)
        if (!profile || !profile.displayName) {
          setShowUserSetupModal(true);
        }
      } catch (error) {
        console.error('Error checking user profile:', error);
        setCreatorUsername(null);
        // Show modal on error to be safe, treat as first-time
        setIsFirstTimeUser(true);
        setShowUserSetupModal(true);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkUserProfile();
  }, [ready, authenticated, creatorAddress]);

  useEffect(() => {
    if (!creatorUsername) return;

    const onLegacyDashboardPath = pathname === '/dashboard';
    if (onLegacyDashboardPath) {
      navigate.replace(`/dashboard/${encodeURIComponent(creatorUsername)}`);
      return;
    }

    const onUsernameDashboardPath = pathname?.startsWith('/dashboard/');
    const requestedCreatorId = dashboardRouteCreatorId?.trim().toLowerCase();
    const canonicalCreatorId = creatorUsername.trim().toLowerCase();
    if (onUsernameDashboardPath && dashboardRouteCreatorId && requestedCreatorId !== canonicalCreatorId) {
      const pathSegments = (pathname || '').split('/');
      const suffixPath = pathSegments.length > 3 ? `/${pathSegments.slice(3).join('/')}` : '';
      navigate.replace(`/dashboard/${encodeURIComponent(creatorUsername)}${suffixPath}`);
      return;
    }

    const onCanonicalDashboardRoot =
      pathname === `/dashboard/${encodeURIComponent(creatorUsername)}` ||
      pathname === `/dashboard/${creatorUsername}`;
    if (onCanonicalDashboardRoot && urlChannelId) {
      navigate.replace(`/dashboard/${encodeURIComponent(creatorUsername)}`);
    }
  }, [creatorUsername, dashboardRouteCreatorId, navigate, pathname, urlChannelId]);

  // Sync URL channelId to context when navigating from outside dashboard
  useEffect(() => {
    if (!authenticated) return;
    if (urlChannelId && urlChannelId !== contextChannelId) {
      setSelectedChannelId(urlChannelId);
    }
  }, [authenticated, urlChannelId, contextChannelId, setSelectedChannelId]);

  // Clear stale persisted channel selection in unauthenticated dashboard state
  // so `/dashboard` shows the neutral "no channel selected" view.
  useEffect(() => {
    if (!ready || authenticated) return;
    if (urlChannelId || initialLivePlaybackId || initialChatPlaybackId) return;
    if (contextChannelId) {
      setSelectedChannelId(null);
    }
  }, [
    ready,
    authenticated,
    contextChannelId,
    initialChatPlaybackId,
    initialLivePlaybackId,
    setSelectedChannelId,
    urlChannelId,
  ]);

  const handleProfileSetupSuccess = () => {
    // User has completed setup, no longer first-time
    setIsFirstTimeUser(false);
    setShowUserSetupModal(false);
    // Trigger a refresh of ProfileColumn by dispatching an event or using context
    // For now, we'll rely on ProfileColumn's useEffect to refetch
    window.dispatchEvent(new CustomEvent('profileUpdated'));
  };

  const resolveCreatorRouteUsername = useCallback(async () => {
    if (creatorUsername) return creatorUsername;
    if (!creatorAddress) return null;
    try {
      const profile = await getUserProfile(creatorAddress);
      const username = profile?.displayName?.trim() || null;
      setCreatorUsername(username);
      return username;
    } catch (error) {
      console.error('Error resolving creator username:', error);
      return null;
    }
  }, [creatorAddress, creatorUsername]);

  // useEffect(() => {
  //   // const userAddress = user?.wallet?.address?.toLowerCase().trim();
  //   console.log(solanaWalletAddress);
  //   const filtered = streams.filter(
  //     (stream) =>
  //       !!stream.playbackId &&
  //       stream.creatorId?.value?.toLowerCase().trim() === solanaWalletAddress
  //   );
  //   setFilteredStreams(filtered);
  // }, [streams, solanaWalletAddress]);

// console.log(filteredStreams);

const filteredStreams = useMemo(() => {
  if (!creatorAddress) return [];
  const addr = creatorAddress.toLowerCase();
  const result = streams.filter((stream) => {
    if (!stream.playbackId) return false;
    const livepeerMatch = stream.creatorId?.value?.toLowerCase() === addr;
    const supabaseMatch = (stream as any).supabaseCreatorId?.toLowerCase() === addr;
    return livepeerMatch || supabaseMatch;
  });
  return result;
}, [streams, creatorAddress]);

useEffect(() => {
  if (selectedChannelId) return;
  if (filteredStreams.length === 0) return;
  setSelectedChannelId(filteredStreams[0].playbackId);
}, [filteredStreams, selectedChannelId, setSelectedChannelId]);

// Prevent stale cross-channel context on creator dashboard routes:
// if selected channel is not owned by the authenticated creator and no explicit
// channel/live/chat route parameter is present, reset to first owned channel.
useEffect(() => {
  if (!authenticated) return;
  if (!selectedChannelId) return;
  if (filteredStreams.length === 0) return;
  if (urlChannelId || initialLivePlaybackId || initialChatPlaybackId) return;

  const isOwnedSelection = filteredStreams.some(
    (stream) => stream.playbackId === selectedChannelId,
  );
  if (isOwnedSelection) return;

  const fallbackOwned = filteredStreams[0]?.playbackId || null;
  if (fallbackOwned) {
    setSelectedChannelId(fallbackOwned);
  }
}, [
  authenticated,
  filteredStreams,
  initialChatPlaybackId,
  initialLivePlaybackId,
  selectedChannelId,
  setSelectedChannelId,
  urlChannelId,
]);

// Get the selected channel stream — check filteredStreams first, then all streams as fallback
const selectedChannelFromRedux = useMemo(() => {
  if (!selectedChannelId) return null;
  return filteredStreams.find((stream) => stream.playbackId === selectedChannelId)
    || streams.find((stream) => stream.playbackId === selectedChannelId)
    || null;
}, [selectedChannelId, filteredStreams, streams]);

const isDedicatedLiveView = Boolean(initialLivePlaybackId);
const isDedicatedChatView = Boolean(openChatView);
const activeChatPlaybackId = useMemo(() => {
  return initialChatPlaybackId || selectedChannelId || filteredStreams[0]?.playbackId || null;
}, [filteredStreams, initialChatPlaybackId, selectedChannelId]);
// When the Supabase fallback is used, fetch the streamKey from Livepeer by scanning all streams.
const [resolvedStreamKey, setResolvedStreamKey] = useState<string>('');
const [resolvingStreamKey, setResolvingStreamKey] = useState(false);

useEffect(() => {
  if (!initialLivePlaybackId || streamsLoading) return;
  // Already found in Redux — no need to resolve.
  const inRedux = streams.find((s) => s.playbackId === initialLivePlaybackId && s.streamKey);
  if (inRedux) {
    setResolvedStreamKey(inRedux.streamKey);
    return;
  }
  // Fetch directly from Livepeer API to find this stream's key.
  let cancelled = false;
  setResolvingStreamKey(true);
  fetch('/api/livepeer/stream')
    .then((r) => r.json())
    .then((allStreams: any[]) => {
      if (cancelled) return;
      const match = allStreams.find((s: any) => s.playbackId === initialLivePlaybackId);
      setResolvedStreamKey(match?.streamKey || '');
    })
    .catch(() => {
      if (!cancelled) setResolvedStreamKey('');
    })
    .finally(() => {
      if (!cancelled) setResolvingStreamKey(false);
    });
  return () => { cancelled = true; };
}, [initialLivePlaybackId, streams, streamsLoading]);

const dedicatedLiveStream = useMemo(() => {
  if (!initialLivePlaybackId) return null;
  const fromOwned = filteredStreams.find((stream) => stream.playbackId === initialLivePlaybackId);
  if (fromOwned) return fromOwned;

  const fromAll = streams.find((stream) => stream.playbackId === initialLivePlaybackId);
  if (fromAll) return fromAll;

  // Supabase fallback: use resolvedStreamKey fetched directly from Livepeer API.
  if (!streamsLoading && channelSupabaseData?.playbackId === initialLivePlaybackId) {
    return {
      id: channelSupabaseData.id || initialLivePlaybackId,
      playbackId: channelSupabaseData.playbackId || initialLivePlaybackId,
      title: channelSupabaseData.title || channelSupabaseData.streamName || 'Channel',
      name: channelSupabaseData.streamName || channelSupabaseData.title || 'Channel',
      logo: channelSupabaseData.logo || null,
      isActive: Boolean(channelSupabaseData.isActive),
      lastSeen: channelSupabaseData.lastSeen || null,
      creatorId: { value: channelSupabaseData.creatorId || creatorAddress || '' },
      supabaseCreatorId: channelSupabaseData.creatorId || creatorAddress || '',
      streamKey: resolvedStreamKey,
    } as Stream;
  }

  return null;
}, [filteredStreams, initialLivePlaybackId, streams, streamsLoading, channelSupabaseData, creatorAddress, resolvedStreamKey]);
const dedicatedChatStream = useMemo(() => {
  if (!activeChatPlaybackId) return null;
  return filteredStreams.find((stream) => stream.playbackId === activeChatPlaybackId) || null;
}, [activeChatPlaybackId, filteredStreams]);

const selectedChannel = useMemo(() => {
  if (selectedChannelFromRedux) return selectedChannelFromRedux;
  if (!selectedChannelId || !channelSupabaseData) return null;

  return {
    id: channelSupabaseData.id || selectedChannelId,
    playbackId: channelSupabaseData.playbackId || selectedChannelId,
    title: channelSupabaseData.title || channelSupabaseData.streamName || 'Channel',
    name: channelSupabaseData.streamName || channelSupabaseData.title || 'Channel',
    logo: channelSupabaseData.logo || null,
    isActive: Boolean(channelSupabaseData.isActive),
    lastSeen: channelSupabaseData.lastSeen || null,
    creatorId: { value: channelSupabaseData.creatorId || creatorAddress || '' },
    supabaseCreatorId: channelSupabaseData.creatorId || creatorAddress || '',
    streamKey: resolvedStreamKey || channelSupabaseData.streamKey || '',
  } as Stream;
}, [selectedChannelFromRedux, selectedChannelId, channelSupabaseData, creatorAddress, resolvedStreamKey]);

const selectedChannelIsLive = useMemo(() => {
  if (!selectedChannel) return false;
  if (typeof selectedChannel.isActive === 'boolean') return selectedChannel.isActive;
  if (channelSupabaseData?.playbackId === selectedChannel.playbackId) {
    return Boolean(channelSupabaseData?.isActive);
  }
  return false;
}, [channelSupabaseData?.isActive, channelSupabaseData?.playbackId, selectedChannel]);

const chatHeaderChannel = useMemo(() => {
  if (selectedChannel && selectedChannel.playbackId === activeChatPlaybackId) {
    return selectedChannel;
  }
  if (dedicatedChatStream) return dedicatedChatStream;

  if (activeChatPlaybackId && channelSupabaseData?.playbackId === activeChatPlaybackId) {
    return {
      id: channelSupabaseData.id || activeChatPlaybackId,
      playbackId: channelSupabaseData.playbackId || activeChatPlaybackId,
      title: channelSupabaseData.title || channelSupabaseData.streamName || 'Channel',
      name: channelSupabaseData.streamName || channelSupabaseData.title || 'Channel',
      logo: channelSupabaseData.logo || null,
      isActive: Boolean(channelSupabaseData.isActive),
      lastSeen: channelSupabaseData.lastSeen || null,
      creatorId: { value: channelSupabaseData.creatorId || creatorAddress || '' },
      supabaseCreatorId: channelSupabaseData.creatorId || creatorAddress || '',
      streamKey: channelSupabaseData.streamKey || '',
    } as Stream;
  }

  return null;
}, [activeChatPlaybackId, channelSupabaseData, creatorAddress, dedicatedChatStream, selectedChannel]);
const chatHeaderChannelIsLive = useMemo(() => {
  if (!chatHeaderChannel) return false;
  if (typeof chatHeaderChannel.isActive === 'boolean') return chatHeaderChannel.isActive;
  if (channelSupabaseData?.playbackId === chatHeaderChannel.playbackId) {
    return Boolean(channelSupabaseData?.isActive);
  }
  return false;
}, [channelSupabaseData?.isActive, channelSupabaseData?.playbackId, chatHeaderChannel]);

const dashboardRouteId = creatorUsername || dashboardRouteCreatorId;
const backToDashboardPath = dashboardRouteId
  ? `/dashboard/${encodeURIComponent(dashboardRouteId)}`
  : '/dashboard';
const creatorViewerLivePath = useMemo(() => {
  if (!dashboardRouteId || !selectedChannel?.playbackId) return null;
  return `/creator/${encodeURIComponent(dashboardRouteId)}/live/${encodeURIComponent(selectedChannel.playbackId)}`;
}, [dashboardRouteId, selectedChannel?.playbackId]);
const chatHeaderLiveDeskPath = useMemo(() => {
  if (!dashboardRouteId || !chatHeaderChannel?.playbackId) return null;
  return `/dashboard/${encodeURIComponent(dashboardRouteId)}/live/${encodeURIComponent(chatHeaderChannel.playbackId)}`;
}, [dashboardRouteId, chatHeaderChannel?.playbackId]);
const chatHeaderViewerLivePath = useMemo(() => {
  if (!dashboardRouteId || !chatHeaderChannel?.playbackId) return null;
  return `/creator/${encodeURIComponent(dashboardRouteId)}/live/${encodeURIComponent(chatHeaderChannel.playbackId)}`;
}, [dashboardRouteId, chatHeaderChannel?.playbackId]);

useEffect(() => {
  if (!selectedChannel?.playbackId) {
    previousLiveStateRef.current = false;
    setShowLiveTileAlert(false);
    return;
  }

  const becameLive = !previousLiveStateRef.current && selectedChannelIsLive;
  previousLiveStateRef.current = selectedChannelIsLive;
  if (!becameLive) return;

  setShowLiveTileAlert(true);
  const timer = setTimeout(() => setShowLiveTileAlert(false), 3800);
  return () => clearTimeout(timer);
}, [selectedChannel?.playbackId, selectedChannelIsLive]);

useEffect(() => {
  if (!chatHeaderChannel?.playbackId) {
    previousChatLiveStateRef.current = false;
    setShowChatLiveTileAlert(false);
    return;
  }

  const becameLive = !previousChatLiveStateRef.current && chatHeaderChannelIsLive;
  previousChatLiveStateRef.current = chatHeaderChannelIsLive;
  if (!becameLive) return;

  setShowChatLiveTileAlert(true);
  const timer = setTimeout(() => setShowChatLiveTileAlert(false), 3800);
  return () => clearTimeout(timer);
}, [chatHeaderChannel?.playbackId, chatHeaderChannelIsLive]);

// Fetch Supabase stream data for bio/socialLinks when channel is selected
useEffect(() => {
  const fetchChannelData = async () => {
    if (!selectedChannelId || !creatorAddress) {
      setChannelSupabaseData(null);
      return;
    }
    try {
      const creatorStreams = await getStreamsByCreator(creatorAddress);
      const channelData = creatorStreams.find(
        (s) => s.playbackId === selectedChannelId || s.id === selectedChannelId,
      );
      setChannelSupabaseData(channelData || null);
    } catch (error) {
      console.error('Error fetching channel data:', error);
      setChannelSupabaseData(null);
    }
  };
  fetchChannelData();
}, [selectedChannelId, creatorAddress]);

// Filter assets by selected channel if one is selected
const filteredAssetsForChannel = useMemo(() => {
  if (!selectedChannel || !creatorAddress) return [];
  const addr = creatorAddress.toLowerCase();
  return assets.filter((asset: Asset) => {
    if (!asset.playbackId) return false;
    const assetAddr = asset.creatorId?.value?.toLowerCase() || (asset as any).supabaseCreatorId?.toLowerCase();
    const channelAddr = selectedChannel.creatorId?.value?.toLowerCase() || (selectedChannel as any).supabaseCreatorId?.toLowerCase();
    return assetAddr === addr && assetAddr === channelAddr;
  });
}, [assets, selectedChannel, creatorAddress]);

const EmptyStatePanel = ({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-8 text-center">
    <div className="relative z-10 flex flex-col items-center gap-3">
      <div className="rounded-full border border-white/[0.07] bg-[#0f0f0f] p-3 text-[#888]">{icon}</div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="max-w-md text-sm text-gray-300">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  </div>
);

// console.log(filteredStreams);
  const filteredAssets = useMemo(() => {
    if (!creatorAddress) return [];
    const addr = creatorAddress.toLowerCase();
    return assets.filter((asset: Asset) => {
      if (!asset.playbackId) return false;
      const assetAddr = asset.creatorId?.value?.toLowerCase() || (asset as any).supabaseCreatorId?.toLowerCase();
      return assetAddr === addr;
    });
  }, [assets, creatorAddress]);

  // Fetch stream data for setup modal
  useEffect(() => {
    const fetchStreamForSetup = async () => {
      if (!pendingStreamId || !creatorAddress) return;
      
    try {
      // First try to find in Redux state by id
      const stream = filteredStreams.find(
        (s) => s.id === pendingStreamId || s.playbackId === pendingStreamId,
      );
      let playbackId = stream?.playbackId;
        
        // Fetch from Supabase to get full stream data
        const streams = await getStreamsByCreator(creatorAddress);
        let supabaseStream = null;
        
        if (stream && playbackId) {
          // Find by playbackId
          supabaseStream = streams.find(s => s.playbackId === playbackId);
        } else {
          // Try to find by pendingStreamId (could be id or playbackId)
          supabaseStream = streams.find(s => s.playbackId === pendingStreamId || s.id === pendingStreamId);
          if (supabaseStream) {
            playbackId = supabaseStream.playbackId;
          }
        }
        
          if (supabaseStream) {
            setStreamForSetup({
              playbackId: supabaseStream.playbackId,
              streamName: supabaseStream.streamName || '',
              streamMode: supabaseStream.streamMode || supabaseStream.viewMode || null,
              streamAmount: supabaseStream.streamAmount ?? supabaseStream.amount ?? null,
              Record: supabaseStream.Record ?? null,
            });
          } else if (stream && playbackId) {
            // Stream exists in Redux but not in Supabase yet - use Redux data
            setStreamForSetup({
              playbackId: playbackId,
              streamName: stream.name || stream.title || '',
              streamMode: (stream as any).viewMode || null,
              streamAmount: (stream as any).amount ?? null,
              Record: null,
            });
          } else {
            // If stream not found, still show modal with empty values
            // Try to use pendingStreamId as playbackId (it might be the playbackId)
            setStreamForSetup({
              playbackId: pendingStreamId,
              streamName: '',
              streamMode: null,
              streamAmount: null,
              Record: null,
            });
          }
      } catch (error) {
        console.error('Error fetching stream for setup:', error);
        // Still show modal with empty values
        setStreamForSetup({
          playbackId: pendingStreamId,
          streamName: '',
          streamMode: null,
          streamAmount: null,
          Record: null,
        });
      }
    };

    if (showStreamSetupModal && pendingStreamId) {
      fetchStreamForSetup();
    }
  }, [showStreamSetupModal, pendingStreamId, creatorAddress, filteredStreams]);

  const initiateLiveVideo = async (streamReference: string) => {
    if (!streamReference) return;

    const stream = filteredStreams.find(
      (s) => s.id === streamReference || s.playbackId === streamReference,
    );
    const pendingId = stream?.playbackId || stream?.id || streamReference;

    setPendingStreamId(pendingId);
    setShowStreamSetupModal(true);
  };

  const handleStreamSetupConfirm = async () => {
    if (!pendingStreamId) return;
    
    try {
      // Find stream to get its id for getStreamById
      const stream = filteredStreams.find(
        (s) => s.id === pendingStreamId || s.playbackId === pendingStreamId,
      );
      const playbackId = stream?.playbackId || pendingStreamId;

      if (!playbackId) {
        toast.error('Stream not found');
        setShowStreamSetupModal(false);
        return;
      }
      
      // Fetch stream details
      if (stream?.id) {
        await dispatch(getStreamById(stream.id));
      }
      const creatorRouteId = (await resolveCreatorRouteUsername()) || dashboardRouteCreatorId;
      if (!creatorRouteId) {
        toast.error('Creator username not found. Set a username in profile settings.');
        setShowStreamSetupModal(false);
        return;
      }

      // Close modal
      setShowStreamSetupModal(false);
      setPendingStreamId(null);
      setStreamForSetup(null);

      navigate.push(
        `/dashboard/${encodeURIComponent(creatorRouteId)}/live/${encodeURIComponent(playbackId)}`,
      );
    } catch (error: any) {
      console.error('Error fetching stream:', error);
      toast.error('Failed to start stream. Please try again.');
      setShowStreamSetupModal(false);
    }
  };

  const openLivePageFromStrip = async () => {
    if (!selectedChannel?.playbackId) return;
    const creatorRouteId = (await resolveCreatorRouteUsername()) || dashboardRouteCreatorId;
    if (!creatorRouteId) {
      toast.error('Creator username not found. Set a username in profile settings.');
      return;
    }
    navigate.push(
      `/dashboard/${encodeURIComponent(creatorRouteId)}/live/${encodeURIComponent(selectedChannel.playbackId)}`,
    );
  };
  const toggleSidebar = () => setSidebarCollapsed((x) => !x);
  // setSidebarCollapsed(!sidebarCollapsed)
  const toggleMobileMenu = () => setMobileMenuOpen((x) => !x);

  if (!ready || (authenticated && checkingProfile)) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#080808]">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <UserSetupModal
        open={showUserSetupModal}
        onClose={() => {
          // Only allow closing if not a first-time user
          if (!isFirstTimeUser) {
            setShowUserSetupModal(false);
          }
        }}
        onSuccess={handleProfileSetupSuccess}
        isFirstTime={isFirstTimeUser}
      />
      <StreamSetupModal
        open={showStreamSetupModal}
        onClose={() => {
          setShowStreamSetupModal(false);
          setPendingStreamId(null);
          setStreamForSetup(null);
        }}
        onConfirm={handleStreamSetupConfirm}
        stream={streamForSetup}
      />
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <MobileSidebar
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col h-screen overflow-hidden relative ${isDedicatedChatView ? 'gap-0' : 'gap-0 md:gap-4'}`}>
        <div className={`flex-1 flex overflow-hidden ${isDedicatedChatView ? 'gap-0' : 'gap-0 md:gap-4'}`}>
          <div className={`flex-1 w-full max-w-none mx-0 flex flex-col relative ${isDedicatedChatView ? 'my-0 mx-0' : 'my-0 md:my-2 mx-0 md:px-2'}`}>
          {/* Scrollable Content Area */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isDedicatedChatView ? 'pb-0' : 'pb-4'}`}>
          {/* <Analytics /> */}
          <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
          {!selectedChannel && !isDedicatedLiveView && !isDedicatedChatView && (
            <SectionCard title="">
              <EmptyStatePanel
                title={
                  !authenticated
                    ? 'Explore TVinBio'
                    : filteredStreams.length > 0
                    ? 'Choose a channel to continue'
                    : 'No channel selected'
                }
                description={
                  !authenticated
                    ? 'Browse the app in preview mode. Sign in to create channels, upload videos, go live, and unlock creator tools.'
                    : filteredStreams.length > 0
                    ? 'Pick one of your channels from the sidebar to manage videos, livestreams, and monetization settings.'
                    : 'Your dashboard is ready. Select a channel from the sidebar to open your channel gallery.'
                }
                icon={<Sparkles className="h-5 w-5" />}
                action={
                  !authenticated ? (
                    <button
                      type="button"
                      onClick={() => login()}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-yellow-300 via-yellow-400 to-emerald-400 px-5 text-sm font-semibold text-black transition hover:brightness-105"
                    >
                      Sign in to continue
                    </button>
                  ) : undefined
                }
              />
            </SectionCard>
          )}

          {/* Main selected channel experience + dedicated live/chat routes */}
          {(selectedChannel || isDedicatedLiveView || isDedicatedChatView) && (
            <SectionCard
              title=""
              contentClassName="w-full"
              sectionClassName={
                isDedicatedChatView
                  ? 'md:px-0 px-0 w-full py-0 pb-0 relative my-0 bg-transparent border-0 backdrop-blur-0 rounded-none'
                  : isDedicatedLiveView
                  ? undefined
                  : 'md:px-0 px-0 w-full py-0 pb-0 relative my-0 bg-transparent border-0 backdrop-blur-0 rounded-none'
              }
            >
                {isDedicatedLiveView ? (
                  <div className="-mx-3 md:-mx-6 -mb-4 md:-mb-10 space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#1a1a1a] px-4 py-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Creator Broadcast Desk</p>
                        <h3 className="text-lg font-semibold text-white">
                          {dedicatedLiveStream?.title || dedicatedLiveStream?.name || 'Live Stream'}
                        </h3>
                      </div>
                      <button
                        onClick={() => navigate.push(backToDashboardPath)}
                        className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#242424]"
                      >
                        Back to Dashboard
                      </button>
                    </div>

                    {dedicatedLiveStream && dedicatedLiveStream.streamKey ? (
                      <div
                        className="w-full overflow-hidden rounded-xl border border-white/[0.07] bg-black min-h-[560px] h-[calc(100vh-150px)] md:min-h-[720px] md:h-[calc(100vh-190px)]"
                      >
                        <DashboardBroadcast
                          streamName={dedicatedLiveStream.title || dedicatedLiveStream.name}
                          streamKey={dedicatedLiveStream.streamKey}
                          streamId={dedicatedLiveStream.id}
                          playbackId={dedicatedLiveStream.playbackId}
                          creatorAddress={creatorAddress || ''}
                          onStreamEnd={() => navigate.push(backToDashboardPath)}
                        />
                      </div>
                    ) : streamsLoading || resolvingStreamKey ? (
                      <div className="flex flex-col space-y-3">
                        <Skeleton className="h-[220px] w-full rounded-xl bg-black" />
                        <Skeleton className="h-[220px] w-full rounded-xl bg-black" />
                      </div>
                    ) : (
                      <EmptyStatePanel
                        title="Livestream not found"
                        description="This stream is unavailable or no longer belongs to your selected channel."
                        icon={<Radio className="h-5 w-5" />}
                        action={
                          <button
                            onClick={() => navigate.push(backToDashboardPath)}
                            className="rounded-lg bg-gradient-to-r from-yellow-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black"
                          >
                            Return to Dashboard
                          </button>
                        }
                      />
                    )}
                  </div>
                ) : isDedicatedChatView ? (
                  <div className="space-y-0">
                    {activeChatPlaybackId ? (
                      <>
                        {chatHeaderChannel ? (
                          <div className="w-full">
                            <CreatorChannelCard
                              title={channelSupabaseData?.title || chatHeaderChannel.title || chatHeaderChannel.name || 'Channel'}
                              logo={channelSupabaseData?.logo || chatHeaderChannel.logo || null}
                              bio={channelSupabaseData?.description || null}
                              socialLinks={{}}
                              defaultImage={image1}
                              isActive={chatHeaderChannelIsLive}
                              creatorId={creatorAddress || undefined}
                              creatorRouteId={creatorUsername || undefined}
                              compact
                              chatCompact
                              actionSlot={
                                chatHeaderChannelIsLive && chatHeaderLiveDeskPath ? (
                                  <button
                                    type="button"
                                    onClick={() => navigate.push(chatHeaderLiveDeskPath)}
                                    className="inline-flex h-8 items-center justify-center rounded-full border border-red-300/45 bg-red-500/10 px-3 text-[11px] font-semibold text-red-100 transition hover:bg-red-500/20"
                                  >
                                    Open live desk
                                  </button>
                                ) : undefined
                              }
                            />
                            {chatHeaderChannelIsLive && chatHeaderViewerLivePath ? (
                              <button
                                type="button"
                                onClick={() => navigate.push(chatHeaderViewerLivePath)}
                                className={`mt-2 inline-flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                                  showChatLiveTileAlert
                                    ? 'animate-pulse border-red-300/60 bg-red-500/16 text-red-100'
                                    : 'border-red-300/45 bg-red-500/12 text-red-100 hover:bg-red-500/20'
                                }`}
                                aria-label="Open public livestream page"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.85)]" />
                                  {chatHeaderChannel.title || chatHeaderChannel.name || 'Channel'} is live now
                                </span>
                                <span className="text-xs uppercase tracking-[0.12em] text-red-100/90">
                                  Open viewer page
                                </span>
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        <ChannelChatExperience
                          playbackId={activeChatPlaybackId}
                          creatorId={creatorAddress || ''}
                          streamName={dedicatedChatStream?.title || dedicatedChatStream?.name || selectedChannel?.title || 'Channel'}
                          onBack={() => navigate.push(backToDashboardPath)}
                          backLabel="Back to Dashboard"
                        />
                      </>
                    ) : (
                      <EmptyStatePanel
                        title="Choose a channel to open chat"
                        description="Select a channel from the sidebar, then open chat."
                        icon={<Sparkles className="h-5 w-5" />}
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full pb-4 md:pb-6">
                    <div className="relative overflow-hidden border border-white/[0.08] bg-[#08090f] rounded-none md:rounded-2xl">
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(250,204,21,0.15),transparent_35%),radial-gradient(circle_at_84%_8%,rgba(20,184,166,0.14),transparent_33%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_42%)]" />

                      <div className="relative px-3 pt-4 sm:px-4 sm:pt-5 md:px-6 md:pt-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-3">
                              <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.16] bg-[#111824]">
                                {channelSupabaseData?.logo || selectedChannel.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={(channelSupabaseData?.logo || selectedChannel.logo) as string}
                                    alt={selectedChannel.title || selectedChannel.name || 'Channel'}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white">
                                    {(selectedChannel.title || selectedChannel.name || 'C').charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <h2 className="truncate text-xl sm:text-2xl font-semibold text-white">
                                  {channelSupabaseData?.title || selectedChannel.title || selectedChannel.name || 'Your Channel'}
                                </h2>
                                <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-gray-300">
                                  {channelSupabaseData?.description?.trim() || 'Creator dashboard and publishing gallery.'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                                  selectedChannelIsLive
                                    ? 'border-red-400/45 bg-red-500/10 text-red-200'
                                    : 'border-white/[0.14] bg-white/[0.03] text-gray-300'
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    selectedChannelIsLive ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]' : 'bg-gray-500'
                                  }`}
                                />
                                {selectedChannelIsLive ? 'Live now' : 'Offline'}
                              </span>
                              <span className="inline-flex items-center rounded-full border border-white/[0.12] bg-black/30 px-3 py-1 text-xs text-gray-300">
                                {filteredAssetsForChannel.length} video{filteredAssetsForChannel.length === 1 ? '' : 's'}
                              </span>
                              <span className="inline-flex max-w-full sm:max-w-[320px] items-center rounded-full border border-white/[0.12] bg-black/30 px-3 py-1 text-xs text-gray-400">
                                <span className="truncate">ID: {selectedChannel.playbackId}</span>
                              </span>
                              {selectedChannelIsLive ? (
                                <button
                                  type="button"
                                  onClick={openLivePageFromStrip}
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                    showLiveTileAlert
                                      ? 'animate-pulse border-red-300/55 bg-red-500/15 text-red-100'
                                      : 'border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20'
                                  }`}
                                >
                                  <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.75)]" />
                                  Broadcast is live
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-end">
                            <button
                              type="button"
                              onClick={() => setIsDialogOpen2(true)}
                              className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.15] bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                            >
                              Upload video
                            </button>

                            {selectedChannelIsLive ? (
                              <>
                                <button
                                  type="button"
                                  onClick={openLivePageFromStrip}
                                  className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-fuchsia-500 px-4 text-sm font-semibold text-white transition hover:opacity-90"
                                >
                                  Open live desk
                                </button>
                                {creatorViewerLivePath ? (
                                  <button
                                    type="button"
                                    onClick={() => navigate.push(creatorViewerLivePath)}
                                    className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-300/45 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 sm:col-span-2 lg:col-span-1"
                                  >
                                    Watch stream
                                  </button>
                                ) : null}
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  initiateLiveVideo(selectedChannel.playbackId || selectedChannel.id)
                                }
                                className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-yellow-300 via-yellow-400 to-emerald-400 px-4 text-sm font-semibold text-black transition hover:brightness-105"
                              >
                                Go live
                              </button>
                            )}
                          </div>
                        </div>

                        {selectedChannelIsLive ? (
                          <div className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                            Broadcast is active. Use <span className="font-semibold">Watch stream</span> to open the viewer experience or <span className="font-semibold">Open live desk</span> to manage the session.
                          </div>
                        ) : null}
                      </div>

                      <div className="relative px-3 pb-6 pt-5 sm:px-4 md:px-6 md:pb-9 md:pt-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-xl font-semibold text-white">Gallery</h3>
                          <span className="text-xs text-gray-400">
                            {filteredAssetsForChannel.length} item{filteredAssetsForChannel.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {assetsLoading ? (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: 6 }, (_, index) => (
                              <div key={index} className="flex flex-col space-y-3">
                                <Skeleton className="h-[190px] w-full rounded-xl bg-black" />
                                <div className="space-y-2">
                                  <Skeleton className="h-4 w-full rounded-md bg-black" />
                                  <Skeleton className="h-7 w-20 rounded-md bg-black" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : filteredAssetsForChannel.length === 0 ? (
                          <EmptyStatePanel
                            title="No videos yet"
                            description="Upload your first video to start building your channel library and gated content catalog."
                            icon={<Clapperboard className="h-5 w-5" />}
                            action={
                              <button
                                onClick={() => setIsDialogOpen2(true)}
                                className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
                              >
                                <RiVideoAddLine className="w-5 h-5" />
                                Upload video
                              </button>
                            }
                          />
                        ) : (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {filteredAssetsForChannel.map((asset) => (
                              <div key={asset.id}>
                                <VideoPaymentGate
                                  playbackId={asset.playbackId}
                                  creatorId={asset.creatorId?.value || creatorAddress || ''}
                                  onPlayClick={async () => {
                                    if (!asset.playbackId) return;
                                    const creatorRouteId = await resolveCreatorRouteUsername();
                                    if (!creatorRouteId) {
                                      toast.error('Creator username not found. Set a username in profile settings.');
                                      return;
                                    }
                                    navigate.push(
                                      `/creator/${encodeURIComponent(creatorRouteId)}/video/${encodeURIComponent(asset.playbackId)}`,
                                    );
                                  }}
                                >
                                  <VideoCard
                                    title={asset.name}
                                    assetData={asset}
                                    imageUrl={image1}
                                    playbackId={asset.playbackId}
                                    createdAt={new Date(asset.createdAt)}
                                    format={(asset as any).videoSpec?.format}
                                  />
                                </VideoPaymentGate>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>
          )}
          </div>
          {/* Bottom Navigation - Fixed at bottom of middle column */}
          <div className="flex-shrink-0 z-10">
            <BottomNav />
          </div>
          </div>
        </div>

        <Dialog.Root open={isDialogOpen2} onOpenChange={setIsDialogOpen2} modal={false}>
          <Dialog.Portal forceMount>
            <Dialog.Overlay
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100]"
              style={{
                display: isDialogOpen2 ? 'block' : 'none',
                pointerEvents: isDialogOpen2 ? 'auto' : 'none',
              }}
            />
            <Dialog.Content
              forceMount
              style={{
                display: isDialogOpen2 ? 'flex' : 'none',
                pointerEvents: isDialogOpen2 ? 'auto' : 'none',
              }}
              className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#0f0f0f] border border-white/[0.07] px-10 max-sm:px-6 py-6 shadow-2xl z-[101]"
            >
              <Dialog.Title className="text-white text-center flex items-center gap-2 my-4 text-xl font-bold">
                <RiVideoAddLine className="text-yellow-400 text-sm" /> Upload Video Asset
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Upload a video file to your channel
              </Dialog.Description>
              <UploadVideoAsset
                onClose={() => {
                  setIsDialogOpen2(false);
                }}
                onStatusChange={handleVideoUploadStatusChange}
              />
              <Dialog.Close asChild>
                <button
                  className="absolute right-2.5 top-2.5 inline-flex size-[25px] appearance-none items-center justify-center rounded-full text-white hover:bg-white/10 focus:shadow-[0_0_0_2px] focus:shadow-yellow-500 focus:outline-none transition-colors"
                  aria-label="Close"
                >
                  <IoMdClose className="text-white font-medium text-4xl" />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {videoUploadNotice && (
          <div className="fixed bottom-6 right-4 z-[120] w-[min(92vw,360px)]">
            {videoUploadNotice.minimized ? (
              <button
                type="button"
                onClick={() =>
                  setVideoUploadNotice((prev) =>
                    prev ? { ...prev, minimized: false } : prev,
                  )
                }
                className="w-full rounded-lg border border-white/[0.07] bg-[#1a1a1a] px-3 py-2 text-left"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#888]">
                  Upload In Background
                </p>
                <p className="mt-1 text-sm font-semibold text-white line-clamp-1">
                  {videoUploadNotice.title}
                </p>
              </button>
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-[#0f0f0f] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#888]">
                      Upload Status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white line-clamp-1">
                      {videoUploadNotice.title}
                    </p>
                    {videoUploadNotice.message && (
                      <p className="mt-1 text-xs text-gray-300">
                        {videoUploadNotice.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setVideoUploadNotice((prev) =>
                          prev ? { ...prev, minimized: true } : prev,
                        )
                      }
                      className="rounded-md border border-white/[0.07] px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-[#242424]"
                    >
                      Minimize
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoUploadNotice(null)}
                      className="rounded-md border border-white/[0.07] px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-[#242424]"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-[#1a1a1a] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-cyan-300 to-teal-400 transition-all duration-300"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, videoUploadNotice.progress || 0),
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-300 capitalize">
                      {videoUploadNotice.phase.replace('-', ' ')}
                    </span>
                    <span className="text-xs font-semibold text-cyan-200">
                      {Math.round(videoUploadNotice.progress || 0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Dashboard;
