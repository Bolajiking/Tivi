'use client';

import React from 'react';
import Image, { StaticImageData } from 'next/image';
import { useFetchStreamPlaybackId } from '@/app/hook/usePlaybckInfo';
import { useViewMetrics } from '@/app/hook/useViewerMetrics';
import Link from 'next/link';

// Helper to check if URL is from Livepeer CDN (which might fail)
const isLivepeerCDN = (url: string | undefined): boolean => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('recordings-cdn-s.lp-playback.studio') || url.includes('vod-cdn.lp-playback.studio');
};

interface PublicStreamCardProps {
  title: string;
  image: StaticImageData;
  logo?: string;
  playbackId: string;
  playb: string;
  lastSeen: Date;
  status: boolean;
  creatorId: string;
}

export const PublicStreamCard: React.FC<PublicStreamCardProps> = ({
  title,
  image,
  logo,
  playbackId,
  playb,
  lastSeen,
  status,
  creatorId,
}) => {
  const { thumbnailUrl, loading } = useFetchStreamPlaybackId(playb);
  const { viewerMetrics: viewstream } = useViewMetrics({ playbackId: playb });
  const [imageError, setImageError] = React.useState(false);
  
  // Reset error when thumbnailUrl changes
  React.useEffect(() => {
    setImageError(false);
  }, [thumbnailUrl]);
  
  // Determine the image source with fallback chain: thumbnail -> logo -> default
  const getImageSource = (): string | StaticImageData => {
    if (imageError && thumbnailUrl) {
      // If thumbnail failed, use logo or default
      return logo || image;
    }
    // Prefer thumbnail if available, otherwise logo, otherwise default
    return thumbnailUrl || logo || image;
  };

  const imageSrc = getImageSource();
  const useRegularImg = typeof imageSrc === 'string' && isLivepeerCDN(imageSrc);

  const handleImageError = () => {
    if (!imageError && thumbnailUrl) {
      setImageError(true);
    }
  };

  return (
    <div className="w-full max-w-none flex bg-transparent items-center space-y-4 justify-between p-4 rounded-lg">
      {/* Round Stream Image */}
      <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-yellow-400/50">
        {loading ? (
          <div className="flex items-center justify-center w-full h-full bg-white/10">
            <p className="text-white text-sm">Loading</p>
          </div>
        ) : useRegularImg ? (
          // Use regular img tag for Livepeer CDN URLs to avoid Next.js optimization errors
          <img
            src={imageSrc as string}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <Image
            src={imageSrc}
            alt={title}
            fill
            className="object-cover"
            sizes="128px"
            onError={handleImageError}
          />
        )}
        {/* Live Status Badge */}
        {status && (
          <div className="absolute bottom-0 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-tl-lg rounded-br-lg font-semibold">
            LIVE
          </div>
        )}
      </div>

      {/* Stream Name */}
      <div className="text-center flex-1">
        <h2 className="text-white font-bold text-2xl">{title}</h2>
        {viewstream?.viewCount !== undefined && (
          <p className="text-gray-300 text-sm mt-1">{viewstream.viewCount} viewers</p>
        )}
        {lastSeen && (
          <p className="text-gray-400 text-xs mt-1">
            {status ? 'Started' : 'Last streamed'} {new Date(lastSeen).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* View Stream Button */}
      <div className="flex flex-col items-center justify-center gap-3">
        <Link
          href={`/view/${playbackId}?streamName=${encodeURIComponent(title)}&id=${creatorId}`}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-all duration-200 font-semibold"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
          </svg>
          View Stream
        </Link>
      </div>
    </div>
  );
};

