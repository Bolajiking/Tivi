'use client';
import React, { useEffect, useState, useRef } from 'react';
import { BiSolidDownArrow, BiSolidUpArrow } from 'react-icons/bi';
import { AnalyticCardProps, ChannelCardProps, VideoCardProps } from '@/interfaces';
import { AssetPopup, Popup } from '../Popup';
import Image, { StaticImageData } from 'next/image';
import { FaPlay } from 'react-icons/fa';
import { VideoPlayer } from '../templates/dashboard/VideoPlayer';
import { useFetchPlaybackId, useFetchStreamPlaybackId } from '@/app/hook/usePlaybckInfo';
import { usePlaybackMetrics } from '@/app/hook/usePlaybackView';
import { Bars } from 'react-loader-spinner';
import { useViewMetrics } from '@/app/hook/useViewerMetrics';
import { FaLock } from 'react-icons/fa6';
import { useGetAssetGate } from '@/app/hook/useAssetGate';
// import Link from 'next/link';
// import { useLivepeerAnalytics } from '@/app/hook/useLivepeerAnalytics';

interface VideoStreamCardProps {
  playbackId: string;
  streamName: string;
  imageUrl: StaticImageData | string;
  creatorId: string;
  lastSeen: Date;
  status: boolean; // true means Live; false means Idle
}
// Analytic Card
export const AnalyticCard = ({ title, views, value, playtimeMins, loading }: AnalyticCardProps) => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="border border-white/20 flex flex-col justify-between bg-white/10 backdrop-blur-sm rounded-lg p-4 gap-y-5 h-full">
        <div>
          <p className="text-2xl font-bold break-words text-white">{title}</p>
        </div>
        {loading ? (
          <Bars width={25} height={25} color="#facc15" />
        ) : (
          <div>
            {views ? (
              <p className="text-4xl font-extrabold tracking-wide text-white">{views} Views</p>
            ) : (
              <p className="text-2xl font-bold tracking-wide text-white">{playtimeMins}</p>
            )}
            <p className="text-xs flex items-center gap-1">
              <span className="text-gray-300">{value}</span>
              <span>
                {(value ?? 0) < 0 ? (
                  <BiSolidDownArrow className="text-orange-400 text-xs" />
                ) : (
                  <BiSolidUpArrow className="text-green-400 text-xs" />
                )}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
// Channel Card
export const ChannelCard: React.FC<ChannelCardProps> = ({
  title,
  goLive,
  streamId,
  playbackId,
  image,
  playb,
  logo,
  lastSeen,
  status,
}) => {
  const { thumbnailUrl, loading } = useFetchStreamPlaybackId(playb);
  const { viewerMetrics: viewstream } = useViewMetrics({ playbackId: playb });
  return (
    <div className="w-full h-full flex flex-col group rounded-xl border border-white/15 bg-white/5 p-2">
      <div className="w-full bg-gray rounded-lg overflow-hidden relative">
        {loading ? (
          <div className="flex items-center w-full max-sm:h-[220px] h-[300px] lg:h-[200px] justify-center">
            <p className="text-white">Loading</p>
          </div>
        ) : (
          <Image
            src={logo || thumbnailUrl || image}
            alt={title}
            className="rounded-lg w-full max-sm:h-[220px] h-[300px] lg:h-[200px] object-cover"
            width={400}
            height={180}
          />
        )}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
          {viewstream?.viewCount} views
        </div>
        <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-md flex items-center gap-1">
          {status ? (
            <>
              <div className="bg-[#04EB2A] h-[6px] w-[6px] rounded-full" />
              <span className="text-xs text-white font-medium select-none">Live</span>
            </>
          ) : (
            <>
              <div className="bg-gray-200 h-[6px] w-[6px] rounded-full" />
              <span className="text-xs text-gray-300 font-medium select-none">Idle</span>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-2 px-1">
        <div>
          <h3 className="font-bold text-white text-lg capitalize pt-2 break-words">{title}</h3>
        </div>
        <div className="ml-auto pt-2">
          {streamId && playbackId && <Popup streamId={streamId} playbackId={playbackId} />}
        </div>
      </div>
      <div className="px-1">
        <div className="text-sm text-gray-300">Last Active {lastSeen ? lastSeen.toDateString() : ''}</div>
      </div>
      <div className="flex justify-start mt-auto px-1">
        <button
          className="mt-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 cursor-pointer text-black py-2 text-sm font-semibold px-4 rounded-md transition-all duration-200"
          onClick={goLive}
        >
          Go Live
        </button>
      </div>
    </div>
  );
};
// Asset Card
export const VideoCard: React.FC<VideoCardProps> = ({ title, imageUrl, createdAt, playbackId, assetData, format, onPlayClick }) => {
  // const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { views: videocount } = usePlaybackMetrics(playbackId || '');
  const { thumbnailUrl, loading } = useFetchPlaybackId(assetData.playbackId);
  const viewMode = String(assetData.viewMode || 'free').toLowerCase();
  const amount = Number(assetData.amount || 0);
  const isPaid = viewMode !== 'free' && amount > 0;
  const isMonthly = viewMode === 'monthly';
  const description = String(assetData.description || '').trim();
  
  // Handle clicks - if onPlayClick is provided, use it; otherwise open in new tab
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If onPlayClick callback is provided, use it for inline playback
    if (onPlayClick) {
      onPlayClick();
      return;
    }
    
    // Otherwise, default behavior: open in new tab
    if (assetData.playbackId) {
      const creatorId = assetData?.creatorId?.value || assetData?.creatorWalletAddress || '';
      const query = creatorId ? `?id=${encodeURIComponent(creatorId)}` : '';
      window.open(`/player/${assetData.playbackId}${query}`, '_blank');
    }
  };

  return (
    <div className="w-full h-full flex flex-col group rounded-xl border border-white/15 bg-white/5 p-2">
      <div 
        className={`w-full bg-gray-200 rounded-lg overflow-hidden relative ${onPlayClick ? 'cursor-pointer' : ''}`}
        onClick={handleClick}
        onMouseDown={(e) => {
          // Prevent any default behavior on mouse down
          if (e.button === 0) { // Left click only
            e.preventDefault();
          }
        }}
      >
        {loading ? (
          <div className="flex items-center w-full max-sm:h-[220px] h-[300px] lg:h-[200px] justify-center">
            <p className="text-gray-800">Loading</p>
          </div>
        ) : (
          <Image
            src={thumbnailUrl || imageUrl}
            alt={assetData.name}
            className="rounded-lg w-full max-sm:h-[220px] h-[300px] lg:h-[200px] object-cover pointer-events-none"
            width={400}
            height={180}
            draggable={false}
          />
        )}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10 pointer-events-none">
          {videocount?.viewCount || 0} views
        </div>
        <div className="absolute inset-0 flex justify-center items-center group-hover:bg-black bg-opacity-0 group-hover:bg-opacity-40 transition duration-300 pointer-events-none">
          <button 
            onClick={handleClick}
            className="text-white text-4xl opacity-0 group-hover:opacity-100 pointer-events-auto"
            type="button"
          >
            <FaPlay />
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center mt-2 px-1">
        <div>
          <h2 className="font-bold text-white text-lg capitalize pt-2 break-words">
            {title}
            {format ? `.${format}` : ''}
          </h2>
        </div>
        <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <AssetPopup asset={assetData} />
        </div>
      </div>
      <div className="flex justify-start px-1">
        <p className="text-sm text-gray-300">{createdAt ? createdAt.toDateString() : ''}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 px-1 pt-1">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isPaid ? 'bg-yellow-500/25 text-yellow-200 border border-yellow-500/30' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
          }`}
        >
          {isPaid ? (isMonthly ? 'Monthly' : 'One-Time') : 'Free'}
        </span>
        {isPaid && (
          <span className="rounded-full border border-teal-400/30 bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold text-teal-100">
            ${amount.toFixed(2)}
          </span>
        )}
      </div>
      {description && <p className="px-1 pt-1 text-xs text-gray-400 line-clamp-2">{description}</p>}
    </div>
  );
};
// Stream
export const VideoStreamCard: React.FC<VideoStreamCardProps> = ({
  playbackId,
  streamName,
  imageUrl,
  creatorId,
  lastSeen,
  status,
}) => {
  const { thumbnailUrl, loading } = useFetchStreamPlaybackId(playbackId);
  const { viewerMetrics: viewstream } = useViewMetrics({ playbackId: playbackId });
  const host = process.env.NEXT_PUBLIC_BASE_URL;

  const playbackUrl = host
    ? `${host.includes('localhost') ? 'http' : 'https'}://${host}/creator/${encodeURIComponent(
        creatorId || '',
      )}/live/${encodeURIComponent(playbackId)}`
    : null;

  const handlePlayClick = () => {
    if (playbackUrl) {
      window.open(playbackUrl, '_blank');
    }
  };

  return (
    <div className="flex gap-3 p-2 cursor-pointer group">
      {/* Thumbnail Container */}
      <div className="relative flex-shrink-0 w-40 h-24">
        {loading ? (
          <div className="flex items-center justify-center w-full h-full bg-gray-200">
            <p className="text-sm">Loading...</p>
          </div>
        ) : (
          <>
            <Image
              src={thumbnailUrl || imageUrl || '/assets/default-thumbnail.jpg'}
              alt={streamName}
              fill
              className="rounded object-cover"
            />
            {/* Status overlay */}
            <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded flex items-center gap-1">
              {status ? (
                <>
                  <div className="bg-[#04EB2A] h-[6px] w-[6px] rounded-full" />
                  <span className="text-xs text-black-primary-text font-medium select-none">Live</span>
                </>
              ) : (
                <>
                  <div className="bg-gray-200 h-[6px] w-[6px] rounded-full" />
                  <span className="text-xs text-gray-500 font-medium select-none">Idle</span>
                </>
              )}
            </div>
          </>
        )}

        {/* Hover overlay with play button */}
        <div className="absolute inset-0 flex justify-center items-center bg-opacity-0 group-hover:bg-opacity-60 transition duration-300">
          <button onClick={handlePlayClick} className="text-white text-2xl opacity-0 group-hover:opacity-100">
            <FaPlay />
          </button>
        </div>
      </div>

      {/* Video Details */}
      <div className="flex flex-col justify-between flex-grow overflow-hidden">
        <p className="text-sm text-black capitalize line-clamp-2">{streamName}</p>
        <div>
          <p className="text-sm text-gray-500">{viewstream?.viewCount || 0} views</p>
          <p className="text-xs text-gray-500">Last Seen: {lastSeen.toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};

// vidooooooooooooooooo
export const StreamVideoCard: React.FC<VideoCardProps> = ({ title, imageUrl, createdAt, playbackId, assetData }) => {
  const { video, loading: gateLoading, hasAccess } = useGetAssetGate(assetData.playbackId);
  const { views: videocount } = usePlaybackMetrics(playbackId || '');
  const { thumbnailUrl, loading } = useFetchPlaybackId(assetData.playbackId);
  const isGated = !hasAccess && video?.viewMode !== 'free';
  const handlePlayClick = () => {
    if (assetData.playbackId) {
      const creatorId = assetData?.creatorId?.value || assetData?.creatorWalletAddress || '';
      const query = creatorId ? `?id=${encodeURIComponent(creatorId)}` : '';
      window.open(`/player/${assetData.playbackId}${query}`, '_blank');
    }
  };
  return (
    <>
      <div className="flex gap-3 p-2 cursor-pointer group">
        {/* Thumbnail Container */}
        <div className="relative flex-shrink-0 w-40 h-24">
          {loading || gateLoading ? (
            <div className="flex items-center justify-center w-full h-full bg-gray-200">
              <p className="text-sm">Loading...</p>
            </div>
          ) : (
            <>
              <Image
                src={thumbnailUrl || imageUrl || '/assets/default-thumbnail.jpg'}
                alt={title}
                fill
                className="rounded object-cover"
              />
              <span className="absolute bottom-1 right-1 bg-black text-white text-xs px-1 rounded">
                {assetData.videoSpec && assetData.videoSpec.duration
                  ? `${Math.floor(assetData.videoSpec.duration / 3600)
                      .toString()
                      .padStart(2, '0')}:${Math.floor((assetData.videoSpec.duration % 3600) / 60)
                      .toString()
                      .padStart(2, '0')}:${Math.floor(assetData.videoSpec.duration % 60)
                      .toString()
                      .padStart(2, '0')}`
                  : '00:00:00'}
              </span>
            </>
          )}
          {/* Hover overlay with play button */}
          <div className="absolute inset-0 flex justify-center items-center bg-opacity-0 group-hover:bg-opacity-60 transition duration-300">
            {isGated ? (
              <div onClick={handlePlayClick} className="text-main-blue text-4xl opacity-0 group-hover:opacity-100">
                <FaLock />
              </div>
            ) : (
              <button onClick={handlePlayClick} className="text-white text-4xl opacity-0 group-hover:opacity-100">
                <FaPlay />
              </button>
            )}
          </div>
        </div>
        {/* Video Details */}
        <div className="flex flex-col justify-between flex-grow overflow-hiden">
          <p className="text-sm text-black capitalize line-clamp-2">{title}</p>
          <div className="">
            <p className="text-sm text-gray-500">{videocount?.viewCount} views</p>
            <p className="text-xs text-gray-500">{createdAt ? createdAt.toDateString() : ''}</p>
          </div>
        </div>
      </div>
    </>
  );
};
