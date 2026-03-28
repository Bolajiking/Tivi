'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllStreams } from '@/features/streamAPI';
import { getAssets } from '@/features/assetsAPI';
import { AppDispatch, RootState } from '@/store/store';
import { Stream, Asset } from '@/interfaces';
import { VideoCard } from '@/components/Card/Card';
import { CreatorChannelCard } from './CreatorChannelCard';
import image1 from '@/assets/image1.png';
import { Bars } from 'react-loader-spinner';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  getUserProfile,
  getUserProfileByUsername,
  subscribeToCreatorStreamUpdates,
  subscribeToStreamStatus,
  subscribeToCreator,
  unsubscribeFromCreator,
  getStreamsByCreator,
} from '@/lib/supabase-service';
import SectionCard from '@/components/Card/SectionCard';
import { ChevronLeft, ChevronRight, Clapperboard, Radio, X } from 'lucide-react';
import clsx from 'clsx';
import Logo from '@/components/Logo';
import { usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SidebarBottomLinks from '@/components/SidebarBottomLinks';
import BottomNav from '@/components/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import Header from '@/components/Header';
import SidebarUserPanel from '@/components/SidebarUserPanel';
import { PlayerWithControls } from '@/components/templates/player/player/Player';
import { useLivePlaybackInfo } from '@/app/hook/useLivePlaybackInfo';
import { PlayerLoading } from '@/components/templates/player/player/Player';
import { VideoPlayer } from '@/components/templates/dashboard/VideoPlayer';
import { CreatorPaymentGate } from '@/components/CreatorPaymentGate';
import { StreamPaymentGate } from '@/components/StreamPaymentGate';
import { VideoPaymentGate } from '@/components/VideoPaymentGate';
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
import { ChannelChatExperience } from '@/components/templates/chat/ChannelChatExperience';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import { RiVideoAddLine } from 'react-icons/ri';

interface CreatorProfileData {
  creatorId: string;
  displayName: string;
  bio: string;
  avatar: string;
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    website?: string;
  };
  theme: {
    backgroundColor: string;
    textColor: string;
    accentColor: string;
  };
  isVerified: boolean;
  totalViews: number;
  totalStreams: number;
  totalVideos: number;
}

interface CreatorProfileProps {
  creatorId: string; // This will now be the username from the URL
  initialVideoPlaybackId?: string;
  initialStreamPlaybackId?: string;
  initialChatPlaybackId?: string;
  openChatView?: boolean;
}

