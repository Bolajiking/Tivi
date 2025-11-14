'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllStreams } from '@/features/streamAPI';
import { getAssets } from '@/features/assetsAPI';
import { AppDispatch, RootState } from '@/store/store';
import { Stream, Asset } from '@/interfaces';
import { VideoCard } from '@/components/Card/Card';
import image1 from '@/assets/image1.png';
import { Bars } from 'react-loader-spinner';
import { toast } from 'sonner';
import Link from 'next/link';
import { getUserProfile, subscribeToCreator } from '@/lib/supabase-service';
import SectionCard from '@/components/Card/SectionCard';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { PublicStreamCard } from './PublicStreamCard';
import Logo from '@/components/Logo';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SidebarBottomLinks from '@/components/SidebarBottomLinks';
import BottomNav from '@/components/BottomNav';
import { LuArrowLeftFromLine, LuArrowRightFromLine } from 'react-icons/lu';
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
  creatorId: string;
}

export function CreatorProfile({ creatorId }: CreatorProfileProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { streams, loading: streamsLoading, error: streamsError } = useSelector((state: RootState) => state.streams);
  const { assets, loading: assetsLoading, error: assetsError } = useSelector((state: RootState) => state.assets);
  const { user, authenticated, ready } = usePrivy();
  const router = useRouter();
  const solanaWalletAddress = useSelector((state: RootState) => state.user.solanaWalletAddress);
  
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Get current user's wallet address
  const currentUserAddress = useMemo(() => {
    if (user?.wallet?.chainType === 'solana' && user?.wallet?.address) {
      return user.wallet.address;
    }
    return solanaWalletAddress || '';
  }, [user?.wallet, solanaWalletAddress]);

  // Check if viewer is the creator
  const isCreator = useMemo(() => {
    if (!currentUserAddress || !creatorId) return false;
    return currentUserAddress.toLowerCase() === creatorId.toLowerCase();
  }, [currentUserAddress, creatorId]);

  // Check if user is logged in
  const isLoggedIn = authenticated && ready && !!currentUserAddress;

  // Fetch creator profile data
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      try {
        setLoading(true);
        const supabaseUser = await getUserProfile(creatorId);
        
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
  }, [creatorId]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Page URL copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy URL');
    }
  };

  // Fetch streams and assets for this creator
  useEffect(() => {
    if (creatorId) {
      dispatch(getAllStreams());
      dispatch(getAssets());
    }
  }, [dispatch, creatorId]);

  // Filter streams and assets for this creator
  const creatorStreams = streams.filter((stream: Stream) => 
    stream.creatorId?.value === creatorId && !!stream.playbackId
  );

