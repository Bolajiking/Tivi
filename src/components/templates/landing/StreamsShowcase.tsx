'use client';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { getAssets } from '@/features/assetsAPI';
import Spinner from '@/components/Spinner';
import Link from 'next/link';
import { Stream, Asset } from '@/interfaces';
import image1 from '@/assets/image1.png';
// import Logo from '@/components/Logo';

interface StreamsShowcaseProps {
  streams: Stream[];
  loading: boolean;
}

export default function StreamsShowcase({ streams, loading }: StreamsShowcaseProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { assets, loading: assetsLoading } = useSelector((state: RootState) => state.assets);
  const [activeTab, setActiveTab] = useState<'streams' | 'videos'>('streams');

  // Filter out streams without creatorId
  const filteredStreams = streams.filter(stream => stream.creatorId && stream.creatorId.value);

  useEffect(() => {
   console.log(filteredStreams);
  }, [filteredStreams]);
  
  useEffect(() => {
    // Load assets for the videos tab
    dispatch(getAssets());
  }, [dispatch]);

  return (
    <section id="streams-showcase" className="py-16 px-4 max-w-7xl mx-auto mt-16 relative">
      
      <h2 className="text-3xl font-bold text-white mb-8 text-center">Available Content</h2>
      
      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20 flex">
          <button
            onClick={() => setActiveTab('streams')}
            className={`flex-1 px-6 py-2 rounded-md transition-all duration-200 ${
              activeTab === 'streams'
                ? 'bg-white text-gray-900 font-semibold'
                : 'text-white hover:bg-white/10'
            }`}
          >
            Livestreams
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 px-6 py-2 rounded-md transition-all duration-200 ${
              activeTab === 'videos'
                ? 'bg-white text-gray-900 font-semibold'
                : 'text-white hover:bg-white/10'
            }`}
          >
            Videos
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'streams' ? (
        // Streams Tab
        loading ? (
          <div className="flex justify-center items-center h-32">
            <Spinner />
          </div>
        ) : filteredStreams && filteredStreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filteredStreams.map((stream) => (
              <Link 
                key={stream.id} 
                href={`/view/${stream.playbackId}?streamName=${encodeURIComponent(stream.name)}&id=${encodeURIComponent(stream.creatorId?.value || '')}`} 
                className="block bg-white/10 rounded-lg overflow-hidden shadow-lg hover:scale-105 transition-transform"
              >
                <div className="h-40 bg-gray-800 flex items-center justify-center relative">
                  {stream.logo ? (
                    <img src={stream.logo} alt={stream.name} className="object-cover w-full h-full" />
                  ) : (
                    <img src={image1.src} alt={stream.name} className="object-cover w-full h-full" />
                  )}
                  {stream.isActive && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-1 truncate">{stream.name}</h3>
                  {stream.creatorId?.value && (
                    <div className="text-xs text-yellow-300">by {stream.creatorId.value.slice(0, 5) + '...' + stream.creatorId.value.slice(-5)}</div>
                  )}
                  {/* <div className="text-xs text-purple-300">{stream.description}</div> */}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400">No streams available at the moment.</div>
        )
      ) : (
        // Videos Tab
        assetsLoading ? (
          <div className="flex justify-center items-center h-32">
            <Spinner />
          </div>
        ) : assets && assets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {assets.map((asset) => (
              <Link 
                key={asset.id} 
                href={`/player/${asset.playbackId}?id=${encodeURIComponent(asset.id)}`} 
                className="block bg-white/10 rounded-lg overflow-hidden shadow-lg md:w-[20vw]  m-5 hover:scale-105 transition-transform"
              >
                <div className="h-40 bg-gray-200 flex items-center justify-center relative">
                  {asset.downloadUrl ? (
                    // <img src={asset.downloadUrl} alt={asset.name} className="object-cover w-full h-full" />
                    <span className="text-gray-800 text-center text-2xl font-bold">Video</span>
                  ) : (
                    <span className="text-gray-800 text-center text-2xl font-bold">Video</span>
                    // <img src={image1.src} alt={asset.name} className="object-cover w-full h-full" />
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {asset.videoSpec?.duration ? 
                      `${Math.floor(asset.videoSpec.duration / 60)}:${(asset.videoSpec.duration % 60).toString().padStart(2, '0')}` : 
                      '00:00'
                    }
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-1 truncate">{asset.name}</h3>
                  {asset.creatorId?.value && (
                    <div className="text-xs text-yellow-300">by {asset.creatorId.value.slice(0, 5) + '...' + asset.creatorId.value.slice(-5)}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400">No videos available at the moment.</div>
        )
      )}
    </section>
  );
} 