// Stream Player Component for dedicated livestream viewing
function StreamPlayerView({
  playbackId,
  title,
  creatorId,
  backLabel,
  onBack,
}: {
  playbackId: string;
  title: string;
  creatorId: string;
  backLabel: string;
  onBack: () => void;
}) {
  const { src, loading, error, status } = useLivePlaybackInfo(playbackId);

  if (loading) {
    return (
      <div className="w-full min-h-[560px] flex items-center justify-center rounded-xl border border-white/[0.07] bg-[#06070a]">
        <PlayerLoading>
          <div className="flex flex-col items-center gap-2">
            <Bars width={40} height={40} color="#facc15" />
            <span className="text-white text-sm">Loading livestream...</span>
          </div>
        </PlayerLoading>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-[560px] flex flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-black/70">
        <p className="text-red-300 mb-4">Failed to load stream: {error}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-white/[0.07] bg-[#1a1a1a] hover:bg-[#242424] text-white transition-colors"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="rounded-xl border border-white/[0.07] bg-[#1a1a1a] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Live Broadcast</p>
            <h3 className="text-white font-bold text-lg">{title}</h3>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-white/[0.07] bg-[#1a1a1a] hover:bg-[#242424] text-white transition-colors text-sm font-semibold"
          >
            {backLabel}
          </button>
        </div>
      </div>
      <div
        className="w-full overflow-hidden rounded-xl border border-white/[0.07] bg-black min-h-[520px] h-[calc(100vh-150px)] md:min-h-[700px] md:h-[calc(100vh-180px)]"
      >
        <PlayerWithControls src={src || []} streamStatus={status} title={title} playbackId={playbackId} id={creatorId} />
      </div>
    </div>
  );
}

// Video Player Component for inline viewing
function VideoPlayerView({
  playbackId,
  title,
  creatorId,
  creatorIdentifier,
  isCreator,
  videos,
  onBack,
  onPlayVideo,
}: {
  playbackId: string;
  title: string;
  creatorId: string;
  creatorIdentifier: string;
  isCreator: boolean;
  videos: Asset[];
  onBack: () => void;
  onPlayVideo: (playbackId: string) => void;
}) {
  const shareableVideoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/creator/${encodeURIComponent(creatorIdentifier)}/video/${encodeURIComponent(playbackId)}`
      : `/creator/${encodeURIComponent(creatorIdentifier)}/video/${encodeURIComponent(playbackId)}`;

  const relatedVideos = videos.filter((video) => video.playbackId !== playbackId);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#242424] text-white rounded-lg transition-colors text-sm font-semibold"
          >
            {isCreator ? 'Back to My Dashboard' : 'Back to Creator'}
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareableVideoUrl);
                toast.success('Video link copied');
              } catch (error) {
                toast.error('Failed to copy video link');
              }
            }}
            className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black rounded-lg transition-colors text-sm font-semibold"
          >
            Copy Video Link
          </button>
        </div>
      </div>

      <div className="w-full border border-white/[0.07] rounded-lg overflow-hidden bg-black" style={{ minHeight: '600px', height: 'calc(100vh - 400px)' }}>
        <VideoPaymentGate
          playbackId={playbackId}
          creatorId={creatorId}
          enforceAccess
        >
          <VideoPlayer playbackId={playbackId} />
        </VideoPaymentGate>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h4 className="text-white text-sm uppercase tracking-[0.18em] font-semibold">More Videos</h4>
          <span className="text-xs text-gray-300">{relatedVideos.length} available</span>
        </div>
        {relatedVideos.length === 0 ? (
          <div className="h-24 flex items-center justify-center rounded-lg border border-white/[0.07] bg-[#0f0f0f]">
            <p className="text-sm text-gray-300">No additional videos yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatedVideos.map((video) => {
              const videoCreatorId = video.creatorId?.value || creatorId || '';
              return (
                <VideoPaymentGate
                  key={video.id}
                  playbackId={video.playbackId}
                  creatorId={videoCreatorId}
                  onPlayClick={() => {
                    if (video.playbackId) {
                      onPlayVideo(video.playbackId);
                    }
                  }}
                >
                  <VideoCard
                    title={video.name}
                    assetData={video}
                    imageUrl={image1}
                    playbackId={video.playbackId}
                    createdAt={new Date(video.createdAt)}
                    format={video.videoSpec?.format}
                  />
                </VideoPaymentGate>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function CreatorProfile({
  creatorId,
  initialVideoPlaybackId,
  initialStreamPlaybackId,
  initialChatPlaybackId,
  openChatView,
}: CreatorProfileProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { streams, loading: streamsLoading, error: streamsError } = useSelector((state: RootState) => state.streams);
  const { assets, loading: assetsLoading, error: assetsError } = useSelector((state: RootState) => state.assets);
  const { authenticated, ready, login } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const router = useRouter();
  const pathname = usePathname();
  
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [creatorStreamData, setCreatorStreamData] = useState<any>(null);
  const [selectedVideoPlaybackId, setSelectedVideoPlaybackId] = useState<string | null>(
    initialVideoPlaybackId || null,
  );
  const [actualCreatorId, setActualCreatorId] = useState<string | null>(null); // The wallet address from username lookup
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [showLiveTileAlert, setShowLiveTileAlert] = useState(false);
  const previousLiveStateRef = useRef(false);

  // Get current user's wallet address
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const currentUserAddress = useMemo(() => walletAddress || '', [walletAddress]);

  // Check if viewer is the creator
  const isCreator = useMemo(() => {
    if (!currentUserAddress || !actualCreatorId) return false;
    return currentUserAddress.toLowerCase() === actualCreatorId.toLowerCase();
  }, [currentUserAddress, actualCreatorId]);

  // Check if user is logged in
  const isLoggedIn = authenticated && ready && !!currentUserAddress;

  useEffect(() => {
    if (!isCreator) return;
    if (!pathname?.startsWith('/creator/')) return;

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length !== 2 || segments[0] !== 'creator') return;

    router.replace(`/dashboard/${encodeURIComponent(creatorId)}`);
  }, [creatorId, isCreator, pathname, router]);

  // Check subscription status when user is logged in
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!isLoggedIn || !currentUserAddress || !actualCreatorId) {
        setIsSubscribed(false);
        return;
      }

      try {
        setCheckingSubscription(true);
        const viewerProfile = await getUserProfile(currentUserAddress);
        if (viewerProfile && viewerProfile.Channels) {
          const isSubscribedToCreator = viewerProfile.Channels.includes(actualCreatorId);
          setIsSubscribed(isSubscribedToCreator);
        } else {
          setIsSubscribed(false);
        }
      } catch (error: any) {
        console.error('Error checking subscription status:', error);
        setIsSubscribed(false);
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscriptionStatus();
  }, [isLoggedIn, currentUserAddress, actualCreatorId]);

  // Helper function to parse socialLinks from stream data
  const parseSocialLinks = (socialLinksArray: string[] | null | undefined): { twitter?: string; instagram?: string; youtube?: string; website?: string } => {
    const socialLinks: { twitter?: string; instagram?: string; youtube?: string; website?: string } = {};
    
    if (!Array.isArray(socialLinksArray)) return socialLinks;
    
    socialLinksArray.forEach((jsonString: string) => {
      if (typeof jsonString === 'string') {
        try {
          const parsed = JSON.parse(jsonString);
          Object.keys(parsed).forEach((key) => {
            const value = parsed[key];
            if (key === 'twitter' && value) {
              socialLinks.twitter = value;
            } else if (key === 'instagram' && value) {
              socialLinks.instagram = value;
            } else if (key === 'youtube' && value) {
              socialLinks.youtube = value;
            } else if (key === 'website' && value) {
              socialLinks.website = value;
            }
          });
        } catch (e) {
          console.warn('Failed to parse social link JSON:', jsonString);
        }
      }
    });
    
    return socialLinks;
  };

  // Fetch creator profile data and stream data
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      try {
        setLoading(true);
        
        // Try username and wallet address lookups in parallel for faster 404s
        const [byUsername, byWallet] = await Promise.all([
          getUserProfileByUsername(creatorId).catch(() => null),
          getUserProfile(creatorId).catch(() => null),
        ]);
        const supabaseUser = byUsername || byWallet;
        const walletAddress = supabaseUser?.creatorId || null;
        
        if (!walletAddress) {
          setError('Profile not found');
          setLoading(false);
          return;
        }

        const canonicalCreatorId = supabaseUser?.displayName?.trim();
        const requestedCreatorId = creatorId?.trim();
        const shouldCanonicalizeCreatorId =
          canonicalCreatorId &&
          requestedCreatorId &&
          canonicalCreatorId.toLowerCase() !== requestedCreatorId.toLowerCase();
        if (shouldCanonicalizeCreatorId) {
          const canonicalPath = initialVideoPlaybackId
            ? `/creator/${encodeURIComponent(canonicalCreatorId)}/video/${encodeURIComponent(initialVideoPlaybackId)}`
            : initialStreamPlaybackId
              ? `/creator/${encodeURIComponent(canonicalCreatorId)}/live/${encodeURIComponent(initialStreamPlaybackId)}`
              : openChatView
                ? `/creator/${encodeURIComponent(canonicalCreatorId)}/chat${
                    initialChatPlaybackId
                      ? `?channelId=${encodeURIComponent(initialChatPlaybackId)}`
                      : ''
                  }`
              : `/creator/${encodeURIComponent(canonicalCreatorId)}`;
          router.replace(canonicalPath);
        }
        
        // Store the actual creatorId (wallet address) for use in other parts
        setActualCreatorId(walletAddress);
        
        // Fetch stream data for the channel display (bio and socialLinks are in stream table)
        try {
          const streams = await getStreamsByCreator(walletAddress);
          if (streams && streams.length > 0) {
            setCreatorStreamData(streams[0]);
          }
        } catch (err) {
          console.warn('Failed to fetch stream data:', err);
        }
        
        if (supabaseUser) {
          // Convert socialLinks from array of JSON strings to object format
          // Input format: ["{\"twitter\":\"https://...\"}", "{\"instagram\":\"https://...\"}"]
          // Output format: {twitter: "https://...", instagram: "https://..."}
          const socialLinksObj: CreatorProfileData['socialLinks'] = {};
          if (Array.isArray(supabaseUser.socialLinks)) {
            supabaseUser.socialLinks.forEach((jsonString: string) => {
              if (typeof jsonString === 'string') {
                try {
                  const parsed = JSON.parse(jsonString);
                  // Each parsed object has one key-value pair like {"twitter": "https://..."}
                  Object.keys(parsed).forEach((key) => {
                    const value = parsed[key];
                    if (key === 'twitter' && value) {
                      socialLinksObj.twitter = value;
                    } else if (key === 'instagram' && value) {
                      socialLinksObj.instagram = value;
                    } else if (key === 'youtube' && value) {
                      socialLinksObj.youtube = value;
                    } else if (key === 'website' && value) {
                      socialLinksObj.website = value;
                    }
                  });
                } catch (e) {
                  // If parsing fails, skip this entry
                  console.warn('Failed to parse social link JSON:', jsonString);
                }
              }
            });
          }

          // Convert Supabase format to CreatorProfileData
          const profileData: CreatorProfileData = {
            creatorId: supabaseUser.creatorId,
            displayName: supabaseUser.displayName || '',
            bio: supabaseUser.bio || '',
            avatar: supabaseUser.avatar || '',
            socialLinks: socialLinksObj,
            theme: {
              backgroundColor: '#ffffff',
              textColor: '#000000',
              accentColor: '#0000ff',
            },
            isVerified: false,
            totalViews: 0,
            totalStreams: 0,
            totalVideos: 0,
          };
          setCreatorProfile(profileData);
        } else {
          setError('Profile not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch creator profile');
        toast.error('Failed to load creator profile');
      } finally {
        setLoading(false);
      }
    };

    if (creatorId) {
      fetchCreatorProfile();
    }
  }, [creatorId, initialChatPlaybackId, initialStreamPlaybackId, initialVideoPlaybackId, openChatView, router]);

  // Fetch streams and assets for this creator
  useEffect(() => {
    if (actualCreatorId) {
      dispatch(getAllStreams());
      dispatch(getAssets());
    }
  }, [dispatch, actualCreatorId]);

  useEffect(() => {
    if (!actualCreatorId) return;
    const unsubscribe = subscribeToCreatorStreamUpdates(actualCreatorId, (streamUpdate) => {
      if (streamUpdate?.playbackId) {
        setCreatorStreamData((prev: any) => {
          if (!prev?.playbackId || prev.playbackId === streamUpdate.playbackId) {
            return {
              ...(prev || {}),
              ...streamUpdate,
              playbackId: streamUpdate.playbackId,
            };
          }
          return prev;
        });
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
  }, [actualCreatorId, dispatch]);

  // Filter streams and assets for this creator
  const normalizedActualCreatorId = String(actualCreatorId || '').toLowerCase();
  const creatorStreams = streams.filter((stream: Stream) => {
    if (!stream.playbackId || !normalizedActualCreatorId) return false;
    const livepeerCreator = String(stream.creatorId?.value || '').toLowerCase();
    const supabaseCreator = String((stream as any).supabaseCreatorId || '').toLowerCase();
    return livepeerCreator === normalizedActualCreatorId || supabaseCreator === normalizedActualCreatorId;
  });

// console.log('creatorStreams', creatorStreams);

  const creatorAssets = assets.filter((asset: Asset) => {
    if (!asset.playbackId || !normalizedActualCreatorId) return false;
    const livepeerCreator = String(asset.creatorId?.value || '').toLowerCase();
    const supabaseCreator = String((asset as any).supabaseCreatorId || '').toLowerCase();
    return livepeerCreator === normalizedActualCreatorId || supabaseCreator === normalizedActualCreatorId;
  });
  const creatorPrimaryPlaybackId = useMemo(
    () => creatorStreamData?.playbackId || creatorStreams[0]?.playbackId || null,
    [creatorStreamData?.playbackId, creatorStreams],
  );
  const isDedicatedLiveView = Boolean(initialStreamPlaybackId);
  const isDedicatedChatView = Boolean(openChatView);
  const activeChatPlaybackId = useMemo(
    () => initialChatPlaybackId || creatorPrimaryPlaybackId,
    [creatorPrimaryPlaybackId, initialChatPlaybackId],
  );
  const selectedLiveStream = useMemo(() => {
    if (!initialStreamPlaybackId) return null;
    return (
      creatorStreams.find((stream: Stream) => stream.playbackId === initialStreamPlaybackId) ||
      (creatorStreamData?.playbackId === initialStreamPlaybackId ? creatorStreamData : null)
    );
  }, [creatorStreamData, creatorStreams, initialStreamPlaybackId]);
  const selectedChatStream = useMemo(() => {
    if (!activeChatPlaybackId) return null;
    return (
      creatorStreams.find((stream: Stream) => stream.playbackId === activeChatPlaybackId) ||
      (creatorStreamData?.playbackId === activeChatPlaybackId ? creatorStreamData : null)
    );
  }, [activeChatPlaybackId, creatorStreamData, creatorStreams]);
  const selectedLiveTitle =
    selectedLiveStream?.title ||
    selectedLiveStream?.name ||
    selectedLiveStream?.streamName ||
    'Live Stream';
  const primaryChannelStream = useMemo(() => {
    if (creatorPrimaryPlaybackId) {
      const fromRedux = creatorStreams.find((stream: Stream) => stream.playbackId === creatorPrimaryPlaybackId);
      if (fromRedux) return fromRedux;
    }
    return creatorStreamData || creatorStreams[0] || null;
  }, [creatorPrimaryPlaybackId, creatorStreamData, creatorStreams]);
  const primaryChannelTitle =
    primaryChannelStream?.title ||
    primaryChannelStream?.name ||
    primaryChannelStream?.streamName ||
    creatorStreamData?.title ||
    creatorStreamData?.streamName ||
    creatorProfile?.displayName ||
    'Channel';
  const primaryChannelLogo = primaryChannelStream?.logo || creatorStreamData?.logo || creatorProfile?.avatar || null;
  const primaryChannelBio = primaryChannelStream?.description || creatorStreamData?.description || creatorProfile?.bio || null;
  const primaryChannelPlaybackId =
    primaryChannelStream?.playbackId || creatorPrimaryPlaybackId || creatorStreamData?.playbackId || '';
  const primaryChannelIsLive = Boolean(primaryChannelStream?.isActive || creatorStreamData?.isActive);

  useEffect(() => {
    if (!primaryChannelPlaybackId) {
      previousLiveStateRef.current = false;
      setShowLiveTileAlert(false);
      return;
    }

    const becameLive = !previousLiveStateRef.current && primaryChannelIsLive;
    previousLiveStateRef.current = primaryChannelIsLive;
    if (!becameLive) return;

    setShowLiveTileAlert(true);
    if (!isCreator) {
      toast.success(`${primaryChannelTitle} is live now`, { duration: 3200 });
    }
    const timer = setTimeout(() => setShowLiveTileAlert(false), 3800);
    return () => clearTimeout(timer);
  }, [isCreator, primaryChannelIsLive, primaryChannelPlaybackId, primaryChannelTitle]);

  // The creator-level subscription (subscribeToCreatorStreamUpdates above) already
  // covers live-state changes for the primary channel. A second per-playbackId
  // subscription was causing duplicate state updates and unnecessary Supabase
  // connections. Removed to consolidate into the single creator subscription.

  useEffect(() => {
    setSelectedVideoPlaybackId(initialVideoPlaybackId || null);
  }, [initialVideoPlaybackId]);

  const selectedVideoAsset = useMemo(() => {
    if (!selectedVideoPlaybackId) return null;
    return (
      creatorAssets.find(
        (asset: Asset) => asset.playbackId === selectedVideoPlaybackId,
      ) || null
    );
  }, [creatorAssets, selectedVideoPlaybackId]);

  // Handle errors
  useEffect(() => {
    if (streamsError) {
      toast.error('Failed to fetch streams: ' + streamsError);
    }
    if (assetsError) {
      toast.error('Failed to fetch assets: ' + assetsError);
    }
  }, [streamsError, assetsError]);

  // useEffect(() => {
  //   console.log('creatorProfile', creatorProfile);
  // }, [creatorProfile]);

  // Check if we're on mobile screen
  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      if (isMobileView) {
        setSidebarCollapsed(true);
      }
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Inject PWA manifest link, theme color, and register service worker
  useEffect(() => {
    if (!creatorId) return;

    // Remove existing manifest link if any
    const existingManifest = document.querySelector('link[rel="manifest"]');
    if (existingManifest) {
      existingManifest.remove();
    }

    // Create and inject new manifest link
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = `/api/manifest/${encodeURIComponent(creatorId)}`;
    document.head.appendChild(manifestLink);

    // Add/update theme color meta tag
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute('content', '#facc15');

    // Register service worker
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV !== 'production') {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister().catch(() => {});
          });
        });
      } else {
        navigator.serviceWorker
          .register('/api/sw')
          .then((registration) => {
            console.log('Service Worker registered:', registration);
          })
          .catch((error) => {
            console.log('Service Worker registration failed:', error);
          });
      }
    }

    return () => {
      // Cleanup on unmount
      const manifest = document.querySelector('link[rel="manifest"]');
      if (manifest && manifest.getAttribute('href')?.includes(creatorId)) {
        manifest.remove();
      }
    };
  }, [creatorId]);

  // Handle PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setIsInstallable(false);
      toast.success('App installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle install button click
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.error('Install prompt not available');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast.success('Installing app...');
    } else {
      toast.info('Installation cancelled');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
      return;
    }
    setSidebarCollapsed((prev) => !prev);
  };

  const toggleSidebarProfile = () => {
    setSidebarProfileOpen((prev) => {
      const next = !prev;
      if (next && !isMobile && sidebarCollapsed) {
        setSidebarCollapsed(false);
      }
      return next;
    });
  };

  if (loading) {
    return <CreatorProfileLoading />;
  }

  if (error || !creatorProfile) {
    console.log('error', error);
    return (
      <div className="flex items-center justify-center h-screen bg-[#080808]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">Creator Not Found</h2>
          <p className="text-gray-300">This creator profile does not exist or is private.</p>
        </div>
      </div>
    );
  }

  const toggleMobileMenu = () => setMobileMenuOpen((x) => !x);

  // Handle subscribe action
  const handleSubscribe = async () => {
    if (!isLoggedIn) {
      setShowSignupModal(true);
      return;
    }

    if (!currentUserAddress) {
      toast.error('Wallet address not found');
      return;
    }

    setIsSubscribing(true);
    try {
      if (!actualCreatorId) {
        toast.error('Creator not found');
        return;
      }
      await subscribeToCreator(currentUserAddress, actualCreatorId);
      setIsSubscribed(true);
      toast.success(`Subscribed to ${creatorProfile?.displayName || creatorStreamData?.title || 'creator'}!`);
    } catch (err: any) {
      console.error('Subscribe error:', err);
      toast.error(err.message || 'Failed to subscribe');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Handle unsubscribe action
  const handleUnsubscribe = async () => {
    if (!isLoggedIn || !currentUserAddress) {
      toast.error('Wallet address not found');
      return;
    }

    setIsSubscribing(true);
    try {
      if (!actualCreatorId) {
        toast.error('Creator not found');
        return;
      }
      await unsubscribeFromCreator(currentUserAddress, actualCreatorId);
      setIsSubscribed(false);
      toast.success(`Unsubscribed from ${creatorProfile?.displayName || creatorStreamData?.title || 'creator'}`);
    } catch (err: any) {
      console.error('Unsubscribe error:', err);
      toast.error(err.message || 'Failed to unsubscribe');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Handle signup redirect
  const handleSignup = () => {
    setShowSignupModal(false);
    login();
  };

  const openCreatorDashboard = () => {
    router.push(`/dashboard/${encodeURIComponent(creatorId)}`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      {/* Sidebar */}
      <aside
        className={clsx(
          'md:relative z-20 h-full md:block px-2.5 py-2 gap-y-2.5 transition-all duration-300 ease-in-out border-r border-white/[0.07] flex flex-col bg-[#1a1a1a] overflow-hidden',
          {
            'w-[80px]': sidebarCollapsed && !isMobile,
            'w-[240px]': !sidebarCollapsed && !isMobile,
            hidden: isMobile && !mobileMenuOpen,
            block: isMobile && mobileMenuOpen,
          },
        )}
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.07]">
          <div className={clsx('pt-0.5', sidebarCollapsed && 'hidden')}>
            <Logo size="sm" iconOnly />
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07] bg-[#0f0f0f] text-gray-300 hover:text-white hover:bg-[#1a1a1a] transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <Sidebar
            sidebarCollapsed={sidebarCollapsed}
            isInstallable={isInstallable}
            onInstallClick={handleInstallClick}
          />
        </div>
        
        {/* Bottom Links Section - Fixed at bottom of screen */}
        <div className={clsx(
          'z-30 border-t border-white/[0.07] transition-all duration-300',
          {
            'fixed bottom-0 left-0 w-[80px]': sidebarCollapsed && !isMobile,
            'fixed bottom-0 left-0 w-[240px]': !sidebarCollapsed && !isMobile,
            'mt-auto w-full': isMobile,
          }
        )}>
          <SidebarBottomLinks sidebarCollapsed={sidebarCollapsed} onProfileClick={toggleSidebarProfile} />
        </div>
        <SidebarUserPanel
          variant="sheet"
          open={sidebarProfileOpen}
          onClose={() => setSidebarProfileOpen(false)}
        />
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col h-screen overflow-hidden relative ${isDedicatedChatView ? 'gap-0' : 'gap-0 md:gap-4'}`}>
        <div className={`flex-1 flex overflow-hidden ${isDedicatedChatView ? 'gap-0' : 'gap-0 md:gap-4'}`}>
          {/* Center Content Area - Gated */}
      <CreatorPaymentGate
        creatorId={actualCreatorId || creatorId}
        viewMode={creatorStreamData?.viewMode || 'free'}
        amount={creatorStreamData?.amount || 0}
        streamName={creatorStreamData?.streamName || creatorStreamData?.title}
            title={creatorStreamData?.title || creatorStreamData?.streamName || 'Channel'}
        onPaymentSuccess={() => {
          // Payment successful - component will automatically show content
        }}
      >
          <div className={`flex-1 w-full max-w-[1380px] mx-auto flex flex-col relative ${isDedicatedChatView ? 'my-0 mx-0' : 'my-0 md:my-2 mx-0 md:mx-2'}`}>
          {/* Scrollable Content Area */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isDedicatedChatView ? 'pb-0' : 'pb-4'}`}>
          {/* Header */}
          <Header 
            toggleMenu={toggleMobileMenu} 
            mobileOpen={mobileMenuOpen}
            title={creatorStreamData?.title || creatorStreamData?.streamName || undefined}
          />

          {/* Signup Modal for Subscribe */}
          <AlertDialog open={showSignupModal} onOpenChange={setShowSignupModal}>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Sign In Required</AlertDialogTitle>
                <AlertDialogDescription>
                  You need to sign in to subscribe to creators. Would you like to sign in now?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowSignupModal(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSignup} className="bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black">
                  Sign In
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>


          {isDedicatedChatView && (
            <>
              <div
                className={clsx(
                  'w-full relative',
                  'my-0 py-0 pb-0',
                  'md:px-0 px-0 rounded-none',
                )}
              >
                {streamsLoading ? (
                  Array.from({ length: 1 }, (_, index) => (
                    <div key={index} className="flex flex-col space-y-3">
                      <Skeleton className="h-[120px] w-[318px] rounded-xl bg-black" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 md:w-[316px] rounded-md bg-black" />
                        <Skeleton className="h-7 w-[44px] rounded-md bg-black" />
                        </div>
                    </div>
                  ))
                ) : creatorStreamData || creatorProfile ? (
                  <div className={clsx('col-span-full w-full', isDedicatedChatView ? 'space-y-0' : 'space-y-2')}>
                    <CreatorChannelCard
                      title={creatorStreamData?.title || creatorStreamData?.streamName || creatorProfile?.displayName || 'Channel'}
                      logo={creatorStreamData?.logo || creatorProfile?.avatar || null}
                      bio={creatorStreamData?.description || null}
                      socialLinks={parseSocialLinks(creatorStreamData?.socialLinks) || {}}
                      defaultImage={image1}
                      isActive={creatorStreamData?.isActive || false}
                      creatorId={actualCreatorId || undefined}
                      creatorRouteId={creatorId}
                      compact
                      chatCompact={isDedicatedChatView}
                      actionSlot={
                        primaryChannelIsLive || !isCreator ? (
                          <div className="inline-flex items-center gap-1.5">
                            {primaryChannelIsLive && primaryChannelPlaybackId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const livePath = isCreator
                                    ? `/dashboard/${encodeURIComponent(creatorId)}/live/${encodeURIComponent(primaryChannelPlaybackId)}`
                                    : `/creator/${encodeURIComponent(creatorId)}/live/${encodeURIComponent(primaryChannelPlaybackId)}`;
                                  router.push(livePath);
                                }}
                                className={`inline-flex h-8 items-center justify-center gap-1 rounded-full border border-red-300/45 bg-red-500/10 px-3 text-[11px] font-semibold text-red-100 transition hover:bg-red-500/20 ${
                                  showLiveTileAlert ? 'animate-pulse' : ''
                                }`}
                              >
                                <Radio className="h-3.5 w-3.5" />
                                {isCreator ? 'Live desk' : 'Watch live'}
                              </button>
                            ) : null}
                            {!isCreator ? (
                              checkingSubscription ? (
                                <div className="inline-flex h-8 items-center justify-center rounded-full border border-white/[0.07] bg-[#1a1a1a] px-3">
                                  <Bars width={12} height={12} color="#facc15" />
                                </div>
                              ) : isSubscribed ? (
                                <button
                                  onClick={handleUnsubscribe}
                                  disabled={isSubscribing}
                                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-red-300/30 bg-gradient-to-r from-red-500 to-red-600 px-3.5 text-[11px] font-semibold text-white transition-all duration-200 hover:from-red-600 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isSubscribing ? (
                                    <>
                                      <Bars width={12} height={12} color="#ffffff" />
                                      <span>...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span>Unsubscribe</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={handleSubscribe}
                                  disabled={isSubscribing}
                                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-teal-500 px-3.5 text-[11px] font-semibold text-black transition-all duration-200 hover:from-yellow-500 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isSubscribing ? (
                                    <>
                                      <Bars width={12} height={12} color="#000000" />
                                      <span>...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                      <span>Subscribe</span>
                                    </>
                                  )}
                                </button>
                              )
                            ) : null}
                          </div>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <div className="col-span-full text-center py-4 text-gray-300">
                    <p>No channel information available</p>
                  </div>
                )}
              </div>
            </>
          )}

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
            {isDedicatedLiveView && initialStreamPlaybackId ? (
              <div className="-mx-3 md:-mx-6 -mb-4 md:-mb-10">
                <StreamPlayerView
                  playbackId={initialStreamPlaybackId}
                  title={selectedLiveTitle}
                  creatorId={actualCreatorId || ''}
                  backLabel={isCreator ? 'Back to My Dashboard' : 'Back to Creator'}
                  onBack={() => {
                    if (isCreator) {
                      router.push(`/dashboard/${encodeURIComponent(creatorId)}`);
                      return;
                    }
                    router.push(`/creator/${encodeURIComponent(creatorId)}`);
                  }}
                />
              </div>
            ) : isDedicatedChatView && activeChatPlaybackId ? (
              <div className="space-y-0">
                <ChannelChatExperience
                  playbackId={activeChatPlaybackId}
                  creatorId={actualCreatorId || creatorId}
                  streamName={
                    selectedChatStream?.title ||
                    selectedChatStream?.name ||
                    selectedChatStream?.streamName ||
                    creatorStreamData?.title ||
                    creatorProfile?.displayName ||
                    'Channel'
                  }
                  backLabel={isCreator ? 'Back to My Dashboard' : 'Back to Creator'}
                  onBack={() => {
                    if (isCreator) {
                      router.push(`/dashboard/${encodeURIComponent(creatorId)}`);
                      return;
                    }
                    router.push(`/creator/${encodeURIComponent(creatorId)}`);
                  }}
                />
              </div>
            ) : selectedVideoPlaybackId ? (
              <VideoPlayerView
                playbackId={selectedVideoPlaybackId}
                title={selectedVideoAsset?.name || selectedVideoAsset?.title || 'Video'}
                creatorId={selectedVideoAsset?.creatorId?.value || actualCreatorId || creatorId}
                creatorIdentifier={creatorId}
                isCreator={isCreator}
                videos={creatorAssets}
                onBack={() => {
                  if (isCreator) {
                    openCreatorDashboard();
                    return;
                  }
                  router.push(`/creator/${encodeURIComponent(creatorId)}`);
                }}
                onPlayVideo={(playbackId) => {
                  router.push(
                    `/creator/${encodeURIComponent(creatorId)}/video/${encodeURIComponent(playbackId)}`,
                  );
                }}
              />
            ) : (
              <div className="w-full pb-4 md:pb-6">
                <div className="relative overflow-hidden border border-white/[0.08] bg-[#08090f] rounded-none md:rounded-2xl">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(250,204,21,0.15),transparent_35%),radial-gradient(circle_at_84%_8%,rgba(20,184,166,0.14),transparent_33%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_42%)]" />

                  <div className="relative px-3 pt-4 sm:px-4 sm:pt-5 md:px-6 md:pt-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.16] bg-[#111824]">
                            {primaryChannelLogo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={primaryChannelLogo as string}
                                alt={primaryChannelTitle}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white">
                                {primaryChannelTitle.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h2 className="truncate text-xl sm:text-2xl font-semibold text-white">
                              {primaryChannelTitle}
                            </h2>
                            <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-gray-300">
                              {primaryChannelBio?.trim() || 'Creator profile and media gallery.'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                              primaryChannelIsLive
                                ? 'border-red-400/45 bg-red-500/10 text-red-200'
                                : 'border-white/[0.14] bg-white/[0.03] text-gray-300'
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                primaryChannelIsLive ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]' : 'bg-gray-500'
                              }`}
                            />
                            {primaryChannelIsLive ? 'Live now' : 'Offline'}
                          </span>
                          {primaryChannelIsLive && primaryChannelPlaybackId ? (
                            <button
                              type="button"
                              onClick={() => {
                                const livePath = isCreator
                                  ? `/dashboard/${encodeURIComponent(creatorId)}/live/${encodeURIComponent(primaryChannelPlaybackId)}`
                                  : `/creator/${encodeURIComponent(creatorId)}/live/${encodeURIComponent(primaryChannelPlaybackId)}`;
                                router.push(livePath);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                showLiveTileAlert
                                  ? 'animate-pulse border-red-300/55 bg-red-500/15 text-red-100'
                                  : 'border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20'
                              }`}
                            >
                              <Radio className="h-3.5 w-3.5" />
                              {isCreator ? 'Broadcast live' : 'Watch live now'}
                            </button>
                          ) : null}
                          <span className="inline-flex items-center rounded-full border border-white/[0.12] bg-black/30 px-3 py-1 text-xs text-gray-300">
                            {creatorAssets.length} video{creatorAssets.length === 1 ? '' : 's'}
                          </span>
                          {primaryChannelPlaybackId ? (
                            <span className="inline-flex max-w-full sm:max-w-[320px] items-center rounded-full border border-white/[0.12] bg-black/30 px-3 py-1 text-xs text-gray-400">
                              <span className="truncate">ID: {primaryChannelPlaybackId}</span>
                            </span>
                          ) : null}
                        </div>

                        {primaryChannelIsLive && primaryChannelPlaybackId && !isCreator ? (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/creator/${encodeURIComponent(creatorId)}/live/${encodeURIComponent(primaryChannelPlaybackId)}`,
                              )
                            }
                            className={`mt-3 inline-flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                              showLiveTileAlert
                                ? 'animate-pulse border-red-300/60 bg-red-500/16 text-red-100'
                                : 'border-red-300/45 bg-red-500/12 text-red-100 hover:bg-red-500/20'
                            }`}
                            aria-label="Watch active livestream"
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.85)]" />
                              {primaryChannelTitle} is live now
                            </span>
                            <span className="text-xs uppercase tracking-[0.12em] text-red-100/90">
                              Watch live
                            </span>
                          </button>
                        ) : null}
                      </div>

                      <div className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-end">
                        {isCreator ? (
                          <>
                            <button
                              type="button"
                              onClick={openCreatorDashboard}
                              className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.15] bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                            >
                              <RiVideoAddLine className="mr-1.5 h-4 w-4" />
                              Upload video
                            </button>
                            <button
                              type="button"
                              onClick={
                                primaryChannelPlaybackId
                                  ? () =>
                                      router.push(
                                        `/dashboard/${encodeURIComponent(creatorId)}/live/${encodeURIComponent(primaryChannelPlaybackId)}`,
                                      )
                                  : openCreatorDashboard
                              }
                              className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
                                primaryChannelIsLive
                                  ? 'bg-gradient-to-r from-red-500 to-fuchsia-500 text-white hover:opacity-90'
                                  : 'bg-gradient-to-r from-yellow-300 via-yellow-400 to-emerald-400 text-black hover:brightness-105'
                              }`}
                            >
                              {primaryChannelIsLive ? 'Open live desk' : 'Go live'}
                            </button>
                          </>
                        ) : (
                          <>
                            {checkingSubscription ? (
                              <div className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] px-4">
                                <Bars width={14} height={14} color="#facc15" />
                              </div>
                            ) : isSubscribed ? (
                              <button
                                onClick={handleUnsubscribe}
                                disabled={isSubscribing}
                                className="inline-flex h-10 items-center justify-center rounded-full border border-red-300/30 bg-gradient-to-r from-red-500 to-red-600 px-4 text-sm font-semibold text-white transition-all duration-200 hover:from-red-600 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSubscribing ? '...' : 'Unsubscribe'}
                              </button>
                            ) : (
                              <button
                                onClick={handleSubscribe}
                                disabled={isSubscribing}
                                className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-teal-500 px-4 text-sm font-semibold text-black transition-all duration-200 hover:from-yellow-500 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSubscribing ? '...' : 'Subscribe'}
                              </button>
                            )}

                            {primaryChannelPlaybackId && primaryChannelIsLive ? (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/creator/${encodeURIComponent(creatorId)}/live/${encodeURIComponent(primaryChannelPlaybackId)}`,
                                  )
                                }
                                className={`inline-flex h-10 items-center justify-center rounded-full border border-emerald-300/45 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 ${
                                  showLiveTileAlert ? 'animate-pulse' : ''
                                }`}
                              >
                                Watch stream
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative px-3 pb-6 pt-5 sm:px-4 md:px-6 md:pb-9 md:pt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-white">Gallery</h3>
                      <span className="text-xs text-gray-400">
                        {creatorAssets.length} item{creatorAssets.length === 1 ? '' : 's'}
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
                    ) : creatorAssets.length === 0 ? (
                      <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-8 text-center">
                        <div className="relative z-10 flex flex-col items-center gap-3">
                          <div className="rounded-full border border-white/[0.07] bg-[#0f0f0f] p-3 text-[#888]">
                            <Clapperboard className="h-5 w-5" />
                          </div>
                          <h3 className="text-lg font-semibold text-white">No videos yet</h3>
                          <p className="max-w-md text-sm text-gray-300">
                            {isCreator
                              ? 'Upload your first video from the dashboard to start building your channel gallery.'
                              : 'This creator has not uploaded any videos yet.'}
                          </p>
                          {isCreator ? (
                            <button
                              onClick={openCreatorDashboard}
                              className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
                            >
                              <RiVideoAddLine className="w-5 h-5" />
                              Open dashboard
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {creatorAssets.map((asset) => {
                          const videoCreatorId = asset.creatorId?.value || actualCreatorId || '';
                          return (
                            <div key={asset.id}>
                              <VideoPaymentGate
                                playbackId={asset.playbackId}
                                creatorId={videoCreatorId}
                                onPlayClick={() => {
                                  if (asset.playbackId) {
                                    router.push(
                                      `/creator/${encodeURIComponent(creatorId)}/video/${encodeURIComponent(asset.playbackId)}`,
                                    );
                                  }
                                }}
                              >
                                <VideoCard
                                  title={asset.name}
                                  assetData={asset}
                                  imageUrl={image1}
                                  playbackId={asset.playbackId}
                                  createdAt={new Date(asset.createdAt)}
                                  format={asset.videoSpec?.format}
                                />
                              </VideoPaymentGate>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
          </div>

          {/* Bottom Navigation - Fixed at bottom of middle column */}
          <div className="flex-shrink-0 z-10">
            <BottomNav />
          </div>
        </div>
          </CreatorPaymentGate>
        </div>
      </div>
    </div>
  );
}

export function CreatorProfileLoading() {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="text-center">
        <Bars width={40} height={40} color="#facc15" />
        <p className="mt-4 text-white">Loading creator profile...</p>
      </div>
    </div>
  );
} 
