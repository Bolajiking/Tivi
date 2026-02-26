'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Player from '@livepeer/react/player';
import { Bars } from 'react-loader-spinner';
import { toast } from 'sonner';
import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  LoadingIcon,
  MuteIcon,
  OfflineErrorIcon,
  PauseIcon,
  PictureInPictureIcon,
  PlayIcon,
  PrivateErrorIcon,
  UnmuteIcon,
} from '@livepeer/react/assets';
import { Clip } from './Clip';
import { Settings } from './Settings';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { sendChatMessage, fetchChatMessages } from '@/features/chatAPI';
import { addIncomingMessage } from '@/features/chatSlice';
import { useViewMetrics } from '@/app/hook/useViewerMetrics';
import { useStreamGate } from '@/app/hook/useStreamGate';
import type { Src } from '@livepeer/react';
import { StreamGateModal } from './StreamGateModal';
import { StreamPayment } from './StreamPayment';
import { useRouter } from 'next/navigation';
import { useSendTransaction, useWallets, usePrivy } from '@privy-io/react-auth';
import { addNotificationToStream, getUserProfile, subscribeToChatMessages } from '@/lib/supabase-service';
import type { Notification } from '@/lib/supabase-types';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Gift as GiftIcon, MessageCircle, Share2 } from 'lucide-react';
import Link from 'next/link';
import { BASE_CHAIN_NAME, USDC_SYMBOL, sendBaseUsdcPayment } from '@/lib/base-usdc-payment';

