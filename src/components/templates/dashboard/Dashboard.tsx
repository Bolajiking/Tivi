'use client';
import Header from '@/components/Header';
import Analytics from './Analytics';
import SectionCard from '@/components/Card/SectionCard';
import { ChannelCard, VideoCard } from '@/components/Card/Card';
import { ChannelCardRedesign } from '@/components/Card/ChannelCardRedesign';
import { RiVideoAddLine } from 'react-icons/ri';
import * as Dialog from '@radix-ui/react-dialog';
import { IoMdClose } from 'react-icons/io';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import UploadVideoAsset from '@/components/UploadVideoAsset';
import type { Asset, Stream } from '@/interfaces';
import MobileSidebar from '@/components/MobileSidebar';
import { ProfileColumn } from './ProfileColumn';
import BottomNav from '@/components/BottomNav';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { UserSetupModal } from '@/components/UserSetupModal';
import { getUserProfile } from '@/lib/supabase-service';
import { BroadcastWithControls } from '@/components/templates/stream/broadcast/Broadcast';
import { getStreamById } from '@/features/streamAPI';

const Dashboard = () => {
  const { user, ready, authenticated } = usePrivy();
  const navigate = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { streams, loading: streamsLoading, error: streamsError, stream: currentStream } = useSelector((state: RootState) => state.streams);
  const { assets, loading: assetsLoading, error: assetsError } = useSelector((state: RootState) => state.assets);
  const searchParams = useSearchParams();
  const { selectedChannelId: contextChannelId, setSelectedChannelId } = useChannel();
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  
  // Get channelId from URL query params (for navigation from outside dashboard)
  const urlChannelId = searchParams?.get('channelId');
  
  // Use URL channelId if available, otherwise use context channelId
  const selectedChannelId = urlChannelId || contextChannelId;
  
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
  const [isDialogOpen2, setIsDialogOpen2] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'livestreams'>('videos');

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

  // console.log(streams);
  useEffect(() => {
    console.log(streams);
  }, [streams]);
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
        // Show modal if user doesn't have displayName or avatar
        if (!profile || !profile.displayName || !profile.avatar) {
          setShowUserSetupModal(true);
        }
      } catch (error) {
        console.error('Error checking user profile:', error);
        // Show modal on error to be safe
        setShowUserSetupModal(true);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkUserProfile();
  }, [ready, authenticated, creatorAddress]);

  // Sync URL channelId to context when navigating from outside dashboard
  useEffect(() => {
    if (urlChannelId && urlChannelId !== contextChannelId) {
      setSelectedChannelId(urlChannelId);
    }
  }, [urlChannelId, contextChannelId, setSelectedChannelId]);

  const handleProfileSetupSuccess = () => {
    // Trigger a refresh of ProfileColumn by dispatching an event or using context
    // For now, we'll rely on ProfileColumn's useEffect to refetch
    window.dispatchEvent(new CustomEvent('profileUpdated'));
  };

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

// Filter assets by selected channel if one is selected
const filteredAssetsForChannel = useMemo(() => {
  if (!selectedChannel || !creatorAddress) return [];
  return assets.filter((asset: Asset) => 
    !!asset.playbackId && 
    asset.creatorId?.value === creatorAddress &&
    asset.creatorId?.value === selectedChannel.creatorId?.value
  );
}, [assets, selectedChannel, creatorAddress]); 