// console.log('creatorStreams', creatorStreams);

  const creatorAssets = assets.filter((asset: Asset) => 
    asset.creatorId?.value === creatorId && !!asset.playbackId
  );

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
      await subscribeToCreator(currentUserAddress, creatorId);
      toast.success(`Subscribed to ${creatorProfile?.displayName || 'creator'}!`);
    } catch (err: any) {
      console.error('Subscribe error:', err);
      toast.error(err.message || 'Failed to subscribe');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Handle signup redirect
  const handleSignup = () => {
    setShowSignupModal(false);
    router.push('/dashboard');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-black via-gray-950 to-black">
      {/* Sidebar */}
      <aside
        className={clsx(
          'md:relative z-20 h-full md:block px-4 gap-y-4 transition-all duration-300 ease-in-out border-r border-white/20 flex flex-col bg-white/10 backdrop-blur-sm',
          {
            'w-[100px]': sidebarCollapsed && !isMobile,
            'w-72 p-4': !sidebarCollapsed && !isMobile,
            hidden: isMobile && !mobileMenuOpen,
            block: isMobile && mobileMenuOpen,
          },
        )}
      >
        <div className="flex items-center justify-between py-4 border-b border-white/20">
          {!sidebarCollapsed && (
            <div>
              <Logo size="lg" />
            </div>
          )}
          <button onClick={toggleSidebar} className="ml-auto text-gray-300 hover:text-white transition-colors">
            {sidebarCollapsed ? (
              <LuArrowRightFromLine className="h-5 w-5" />
            ) : (
              <LuArrowLeftFromLine className="h-5 w-5" />
            )}
          </button>
        </div>
        <Sidebar sidebarCollapsed={sidebarCollapsed} />
        
        {/* Bottom Links Section - Fixed at bottom of screen */}
        <div className={clsx(
          'fixed bottom-0 left-0 z-30 backdrop-blur-lg border-t border-white/20 transition-all duration-300',
          {
            'w-[100px]': sidebarCollapsed && !isMobile,
            'w-72': !sidebarCollapsed && !isMobile,
            'hidden': isMobile,
          }
        )}>
          <SidebarBottomLinks sidebarCollapsed={sidebarCollapsed} />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 h-screen overflow-hidden">
        <div className="flex-1 flex gap-4 overflow-auto pb-20">
          <div className="flex-1 my-2 ml-2 pb-8">
          {/* Header */}
          <header className="flex-1 w-full z-10 top-0 right-0 transition-all shadow-md duration-300 ease-in-out">
            <div className="flex justify-between items-center p-2 sm:p-5 bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
              <div className="flex items-center w-full flex-1 gap-3">
                <button onClick={toggleMobileMenu} className="md:hidden">
                  {mobileMenuOpen ? <X className="h-7 w-7 text-white" /> : <Menu className="h-7 w-7 text-white" />}
                </button>
                <div className="rounded-md text-white">
                  {/* <h1 className="text-md sm:text-lg font-bold text-white">{creatorProfile?.displayName || 'Creator Profile'}</h1> */}
                  {/* <Logo size="lg" /> */}
                  <h1 className="text-md sm:text-lg font-bold text-white">ChainfrenTV - Live Streaming onChain</h1>
                </div>
              </div>
              {/* Subscribe Button - Only show if viewer is not the creator */}
              {!isCreator && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className="px-3 sm:px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm sm:text-base"
                  >
                    {isSubscribing ? (
                      <>
                        <Bars width={16} height={16} color="#ffffff" />
                        <span className="hidden sm:inline">Subscribing...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="hidden sm:inline">Subscribe</span>
                        <span className="sm:hidden">Sub</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Signup Modal for Subscribe */}
          <AlertDialog open={showSignupModal} onOpenChange={setShowSignupModal}>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Sign Up Required</AlertDialogTitle>
                <AlertDialogDescription>
                  You need to sign up and connect your wallet to subscribe to creators. Would you like to sign up now?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowSignupModal(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSignup} className="bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black">
                  Sign Up
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>


          {/* Creator Info Card */}
          <SectionCard title="">
            <div className="col-span-full w-full flex flex-col md:flex-row items-center justify-between gap-4 p-4">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative">
                  <img
                    src={creatorProfile?.avatar || '/assets/images/default-avatar.png'}
                    alt={creatorProfile?.displayName}
                    className="w-20 h-20 rounded-full object-cover border-4"
                    style={{ borderColor:  '#C28B0A' }}
                  />
                  {creatorProfile?.isVerified && (
                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="text-center md:text-left">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{creatorProfile?.displayName}</h1>
                  <p className="text-lg text-gray-300 mt-2">{creatorProfile?.bio}</p>
                </div>
              </div>
              
              {/* Social Links */}
              <div className="flex space-x-3">
                {creatorProfile?.socialLinks?.twitter && (
                  <a
                    href={creatorProfile?.socialLinks?.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-opacity-20 transition-colors bg-white/10"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                )}
                {creatorProfile?.socialLinks?.instagram && (
                  <a
                    href={creatorProfile?.socialLinks?.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-opacity-20 transition-colors bg-white/10"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.297-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.807.875 1.297 2.026 1.297 3.323s-.49 2.448-1.297 3.323c-.875.875-2.026 1.297-3.323 1.297zm7.718-1.297c-.875.807-2.026 1.297-3.323 1.297s-2.448-.49-3.323-1.297c-.807-.875-1.297-2.026-1.297-3.323s.49-2.448 1.297-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.807.875 1.297 2.026 1.297 3.323s-.49 2.448-1.297 3.323z"/>
                    </svg>
                  </a>
                )}
                {creatorProfile?.socialLinks?.youtube && (
                  <a
                    href={creatorProfile?.socialLinks?.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-opacity-20 transition-colors bg-white/10"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </a>
                )}
                {creatorProfile?.socialLinks?.website && (
                  <a
                    href={creatorProfile?.socialLinks?.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-opacity-20 transition-colors bg-white/10"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1 16.057v-3.057h2v3.057c1.14-.102 2-.317 2-.735 0-.418-.86-.633-2-.735V9.057c1.14-.102 2-.317 2-.735 0-.418-.86-.633-2-.735V5.057c1.14-.102 2-.317 2-.735 0-.418-.86-.633-2-.735V2h-2v1.057c-1.14.102-2 .317-2 .735 0 .418.86.633 2 .735v2.53c-1.14.102-2 .317-2 .735 0 .418.86.633 2 .735v2.53c-1.14.102-2 .317-2 .735 0 .418.86.633 2 .735z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </SectionCard>

          <hr className="border-white/20" />

          {/* Live Streams Section */}
          <div id="streams">
          <SectionCard title="Live Streams">
            {streamsLoading ? (
              <div className="col-span-full flex justify-center py-8">
                <Bars width={40} height={40} color="#facc15" />
              </div>
            ) : creatorStreams.length > 0 ? (
              creatorStreams.map((stream) => (
                <div key={stream.id} className="col-span-full w-full">
                  <PublicStreamCard
                    title={stream.title || stream.name}
                    image={image1}
                    logo={stream.logo}
                    playbackId={stream.playbackId}
                    playb={stream.playbackId}
                    lastSeen={new Date(stream.lastSeen || 0)}
                    status={stream.isActive}
                    creatorId={creatorId}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-300">
                <p>No live streams available</p>
              </div>
            )}
          </SectionCard>
          </div>

          <hr className="border-white/20" />

          {/* Videos Section */}
          <div id="videos">
          <SectionCard title="Videos">
            {assetsLoading ? (
              <div className="col-span-full flex justify-center py-8">
                <Bars width={40} height={40} color="#facc15" />
              </div>
            ) : creatorAssets.length > 0 ? (
              creatorAssets.map((asset) => (
                <VideoCard
                  key={asset.id}
                  title={asset.name}
                  assetData={asset}
                  imageUrl={image1}
                  playbackId={asset.playbackId}
                  createdAt={new Date(asset.createdAt)}
                  format={asset.videoSpec?.format}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-300">
                <p>No videos available</p>
              </div>
            )}
          </SectionCard>
          </div>
          </div>
        </div>
        
        {/* Bottom Navigation - Contained within Creator Profile content */}
        <div className="w-full">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

export function CreatorProfileLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Bars width={40} height={40} color="#facc15" />
        <p className="mt-4">Loading creator profile...</p>
      </div>
    </div>
  );
} 