export function PlayerWithControls({
  src,
  streamStatus,
  id,
  title,
  playbackId,
}: {
  src?: Src[];
  streamStatus?: 'idle' | 'ready' | 'starting' | 'offline';
  title: string;
  playbackId: string;
  id: string;
}) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { viewerMetrics: totalViewers } = useViewMetrics({ playbackId });
  const { authenticated, ready } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  
  // Get wallet address from Privy (Ethereum wallet)
  const walletAddress = wallets && wallets.length > 0 ? wallets[0].address : null;
  const connected = authenticated && ready && !!walletAddress;
  const { messages: chatMessages, sending: isSendingChat } = useSelector((s: RootState) => s.chat);
  const { stream, loading, error, hasAccess, setHasAccess, markPaid } = useStreamGate(playbackId);
  const [forceHlsMode, setForceHlsMode] = useState(false);

  const liveSources = useMemo(() => {
    const sourceList = src || [];
    const hlsOnly = sourceList.filter((source) => {
      const type = String((source as any)?.type || '').toLowerCase();
      const mime = String((source as any)?.mime || '').toLowerCase();
      const url = String((source as any)?.src || (source as any)?.url || '').toLowerCase();
      return type.includes('hls') || mime.includes('mpegurl') || url.includes('.m3u8');
    });

    const webrtcOnly = sourceList.filter((source) => {
      const type = String((source as any)?.type || '').toLowerCase();
      const url = String((source as any)?.src || (source as any)?.url || '').toLowerCase();
      return type.includes('webrtc') || url.includes('/webrtc/');
    });

    if (forceHlsMode) {
      return hlsOnly.length > 0 ? hlsOnly : sourceList;
    }

    // For viewer reliability prefer HLS when available.
    if (hlsOnly.length > 0) {
      return hlsOnly;
    }
    if (webrtcOnly.length > 0) {
      return webrtcOnly;
    }
    return sourceList;
  }, [forceHlsMode, src]);

  const hasPlayableSource = liveSources.length > 0;

  const handlePlaybackError = useCallback((err: any) => {
    const type = String(err?.type || '').toLowerCase();
    if (type === 'permissions') {
      return;
    }
    const message = String(err?.message || '').toLowerCase();
    if ((type === 'fallback' && message.includes('bframes')) || message.includes('bframes')) {
      setForceHlsMode(true);
      return;
    }
    if (
      type.includes('network') ||
      type.includes('offline') ||
      message.includes('fragloaderror') ||
      message.includes('manifestloaderror') ||
      message.includes('manifestloadtimeout')
    ) {
      setForceHlsMode(true);
    }
  }, []);
  
  // Get creator displayName for share link
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);
  
  // Chat state management
  const [chatInput, setChatInput] = useState('');
  const [donatingAmount, setDonatingAmount] = useState<number | null>(null);
  const [showGiftGrid, setShowGiftGrid] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isDesktopChatCollapsed, setIsDesktopChatCollapsed] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [mobileUnreadCount, setMobileUnreadCount] = useState(0);
  const previousMessageCountRef = useRef(0);
  const initializedChatCountRef = useRef(false);

  // Fetch creator displayName for share link
  useEffect(() => {
    const fetchCreatorName = async () => {
      if (!id) return;
      try {
        const profile = await getUserProfile(id);
        if (profile?.displayName) {
          setCreatorDisplayName(profile.displayName);
        }
      } catch (error) {
        console.error('Error fetching creator profile:', error);
      }
    };
    fetchCreatorName();
  }, [id]);

  // Build creator profile URL for sharing
  const creatorProfileUrl = creatorDisplayName
    ? `/creator/${encodeURIComponent(creatorDisplayName)}`
    : null;

  // Share handler
  const handleShare = useCallback(async () => {
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
  }, [creatorProfileUrl]);

  // Fetch chat messages when component mounts
  useEffect(() => {
    if (playbackId) {
      dispatch(fetchChatMessages(playbackId));
    }
  }, [playbackId, dispatch]);

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
  

  // Chat functionality
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || !connected || !walletAddress) {
      toast.error('Please connect your wallet to send messages');
      return;
    }

    const sender = walletAddress.slice(0, 5) + '...';
    const messageData = {
      message: chatInput.trim(),
      streamId: playbackId,
      walletAddress: walletAddress,
      sender,
    };

    try {
      await dispatch(sendChatMessage(messageData)).unwrap();
      setChatInput('');
      // toast.success('Message sent successfully!');
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Chat error:', error);
    }
  }, [chatInput, connected, walletAddress, playbackId, dispatch]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }, [handleSendChat]);

  const donationPresets = useMemo(() => {
    const configured = Array.isArray(stream?.donation)
      ? stream.donation.filter((amt) => Number(amt) > 0)
      : [];
    if (configured.length > 0) {
      return configured;
    }
    // Always render donation controls, even if presets are not configured yet.
    return [5, 10, 25, 50];
  }, [stream?.donation]);

  const giftPresets = useMemo(() => {
    const fallback = [5, 10, 25, 50];
    const selected = donationPresets.slice(0, 4);
    if (selected.length >= 4) return selected;
    const missing = fallback.filter((amount) => !selected.includes(amount));
    return [...selected, ...missing].slice(0, 4);
  }, [donationPresets]);

  const handleDonate = useCallback(
    async (amount: number) => {
      if (!walletAddress) {
        toast.error('Connect a wallet to send a gift.');
        return;
      }
      if (!stream?.creatorId) {
        toast.error('Creator wallet not available for gifting.');
        return;
      }

      setDonatingAmount(amount);
      try {
        const txHash = await sendBaseUsdcPayment({
          sendTransaction: sendTransaction as any,
          payerAddress: walletAddress,
          recipientAddress: stream.creatorId,
          amountUsd: amount,
        });

        const notification: Notification = {
          type: 'donation',
          title: 'New Stream Gift',
          message: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} gifted $${amount.toFixed(2)} ${USDC_SYMBOL} on ${BASE_CHAIN_NAME}`,
          walletAddress,
          txHash,
          amount,
          createdAt: new Date().toISOString(),
          read: false,
        };

        try {
          await addNotificationToStream(playbackId, notification);
        } catch (error) {
          console.error('Failed to save stream gift notification:', error);
        }

        toast.success(`Gifted $${amount.toFixed(2)} ${USDC_SYMBOL}.`);
      } catch (error: any) {
        toast.error(error?.message || 'Gift failed. Please try again.');
      } finally {
        setDonatingAmount(null);
      }
    },
    [playbackId, sendTransaction, stream?.creatorId, walletAddress],
  );

  // const fetchProducts = useCallback(async () => {
  //   if (!id) return;
  //   setProductsLoading(true);
  //   setProductsError(null);
  //   try {
  //     const { data } = await axios.get(`https://chaintv.onrender.com/api/${id}/products`);
  //     setProducts(data.product || []);
  //   } catch (e) {
  //     setProductsError('Failed to load products.');
  //     toast.error('Failed to load products.');
  //     console.log(e);
  //   } finally {
  //     setProductsLoading(false);
  //   }
  // }, [id]);

  // useEffect(() => {
  //   fetchProducts();
  // }, [fetchProducts]);

  // 1. Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center flex-col h-screen">
        <Bars width={40} height={40} color="#facc15" />
        <p>Loading stream…</p>
      </div>
    );
  }

  // 2. Error state
  if (error) {
    return <div className="text-center text-red-500 mt-10">{error}</div>;
  }

  return (
    <div className="relative h-full min-h-[480px] md:min-h-[560px] w-full overflow-hidden bg-[#07080b] p-2 md:p-4">
      <div className="pointer-events-none absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-yellow-400/20 blur-3xl" />

      <div className="w-full flex flex-col md:flex-row md:h-full min-h-0 gap-3 md:gap-4 overflow-hidden">
        {/* Main Player Section */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 rounded-xl md:h-full border border-white/15 bg-gradient-to-br from-[#0f1218] via-[#0c0f14] to-[#07080b] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-white/10 bg-black/35 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-200">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
              <div className="text-white">
                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Broadcast</p>
                <p className="text-sm md:text-base font-semibold text-white line-clamp-1">{title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 19 19"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white"
                >
                  <path
                    d="M1.13465 18.3333C0.874752 18.3333 0.662336 18.1219 0.680419 17.8626C0.921899 14.4003 3.80706 11.6666 7.33073 11.6666C10.9732 11.6666 13.9334 14.5877 13.9964 18.2152C13.9975 18.2801 13.9447 18.3333 13.8797 18.3333H1.13465ZM7.33073 10.8333C4.56823 10.8333 2.33073 8.59575 2.33073 5.83325C2.33073 3.07075 4.56823 0.833252 7.33073 0.833252C10.0932 0.833252 12.3307 3.07075 12.3307 5.83325C12.3307 8.59575 10.0932 10.8333 7.33073 10.8333ZM13.7277 12.9922C13.6526 12.9024 13.7358 12.7685 13.8472 12.8046C16.0719 13.5275 17.7493 15.4644 18.0974 17.8336C18.1369 18.1027 17.9199 18.3333 17.6478 18.3333H15.7817C15.7167 18.3333 15.6641 18.2804 15.6632 18.2155C15.6357 16.229 14.9131 14.4105 13.7277 12.9922ZM12.0353 10.8229C11.9351 10.8159 11.8957 10.6928 11.968 10.6229C13.2194 9.41095 13.9974 7.71297 13.9974 5.83325C13.9974 4.74321 13.7358 3.71428 13.2719 2.80581C13.2263 2.71635 13.3033 2.61265 13.4004 2.63835C15.1837 3.11026 16.4974 4.73431 16.4974 6.66659C16.4974 8.96867 14.6328 10.8333 12.3307 10.8333C12.2314 10.8333 12.1329 10.8298 12.0353 10.8229Z"
                    fill="currentColor"
                  />
                </svg>
                <span className="text-xs font-semibold text-white">
                  {totalViewers?.viewCount || 0} {totalViewers?.viewCount === 1 ? 'viewer' : 'viewers'}
                </span>
              </div>

              {creatorProfileUrl && (
                <Link href={creatorProfileUrl} target="_blank" rel="noopener noreferrer">
                  <button className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 hover:bg-cyan-300/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors">
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Share Creator</span>
                    <span className="sm:hidden">Share</span>
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Player Container */}
          <div className="relative bg-black overflow-hidden aspect-video md:aspect-auto md:flex-1 md:min-h-0">
            {!hasPlayableSource ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 text-center backdrop-blur-lg">
                <OfflineErrorIcon className="hidden h-[120px] w-full sm:flex" />
                <div className="flex flex-col gap-1">
                  <div className="text-2xl font-bold text-white">
                    {streamStatus === 'offline' ? 'Stream is offline' : 'Starting stream...'}
                  </div>
                  <div className="text-sm text-gray-200">
                    {streamStatus === 'offline'
                      ? 'Playback will start automatically once the creator goes live.'
                      : 'Connecting to live playback. This can take a few seconds after broadcast starts.'}
                  </div>
                </div>
              </div>
            ) : (
              <Player.Root
                autoPlay
                clipLength={30}
                src={liveSources}
                lowLatency={false}
                timeout={15000}
                onError={handlePlaybackError}
              >
                <Player.Container className="relative h-full w-full overflow-hidden bg-gray-950">
                  <Player.Video title="Live stream" className="h-full w-full object-cover" />
                  {/* Loading Indicator */}
                  <Player.LoadingIndicator className="absolute inset-0 bg-black/50 backdrop-blur data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0">
                    <div className="flex h-full w-full items-center justify-center">
                      <LoadingIcon className="h-8 w-8 animate-spin text-white" />
                    </div>
                  </Player.LoadingIndicator>
                  {/* Generic Error Indicator */}
                  <Player.ErrorIndicator
                    matcher="all"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-center backdrop-blur-lg data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
                  >
                    <div className="flex items-center justify-center">
                      <LoadingIcon className="h-8 w-8 animate-spin text-white" />
                    </div>
                    <p className="text-white">Starting...</p>
                  </Player.ErrorIndicator>
                  {/* Offline Indicator */}
                  <Player.ErrorIndicator
                    matcher="offline"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-center backdrop-blur-lg data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
                  >
                    <OfflineErrorIcon className="hidden h-[120px] w-full sm:flex" />
                    <div className="flex flex-col gap-1">
                      <div className="text-2xl font-bold text-white">Stream is offline</div>
                      <div className="text-sm text-gray-100">
                        Playback will start automatically once the stream has started
                      </div>
                    </div>
                  </Player.ErrorIndicator>
                  {/* Access Control / Private Stream Indicator */}
                  <Player.ErrorIndicator
                    matcher="access-control"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-center backdrop-blur-lg data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
                  >
                    <PrivateErrorIcon className="hidden h-[120px] w-full sm:flex" />
                    <div className="flex flex-col gap-1">
                      <div className="text-2xl font-bold text-white">Stream is private</div>
                      <div className="text-sm text-gray-100">
                        It looks like you don&apos;t have permission to view this content
                      </div>
                    </div>
                  </Player.ErrorIndicator>
                  {/* Player Controls */}
                  <Player.Controls
                    autoHide={1000}
                    className="bg-gradient-to-b gap-1 px-3 md:px-3 py-2 flex-col-reverse flex from-black/0 via-65% via-black/35 duration-1000 to-black/85 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
                  >
                    <div className="flex justify-between gap-4">
                      <div className="flex flex-1 items-center gap-3">
                        <Player.PlayPauseTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0 drop-shadow-[0_0_10px_rgba(250,204,21,0.35)]">
                          <Player.PlayingIndicator asChild matcher={false}>
                            <PlayIcon className="w-full h-full" />
                          </Player.PlayingIndicator>
                          <Player.PlayingIndicator asChild>
                            <PauseIcon className="w-full h-full text-white" />
                          </Player.PlayingIndicator>
                        </Player.PlayPauseTrigger>
                        <Player.LiveIndicator className="gap-2 flex items-center">
                          <div className="bg-red-600 h-1.5 w-1.5 rounded-full" />
                          <span className="text-sm text-white select-none">LIVE</span>
                        </Player.LiveIndicator>
                        <Player.LiveIndicator matcher={false} className="flex gap-2 items-center">
                          <Player.Time className="text-sm tabular-nums select-none text-white" />
                        </Player.LiveIndicator>
                        <Player.MuteTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0">
                          <Player.VolumeIndicator asChild matcher={false}>
                            <MuteIcon className="w-full text-white h-full" />
                          </Player.VolumeIndicator>
                          <Player.VolumeIndicator asChild matcher={true}>
                            <UnmuteIcon className="w-full text-white h-full" />
                          </Player.VolumeIndicator>
                        </Player.MuteTrigger>
                        <Player.Volume className="relative mr-1 flex-1 group flex cursor-pointer items-center select-none touch-none max-w-[120px] h-5">
                          <Player.Track className="bg-white/20 relative grow rounded-full transition-all h-[2px] md:h-[3px] group-hover:h-[3px] group-hover:md:h-[4px]">
                            <Player.Range className="absolute bg-gradient-to-r from-yellow-400 to-teal-400 rounded-full h-full" />
                          </Player.Track>
                          <Player.Thumb className="block transition-all group-hover:scale-110 w-3 h-3 bg-white rounded-full shadow-[0_0_12px_rgba(250,204,21,0.45)]" />
                        </Player.Volume>
                      </div>
                      <div className="flex sm:flex-1 md:flex-[1.5] justify-end items-center gap-2.5">
                        <Player.FullscreenIndicator matcher={false} asChild>
                          <Settings className="w-6 h-6 transition-all text-white flex-shrink-0" />
                        </Player.FullscreenIndicator>
                        <Clip className="flex items-center text-white w-6 h-6 justify-center" />
                        <Player.PictureInPictureTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0">
                          <PictureInPictureIcon className="w-full h-full text-white" />
                        </Player.PictureInPictureTrigger>
                        <Player.FullscreenTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0">
                          <Player.FullscreenIndicator asChild>
                            <ExitFullscreenIcon className="w-full h-full text-white" />
                          </Player.FullscreenIndicator>
                          <Player.FullscreenIndicator matcher={false} asChild>
                            <EnterFullscreenIcon className="w-full h-full text-white" />
                          </Player.FullscreenIndicator>
                        </Player.FullscreenTrigger>
                      </div>
                    </div>
                    <Player.Seek className="relative group flex cursor-pointer items-center select-none touch-none w-full h-5">
                      <Player.Track className="bg-white/20 relative grow rounded-full transition-all h-[2px] md:h-[3px] group-hover:h-[3px] group-hover:md:h-[4px]">
                        <Player.SeekBuffer className="absolute bg-black/30 transition-all duration-1000 rounded-full h-full" />
                        <Player.Range className="absolute bg-gradient-to-r from-yellow-400 to-teal-400 rounded-full h-full" />
                      </Player.Track>
                      <Player.Thumb className="block group-hover:scale-110 w-3 h-3 bg-white transition-all rounded-full shadow-[0_0_12px_rgba(45,212,191,0.55)]" />
                    </Player.Seek>
                  </Player.Controls>
                </Player.Container>
              </Player.Root>
            )}
          </div>

          {/* Donation Rail Below Broadcast */}
          <div className="sticky bottom-0 z-10 md:static shrink-0 border-t border-white/10 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-teal-500/10 px-3 md:px-4 py-3 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),0.75rem)] md:pb-3">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.14em] text-yellow-100/80">Show some love</p>
                <p className="text-[10px] text-gray-400">{USDC_SYMBOL} on {BASE_CHAIN_NAME}</p>
              </div>
              <div className="relative overflow-hidden rounded-xl w-fit">
                <div
                  className={`transition-all duration-300 ease-out ${
                    showGiftGrid
                      ? 'pointer-events-none max-h-0 -translate-y-2 scale-[0.98] opacity-0'
                      : 'max-h-16 translate-y-0 scale-100 opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    disabled={!connected}
                    onClick={() => setShowGiftGrid(true)}
                    className="group inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-yellow-300/30 bg-gradient-to-r from-yellow-500/85 to-teal-500/85 px-4 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(250,204,21,0.22)] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GiftIcon className="h-4 w-4 transition-transform duration-200 group-hover:rotate-6" />
                    Gift
                  </button>
                </div>

                <div
                  className={`origin-top transition-all duration-300 ease-out ${
                    showGiftGrid
                      ? 'max-h-52 translate-y-0 scale-100 opacity-100'
                      : 'pointer-events-none max-h-0 -translate-y-2 scale-[0.96] opacity-0'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setShowGiftGrid(false)}
                      className="rounded-full border border-white/20 bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-200 transition-colors hover:bg-black/55"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {giftPresets.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        disabled={!connected || donatingAmount === amount}
                        onClick={() => handleDonate(amount)}
                        className="h-14 w-14 rounded-lg border border-yellow-300/25 bg-black/45 text-xs font-semibold text-yellow-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform duration-200 hover:scale-[1.01] hover:bg-black/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {donatingAmount === amount ? '...' : `$${amount}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Stack: Donations + Chat */}
        <div
          className={`w-full border border-white/15 bg-gradient-to-b from-[#10141c] via-[#0c1016] to-[#090b10] backdrop-blur-sm flex flex-col rounded-xl overflow-hidden md:h-full md:max-h-full transition-[max-height,width] duration-300 ${
            isMobileChatOpen ? 'max-h-[68vh]' : 'max-h-[64px]'
          } ${isDesktopChatCollapsed ? 'md:w-14 lg:w-16' : 'md:w-64 lg:w-72'} md:max-h-none`}
        >
          <button
            type="button"
            onClick={() => setIsMobileChatOpen((prev) => !prev)}
            className="md:hidden flex h-16 w-full items-center justify-between border-b border-white/10 bg-black/30 px-4 text-left"
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
            className={`hidden md:flex items-center border-b border-white/10 bg-black/25 ${
              isDesktopChatCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-3.5'
            }`}
          >
            {!isDesktopChatCollapsed && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Community Desk</p>
                <h3 className="font-semibold tracking-wide text-white text-sm md:text-base">Live Chat + Donations</h3>
                {!connected && (
                  <p className="text-xs text-amber-300/90 mt-1">Connect wallet for chat and tips.</p>
                )}
              </div>
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
            {isDesktopChatCollapsed && (
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
            )}
          </div>

          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-[max-height,opacity] duration-300 ${
              isMobileChatOpen ? 'max-h-[58vh] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
            } ${isDesktopChatCollapsed ? 'md:hidden' : 'md:max-h-none md:opacity-100 md:pointer-events-auto'}`}
          >
            <div className="md:hidden px-3 pb-2 text-xs text-amber-200/90">
              {!connected ? 'Connect wallet for chat and tips.' : 'Chat live with the community.'}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-2.5 md:p-3 space-y-2 md:space-y-3 min-h-0">
              {chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-xs md:text-sm text-center px-4">
                  <p>No messages yet. Break the silence.</p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-2.5 md:p-3 border ${
                        msg.walletAddress?.toLowerCase() === walletAddress?.toLowerCase()
                          ? 'border-yellow-500/40 bg-yellow-500/10'
                          : msg.sender === id
                          ? 'border-teal-400/30 bg-teal-500/10'
                          : 'border-white/10 bg-white/[0.05]'
                      }`}
                    >
                      <span
                        className={`font-semibold text-xs md:text-sm ${
                          msg.walletAddress?.toLowerCase() === walletAddress?.toLowerCase()
                            ? 'text-yellow-200'
                            : msg.sender === id
                            ? 'text-teal-200'
                            : 'text-blue-200'
                        }`}
                      >
                        {msg.walletAddress?.toLowerCase() === walletAddress?.toLowerCase()
                          ? 'You'
                          : msg.sender === id
                          ? 'Streamer'
                          : `${msg.sender?.slice(0, 6)}...${msg.sender?.slice(-4)}`}
                        :
                      </span>{' '}
                      <span className="text-white/95 text-xs md:text-sm">{msg.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-2.5 md:p-3 border-t border-white/10 bg-black/35 rounded-b-xl flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex flex-col space-y-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={connected ? 'Type to join the room...' : 'Connect wallet to chat'}
                  disabled={!connected || isSendingChat}
                  className="w-full border border-white/20 rounded-lg py-2 px-3 bg-white/[0.07] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                />
                <button
                  type="submit"
                  disabled={!connected || isSendingChat || !chatInput.trim()}
                  className="bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-black font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isSendingChat ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Gate modal for paid streams - rendered on top of main content */}
      {!hasAccess && stream && stream.viewMode !== 'free' && (
        <StreamGateModal
          open={!hasAccess}
          onClose={() => router.back()}
          title="Locked Stream"
        >
          <StreamPayment
            playbackId={playbackId}
            usdAmount={stream.amount}
            recipientAddress={stream.creatorId}
            viewMode={stream.viewMode}
            onPaymentSuccess={() => {
              setHasAccess(true);
              if (walletAddress) {
                markPaid(walletAddress);
              }
            }}
          />
        </StreamGateModal>
      )}
    </div>
  );
}

/**
 * Minimal loading UI that appears before or during buffering.
 */
export const PlayerLoading = ({ children }: { children?: React.ReactNode }) => (
  <div className="relative mx-auto flex max-w-2xl flex-col-reverse gap-3 overflow-hidden rounded-sm bg-black px-3 py-2 animate-pulse">
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse rounded-lg bg-gray-800" />
        <div className="h-6 w-16 animate-pulse rounded-lg bg-gray-800 md:h-7 md:w-20" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse rounded-lg bg-gray-800" />
        <div className="h-6 w-6 animate-pulse rounded-lg bg-gray-800" />
      </div>
    </div>
    <div className="h-2 w-full animate-pulse rounded-lg bg-gray-800" />
    {children}
  </div>
);
