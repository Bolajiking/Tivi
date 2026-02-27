'use client';
import {
  DisableAudioIcon,
  DisableVideoIcon,
  EnableAudioIcon,
  EnableVideoIcon,
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  LoadingIcon,
  OfflineErrorIcon,
  PictureInPictureIcon,
  StartScreenshareIcon,
  StopScreenshareIcon,
} from '@livepeer/react/assets';
import * as Dialog from '@radix-ui/react-dialog';
import * as Broadcast from '@livepeer/react/broadcast';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getIngest } from '@livepeer/react/external';
import { toast } from 'sonner';
import { Settings } from './Settings';
import styles from './BroadcastScroll.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RiVideoAddLine } from 'react-icons/ri';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CustomizeChannelDialog } from '@/components/Dialog'; // our customized dialog
import Image from 'next/image';
import { Menu, SettingsIcon, X } from 'lucide-react';
import MobileSidebar from '@/components/MobileSidebar';
import { useViewMetrics } from '@/app/hook/useViewerMetrics';
import { UploadAdsAsset } from '@/components/UploadVideoAsset';
import { IoMdClose } from 'react-icons/io';
import { useGetStreamDetails } from '@/app/hook/useStreamGate';
import { Bars } from 'react-loader-spinner';
import { sendChatMessage, fetchChatMessages } from '@/features/chatAPI';
import { addIncomingMessage } from '@/features/chatSlice';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';
import { BroadcastStatusSync } from './BroadcastStatusSync';
import { getAllStreams } from '@/features/streamAPI';
import { setStreamActiveStatus, subscribeToChatMessages } from '@/lib/supabase-service';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

interface Streams {
  streamKey: string;
  playbackId: string;
  streamName: string;
  isActive?: boolean;
  createdAt?: string;
}

