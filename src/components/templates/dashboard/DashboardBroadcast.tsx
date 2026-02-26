'use client';
import {
  LoadingIcon,
  OfflineErrorIcon,
} from '@livepeer/react/assets';
import * as Broadcast from '@livepeer/react/broadcast';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getIngest } from '@livepeer/react/external';
import { toast } from 'sonner';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { RootState } from '@/store/store';
import { useSelector, useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store/store';
import { sendChatMessage, fetchChatMessages } from '@/features/chatAPI';
import { addIncomingMessage } from '@/features/chatSlice';
import { getUserProfile, setStreamActiveStatus, subscribeToChatMessages } from '@/lib/supabase-service';
import { BroadcastControls } from '@/components/templates/stream/broadcast/Broadcast';
import { BroadcastStatusSync } from '@/components/templates/stream/broadcast/BroadcastStatusSync';
import { getAllStreams } from '@/features/streamAPI';

interface DashboardBroadcastProps {
  streamName: string;
  streamKey: string;
  playbackId: string;
  creatorAddress: string;
  onStreamEnd?: () => void;
}

export function DashboardBroadcast({ 
  streamName, 
  streamKey, 
  playbackId,
  creatorAddress,
  onStreamEnd
}: DashboardBroadcastProps) {
  const dispatch = useDispatch<AppDispatch>();
  
  const [sessionTime, setSessionTime] = useState('00:00:00');
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isDesktopChatCollapsed, setIsDesktopChatCollapsed] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [mobileUnreadCount, setMobileUnreadCount] = useState(0);
  
  const { messages: chatMessages } = useSelector((s: RootState) => s.chat);
  
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const lastLiveStateRef = useRef<boolean | null>(null);
  const previousMessageCountRef = useRef(0);
  const initializedChatCountRef = useRef(false);

  // Fetch creator displayName for the visit link
  useEffect(() => {
    const fetchCreatorName = async () => {
      if (!creatorAddress) return;
      try {
        const profile = await getUserProfile(creatorAddress);
        if (profile?.displayName) {
          setCreatorDisplayName(profile.displayName);
        }
      } catch (error) {
        console.error('Error fetching creator profile:', error);
      }
    };
    fetchCreatorName();
  }, [creatorAddress]);

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

  // Build creator profile URL
  const creatorProfileUrl = creatorDisplayName
    ? `/creator/${encodeURIComponent(creatorDisplayName)}`
    : null;

  // Copy link handler
  const handleCopyLink = async () => {
    if (!creatorProfileUrl) {
      toast.error('Creator profile not available');
      return;
    }
    try {
      const fullUrl = `${window.location.origin}${creatorProfileUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      toast.success('Creator profile link copied!');
    } catch {
      toast.error('Failed to copy link');
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
  const handleEndStream = async () => {
    setTimerStarted(false);
    try {
      await setStreamActiveStatus(playbackId, false);
      dispatch(getAllStreams());
    } catch (error) {
      console.error('Failed to set stream inactive:', error);
    }
    if (onStreamEnd) {
      onStreamEnd();
    }
  };

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

  const handleSendMessage = useCallback(async () => {
    const messageData = {
      message: chatInput.trim(),
      streamId: playbackId,
      walletAddress: creatorAddress || '',
      sender: creatorAddress || '',
    };

    try {
      await dispatch(sendChatMessage(messageData)).unwrap();
      setChatInput('');
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Chat error:', error);
    }
  }, [chatInput, creatorAddress, playbackId, dispatch]);

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

  useEffect(() => {
    const syncViewport = () => {
      setIsDesktopViewport(window.innerWidth >= 768);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    const currentCount = chatMessages.length;
    const isChatCollapsed = isDesktopViewport ? isDesktopChatCollapsed : !isMobileChatOpen;
    if (!initializedChatCountRef.current) {
      previousMessageCountRef.current = currentCount;
      initializedChatCountRef.current = true;
      return;
    }
    if (isChatCollapsed && currentCount > previousMessageCountRef.current) {
      setMobileUnreadCount((prev) => prev + (currentCount - previousMessageCountRef.current));
    }
    if (!isChatCollapsed && mobileUnreadCount !== 0) {
      setMobileUnreadCount(0);
    }
    previousMessageCountRef.current = currentCount;
  }, [
    chatMessages.length,
    isDesktopChatCollapsed,
    isDesktopViewport,
    isMobileChatOpen,
    mobileUnreadCount,
  ]);

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
      <div className="flex flex-col md:flex-row flex-1 h-full w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-black via-gray-950 to-black p-2 md:p-4 gap-2 md:gap-4">
        {/* Main Broadcast Area - Wider with padding */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top Controls Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-white/10 to-white/5 border-b border-white/20 rounded-t-lg">
            {/* Session Duration */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-md">
                <span className="text-white font-medium text-sm">{sessionTime}</span>
                <span className="text-gray-400 text-xs">Session</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              {/* Start/Stop Stream Button */}
              <Broadcast.EnabledTrigger className="rounded-md">
                <Broadcast.EnabledIndicator
                  className="flex items-center bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 h-[36px] min-w-[120px] md:min-w-[140px] rounded-md text-black px-3 md:px-4 justify-center transition-colors text-xs md:text-sm"
                  matcher={false}
                  onClick={handleStartStream}
                >
                  <span className="font-medium">Start Stream</span>
                </Broadcast.EnabledIndicator>
                
                {/* End Stream Dropdown */}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Broadcast.EnabledIndicator
                      className="flex items-center justify-center bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 h-[36px] min-w-[120px] md:min-w-[140px] rounded-md text-white px-3 md:px-4 cursor-pointer transition-colors text-xs md:text-sm"
                      matcher={true}
                    >
                      <span className="font-medium">Stop Stream</span>
                    </Broadcast.EnabledIndicator>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="p-4 flex flex-col w-[280px] items-center rounded-lg z-50 bg-gray-900 border border-white/20 shadow-xl"
                      sideOffset={5}
                    >
                      <p className="text-white font-medium text-sm mb-4 text-center">
                        Are you sure you want to end this stream?
                      </p>
                      <div className="flex gap-3 w-full">
                        <DropdownMenu.Item
                          className="flex-1 flex items-center cursor-pointer px-4 py-2 border border-white/20 h-[36px] rounded-md text-white justify-center hover:bg-white/10 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="text-sm font-medium">Cancel</p>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={handleEndStream}
                          className="flex-1 flex items-center cursor-pointer px-4 py-2 bg-red-600 hover:bg-red-700 h-[36px] rounded-md text-white justify-center transition-colors"
                        >
                          <p className="text-sm font-medium">End Stream</p>
                        </DropdownMenu.Item>
                      </div>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </Broadcast.EnabledTrigger>

              {/* Copy Link Button */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors text-xs md:text-sm font-medium"
              >
                <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Copy Link</span>
                <span className="sm:hidden">Copy</span>
              </button>

              {/* Visit Link Button */}
              {creatorProfileUrl && (
                <Link href={creatorProfileUrl} target="_blank" rel="noopener noreferrer">
                  <button className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors text-xs md:text-sm font-medium">
                    <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Visit</span>
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Broadcast Video Container */}
          <div className="relative bg-black rounded-b-lg overflow-hidden aspect-video md:aspect-auto md:flex-1">
            <BroadcastContainer />
          </div>
        </div>

        {/* Chat Panel - collapsible on mobile */}
        <div
          className={`w-full border-t md:border-t-0 md:border-l border-white/20 bg-black/40 backdrop-blur-sm flex flex-col rounded-lg md:rounded-l-none transition-[max-height,width] duration-300 ${
            isMobileChatOpen ? 'max-h-[66vh]' : 'max-h-[64px]'
          } ${isDesktopChatCollapsed ? 'md:w-14 lg:w-16' : 'md:w-64 lg:w-72'} md:max-h-none`}
        >
          <button
            type="button"
            onClick={() => setIsMobileChatOpen((prev) => !prev)}
            className="md:hidden flex h-16 w-full items-center justify-between border-b border-white/20 bg-gradient-to-r from-white/10 to-white/5 px-4 text-left"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-cyan-200" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Community Desk</p>
                <p className="text-sm font-semibold text-white">Live Chat</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              {mobileUnreadCount > 0 && !isMobileChatOpen && (
                <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-cyan-400/20 px-1.5 text-[10px] font-semibold text-cyan-100">
                  {mobileUnreadCount > 99 ? '99+' : mobileUnreadCount}
                </span>
              )}
              {isMobileChatOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
          </button>

          <div
            className={`hidden md:flex items-center border-b border-white/20 bg-gradient-to-r from-white/10 to-white/5 ${
              isDesktopChatCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-3'
            }`}
          >
            {!isDesktopChatCollapsed && (
              <h3 className="font-semibold tracking-wide text-white text-sm md:text-base">Live Chat</h3>
            )}
            <button
              type="button"
              onClick={() => setIsDesktopChatCollapsed((prev) => !prev)}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/5 text-gray-200 transition-colors hover:bg-white/15"
              aria-label={isDesktopChatCollapsed ? 'Expand chat panel' : 'Collapse chat panel'}
            >
              {mobileUnreadCount > 0 && isDesktopChatCollapsed && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-cyan-400/25 px-1 text-[9px] font-semibold text-cyan-100">
                  {mobileUnreadCount > 99 ? '99+' : mobileUnreadCount}
                </span>
              )}
              {isDesktopChatCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          <div
            className={`${
              isDesktopChatCollapsed ? 'hidden md:flex md:items-center md:justify-center md:flex-1' : 'hidden'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsDesktopChatCollapsed(false)}
              className="group flex h-full w-full flex-col items-center justify-center gap-4 border-t border-white/10 bg-black/20 text-gray-300 transition-colors hover:bg-black/35"
              aria-label="Expand chat panel"
            >
              <MessageCircle className="h-4 w-4 text-cyan-200" />
              {mobileUnreadCount > 0 && (
                <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-cyan-400/20 px-1.5 text-[10px] font-semibold text-cyan-100">
                  {mobileUnreadCount > 99 ? '99+' : mobileUnreadCount}
                </span>
              )}
              <span className="rotate-90 whitespace-nowrap text-[10px] uppercase tracking-[0.14em] text-gray-400 group-hover:text-cyan-100">
                Chat
              </span>
            </button>
          </div>

          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-[max-height,opacity] duration-300 ${
              isMobileChatOpen ? 'max-h-[56vh] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
            } ${isDesktopChatCollapsed ? 'md:hidden' : 'md:max-h-none md:opacity-100 md:pointer-events-auto'}`}
          >
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 min-h-[200px] md:min-h-0">
              <p className="text-center text-gray-400 text-xs md:text-sm mb-3 md:mb-4">
                Welcome to {streamName} chat
              </p>
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-2.5 md:p-3 border ${
                    msg?.sender === creatorAddress
                      ? 'border-yellow-500/30 bg-yellow-500/10'
                      : 'border-white/10 bg-white/10'
                  }`}
                >
                  <span
                    className={`font-semibold text-xs md:text-sm ${
                      msg?.sender === creatorAddress ? 'text-yellow-300' : 'text-blue-300'
                    }`}
                  >
                    {msg?.sender === creatorAddress ? 'You' : `${msg?.sender?.slice(0, 6)}...${msg?.sender?.slice(-4)}`}:
                  </span>{' '}
                  <span className="text-white/95 text-xs md:text-sm">{msg?.message}</span>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-white/20 bg-white/10 rounded-b-lg">
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
                  className="w-full border border-white/20 rounded-md py-2 px-3 bg-white/10 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 text-sm"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black font-medium px-4 py-2 rounded-md transition-colors text-sm"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Broadcast.Root>
  );
}

// Broadcast Container Component
const BroadcastContainer = () => {
  return (
    <Broadcast.Container className="flex relative h-full w-full">
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
          <LoadingIcon className="w-8 h-8 animate-spin text-white" />
        </div>
      </Broadcast.LoadingIndicator>
      {/* Error Indicator */}
      <Broadcast.ErrorIndicator
        matcher="not-permissions"
        className="absolute select-none inset-0 text-center flex flex-col items-center justify-center gap-4 bg-black/80"
      >
        <OfflineErrorIcon className="h-[120px] w-full sm:flex hidden" />
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold text-white">Broadcast failed</div>
          <div className="text-sm text-gray-300">
            There was an error with broadcasting - it is retrying in the background.
          </div>
        </div>
      </Broadcast.ErrorIndicator>
      {/* Controls */}
      <BroadcastControls />
    </Broadcast.Container>
  );
};
