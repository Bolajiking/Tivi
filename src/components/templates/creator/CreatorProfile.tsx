'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllStreams } from '@/features/streamAPI';
import { getAssets } from '@/features/assetsAPI';
import { AppDispatch, RootState } from '@/store/store';
import { Stream, Asset } from '@/interfaces';
import { VideoCard } from '@/components/Card/Card';
import { ChannelCardRedesign } from '@/components/Card/ChannelCardRedesign';
import { CreatorChannelCard } from './CreatorChannelCard';
import image1 from '@/assets/image1.png';
import { Bars } from 'react-loader-spinner';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  getUserProfile,
  getUserProfileByUsername,
  subscribeToCreatorStreamUpdates,
  subscribeToCreator,
  unsubscribeFromCreator,
  getStreamsByCreator,
} from '@/lib/supabase-service';
import SectionCard from '@/components/Card/SectionCard';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';
import Logo from '@/components/Logo';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SidebarBottomLinks from '@/components/SidebarBottomLinks';
import BottomNav from '@/components/BottomNav';
import { LuArrowLeftFromLine, LuArrowRightFromLine } from 'react-icons/lu';
import { FaTwitter, FaInstagram, FaYoutube, FaLink } from 'react-icons/fa';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/skeleton';
import Header from '@/components/Header';
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
      <div className="w-full min-h-[560px] flex items-center justify-center rounded-xl border border-white/15 bg-[#06070a]">
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
      <div className="w-full min-h-[560px] flex flex-col items-center justify-center rounded-xl border border-white/20 bg-black/70">
        <p className="text-red-300 mb-4">Failed to load stream: {error}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="rounded-xl border border-white/15 bg-gradient-to-r from-white/10 to-white/5 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Live Broadcast</p>
            <h3 className="text-white font-bold text-lg">{title}</h3>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white transition-colors text-sm font-semibold"
          >
            {backLabel}
          </button>
        </div>
      </div>
      <div
        className="w-full overflow-hidden rounded-xl border border-white/20 bg-black min-h-[520px] h-[calc(100vh-150px)] md:min-h-[700px] md:h-[calc(100vh-180px)]"
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
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-semibold"
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
            className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors text-sm font-semibold"
          >
            Copy Video Link
          </button>
        </div>
      </div>

      <div className="w-full border border-white/20 rounded-lg overflow-hidden bg-black" style={{ minHeight: '600px', height: 'calc(100vh - 400px)' }}>
        <VideoPaymentGate
          playbackId={playbackId}
          creatorId={creatorId}
          enforceAccess
        >
          <VideoPlayer playbackId={playbackId} />
        </VideoPaymentGate>
      </div>

      <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h4 className="text-white text-sm uppercase tracking-[0.18em] font-semibold">More Videos</h4>
          <span className="text-xs text-gray-300">{relatedVideos.length} available</span>
        </div>
        {relatedVideos.length === 0 ? (
          <div className="h-24 flex items-center justify-center rounded-lg border border-white/10 bg-white/5">
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
  const { authenticated, ready } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const router = useRouter();
  
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
  const [activeTab, setActiveTab] = useState<'videos' | 'livestreams'>('videos');
  const [actualCreatorId, setActualCreatorId] = useState<string | null>(null); // The wallet address from username lookup
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

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
        
        // First, try to get user by username (displayName)
        // The creatorId param is now the username from the URL
        let supabaseUser = await getUserProfileByUsername(creatorId);
        let walletAddress = null;
        
        // If not found by username, try as wallet address (for backward compatibility)
        if (!supabaseUser) {
          supabaseUser = await getUserProfile(creatorId);
          if (supabaseUser) {
            walletAddress = supabaseUser.creatorId;
          }
        } else {
          walletAddress = supabaseUser.creatorId;
        }
        
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
    const unsubscribe = subscribeToCreatorStreamUpdates(actualCreatorId, () => {
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
  const creatorStreams = streams.filter((stream: Stream) => 
    stream.creatorId?.value === actualCreatorId && !!stream.playbackId
  );

// console.log('creatorStreams', creatorStreams);

  const creatorAssets = assets.filter((asset: Asset) => 
    asset.creatorId?.value === actualCreatorId && !!asset.playbackId
  );
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

  useEffect(() => {
    setSelectedVideoPlaybackId(initialVideoPlaybackId || null);
    if (initialVideoPlaybackId) {
      setActiveTab('videos');
    }
  }, [initialVideoPlaybackId]);

  useEffect(() => {
    if (initialStreamPlaybackId) {
      setActiveTab('livestreams');
    }
  }, [initialStreamPlaybackId]);

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
    if (!isMobile) {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  if (loading) {
    return <CreatorProfileLoading />;
  }

  if (error || !creatorProfile) {
    console.log('error', error);
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-black via-gray-950 to-black">
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
    router.push('/auth/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-black via-gray-950 to-black">
      {/* Sidebar */}
      <aside
        className={clsx(
          'md:relative z-20 h-full md:block px-2.5 py-2 gap-y-2.5 transition-all duration-300 ease-in-out border-r border-white/20 flex flex-col bg-white/10 backdrop-blur-sm',
          {
            'w-[80px]': sidebarCollapsed && !isMobile,
            'w-[240px]': !sidebarCollapsed && !isMobile,
            hidden: isMobile && !mobileMenuOpen,
            block: isMobile && mobileMenuOpen,
          },
        )}
      >
        <div className="flex items-start justify-between pb-2 border-b border-white/20">
          {!sidebarCollapsed && (
            <div className="pt-0.5">
              <Logo size="sm" />
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-gray-300 hover:text-white hover:bg-white/15 transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <LuArrowRightFromLine className="h-4 w-4" />
            ) : (
              <LuArrowLeftFromLine className="h-4 w-4" />
            )}
          </button>
        </div>
        <Sidebar 
          sidebarCollapsed={sidebarCollapsed} 
          isInstallable={isInstallable}
          onInstallClick={handleInstallClick}
        />
        
        {/* Bottom Links Section - Fixed at bottom of screen */}
        <div className={clsx(
          'fixed bottom-0 left-0 z-30 backdrop-blur-lg border-t border-white/20 transition-all duration-300',
          {
            'w-[80px]': sidebarCollapsed && !isMobile,
            'w-[240px]': !sidebarCollapsed && !isMobile,
            'hidden': isMobile,
          }
        )}>
          <SidebarBottomLinks sidebarCollapsed={sidebarCollapsed} />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 h-screen overflow-hidden relative">
        <div className="flex-1 flex gap-4 overflow-hidden">
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
          <div className="flex-1 my-2 ml-2 flex flex-col relative">
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto pb-4">
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
                <AlertDialogAction onClick={handleSignup} className="bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black">
                  Sign In
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>


          {!isDedicatedLiveView && (
            <>
              {/* Channel Section - Similar to "Your Channel" in Dashboard */}
              <div
                className={clsx(
                  'md:px-6 px-3 w-full relative rounded-lg',
                  isDedicatedChatView ? 'my-1.5 py-1 pb-2' : 'my-2',
                  isCreator
                    ? isDedicatedChatView
                      ? 'bg-white/5 backdrop-blur-sm border border-white/15'
                      : 'py-2 pb-4 bg-white/10 backdrop-blur-sm border border-white/20'
                    : isDedicatedChatView
                    ? 'py-1 pb-2'
                    : 'py-1 pb-3',
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
                  <div className="col-span-full w-full space-y-2">
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
                        !isCreator ? (
                          checkingSubscription ? (
                            <div className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3">
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
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-yellow-300/30 bg-gradient-to-r from-yellow-500 to-teal-500 px-3.5 text-[11px] font-semibold text-black transition-all duration-200 hover:from-yellow-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
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

              {!isDedicatedChatView && <hr className="border-white/20" />}
            </>
          )}

          {/* Gallery Section with Tabs - Similar to Dashboard */}
          <SectionCard
            title=""
            contentClassName={isDedicatedLiveView || isDedicatedChatView ? 'w-full' : undefined}
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
                      if (creatorPrimaryPlaybackId) {
                        router.push(
                          `/dashboard/${encodeURIComponent(creatorId)}?channelId=${encodeURIComponent(creatorPrimaryPlaybackId)}`,
                        );
                        return;
                      }
                      router.push(`/dashboard/${encodeURIComponent(creatorId)}`);
                      return;
                    }
                    router.push(`/creator/${encodeURIComponent(creatorId)}`);
                  }}
                />
              </div>
            ) : isDedicatedChatView && activeChatPlaybackId ? (
              <div className="-mx-3 md:-mx-6 -mb-4 md:-mb-10">
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
                      if (creatorPrimaryPlaybackId) {
                        router.push(
                          `/dashboard/${encodeURIComponent(creatorId)}?channelId=${encodeURIComponent(creatorPrimaryPlaybackId)}`,
                        );
                        return;
                      }
                      router.push(`/dashboard/${encodeURIComponent(creatorId)}`);
                      return;
                    }
                    router.push(`/creator/${encodeURIComponent(creatorId)}`);
                  }}
                />
              </div>
            ) : (
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as 'videos' | 'livestreams')}
                className="w-full col-span-full"
              >
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
                  {selectedVideoPlaybackId ? (
                    <VideoPlayerView
                      playbackId={selectedVideoPlaybackId}
                      title={selectedVideoAsset?.name || selectedVideoAsset?.title || 'Video'}
                      creatorId={selectedVideoAsset?.creatorId?.value || actualCreatorId || creatorId}
                      creatorIdentifier={creatorId}
                      isCreator={isCreator}
                      videos={creatorAssets}
                      onBack={() => {
                        if (isCreator) {
                          if (creatorPrimaryPlaybackId) {
                            router.push(
                              `/dashboard/${encodeURIComponent(creatorId)}?channelId=${encodeURIComponent(creatorPrimaryPlaybackId)}`,
                            );
                            return;
                          }
                          router.push(`/dashboard/${encodeURIComponent(creatorId)}`);
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
                  ) : assetsLoading ? (
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
                      {creatorAssets.length === 0 ? (
                        <div className="flex justify-center items-center h-60">
                          <p className="text-gray-300">No Videos Available.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    </>
                  )}
                </TabsContent>

                {/* Livestreams Tab */}
                <TabsContent value="livestreams" className="mt-4 -mx-3 md:-mx-6 -mb-4 md:-mb-10">
                  {streamsLoading ? (
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
                      {creatorStreams.length === 0 ? (
                        <div className="flex justify-center items-center h-60">
                          <p className="text-gray-300">No Livestreams Available.</p>
                        </div>
                      ) : (
                        <>
                          {creatorStreams.map((stream) => {
                            const streamCreatorId = stream.creatorId?.value || actualCreatorId || '';
                            return (
                            <div key={stream.id} className="mb-4">
                                <StreamPaymentGate
                                  playbackId={stream.playbackId}
                                  creatorId={streamCreatorId}
                                >
                                  <div>
                              <ChannelCardRedesign
                                title={stream.title || stream.name}
                                image={image1}
                                logo={stream.logo}
                                playbackId={stream.playbackId}
                                playb={stream.playbackId}
                                lastSeen={new Date(stream.lastSeen || 0)}
                                status={stream.isActive}
                                showName={false}
                                showSocialLinks={false}
                                useThumbnail={true}
                              />
                              {/* View Stream Button */}
                              <div className="mt-4">
                                <button
                                  onClick={() => {
                                    if (stream.playbackId) {
                                      router.push(
                                        `/creator/${encodeURIComponent(creatorId)}/live/${encodeURIComponent(stream.playbackId)}`,
                                      );
                                    }
                                  }}
                                  className="w-full bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                  </svg>
                                  View Stream
                                </button>
                              </div>
                            </div>
                                </StreamPaymentGate>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </TabsContent>

              </Tabs>
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