// console.log(filteredStreams);
  const filteredAssets = useMemo(() => {
    if (!creatorAddress) return [];
    return assets.filter((asset: Asset) => !!asset.playbackId && asset.creatorId?.value === creatorAddress);
  }, [assets, creatorAddress]);

  // NEW: only when not loading, no error, and zero existing streams
  const canCreateStream = !streamsLoading && !streamsError && filteredStreams.length === 0;

  const initiateLiveVideo = async (id: string) => {
    if (!id) return;
    
    try {
      // Fetch stream details
      await dispatch(getStreamById(id));
      setActiveStreamId(id);
      setIsStreaming(true);
      // Switch to livestreams tab
      setActiveTab('livestreams');
    } catch (error: any) {
      console.error('Error fetching stream:', error);
      toast.error('Failed to start stream. Please try again.');
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
        onClose={() => setShowUserSetupModal(false)}
        onSuccess={handleProfileSetupSuccess}
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
          {selectedChannel && (
            <SectionCard title="Your Channel">
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
                <div key={selectedChannel.id} className="col-span-full w-full">
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
                  />
                </div>
              )}
            </SectionCard>
          )}
          
          {/* Show empty state when no channel is selected and user has channels */}
          {!selectedChannel && !canCreateStream && filteredStreams.length > 0 && (
            <SectionCard title="">
              <div className="flex flex-col justify-center items-center h-60 gap-4">
                <p className="text-gray-300 text-center">
                  Select a channel from the sidebar to view its content
                </p>
              </div>
            </SectionCard>
          )}
          
          {/* Show empty state when no channel is selected */}
          {!selectedChannel && (
            <SectionCard title="">
              <div className="flex flex-col justify-center items-center h-60 gap-4">
                <p className="text-gray-500 text-center text-sm">
                  Select a channel to view
                </p>
              </div>
            </SectionCard>
          )}

          {/* Only show tabs section when a channel is selected */}
          {selectedChannel && (
            <>
              <hr className="border-white/20" />
              <SectionCard title="">
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
                          <div className="flex flex-col justify-center items-center h-60 gap-4">
                            <p className="text-gray-300">
                              No videos available for this channel.
                            </p>
                            {/* Upload Asset Button */}
                            <Dialog.Root open={isDialogOpen2} onOpenChange={setIsDialogOpen2}>
                              <Dialog.Trigger asChild>
                                <button
                                  onClick={() => setIsDialogOpen2(true)}
                                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
                                >
                                  <RiVideoAddLine className="w-5 h-5" />
                                  Upload Video
                                </button>
                              </Dialog.Trigger>
                              <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]" />
                                <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-white/20 px-10 max-sm:px-6 py-6 shadow-2xl z-[101]">
                                  <Dialog.Title className="text-white text-center flex items-center gap-2 my-4 text-xl font-bold">
                                    <RiVideoAddLine className="text-yellow-400 text-sm" /> Upload Video Asset
                                  </Dialog.Title>
                                  <UploadVideoAsset onClose={() => setIsDialogOpen2(false)} />
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
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredAssetsForChannel.map((asset) => (
                              <div key={asset.id}>
                                <VideoCard
                                  title={asset.name}
                                  assetData={asset}
                                  imageUrl={image1}
                                  playbackId={asset.playbackId}
                                  createdAt={new Date(asset.createdAt)}
                                  format={(asset as any).videoSpec?.format}
                                />
                              </div>
                            ))}

                            {/* Upload Asset Button */}
                            <Dialog.Root open={isDialogOpen2} onOpenChange={setIsDialogOpen2}>
                              <Dialog.Trigger asChild>
                                <div className="flex w-full flex-col cursor-pointer" onClick={() => setIsDialogOpen2(true)}>
                                  <div className="w-full justify-center flex items-center h-[180px] rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200">
                                    <RiVideoAddLine className="text-yellow-400 w-24 h-24" />
                                  </div>
                                  <div className="text-white text-xl font-bold pt-2 text-center">Upload Asset</div>
                                </div>
                              </Dialog.Trigger>
                              <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]" />
                                <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-white/20 px-10 max-sm:px-6 py-6 shadow-2xl z-[101]">
                                  <Dialog.Title className="text-white text-center flex items-center gap-2 my-4 text-xl font-bold">
                                    <RiVideoAddLine className="text-yellow-400 text-sm" /> Upload Video Asset
                                  </Dialog.Title>
                                  <UploadVideoAsset onClose={() => setIsDialogOpen2(false)} />
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
                  <TabsContent value="livestreams" className="mt-4">
                    {isStreaming && activeStreamData ? (
                      <div className="w-full">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-white font-bold text-lg">Live Broadcast</h3>
                          <button
                            onClick={handleStopStreaming}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-semibold"
                          >
                            Stop Streaming
                          </button>
                        </div>
                        <div className="w-full border border-white/20 rounded-lg overflow-hidden bg-black" style={{ minHeight: '600px', height: 'calc(100vh - 400px)' }}>
                          <BroadcastWithControls
                            streamName={activeStreamData.name}
                            streamKey={activeStreamData.streamKey}
                            playbackId={activeStreamData.playbackId}
                            isActive={activeStreamData.isActive}
                            createdAt={activeStreamData.createdAt}
                          />
                        </div>
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
                          <div className="flex justify-center items-center h-60">
                            <p className="text-gray-300">No Livestreams Available.</p>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </SectionCard>
            </>
          )}
          </div>
          {/* Bottom Navigation - Fixed at bottom of middle column */}
          <div className="flex-shrink-0 z-10">
            <BottomNav />
          </div>
          </div>
        
          {/* Third Column - Profile Column */}
          <div className="hidden lg:block flex-shrink-0 pt-2 pr-2">
            <ProfileColumn />
          </div>
        </div>
        
        
      </div>
    </div>
    </>
  );
};

export default Dashboard;
