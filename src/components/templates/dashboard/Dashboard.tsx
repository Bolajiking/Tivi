'use client';
import Header from '@/components/Header';
import Analytics from './Analytics';
import SectionCard from '@/components/Card/SectionCard';
import { ChannelCard, VideoCard } from '@/components/Card/Card';
import { ChannelCardRedesign } from '@/components/Card/ChannelCardRedesign';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
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
  const { ready, authenticated } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const navigate = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const dashboardRouteCreatorId = typeof params?.creatorId === 'string' ? decodeURIComponent(params.creatorId) : '';
  const dispatch = useDispatch<AppDispatch>();
  const { streams, loading: streamsLoading, error: streamsError, stream: currentStream } = useSelector((state: RootState) => state.streams);
  const { assets, loading: assetsLoading, error: assetsError } = useSelector((state: RootState) => state.assets);
  const searchParams = useSearchParams();
  const { selectedChannelId: contextChannelId, setSelectedChannelId } = useChannel();
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [showStreamSetupModal, setShowStreamSetupModal] = useState(false);
  const [pendingStreamId, setPendingStreamId] = useState<string | null>(null);
  const [streamForSetup, setStreamForSetup] = useState<any>(null);
  const [channelSupabaseData, setChannelSupabaseData] = useState<any>(null);
  const [creatorUsername, setCreatorUsername] = useState<string | null>(null);

  // Get channelId from URL query params (for navigation from outside dashboard)
  const urlChannelId = searchParams?.get('channelId');
  
  // Use URL channelId if available, otherwise use context channelId
  const selectedChannelId = urlChannelId || contextChannelId || initialLivePlaybackId || null;
  
  // Get creator address (wallet address)
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const creatorAddress = useMemo(() => walletAddress || null, [walletAddress]);
  const [isDialogOpen2, setIsDialogOpen2] = useState(false);
  const [videoUploadNotice, setVideoUploadNotice] = useState<(VideoUploadNotice & { minimized: boolean }) | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'livestreams'>('videos');
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const unsubscribe = subscribeToCreatorStreamUpdates(creatorAddress, () => {
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
  }, [creatorAddress, dispatch]);

  useEffect(() => {
    if (streamsError) {
      toast.error('Failed to fetch streams: ' + streamsError);
    }
    if (assetsError) {
      toast.error('Failed to fetch assets: ' + assetsError);
    }
  }, [streamsError, assetsError]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (ready && !authenticated) {
      navigate.push('/auth/login');
    }
  }, [ready, authenticated, navigate]);

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
    if (onLegacyDashboardPath && urlChannelId) {
      navigate.replace(
        `/dashboard/${encodeURIComponent(creatorUsername)}?channelId=${encodeURIComponent(urlChannelId)}`,
      );
      return;
    }

    const onUsernameDashboardPath = pathname?.startsWith('/dashboard/');
    const requestedCreatorId = dashboardRouteCreatorId?.trim().toLowerCase();
    const canonicalCreatorId = creatorUsername.trim().toLowerCase();
    if (onUsernameDashboardPath && dashboardRouteCreatorId && requestedCreatorId !== canonicalCreatorId) {
      const pathSegments = (pathname || '').split('/');
      const suffixPath = pathSegments.length > 3 ? `/${pathSegments.slice(3).join('/')}` : '';
      const channelQuery = urlChannelId
        ? `?channelId=${encodeURIComponent(urlChannelId)}`
        : '';
      navigate.replace(`/dashboard/${encodeURIComponent(creatorUsername)}${suffixPath}${channelQuery}`);
    }
  }, [creatorUsername, dashboardRouteCreatorId, navigate, pathname, urlChannelId]);

  // Sync URL channelId to context when navigating from outside dashboard
  useEffect(() => {
    if (urlChannelId && urlChannelId !== contextChannelId) {
      setSelectedChannelId(urlChannelId);
    }
  }, [urlChannelId, contextChannelId, setSelectedChannelId]);

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
  return streams.filter((stream) => !!stream.playbackId && stream.creatorId?.value === creatorAddress);
}, [streams, creatorAddress]);

