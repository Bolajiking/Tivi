'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { getAssets } from '@/features/assetsAPI';
import { RootState, AppDispatch } from '@/store/store';
import image1 from '@/assets/image1.png';
import { StreamVideoCard, VideoStreamCard } from '@/components/Card/Card'; // Your video list item component
import type { Asset, Stream } from '@/interfaces';
import { VideoPlayer } from '@/components/templates/dashboard/VideoPlayer';
import { usePrivy } from '@privy-io/react-auth';
import { Bars, ColorRing } from 'react-loader-spinner';
import { getAllStreams, getStreamById } from '@/features/streamAPI';
import { useGetAssetGate } from '@/app/hook/useAssetGate';
import { StreamGateModal } from '@/components/templates/player/player/StreamGateModal';
// import { StreamPayment } from '@/components/templates/player/player/StreamPayment';
import Image from 'next/image';

const PlayerPage = () => {
  const { user } = usePrivy();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const streamId = searchParams.get('id');
  const dispatch = useDispatch<AppDispatch>();
  const playbackId = params?.playbackId as string;
  const { assets, error } = useSelector((state: RootState) => state.assets);
  const { streams } = useSelector((state: RootState) => state.streams);
  const solanaWalletAddress = useSelector((state: RootState) => state.user.solanaWalletAddress);
  const {
    video: details,
    loading: detailsLoading,
    error: detailsError,
    hasAccess,
    setHasAccess,
    markPaid,
  } = useGetAssetGate(playbackId);
  // console.log(details, detailsLoading, detailsError, hasAccess, setHasAccess, markPaid);
  // State for products
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Fetch assets for video details
  useEffect(() => {
    // console.log("user",user)
    dispatch(getAssets());
    dispatch(getAllStreams());
  }, [dispatch]);

  useEffect(() => {
    if (streamId) {
      dispatch(getStreamById(streamId));
    }
  }, [streamId, dispatch]);
  // console.log('streamj', stream);
  console.log("user",user)
  useEffect(() => {
    if (error) {
      toast.error('Failed to fetch assets: ' + error);
    }
  }, [error]);

  const creatorId = user?.wallet?.chainType === 'solana' && user?.wallet?.address
    ? user.wallet.address
    : solanaWalletAddress;
  // Find the main asset (video) that matches the playbackId from the URL
  const mainAsset = useMemo(() => assets.find((asset) => asset.playbackId === playbackId), [assets, playbackId]);

  const filteredAssets = useMemo(() => {
    if (!mainAsset) return [];
    return assets.filter((asset: Asset) => !!asset.playbackId && asset.creatorId?.value === mainAsset.creatorId?.value);
  }, [assets, mainAsset]);

  const filteredStreams = useMemo(() => {
    return streams.filter((stream: Stream) => !!stream.playbackId && stream.creatorId?.value === creatorId);
  }, [streams, creatorId]);

  // When a video in the list is clicked, navigate to that video.
  const handleSelectVideo = (pbId: string) => {
    router.push(`/player/${pbId}`);
  };

  // Fetch products based on the creator's ID (from the main asset)
  // useEffect(() => {
  //   if (mainAsset && mainAsset.creatorId?.value) {
  //     setProductsLoading(true);
  //     fetch(`https://chaintv.onrender.com/api/${mainAsset.creatorId.value}/products`)
  //       .then((res) => {
  //         console.log(res);
  //         return res.json();
  //       })
  //       .then((data) => {
  //         setProducts(data.product || []);
  //       })
  //       .catch((err) => {
  //         setProductsError('Failed to load products. Please try again.');
  //         toast.error('Failed to load products. Please try again.');
  //       })
  //       .finally(() => {
  //         setProductsLoading(false);
  //       });
  //   }
  // }, [mainAsset]);

  // 1. While fetching video details, show loader
  if (detailsLoading) {
    return (
      <div className="flex items-center justify-center flex-col h-screen">
        <Bars width={40} height={40} color="#facc15" />
        <p>Loading Video…</p>
      </div>
    );
  }

  // 2. If there was an error fetching details
  if (detailsError) {
    return <div className="text-center text-red-500 mt-10">{detailsError}</div>;
  }

  // 3. If stream is gated, show gate modal (only after load complete)
  // if (!hasAccess && details?.viewMode !== 'free') {
  //   return (
  //     <StreamGateModal
  //       open={true}
  //       onClose={() => router.back()}
  //       title="Locked Video"
  //       description={`This video requires payment to view.`}
  //     >
  //       <StreamPayment
  //         stream={details as any}
  //         onPaid={(addr) => {
  //           setHasAccess(true);
  //           markPaid(addr);
  //         }}
  //       />
  //     </StreamGateModal>
  //   );
  // }

  // 4. Otherwise render the full player page
  return (
    <div className="min-h-screen w-full bg-white">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Pane: Video List */}
          <aside className="lg:col-span-3">
            <div className="border rounded-lg p-4">
              <ul className="space-y-3 max-h-[80vh] overflow-y-auto">
                {filteredStreams.map((stream) => (
                  <li key={stream.id}>
                    <h3 className="text-lg font-semibold mb-4">Available Stream</h3>
                    <VideoStreamCard
                      streamName={stream.name}
                      playbackId={stream.playbackId!}
                      status={stream.isActive}
                      creatorId={stream.creatorId?.value || ''}
                      lastSeen={new Date(stream.lastSeen)}
                      imageUrl={image1}
                    />
                  </li>
                ))}
                <h3 className="text-lg font-semibold mb-4">Creator Videos</h3>
                {filteredAssets.map((video) => (
                  <li key={video.id}>
                    <button onClick={() => handleSelectVideo(video.playbackId!)} className="w-full text-left">
                      <StreamVideoCard
                        title={video.name}
                        playbackId={video.playbackId!}
                        assetData={video}
                        createdAt={new Date(video.createdAt)}
                        imageUrl={image1}
                        creatorId={video.creatorId?.value || ''}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main Player Area */}
          <main className="col-span-12 lg:col-span-6 flex flex-col space-y-4">
            {/* Video Player Component */}
            <VideoPlayer playbackId={playbackId} />
            <h2 className="mt-4 text-xl font-semibold">{details?.assetName}</h2>

            <div className="mt-3">
              <h3 className="font-medium mb-2">Donate</h3>
              <div className="flex space-x-4">
                {details?.donation?.map((amt, i) => {
                  const colors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-yellow-500'];
                  return (
                    <button
                      key={i}
                      className={`${colors[i] || 'bg-main-blue'} text-white px-4 py-2 rounded-md
                         hover:opacity-90 transition-transform transform hover:scale-110 animate-bounce`}
                      style={{ animationDelay: `${i * 0.2}s` }}
                      onClick={() => alert(`You donated $${amt}!`)}
                    >
                      ${amt}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Product Section */}
            {/* <div className="p-4 border rounded-md">
              <h3 className="text-lg font-semibold mb-2">Products</h3>
              {productsLoading ? (
                <p>Loading products...</p>
              ) : productsError ? (
                <p className="text-red-500">{productsError}</p>
              ) : products.length === 0 ? (
                <p>No products available.</p>
              ) : (
                <div className="flex space-x-4 overflow-x-auto">
                  {products.map((product: any) => (
                    <div key={product.id} className="min-w-[200px] border rounded-lg p-4 flex flex-col items-center">
                      <Image
                        src={typeof product.imageUrl === 'string' ? product.imageUrl : image1.src}
                        alt={product.name}
                        className="w-full h-32 object-cover rounded"
                      />
                      <h4 className="mt-2 text-sm font-medium">{product.name}</h4>
                      <p className="text-sm text-gray-600">${product.price}</p>
                      <button
                        className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
                        onClick={() => alert(`You clicked on ${product.name}`)}
                      >
                        Buy Now
                      </button>
                    </div>  
                  ))}
                </div>
              )}
            </div> */}
          </main>

          {/* Right Pane: Comments Section */}
          <div className="col-span-12 lg:col-span-3">
            <div className="border rounded-lg h-full flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-lg">Comments</h3>
              </div>
              {/* Additional comments content can be added here */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPage;