export function BroadcastWithControls({ streamName, streamKey, playbackId }: Streams) {
  const { walletAddress } = useWalletAddress();
  const creatorId = walletAddress || '';
  const dispatch = useDispatch<AppDispatch>();

  // console.log('creatorId', creatorId);
  const host = process.env.NEXT_PUBLIC_BASE_URL;
  const playbackUrl =
    host && playbackId
      ? `${host.includes('localhost') ? 'http' : 'https'}://${host}/creator/${encodeURIComponent(
          creatorId || '',
        )}/live/${encodeURIComponent(playbackId)}`
      : null;
  const router = useRouter();

  // Fetch settings from backend
  const { stream, loading: detailsLoading, error: detailsError } = useGetStreamDetails(playbackId);

  // Local customization state for live updates
  const [customization, setCustomization] = useState({
    bgColor: '#ffffff',
    fontSize: '16',
    textColor: '#000000',
    logo: '',
    title: streamName || 'Live Stream',
    description: '',
  });

  // When API returns, initialize customization
  useEffect(() => {
    if (stream) {
      setCustomization({
        bgColor: stream.bgcolor,
        textColor: stream.color,
        fontSize: stream.fontSize,
        logo: stream.logo,
        title: stream.streamName,
        description: stream.description,
      });
    }
  }, [stream]);

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isAdsOpen, setIsAdsOpen] = useState(false);
  const [sessionTime, setSessionTime] = useState('00:00:00');
  const [showChat, setShowChat] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showAds, setShowAds] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    // const [chatMessages, setChatMessages] = useState([
    //   { user: 'Creator', message: 'Gm guys, where are you streaming from? WAGMI!', highlight: true },
    // ]);
  const { messages: chatMessages, loading: chatLoading, sending: isSendingChat, error: chatError } = useSelector((s: RootState) => s.chat);
  const [chatInput, setChatInput] = useState('');
  const { viewerMetrics } = useViewMetrics({ playbackId, refreshInterval: 10000 });
  const viewerCount = viewerMetrics?.viewCount || 0;

  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const lastLiveStateRef = useRef<boolean | null>(null);

  // Session timer
  useEffect(() => {
    if (timerStarted) {
      const start = localStorage.getItem('broadcastStart')
        ? Number(localStorage.getItem('broadcastStart'))
        : Date.now();
      startTimeRef.current = start;
      localStorage.setItem('broadcastStart', start.toString());
      intervalRef.current = setInterval(() => {
        const delta = Date.now() - startTimeRef.current;
        const hrs = String(Math.floor(delta / 3600000)).padStart(2, '0');
        const mins = String(Math.floor((delta % 3600000) / 60000)).padStart(2, '0');
        const secs = String(Math.floor((delta % 60000) / 1000)).padStart(2, '0');
        setSessionTime(`${hrs}:${mins}:${secs}`);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      localStorage.removeItem('broadcastStart');
      setSessionTime('00:00:00');
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerStarted]);

  // Copy link
  const handleCopyLink = async () => {
    try {
      if (playbackUrl && creatorId) {
        await navigator.clipboard.writeText(playbackUrl);
        toast.success('Stream link copied!');
      } else {
        toast.error('No link to copy');
      }
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleStartStream = async () => {
    setTimerStarted(true);
    try {
      await setStreamActiveStatus(playbackId, true);
      dispatch(getAllStreams());
    } catch (error) {
      console.error('Failed to set stream active:', error);
    }
  };
  const handleEndStream = useCallback(async () => {
    setTimerStarted(false);
    try {
      await setStreamActiveStatus(playbackId, false);
      dispatch(getAllStreams());
    } catch (error) {
      console.error('Failed to set stream inactive:', error);
    }
  }, [dispatch, playbackId]);
  const toggleSidebar = () => setSidebarCollapsed((sidebar) => !sidebar);
  const toggleMobileMenu = () => setMobileMenuOpen((menu) => !menu);
  const toggleChat = () => {
    setShowChat(true);
    setShowInfo(false);
    setShowAds(false);
  };
  const toggleInfo = () => {
    setShowInfo(true);
    setShowChat(false);
    setShowAds(false);
  };
  const toggleAds = () => {
    setShowAds(true);
    setShowChat(false);
    setShowInfo(false);
  };

  const handleSendMessage = useCallback(async () => {
    // if (!chatInput.trim() || !connected || !publicKey) {
    //   toast.error('Please connect your wallet to send messages');
    //   return;
    // }

    // const sender = publicKey.toString().slice(0, 5) + '...';
    const messageData = {
      message: chatInput.trim(),
      streamId: playbackId,
      walletAddress: creatorId || '',
      sender: creatorId || '',
    };

    try {
      await dispatch(sendChatMessage(messageData)).unwrap();
      setChatInput('');
      // toast.success('Message sent successfully!');
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Chat error:', error);
    }
  }, [chatInput, creatorId, playbackId, dispatch]);

  useEffect(() => {
    if (playbackId) {
      dispatch(fetchChatMessages(playbackId));
    }
  }, [dispatch, playbackId]);

  useEffect(() => {
    if (!playbackId) return;
    const unsubscribe = subscribeToChatMessages(playbackId, (message) => {
      const incomingMessage = message as any;
      dispatch(
        addIncomingMessage({
          id: incomingMessage.id || '',
          sender: incomingMessage.sender,
          message: incomingMessage.message,
          timestamp: incomingMessage.timestamp
            ? new Date(incomingMessage.timestamp)
            : new Date(incomingMessage.created_at || Date.now()),
          streamId: incomingMessage.stream_id || incomingMessage.streamId,
          walletAddress: incomingMessage.wallet_address || incomingMessage.walletAddress,
        }),
      );
    });

    return () => unsubscribe();
  }, [dispatch, playbackId]);

  const handleBroadcastStatusChange = useCallback(
    async (status: string) => {
      const isLive = status === 'live' || status === 'pending';
      if (lastLiveStateRef.current === isLive) return;
      lastLiveStateRef.current = isLive;

      try {
        await setStreamActiveStatus(playbackId, isLive);
        dispatch(getAllStreams());
      } catch (error) {
        console.error(`Failed to sync broadcast status (${status}) for ${playbackId}:`, error);
      }
    },
    [dispatch, playbackId],
  );

  if (detailsLoading) {
    return (
      <div className="flex items-center justify-center flex-col h-full">
        <Bars width={25} height={25} color="#facc15" />
        <p className="pt-3">Loading settings…</p>
      </div>
    );
  }
  if (detailsError) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error: {detailsError}</div>;
  }
  return (
    <Broadcast.Root
      onError={(error) =>
        error?.type === 'permissions'
          ? toast.error('You must accept permissions to broadcast. Please try again.')
          : null
      }
      aspectRatio={16 / 9}
      ingestUrl={getIngest(streamKey)}
    >
      <BroadcastStatusSync onStatusChange={handleBroadcastStatusChange} />
      <div className="flex flex-1 h-screen w-full overflow-hidden">
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
        <div className="flex flex-col w-full h-full overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center px-3 w-full border-b border-green-400 h-[70px] bg-white">
            <button onClick={toggleMobileMenu} className="md:hidden">
              {mobileMenuOpen ? <X className="h-7 w-7 text-[#000]" /> : <Menu className="h-7 w-7 text-[#000]" />}
            </button>
            <BroadcastLoadingIndicator />
            <button className="md:hidden flex gap-3  items-center px-4 py-2 bg-gray-100 rounded-md">
              <span className="font-medium">{viewerCount}</span>
              <span className="">Viewers</span>
            </button>
            {/* Desktop Stats - Hidden on mobile */}
            <div
              className="max-sm:hidden md:flex items-center space-x-4"
              style={{
                fontSize: customization.fontSize,
                color: customization.textColor,
              }}
            >
              <div className="flex flex-col items-center px-4 py-2 bg-gray-100 rounded-md">
                <span className="font-medium">{sessionTime || '00:00:00'}</span>
                <span>Session</span>
              </div>
              <button
                className="flex flex-col items-center px-4 py-2 bg-gray-100 rounded-md"
                onClick={() => router.push('/dashboard')}
              >
                Change Channel
              </button>
              <div className="px-10">
                <CustomizeChannelDialog
                  playbackId={playbackId}
                  initialValues={{
                    bgColor: customization.bgColor,
                    textColor: customization.textColor,
                    fontSize: customization.fontSize,
                    title: customization.title,
                    description: customization.description,
                    logo: customization.logo,
                  }}
                  onSave={(updated) => setCustomization(updated)}
                  open={isCustomizeOpen}
                  onOpenChange={setIsCustomizeOpen}
                />
              </div>
            </div>

            <div className="mt-2 sm:mt-0">
              {/* Broacast trigger */}
              <div className="flex items-center gap-2">
                <Broadcast.EnabledTrigger className="rounded-md">
                  <Broadcast.EnabledIndicator
                    className="flex items-center bg-main-blue h-[40px] min-w-[150px] rounded-md text-black-primary-text px-4 justify-center"
                    matcher={false}
                    onClick={handleStartStream}
                  >
                    <span className="text-base text-black font-medium">Start Stream</span>
                  </Broadcast.EnabledIndicator>
                  {/* End Stream Dropdown */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Broadcast.EnabledIndicator
                        className="flex items-center justify-center bg-red-500 h-[40px] w-full min-w-[150px] rounded-md text-black-primary-text px-4 cursor-pointer"
                        matcher={true}
                      >
                        <span className="text-base text-black  font-medium">End Stream</span>
                      </Broadcast.EnabledIndicator>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="p-6 flex flex-col w-[292px] items-center rounded-md mr-2 z-10 bg-white shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]"
                        sideOffset={5}
                      >
                        <p className="text-black font-medium text-base mb-4 text-center">
                          Are you sure you want to end this Stream?
                        </p>
                        <div className="flex gap-x-4">
                          <DropdownMenu.Item
                            className="flex items-center cursor-pointer px-6 py-3 border h-[40px] rounded-md text-black justify-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-black font-medium text-sm">Cancel</p>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onClick={handleEndStream}
                            className="flex items-center cursor-pointer px-6 py-3 bg-red-500 h-[40px] rounded-md text-black justify-center"
                          >
                            <p className="text-black font-medium text-sm">End Stream</p>
                          </DropdownMenu.Item>
                        </div>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </Broadcast.EnabledTrigger>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="w-full md:h-screen grid grid-cols-1 md:grid-cols-12 gap-x-2 pt-1 ">
            {/* Video Section */}
            <div
              style={{
                backgroundColor: customization.bgColor,
                color: customization.textColor,
                fontSize: customization.fontSize + 'px',
              }}
              className=" w-full col-span-8 h-full flex flex-col overflow-y-auto"
            >
              <div className={`w-full border-l border-border-gray ${customization.bgColor} h-full`}>
                <div className="flex justify-center items-center w-full h-20">
                  {customization.logo && (
                    <div className="w-20 h-20 rounded-full overflow-hidden border mb-2 border-gray-300 flex items-center justify-center">
                      <Image
                        src={customization.logo}
                        alt="logo"
                        width={60}
                        height={60}
                        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                        className="rounded-full"
                      />
                    </div>
                  )}
                </div>
                <div className="relative flex-grow">
                  <BroadcastContainer />
                </div>

                {/* Controls and Info */}
                <div className="bg-white">
                  {/* Action Buttons */}
                  <div className="flex justify-between items-center px-4 py-3 border-t border-b">
                    <div className="flex items-center gap-x-3">
                      <button className="flex rounded-sm bg-background-gray md:h-[33px] items-center px-3">
                        <span className="text-black-primary-text font-medium select-none">Play Ads</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-x-3">
                      {/* <Settings className="w-7 h-7 transition-all flex-shrink-0 text-black-primary-text hover:scale-110" /> */}
                      <button
                        className="flex rounded-md bg-background-gray md:h-[33px]  items-center px-3"
                        onClick={handleCopyLink}
                      >
                        <span className="text-black-secondary-text font-medium select-none">Copy Link</span>
                      </button>
                      {playbackUrl && creatorId && (
                        <Link href={playbackUrl} target="_blank" rel="noopener noreferrer">
                          <button className="flex rounded-md bg-background-gray md:h-[33px] items-center px-3">
                            <span className="text-black-secondary-text font-medium select-none">Visit Link</span>
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Mobile Tabs - Only visible on mobile */}
                  <div className=" border-b md:hidden">
                    <div className="flex">
                      <button
                        className={`flex-1 py-3 text-center font-medium ${showChat ? 'border-b-2 border-black' : ''}`}
                        onClick={toggleChat}
                      >
                        Chat
                      </button>
                      <button
                        className={`flex-1 py-3 text-center font-medium ${showInfo ? 'border-b-2 border-black' : ''}`}
                        onClick={toggleInfo}
                      >
                        Basic Info
                      </button>
                      <button
                        className={`flex-1 py-3 text-center font-medium ${showAds ? 'border-b-2 border-black' : ''}`}
                        onClick={toggleAds}
                      >
                        Ads
                      </button>
                    </div>
                  </div>

                  {/* Mobile Content - Only visible on mobile */}
                  <div className=" md:hidden">
                    {showChat && (
                      <div className="min-h-96 h-[400px] flex flex-col">
                        <div className="flex-1 overflow-y-auto p-4">
                          <p className="text-center text-gray-500 mb-4">Welcome to {streamName} chat!</p>
                          <div className="space-y-3">
                            {chatMessages.map((msg, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3">
                                <span className={`font-bold ${msg?.sender === creatorId ? 'text-red-600' : ''}`}>{msg?.sender === creatorId ? 'Streamer' : msg?.sender}:</span>{' '}
                                {msg?.message}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 border-t">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSendMessage();
                            }}
                            className="flex flex-col space-y-2"
                          >
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder="Send message..."
                              className="w-full border rounded-md py-2 px-3"
                            />
                            <div className="flex justify-between items-center">
                              <button type="button" className="p-2">
                                <SettingsIcon className="h-5 w-5 text-black" />
                              </button>
                              <button type="submit" className="bg-main-blue text-white px-4  rounded-md">
                                Chat
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                    {showInfo && (
                      <div className="h-[calc(100vh-400px)] overflow-y-auto p-4">
                        <div className="flex flex-col mb-3 gap-y-2">
                          <h1 className="text-black-secondary-text font-medium select-none">Title</h1>
                          <input
                            value={customization.title}
                            disabled
                            className="w-full text-sm outline-none border bg-transparent capitalize p-3 text-black-secondary-text border-[#c2c2c2] rounded-md font-medium select-none"
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <h1 className="text-black-secondary-text font-medium select-none">Description</h1>
                          <textarea
                            value={customization.description}
                            disabled
                            rows={2}
                            className="w-full text-sm outline-none border  bg-transparent line-clamp-4 p-3 text-black-secondary-text border-[#c2c2c2] rounded-md font-medium select-none overflow-y-auto"
                          />
                        </div>
                      </div>
                    )}

                    {showAds && (
                      <div className="h-[calc(100vh-400px)] overflow-y-auto p-4">
                        <h4 className="text-sm text-gray-500 mb-3">Video</h4>
                        <Dialog.Root open={isAdsOpen} onOpenChange={setIsAdsOpen}>
                          <Dialog.Trigger asChild>
                            <div className="border rounded-md p-2">
                              <div className="bg-gray-200 h-24 rounded-md flex items-center justify-center text-blue-500 text-2xl">
                                +
                              </div>
                            </div>
                          </Dialog.Trigger>
                          <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 bg-black opacity-70" />
                            <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white px-10 max-sm:px-6 py-6 shadow-lg">
                              <Dialog.Title className="text-black-primary-text text-center flex items-center gap-2 my-4 text-xl font-bold">
                                <RiVideoAddLine className="text-main-blue text-l" /> Upload Video Ads
                              </Dialog.Title>
                              <UploadAdsAsset onClose={() => setIsAdsOpen(false)} />
                              <Dialog.Close asChild>
                                <button
                                  className="absolute right-2.5 top-2.5 inline-flex size-[25px] appearance-none items-center justify-center rounded-full text-violet11 hover:bg-violet4 focus:shadow-[0_0_0_2px] focus:shadow-violet7 focus:outline-none"
                                  aria-label="Close"
                                >
                                  <IoMdClose className="text-black-primary-text font-medium text-4xl" />
                                </button>
                              </Dialog.Close>
                            </Dialog.Content>
                          </Dialog.Portal>
                        </Dialog.Root>
                      </div>
                    )}
                  </div>

                  {/* Desktop Info - Only visible on desktop */}
                  <div className="max-sm:hidden ">
                    <div className="w-full p-3 pl-4 rounded-b-md bg-white border-t">
                      <div className="flex flex-col mb-3 gap-y-2">
                        <h1 className="text-black-secondary-text font-medium select-none">Title</h1>
                        <input
                          value={customization.title}
                          disabled
                          className="w-full text-sm outline-none capitalize border bg-transparent p-3 text-black-secondary-text border-[#c2c2c2] rounded-md font-medium select-none"
                        />
                      </div>
                      <div className="flex flex-col gap-y-2">
                        <h1 className="text-black-secondary-text font-medium select-none">Description</h1>
                        <textarea
                          value={customization.description}
                          disabled
                          rows={2}
                          className="w-full text-sm outline-none border bg-transparent line-clamp-4 p-3 text-black-secondary-text border-[#c2c2c2] rounded-md font-medium select-none overflow-y-auto"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Ads */}
                  <div className="max-sm:hidden border rounded-md m-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                      <h3 className="font-medium">Ads</h3>
                      <div className="flex items-center space-x-2">
                        <button className="text-sm bg-gray-200 px-3 py-1 rounded-md">Edit</button>
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="text-sm text-gray-500 mb-3 mt-6">Picture-in-picture</h4>
                      <div className="grid grid-cols-4 gap-4">
                        <Dialog.Root open={isAdsOpen} onOpenChange={setIsAdsOpen}>
                          <Dialog.Trigger asChild>
                            <div className="border rounded-md p-2">
                              <div className="bg-gray-200 h-24 rounded-md flex items-center justify-center text-blue-500 text-2xl">
                                +
                              </div>
                            </div>
                          </Dialog.Trigger>
                          <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 bg-black opacity-70" />
                            <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white px-10 max-sm:px-6 py-6 shadow-lg">
                              <Dialog.Title className="text-black-primary-text text-center flex items-center gap-2 my-4 text-xl font-bold">
                                <RiVideoAddLine className="text-main-blue text-l" /> Upload Video Ads
                              </Dialog.Title>
                              <UploadAdsAsset onClose={() => setIsAdsOpen(false)} />
                              <Dialog.Close asChild>
                                <button
                                  className="absolute right-2.5 top-2.5 inline-flex size-[25px] appearance-none items-center justify-center rounded-full text-violet11 hover:bg-violet4 focus:shadow-[0_0_0_2px] focus:shadow-violet7 focus:outline-none"
                                  aria-label="Close"
                                >
                                  <IoMdClose className="text-black-primary-text font-medium text-4xl" />
                                </button>
                              </Dialog.Close>
                            </Dialog.Content>
                          </Dialog.Portal>
                        </Dialog.Root>
                        {/* Ads video list */}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Section - Desktop */}
            <div className="max-sm:hidden rounded-lg col-span-4 md:block shadow-sm overflow-y-auto h-full border border-border-gray">
              <div className="flex flex-col h-full">
                <div className="p-3 border-b bg-gray-100">
                  <h3 className="font-medium">Chat</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-white">
                  <p className="text-center text-gray-500 mb-4">Welcome to the chat!</p>
                  <div className="space-y-3">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 text-black">
                        <span className={`font-bold ${msg?.sender === creatorId ? 'text-red-600' : 'text-blue-600'}`}>{msg?.sender === creatorId ? 'You' : msg?.sender}:</span>{' '}
                        {msg?.message}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 border-t bg-white">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex flex-col space-y-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Send message..."
                      className="w-full border rounded-md py-2 px-3 text-black"
                    />
                    <div className="flex justify-end gap-3">
                      <button type="button" className="p-2">
                        <SettingsIcon className="h-6 w-6 text-black" />
                      </button>
                      <button type="submit" className="bg-main-blue text-white px-3 rounded-md">
                        Chat
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Broadcast.Root>
  );
}

export const BroadcastContainer = () => {
  return (
    <Broadcast.Container className="flex relative h-full">
      <Broadcast.Video
        title="Live streaming"
        style={{
          height: '100%',
          width: '100%',
          objectFit: 'cover',
        }}
      />
      {/* Loading Indicator */}
      <Broadcast.LoadingIndicator className="w-full relative h-full">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <LoadingIcon className="w-8 h-8 animate-spin" />
        </div>
        <BroadcastLoading />
      </Broadcast.LoadingIndicator>
      {/* Error Indicator */}
      <Broadcast.ErrorIndicator
        matcher="not-permissions"
        className="absolute select-none inset-0 text-center flex flex-col items-center justify-center gap-4 duration-1000 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
      >
        <OfflineErrorIcon className="h-[120px] w-full sm:flex hidden" />
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold">Broadcast failed</div>
          <div className="text-sm text-gray-100">
            There was an error with broadcasting - it is retrying in the background.
          </div>
        </div>
      </Broadcast.ErrorIndicator>
      {/* Controls */}
      <BroadcastControls />
    </Broadcast.Container>
  );
};

export const BroadcastLoading = () => (
  <div className="w-full px-3 md:px-3 py-3 gap-3 flex-col-reverse flex aspect-video max-w-2xl mx-auto animate-pulse bg-black overflow-hidden rounded-sm">
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 animate-pulse bg-gray-800 overflow-hidden rounded-lg" />
        <div className="w-16 h-6 md:w-20 md:h-7 animate-pulse bg-gray-800 overflow-hidden rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 animate-pulse bg-gray-800 overflow-hidden rounded-lg" />
        <div className="w-7 h-7 animate-pulse bg-gray-800 overflow-hidden rounded-lg" />
      </div>
    </div>
    <div className="w-full h-2 animate-pulse bg-gray-800 overflow-hidden rounded-lg" />
  </div>
);

// export const BroadcastTrigger = () => {
// const [timerStarted, setTimerStarted] = useState(false);

//   // const handleStartStream = () => {
//   //   setTimerStarted(true);
//   //   setTimeout(() => {
//   //     startTimer(); // Start the timer after 5 seconds
//   //   }, 5000);
//   // };
//   return (

//   );
// };

export const BroadcastLoadingIndicator = () => {
  return (
    <Broadcast.LoadingIndicator asChild matcher={false}>
      <div className="overflow-hidden h-[34px] rounded-md top-1 left-1 flex items-center backdrop-blur">
        <Broadcast.StatusIndicator matcher="live" className="flex p-2 gap-2 items-center">
          <div className="bg-[#04EB2A] h-2 w-2 rounded-full" />
          <span className="text-sm text-black-primary-text font-medium select-none">Live</span>
        </Broadcast.StatusIndicator>
        <Broadcast.StatusIndicator className="flex p-2 gap-2 items-center" matcher="pending">
          <div className="bg-[#DC7609] h-3 w-3 rounded-full animate-pulse" />
          <span className="text-sm text-black-primary-text font-medium select-none">Pending</span>
        </Broadcast.StatusIndicator>
        <Broadcast.StatusIndicator className="flex p-2 gap-2 items-center" matcher="idle">
          <div className="bg-[#00000033] animate-pulse h-3 w-3 rounded-full" />
          <span className="text-sm text-black-primary-text font-medium select-none">Offline</span>
        </Broadcast.StatusIndicator>
      </div>
    </Broadcast.LoadingIndicator>
  );
};

export const BroadcastControls = () => {
  return (
    <Broadcast.Controls autoHide={2000} className="flex flex-col-reverse mb-2 px-5 rounded-md">
      <div className="flex justify-between bg-background-gray px-4 rounded-3xl h-[40px] gap-4">
        <div className="flex flex-1 items-center gap-3">
          <Broadcast.VideoEnabledTrigger className="w-7 h-7 hover:scale-110 text-black-primary-text transition-all flex-shrink-0">
            <Broadcast.VideoEnabledIndicator asChild matcher={false}>
              <DisableVideoIcon className="w-full h-full text-black-primary-text" />
            </Broadcast.VideoEnabledIndicator>
            <Broadcast.VideoEnabledIndicator asChild matcher={true}>
              <EnableVideoIcon className="w-full h-full" />
            </Broadcast.VideoEnabledIndicator>
          </Broadcast.VideoEnabledTrigger>
          <Broadcast.AudioEnabledTrigger className="w-7 h-7 hover:scale-110 text-red-500 transition-all flex-shrink-0">
            <Broadcast.AudioEnabledIndicator asChild matcher={false}>
              <DisableAudioIcon className="w-full h-full" />
            </Broadcast.AudioEnabledIndicator>
            <Broadcast.AudioEnabledIndicator asChild matcher={true}>
              <EnableAudioIcon className="w-full h-full" />
            </Broadcast.AudioEnabledIndicator>
          </Broadcast.AudioEnabledTrigger>
        </div>
        <div className="flex sm:flex-1 md:flex-[1.5] justify-end items-center gap-2.5">
          <Broadcast.FullscreenIndicator matcher={false} asChild>
            <Settings className="w-7 h-7 transition-all flex-shrink-0 text-black-primary-text hover:scale-110" />
          </Broadcast.FullscreenIndicator>
          <Broadcast.ScreenshareTrigger className="w-7 h-7 hover:scale-110 transition-all flex-shrink-0">
            <Broadcast.ScreenshareIndicator asChild>
              <StopScreenshareIcon className="w-full h-full text-black-primary-text" />
            </Broadcast.ScreenshareIndicator>
            <Broadcast.ScreenshareIndicator matcher={false} asChild>
              <StartScreenshareIcon className="w-full h-full text-black-primary-text" />
            </Broadcast.ScreenshareIndicator>
          </Broadcast.ScreenshareTrigger>
          <Broadcast.PictureInPictureTrigger className="w-7 h-7 hover:scale-110 text-black-primary-text transition-all flex-shrink-0">
            <PictureInPictureIcon className="w-full h-full text-black-primary-text" />
          </Broadcast.PictureInPictureTrigger>
          <Broadcast.FullscreenTrigger className="w-7 h-7 hover:scale-110 text-black-primary-text transition-all flex-shrink-0">
            <Broadcast.FullscreenIndicator asChild>
              <ExitFullscreenIcon className="w-full h-full text-black-primary-text" />
            </Broadcast.FullscreenIndicator>
            <Broadcast.FullscreenIndicator matcher={false} asChild>
              <EnterFullscreenIcon className="w-full h-full text-black-primary-text" />
            </Broadcast.FullscreenIndicator>
          </Broadcast.FullscreenTrigger>
        </div>
      </div>
    </Broadcast.Controls>
  );
};