// Get the selected channel stream
const selectedChannel = useMemo(() => {
  if (!selectedChannelId) return null;
  return filteredStreams.find((stream) => stream.playbackId === selectedChannelId) || null;
}, [selectedChannelId, filteredStreams]);
const isDedicatedLiveView = Boolean(initialLivePlaybackId);
const isDedicatedChatView = Boolean(openChatView);
const activeChatPlaybackId = useMemo(() => {
  return initialChatPlaybackId || selectedChannelId || filteredStreams[0]?.playbackId || null;
}, [filteredStreams, initialChatPlaybackId, selectedChannelId]);
const dedicatedLiveStream = useMemo(() => {
  if (!initialLivePlaybackId) return null;
  return filteredStreams.find((stream) => stream.playbackId === initialLivePlaybackId) || null;
}, [filteredStreams, initialLivePlaybackId]);
const dedicatedChatStream = useMemo(() => {
  if (!activeChatPlaybackId) return null;
  return filteredStreams.find((stream) => stream.playbackId === activeChatPlaybackId) || null;
}, [activeChatPlaybackId, filteredStreams]);
const dashboardRouteId = creatorUsername || dashboardRouteCreatorId;
const backToDashboardPath = dashboardRouteId
  ? `/dashboard/${encodeURIComponent(dashboardRouteId)}${
      (selectedChannel?.playbackId || activeChatPlaybackId)
        ? `?channelId=${encodeURIComponent(selectedChannel?.playbackId || activeChatPlaybackId || '')}`
        : ''
    }`
  : '/dashboard';

// Fetch Supabase stream data for bio/socialLinks when channel is selected
useEffect(() => {
  const fetchChannelData = async () => {
    if (!selectedChannel || !creatorAddress) {
      setChannelSupabaseData(null);
      return;
    }
    try {
      const streams = await getStreamsByCreator(creatorAddress);
      const channelData = streams.find(s => s.playbackId === selectedChannel.playbackId);
      setChannelSupabaseData(channelData || null);
    } catch (error) {
      console.error('Error fetching channel data:', error);
      setChannelSupabaseData(null);
    }
  };
  fetchChannelData();
}, [selectedChannel, creatorAddress]);

// Helper to parse socialLinks from array format
const parseSocialLinks = (socialLinksArray: string[] | null | undefined): { twitter?: string; instagram?: string; youtube?: string; website?: string } => {
  const socialLinks: { twitter?: string; instagram?: string; youtube?: string; website?: string } = {};
  if (!Array.isArray(socialLinksArray)) return socialLinks;
  socialLinksArray.forEach((jsonString: string) => {
    if (typeof jsonString === 'string') {
      try {
        const parsed = JSON.parse(jsonString);
        Object.keys(parsed).forEach((key) => {
          const value = parsed[key];
          if (key === 'twitter' && value) socialLinks.twitter = value;
          else if (key === 'instagram' && value) socialLinks.instagram = value;
          else if (key === 'youtube' && value) socialLinks.youtube = value;
          else if (key === 'website' && value) socialLinks.website = value;
        });
      } catch (e) {
        console.warn('Failed to parse social link JSON:', jsonString);
      }
    }
  });
  return socialLinks;
};

