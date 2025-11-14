'use client';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import * as Player from '@livepeer/react/player';
import axios from 'axios';
import { Bars, ColorRing } from 'react-loader-spinner';
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
import { StreamVideoCard } from '@/components/Card/Card';
import image1 from '@/assets/image1.png';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { getAssets } from '@/features/assetsAPI';
import { sendChatMessage, fetchChatMessages, fetchRecentMessages } from '@/features/chatAPI';
import { useViewMetrics } from '@/app/hook/useViewerMetrics';
import { useStreamGate } from '@/app/hook/useStreamGate';
// Types
import type { Src } from '@livepeer/react';
import type { StaticImageData } from 'next/image';
import Image from 'next/image';
import { Gift, Smile } from 'lucide-react';
import { StreamGateModal } from './StreamGateModal';
import { StreamPayment } from './StreamPayment';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

import { useRouter } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
// import { useConnection } from '@solana/wallet-adapter-react';
import {   PublicKey, Transaction, SystemProgram} from '@solana/web3.js';
// import { PublicKey } from '@solana/web3.js';

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

interface Product {
  id: string;
  name: string;
  imageUrl?: StaticImageData;
  price: number;
}

export function PlayerWithControls({
  src,
  id,
  title,
  playbackId,
}: {
  src: Src[];
  title: string;
  playbackId: string;
  id: string;
}) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { viewerMetrics: totalViewers } = useViewMetrics({ playbackId });
  const { publicKey, sendTransaction, connected, wallet , wallets } = useWallet();
  const { connection } = useConnection();
  const [message, setMessage] = useState<string | null>(null);
  const { assets, error: assetsError } = useSelector((s: RootState) => s.assets);
  const { messages: chatMessages, loading: chatLoading, sending: isSendingChat, error: chatError } = useSelector((s: RootState) => s.chat);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const { stream, loading, error, hasAccess, setHasAccess, markPaid, processPayment, processingPayment, walletReady } = useStreamGate(playbackId);
  const filteredAssets = useMemo(() => assets.filter((a) => !!a.playbackId && a.creatorId?.value === id), [assets, id]);
  const host = process.env.NEXT_PUBLIC_BASE_URL;
  const playbackUrl =
    host && playbackId
      ? `${host.includes('localhost') ? 'http' : 'https'}://${host}/view/${playbackId}?streamName=${encodeURIComponent(
          title,
        )}`
      : null;

  // Chat state management
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);


  // console.log("these are the wallets",wallet) 
  const handleCopyLink = useCallback(async () => {
    if (!playbackUrl) return toast.error('No playback URL available');
    try {
      await navigator.clipboard.writeText(playbackUrl);
      toast.success('Stream link copied!');
    } catch {
      toast.error('Failed to copy link.');
    }
  }, [playbackUrl]);

  useEffect(() => {
    dispatch(getAssets());
  }, [dispatch]);

  // Fetch chat messages when component mounts
  useEffect(() => {
    if (playbackId) {
      dispatch(fetchChatMessages(playbackId));
    }
  }, [playbackId, dispatch]);

  useEffect(() => {
    if (!playbackId) return;
    const interval = setInterval(() => {
      dispatch(fetchChatMessages(playbackId));
    }, 5000); // fetch every 3 seconds

    return () => clearInterval(interval);
  }, [dispatch, playbackId]);

  useEffect(() => {
    if (assetsError) {
      toast.error('Failed to fetch assets: ' + assetsError);
    }
  }, [assetsError]);


  // useEffect(() => {
  //   if (chatEndRef.current) {
  //     chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  //   }
  // }, [chatMessages]);
  
  const handleSend = async (amount: number) => {
    setMessage(null);
    if (!publicKey) {
      setMessage('Error: Wallet not connected');
      return;
    }
  
    try {
      console.log("Trying to send transaction");
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(id),
          lamports: amount * 1e9, // Convert SOL to lamports
        })
      );
      const signature = await sendTransaction(transaction, connection);
      console.log("Transaction sent successfully, signature:", signature);
      setMessage(`https://solscan.io/tx/${signature}`);
    } catch (error: any) {
      setMessage(`Error: ${error?.message || error}`);
    } finally {
      // setLoading(false);
    }
  };

  // Chat functionality
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || !connected || !publicKey) {
      toast.error('Please connect your wallet to send messages');
      return;
    }

    const sender = publicKey.toString().slice(0, 5) + '...';
    const messageData = {
      message: chatInput.trim(),
      streamId: playbackId,
      walletAddress: publicKey.toString(),
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
  }, [chatInput, connected, publicKey, playbackId, dispatch]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }, [handleSendChat]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: stream?.bgcolor,
        color: stream?.color,
        fontSize: `${stream?.fontSize}px`,
      }}
    >
      <div className="container mx-auto px-4 py-6">
        {/* Title Header */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between">
          <div className="flex-1 text-center text-xl font-semibold capitalize">{stream?.title ?? title}</div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1 mt-6 pb-6">
          {/* Left Pane: Creator Videos List */}
          <div className="block lg:col-span-3">
            <div className="border rounded-lg h-full p-4">
              <h3 className="font-semibold text-lg mb-4">Creator Videos</h3>
              <ul className="space-y-3 overflow-y-auto max-h-[80vh]">
                {filteredAssets.map((video) => (
                  <StreamVideoCard
                    key={video.id}
                    title={video.name}
                    playbackId={playbackId}
                    assetData={video}
                    createdAt={new Date(video.createdAt)}
                    imageUrl={image1}
                    creatorId={id}
                  />
                ))}
              </ul>
            </div>
          </div>
          {/* Player Section */}
          <div className="col-span-12 lg:col-span-6 flex flex-col">
            <Player.Root autoPlay clipLength={30} src={src}>
              <Player.Container className="relative h-full w-full overflow-hidden rounded-md bg-gray-950 outline outline-1 outline-white/50 data-[playing=true]:outline-white/80 data-[playing=true]:outline-2 data-[fullscreen=true]:outline-none data-[fullscreen=true]:rounded-none transition-all">
                <Player.Video title="Live stream" className="max-sm:h-full md:h-[590px] w-full object-cover" />
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
                  className="bg-gradient-to-b gap-1 px-3 md:px-3 py-2 flex-col-reverse flex from-black/20 via-80% via-black/30 duration-1000 to-black/60 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
                >
                  <div className="flex justify-between gap-4">
                    <div className="flex flex-1 items-center gap-3">
                      <Player.PlayPauseTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0">
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
                        <Player.Track className="bg-white/30 relative grow rounded-full transition-all h-[2px] md:h-[3px] group-hover:h-[3px] group-hover:md:h-[4px]">
                          <Player.Range className="absolute bg-white rounded-full h-full" />
                        </Player.Track>
                        <Player.Thumb className="block transition-all group-hover:scale-110 w-3 h-3 bg-white rounded-full" />
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
                    <Player.Track className="bg-white/30 relative grow rounded-full transition-all h-[2px] md:h-[3px] group-hover:h-[3px] group-hover:md:h-[4px]">
                      <Player.SeekBuffer className="absolute bg-black/30 transition-all duration-1000 rounded-full h-full" />
                      <Player.Range className="absolute bg-white rounded-full h-full" />
                    </Player.Track>
                    <Player.Thumb className="block group-hover:scale-110 w-3 h-3 bg-white transition-all rounded-full" />
                  </Player.Seek>
                </Player.Controls>
              </Player.Container>
            </Player.Root>

            {/* Title and Viewer Count */}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-2xl font-semibold capitalize text-black">{stream?.title ?? title}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 19 19"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                >
                  <path
                    d="M1.13465 18.3333C0.874752 18.3333 0.662336 18.1219 0.680419 17.8626C0.921899 14.4003 3.80706 11.6666 7.33073 11.6666C10.9732 11.6666 13.9334 14.5877 13.9964 18.2152C13.9975 18.2801 13.9447 18.3333 13.8797 18.3333H1.13465ZM7.33073 10.8333C4.56823 10.8333 2.33073 8.59575 2.33073 5.83325C2.33073 3.07075 4.56823 0.833252 7.33073 0.833252C10.0932 0.833252 12.3307 3.07075 12.3307 5.83325C12.3307 8.59575 10.0932 10.8333 7.33073 10.8333ZM13.7277 12.9922C13.6526 12.9024 13.7358 12.7685 13.8472 12.8046C16.0719 13.5275 17.7493 15.4644 18.0974 17.8336C18.1369 18.1027 17.9199 18.3333 17.6478 18.3333H15.7817C15.7167 18.3333 15.6641 18.2804 15.6632 18.2155C15.6357 16.229 14.9131 14.4105 13.7277 12.9922ZM12.0353 10.8229C11.9351 10.8159 11.8957 10.6928 11.968 10.6229C13.2194 9.41095 13.9974 7.71297 13.9974 5.83325C13.9974 4.74321 13.7358 3.71428 13.2719 2.80581C13.2263 2.71635 13.3033 2.61265 13.4004 2.63835C15.1837 3.11026 16.4974 4.73431 16.4974 6.66659C16.4974 8.96867 14.6328 10.8333 12.3307 10.8333C12.2314 10.8333 12.1329 10.8298 12.0353 10.8229Z"
                    fill="black"
                  />
                </svg>
                <span className="text-black">
                  {totalViewers?.viewCount} {totalViewers?.viewCount === 0 ? 'viewer' : 'viewers'}
                </span>
              </div>
            </div>

            {/* Stream Description */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex  sm:flex-row items-center justify-center sm:items-start sm:space-x-4 mt-4 sm:mt-0">
                <h1 className="  mb-2 sm:mb-0">Donate</h1>{' '}
                <div className="flex space-x-4">
                  {stream?.donation?.map((amt, i) => {
                    const colors = ['bg-green-500', 'bg-blue-500', 'bg-teal-500', 'bg-yellow-500'];
                    return (
                      <button
                        key={i}
                        className={`${colors[i] || 'bg-main-blue'} text-white px-4 py-2 rounded-md hover:opacity-90 transition-transform transform hover:scale-110 animate-bounce`}
                        style={{ animationDelay: `${i * 0.2}s` }}
                        onClick={() => handleSend(amt)}
                      >
                        ${amt}
                      </button>
                    );
                  })}
                 
                </div>
              </div>
              <div>
                <p className="text-sm text-[#53525F] capitalize">
                  {`Join ${title}  `}
                  <span
                    onClick={handleCopyLink}
                    className="cursor-pointer text-main-blue hover:text-blue-800 underline"
                  >
                    Link
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-[#53525F]">
                {stream?.description || `Welcome to ${title} stream! Enjoy the show.`}
              </p>
            </div>

            {/* New: Product Grid Section */}
            {/* <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Products</h3>
              {productsLoading ? (
                <div className="text-center">
                  {' '}
                  <ColorRing
                    visible={true}
                    height="100"
                    width="50"
                    ariaLabel="color-ring-loading"
                    wrapperStyle={{}}
                    wrapperClass="color-ring-wrapper"
                    colors={['#000000', '#000000', '#000000', '#000000', '#000000']}
                  />
                </div>
              ) : productsError ? (
                <div className="text-center text-red-500">{productsError}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 overflow-x-scroll">
                  {products.map((product: Product) => (
                    <div key={product.name} className="border rounded-lg p-4 flex flex-col ites-center">
                      <Image
                        width={200}
                        height={200}
                        src={
                          typeof product.imageUrl === 'string' ? product.imageUrl : product.imageUrl?.src || image1.src
                        }
                        alt={product.name}
                        className="w-full h-32 object-cover rounded"
                      />
                      <h4 className="mt-2 text-sm capitalize font-medium">{product.name}</h4>
                      <p className="text-sm text-gray-600">${product.price}</p>
                      <button
                        className="mt-2 text-sm bg-main-blue text-white capitalize px-4 py-1 rounded-md hover:bg-blue-800 transition-transform transform hover:scale-110"
                        onClick={() => alert(`You clicked on ${product.name}`)}
                      >
                        Buy Now
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div> */}
             { message && (
                <div className="mt-3">
                  {message.startsWith('Error:') ? (
                    <p className="text-red-500 block">{message}</p>
                  ) : message.startsWith('https://') ? (
                    <p className="text-green-600 block">
                      ✅ Transaction successful!{' '}
                      <a href={message} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                        View Transaction
                      </a>
                    </p>
                  ) : (
                    <p className="text-gray-600 block">{message}</p>
                  )}
                </div>
              )}
            <div className="mt-6">
              <WalletMultiButtonDynamic />
            </div>
          </div>

          {/* Chat Section */}
          <div className="col-span-12 lg:col-span-3">
            <div className="border rounded-lg h-full flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-lg">Chat</h3>
                {!connected && (
                  <p className="text-sm text-gray-500 mt-1">Connect wallet to chat</p>
                )}
              </div>
              
              {/* Chat messages area */}
              <div className="flex-1 p-4 overflow-y-auto min-h-[300px] max-h-[500px]">
                {chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>No messages yet. Be the first to chat!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center mb-1">
                          <span className={`font-semibold text-sm ${msg.sender === id ? 'text-red-600' : 'text-blue-600'}`}>{msg.sender === id ? 'Streamer' : msg.sender}</span>
                        </div>
                        <p className="text-sm text-gray-700">{msg.message}</p>
                      </div>
                    ))}
                    {/* <div ref={chatEndRef} /> */}
                  </div>
                )}
              </div>
              
              {/* Message input */}
              <div className="border-t p-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={connected ? "Send message..." : "Connect wallet to chat"}
                      disabled={!connected || isSendingChat}
                      className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <button 
                      type="button" 
                      className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      disabled={!connected}
                    >
                      <Smile size={18} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={!connected}
                      className="flex items-center gap-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                      <Gift size={18} />
                      <span>Gift</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSendChat}
                      disabled={!connected || isSendingChat || !chatInput.trim()}
                      className="bg-blue-600 text-white px-4 py-1 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isSendingChat ? 'Sending...' : 'Chat'}
                    </button>
                  </div>
                </div>
              </div>
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
            onPaymentSuccess={() => {
              setHasAccess(true);
              if (publicKey) {
                markPaid(publicKey.toBase58());
              }
            }}
            processPayment={processPayment}
            processingPayment={processingPayment}
            walletReady={walletReady}
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
  <div className="relative mx-auto flex max-w-2xl flex-col-reverse gap-3 overflow-hidden rounded-sm bg-white/70 px-3 py-2 animate-pulse">
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse rounded-lg bg-white/5" />
        <div className="h-6 w-16 animate-pulse rounded-lg bg-white/5 md:h-7 md:w-20" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse rounded-lg bg-white/5" />
        <div className="h-6 w-6 animate-pulse rounded-lg bg-white/5" />
      </div>
    </div>
    <div className="h-2 w-full animate-pulse rounded-lg bg-white/5" />
    {children}
  </div>
);
