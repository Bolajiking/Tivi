'use client';

import React from 'react';
import Image, { StaticImageData } from 'next/image';
import { FaTwitter, FaInstagram, FaYoutube, FaLink } from 'react-icons/fa';
import { ChannelCardProps } from '@/interfaces';
import { Popup } from '../Popup';
import { useFetchStreamPlaybackId } from '@/app/hook/usePlaybckInfo';
import { useViewMetrics } from '@/app/hook/useViewerMetrics';
import Link from 'next/link';
import { useProfile } from '@/app/hook/useProfile';

// Helper to check if URL is from Livepeer CDN (which might fail)
const isLivepeerCDN = (url: string | undefined): boolean => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('recordings-cdn-s.lp-playback.studio') || url.includes('vod-cdn.lp-playback.studio');
};

interface ChannelCardRedesignProps extends ChannelCardProps {
  image: StaticImageData;
}

export const ChannelCardRedesign: React.FC<ChannelCardRedesignProps> = ({
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
  const { profile } = useProfile();
  const [imageError, setImageError] = React.useState(false);

  const socialLinks = profile?.socialLinks || {};
  const hasSocialLinks = Object.values(socialLinks).some((link) => link && link.trim() !== '');

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

  // console.log(title,logo,status);

  return (
    <>
    <div className="w-full max-w-none flex bg-transparent  items-center space-y-4 justify-between p-4 rounded-lg">
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
        
      </div>

      {/* Bold Stream Name */}
      <div className="text-center flex">
        <h2 className="text-white font-bold text-2xl">{title}</h2>
        <h2 className="text-yellow-300 text-sm ">TV</h2>
        {/* Live Status Badge */}
        {status && (
          <div className="absolute bottom-0 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-tl-lg rounded-br-lg font-semibold">
            LIVE
          </div>
        )}
        {/* {viewstream?.viewCount !== undefined && (
          <p className="text-gray-300 text-sm mt-1">{viewstream.viewCount} views</p>
        )}
        {lastSeen && (
          <p className="text-gray-400 text-xs mt-1">Last active {lastSeen.toDateString()}</p>
        )} */}
      </div>

      {/* Social Media Links or Add Links Button */}
      <div className="flex flex-col items-center justify-center gap-3">
        {hasSocialLinks ? (
          <>
            {socialLinks.twitter && (
              <a
                href={socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title="Twitter"
              >
                <FaTwitter className="text-xl text-blue-400" />
              </a>
            )}
            {socialLinks.instagram && (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title="Instagram"
              >
                <FaInstagram className="text-xl text-pink-500" />
              </a>
            )}
            {socialLinks.youtube && (
              <a
                href={socialLinks.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title="YouTube"
              >
                <FaYoutube className="text-xl text-red-500" />
              </a>
            )}
            {socialLinks.website && (
              <a
                href={socialLinks.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title="Website"
              >
                <FaLink className="text-xl text-yellow-400" />
              </a>
            )}
          </>
        ) : (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors text-sm font-medium"
          >
            <FaLink className="text-sm" />
            Add Links
          </Link>
        )}
      </div>

    
    </div>
      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        {goLive && (
          <button
            onClick={goLive}
            className="flex-1 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black font-semibold py-2 px-4 rounded-lg transition-all duration-200"
          >
            Go Live
          </button>
        )}
        
        {/* Options Menu */}
        {streamId && playbackId && (
          <div className="flex-shrink-0">
            <Popup streamId={streamId} playbackId={playbackId} />
          </div>
        )}
      </div>
      </>
  );
};