// Filter assets by selected channel if one is selected
const filteredAssetsForChannel = useMemo(() => {
  if (!selectedChannel || !creatorAddress) return [];
  return assets.filter((asset: Asset) => 
    !!asset.playbackId && 
    asset.creatorId?.value === creatorAddress &&
    asset.creatorId?.value === selectedChannel.creatorId?.value
  );
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
  <div className="relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 text-center">
    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-yellow-500/15 blur-2xl" />
    <div className="absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-teal-500/15 blur-2xl" />
    <div className="relative z-10 flex flex-col items-center gap-3">
      <div className="rounded-full border border-white/20 bg-white/10 p-3 text-yellow-300">{icon}</div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="max-w-md text-sm text-gray-300">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  </div>
);

// console.log(filteredStreams);
  const filteredAssets = useMemo(() => {
    if (!creatorAddress) return [];
    return assets.filter((asset: Asset) => !!asset.playbackId && asset.creatorId?.value === creatorAddress);
  }, [assets, creatorAddress]);

  // NEW: only when not loading, no error, and zero existing streams
  const canCreateStream = !streamsLoading && !streamsError && filteredStreams.length === 0;

  // Fetch stream data for setup modal
  useEffect(() => {
    const fetchStreamForSetup = async () => {
      if (!pendingStreamId || !creatorAddress) return;
      
      try {
        // First try to find in Redux state by id
        let stream = filteredStreams.find(s => s.id === pendingStreamId);
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

  const initiateLiveVideo = async (id: string) => {
    if (!id) return;
    
    // Find the stream to get its playbackId
    const stream = filteredStreams.find(s => s.id === id);
    if (!stream || !stream.playbackId) {
      toast.error('Stream not found');
      return;
    }
    
    // Show setup modal first with stream id (we'll get playbackId in the modal)
    setPendingStreamId(id);
    setShowStreamSetupModal(true);
  };

  const handleStreamSetupConfirm = async () => {
    if (!pendingStreamId) return;
    
    try {
      // Find stream to get its id for getStreamById
      const stream = filteredStreams.find(s => s.id === pendingStreamId);
      if (!stream || !stream.playbackId) {
        toast.error('Stream not found');
        setShowStreamSetupModal(false);
        return;
      }
      
      // Fetch stream details
      await dispatch(getStreamById(stream.id));
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
        `/dashboard/${encodeURIComponent(creatorRouteId)}/live/${encodeURIComponent(stream.playbackId)}?channelId=${encodeURIComponent(stream.playbackId)}`,
      );
    } catch (error: any) {
      console.error('Error fetching stream:', error);
      toast.error('Failed to start stream. Please try again.');
      setShowStreamSetupModal(false);
    }
  };

  const handleStopStreaming = () => {
    setIsStreaming(false);
    setActiveStreamId(null);
  };

  // Get active stream data from Redux state
  const activeStreamData = useMemo(() => {
    if (!isStreaming || !activeStreamId || !currentStream) return null;
    
    // Check if currentStream has the required properties
    if (currentStream.streamKey && currentStream.playbackId) {
      return {
        id: currentStream.id,
        streamKey: currentStream.streamKey,
        playbackId: currentStream.playbackId,
        name: currentStream.name || currentStream.title || 'Live Stream',
        isActive: currentStream.isActive || false,
        createdAt: currentStream.createdAt || new Date().toISOString(),
      };
    }
    return null;
  }, [isStreaming, activeStreamId, currentStream]);
  const toggleSidebar = () => setSidebarCollapsed((x) => !x);
  // setSidebarCollapsed(!sidebarCollapsed)
  const toggleMobileMenu = () => setMobileMenuOpen((x) => !x);

  if (!ready || !authenticated || checkingProfile) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-black via-gray-950 to-black">
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
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-black via-gray-950 to-black">
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
      <div className="flex-1 flex flex-col gap-4 h-screen overflow-hidden relative">
        <div className="flex-1 flex gap-4 overflow-hidden">
          <div className="flex-1 my-2 ml-2 flex flex-col relative">
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto pb-4">
          {/* <Analytics /> */}
          <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
          {/* Only show "Your Channel" section when a channel is selected */}
          {selectedChannel && !isDedicatedLiveView && (
            <div
              className={`md:px-6 px-3 w-full relative rounded-lg ${
                isDedicatedChatView ? 'py-1 pb-2 my-1.5' : 'py-2 pb-4 my-2'
              }`}
            >
              {streamsLoading ? (
                Array.from({ length: 1 }, (_, index) => (
                  <div key={index} className="flex flex-col space-y-2">
                    <Skeleton className="h-[120px] w-[318px] rounded-xl bg-black" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 md:w-[316px] rounded-md bg-black" />
                      <Skeleton className="h-7 w-[44px] rounded-md bg-black" />
                    </div>
                  </div>
                ))
              ) : (
                <div key={selectedChannel.id} className="col-span-full w-full">
                  <CreatorChannelCard
                    title={channelSupabaseData?.title || selectedChannel.title || selectedChannel.name || 'Your Channel'}
                    logo={channelSupabaseData?.logo || selectedChannel.logo || null}
                    bio={channelSupabaseData?.description || null}
                    socialLinks={parseSocialLinks(channelSupabaseData?.socialLinks) || {}}
                    defaultImage={image1}
                    isActive={selectedChannel.isActive || false}
                    creatorId={creatorAddress || undefined}
                    creatorRouteId={creatorUsername || undefined}
                    compact
                    chatCompact={isDedicatedChatView}
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Show empty state when no channel is selected and user has channels */}
          {!selectedChannel && !isDedicatedLiveView && !canCreateStream && filteredStreams.length > 0 && (
            <SectionCard title="">
              <EmptyStatePanel
                title="Choose a channel to continue"
                description="Pick one of your channels from the sidebar to manage videos, livestreams, and monetization settings."
                icon={<Sparkles className="h-5 w-5" />}
              />
            </SectionCard>
          )}
          
          {/* Show empty state when no channel is selected */}
          {!selectedChannel && !isDedicatedLiveView && (
            <SectionCard title="">
              <EmptyStatePanel
                title="No channel selected"
                description="Your dashboard is ready. Select a channel to view channel-specific videos and livestream controls."
                icon={<Sparkles className="h-5 w-5" />}
              />
            </SectionCard>
          )}

          {/* Only show tabs section when a channel is selected */}
          {(selectedChannel || isDedicatedLiveView || isDedicatedChatView) && (
            <>
              {!isDedicatedLiveView && !isDedicatedChatView && <hr className="border-white/20" />}
              <SectionCard
                title=""
                contentClassName={isDedicatedLiveView || isDedicatedChatView ? 'w-full' : undefined}
              >
                {isDedicatedLiveView ? (
                  <div className="-mx-3 md:-mx-6 -mb-4 md:-mb-10 space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-white/20 bg-gradient-to-r from-white/10 to-white/5 px-4 py-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Creator Broadcast Desk</p>
                        <h3 className="text-lg font-semibold text-white">
                          {dedicatedLiveStream?.title || dedicatedLiveStream?.name || 'Live Stream'}
                        </h3>
                      </div>
                      <button
                        onClick={() => navigate.push(backToDashboardPath)}
                        className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                      >
                        Back to Dashboard
                      </button>
                    </div>

                    {dedicatedLiveStream ? (
                      <div
                        className="w-full overflow-hidden rounded-xl border border-white/20 bg-black min-h-[560px] h-[calc(100vh-150px)] md:min-h-[720px] md:h-[calc(100vh-190px)]"
                      >
                        <DashboardBroadcast
                          streamName={dedicatedLiveStream.title || dedicatedLiveStream.name}
                          streamKey={dedicatedLiveStream.streamKey}
                          playbackId={dedicatedLiveStream.playbackId}
                          creatorAddress={creatorAddress || ''}
                          onStreamEnd={() => navigate.push(backToDashboardPath)}
                        />
                      </div>
                    ) : streamsLoading ? (
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
                  <div className="-mx-3 md:-mx-6 -mb-4 md:-mb-10 space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-white/20 bg-gradient-to-r from-white/10 to-white/5 px-4 py-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Channel Community</p>
                        <h3 className="text-lg font-semibold text-white">
                          {dedicatedChatStream?.title || dedicatedChatStream?.name || 'Channel Chat'}
                        </h3>
                      </div>
                    </div>
                    {activeChatPlaybackId ? (
                      <ChannelChatExperience
                        playbackId={activeChatPlaybackId}
                        creatorId={creatorAddress || ''}
                        streamName={dedicatedChatStream?.title || dedicatedChatStream?.name || selectedChannel?.title || 'Channel'}
                        onBack={() => navigate.push(backToDashboardPath)}
                        backLabel="Back to Dashboard"
                      />
                    ) : (
                      <EmptyStatePanel
                        title="Choose a channel to open chat"
                        description="Select a channel from the sidebar, then open chat."
                        icon={<Sparkles className="h-5 w-5" />}
                      />
                    )}
                  </div>
                ) : (
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'videos' | 'livestreams')} className="w-full col-span-full">
                  <TabsList className="grid w-full grid-cols-2 bg-white/10 backdrop-blur-sm border border-white/20 p-1">
                    <TabsTrigger 
                      value="videos" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-teal-500 data-[state=active]:text-black text-white"
                    >
                      Videos
                    </TabsTrigger>
                    <TabsTrigger 
                      value="livestreams"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-teal-500 data-[state=active]:text-black text-white"
                    >
                      Livestreams
                    </TabsTrigger>
                  </TabsList>

                  {/* Videos Tab */}
                  <TabsContent value="videos" className="mt-4">
                    {assetsLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }, (_, index) => (
                          <div key={index} className="flex flex-col space-y-3">
                            <Skeleton className="h-[180px] w-full rounded-xl bg-black" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-full rounded-md bg-black" />
                              <Skeleton className="h-7 w-20 rounded-md bg-black" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {filteredAssetsForChannel.length === 0 ? (
                          <EmptyStatePanel
                            title="No videos yet"
                            description="Upload your first video to start building your channel library and gated content catalog."
                            icon={<Clapperboard className="h-5 w-5" />}
                            action={
                              <Dialog.Root open={isDialogOpen2} onOpenChange={setIsDialogOpen2} modal={false}>
                                <Dialog.Trigger asChild>
                                  <button
                                    onClick={() => setIsDialogOpen2(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
                                  >
                                    <RiVideoAddLine className="w-5 h-5" />
                                    Upload Video
                                  </button>
                                </Dialog.Trigger>
                                <Dialog.Portal forceMount>
                                  <Dialog.Overlay
                                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
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
                                    className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-white/20 px-10 max-sm:px-6 py-6 shadow-2xl z-[101]"
                                  >
                                    <Dialog.Title className="text-white text-center flex items-center gap-2 my-4 text-xl font-bold">
                                      <RiVideoAddLine className="text-yellow-400 text-sm" /> Upload Video Asset
                                    </Dialog.Title>
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
                            }
                          />
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                            {/* Upload Asset Button */}
                            <Dialog.Root open={isDialogOpen2} onOpenChange={setIsDialogOpen2} modal={false}>
                              <Dialog.Trigger asChild>
                                <div className="flex w-full flex-col cursor-pointer" onClick={() => setIsDialogOpen2(true)}>
                                  <div className="w-full justify-center flex items-center h-[180px] rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200">
                                    <RiVideoAddLine className="text-yellow-400 w-24 h-24" />
                                  </div>
                                  <div className="text-white text-xl font-bold pt-2 text-center">Upload Asset</div>
                                </div>
                              </Dialog.Trigger>
                              <Dialog.Portal forceMount>
                                <Dialog.Overlay
                                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
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
                                  className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-white/20 px-10 max-sm:px-6 py-6 shadow-2xl z-[101]"
                                >
                                  <Dialog.Title className="text-white text-center flex items-center gap-2 my-4 text-xl font-bold">
                                    <RiVideoAddLine className="text-yellow-400 text-sm" /> Upload Video Asset
                                  </Dialog.Title>
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
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* Livestreams Tab */}
                  <TabsContent value="livestreams" className="mt-4 -mx-3 md:-mx-6 -mb-4 md:-mb-10">
                    {isStreaming && activeStreamData ? (
                      <div className="w-[calc(100%+1.5rem)] md:w-[calc(100%+3rem)] border border-white/20 rounded-lg overflow-hidden bg-black" style={{ minHeight: '600px', height: 'calc(100vh - 400px)' }}>
                        <DashboardBroadcast
                          streamName={activeStreamData.name}
                          streamKey={activeStreamData.streamKey}
                          playbackId={activeStreamData.playbackId}
                          creatorAddress={creatorAddress || ''}
                          onStreamEnd={handleStopStreaming}
                        />
                      </div>
                    ) : streamsLoading ? (
                      Array.from({ length: 1 }, (_, index) => (
                        <div key={index} className="flex flex-col space-y-3">
                          <Skeleton className="h-[180px] w-[318px] rounded-xl bg-black" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 md:w-[316px] rounded-md bg-black" />
                            <Skeleton className="h-7 w-[44px] rounded-md bg-black" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        {selectedChannel ? (
                          <div className="mb-4">
                            <ChannelCardRedesign
                              title={selectedChannel.title || selectedChannel.name}
                              image={image1}
                              logo={selectedChannel.logo}
                              goLive={() => initiateLiveVideo(selectedChannel.id)}
                              streamId={selectedChannel.id}
                              playbackId={selectedChannel.playbackId}  
                              playb={selectedChannel.playbackId}
                              lastSeen={new Date(selectedChannel.lastSeen || 0)}
                              status={selectedChannel.isActive}
                              showName={false}
                              showSocialLinks={false}
                              useThumbnail={true}
                            />
                            {/* Go Live Button */}
                            <div className="mt-4">
                              <button
                                onClick={() => initiateLiveVideo(selectedChannel.id)}
                                className="w-full bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                              >
                                <RiVideoAddLine className="w-5 h-5" />
                                Go Live
                              </button>
                            </div>
                          </div>
                        ) : (
                          <EmptyStatePanel
                            title="No livestream available"
                            description="This channel has no active livestream configured yet. Set one up and go live when you're ready."
                            icon={<Radio className="h-5 w-5" />}
                          />
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
                )}
              </SectionCard>
            </>
          )}
          </div>
          {/* Bottom Navigation - Fixed at bottom of middle column */}
          <div className="flex-shrink-0 z-10">
            <BottomNav />
          </div>
          </div>
        </div>

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
                className="w-full rounded-lg border border-cyan-300/30 bg-gradient-to-r from-[#0b1018] via-[#0d1320] to-[#0f1b1f] px-3 py-2 text-left shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">
                  Upload In Background
                </p>
                <p className="mt-1 text-sm font-semibold text-white line-clamp-1">
                  {videoUploadNotice.title}
                </p>
              </button>
            ) : (
              <div className="rounded-xl border border-cyan-300/30 bg-gradient-to-br from-[#0d121a] via-[#111827] to-[#0f1d1f] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.52)] backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">
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
                      className="rounded-md border border-white/20 px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/10"
                    >
                      Minimize
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoUploadNotice(null)}
                      className="rounded-md border border-white/20 px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
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
