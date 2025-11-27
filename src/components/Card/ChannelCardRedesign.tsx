'use client';

import React, { useEffect, useState } from 'react';
import Image, { StaticImageData } from 'next/image';
import { FaTwitter, FaInstagram, FaYoutube, FaLink } from 'react-icons/fa';
import { RiVideoAddLine, RiLiveLine } from 'react-icons/ri';
import { ChannelCardProps } from '@/interfaces';
import { useFetchStreamPlaybackId } from '@/app/hook/usePlaybckInfo';
import Link from 'next/link';
import { getStreamByPlaybackId } from '@/lib/supabase-service';
import { SupabaseStream } from '@/lib/supabase-types';

// Helper to check if URL is from Livepeer CDN (which might fail)
const isLivepeerCDN = (url: string | undefined): boolean => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('recordings-cdn-s.lp-playback.studio') || url.includes('vod-cdn.lp-playback.studio');
};

interface ChannelCardRedesignProps extends ChannelCardProps {
  image: StaticImageData;
  showName?: boolean;
  showSocialLinks?: boolean;
  useThumbnail?: boolean; // If true, prefer thumbnail; if false, prefer logo from stream
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
  showName = true,
  showSocialLinks = true,
  useThumbnail = false,
}) => {
  const { thumbnailUrl, loading } = useFetchStreamPlaybackId(playb);
  const [imageError, setImageError] = React.useState(false);
  const [streamData, setStreamData] = useState<SupabaseStream | null>(null);
  const [loadingStream, setLoadingStream] = useState(true);

  // Fetch stream data from Supabase
  useEffect(() => {
    const fetchStreamData = async () => {
      if (!playbackId) {
        setLoadingStream(false);
        return;
      }

      try {
        setLoadingStream(true);
        const stream = await getStreamByPlaybackId(playbackId);
        setStreamData(stream);
      } catch (error) {
        console.error('Error fetching stream data:', error);
      } finally {
        setLoadingStream(false);
      }
    };

    fetchStreamData();
  }, [playbackId]);

  // Helper function to parse socialLinks from array of JSON strings to object format
  const parseSocialLinks = (socialLinksArray: string[] | null | undefined): { twitter?: string; instagram?: string; youtube?: string; website?: string } => {
    const socialLinks: { twitter?: string; instagram?: string; youtube?: string; website?: string } = {};
    
    if (Array.isArray(socialLinksArray)) {
      socialLinksArray.forEach((jsonString: string) => {
        if (typeof jsonString === 'string') {
          try {
            const parsed = JSON.parse(jsonString);
            Object.keys(parsed).forEach((key) => {
              const value = parsed[key];
              if (key === 'twitter' && value) {
                socialLinks.twitter = value;
              } else if (key === 'instagram' && value) {
                socialLinks.instagram = value;
              } else if (key === 'youtube' && value) {
                socialLinks.youtube = value;
              } else if (key === 'website' && value) {
                socialLinks.website = value;
              }
            });
          } catch (e) {
            console.warn('Failed to parse social link JSON:', jsonString);
          }
        }
      });
    }
    
    return socialLinks;
  };

  // Get stream name from stream data, fallback to title prop
  const streamName = streamData?.streamName || title;
  
  // Get social links from stream data
  const socialLinks = streamData ? parseSocialLinks(streamData.socialLinks) : {};
  const hasSocialLinks = Object.values(socialLinks).some((link) => link && link.trim() !== '');

  // Reset error when thumbnailUrl changes
  React.useEffect(() => {
    setImageError(false);
  }, [thumbnailUrl]);

  // Determine the image source based on useThumbnail prop
  const getImageSource = (): string | StaticImageData | null => {
    if (useThumbnail) {
      // For Gallery: prefer thumbnail -> null (will show custom placeholder)
    if (imageError && thumbnailUrl) {
        return null; // Show custom placeholder instead of default image
      }
      return thumbnailUrl || null;
    } else {
      // For "Your Channel": prefer logo from stream -> logo prop -> default
      const streamLogo = streamData?.logo || logo;
      return streamLogo || image;
    }
  };

  const imageSrc = getImageSource();
  const hasImage = imageSrc !== null;
  const useRegularImg = typeof imageSrc === 'string' && isLivepeerCDN(imageSrc);

  const handleImageError = () => {
    if (!imageError && thumbnailUrl) {
      setImageError(true);
    }
  };

  // console.log(title,logo,status);

  // Determine layout based on what's being shown
  const isSimpleLayout = !showName && !showSocialLinks;

  // Custom placeholder component for Gallery when no thumbnail is available
  const StreamPlaceholder = () => (
    <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-yellow-500/20 via-teal-500/20 to-yellow-500/20 flex flex-col items-center justify-center">
      <div className="relative flex flex-col items-center">
        <div className="relative mb-4">
          {/* <RiVideoAddLine className="w-20 h-20 text-yellow-400/80" /> */}
          <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-yellow-400/40 flex items-center justify-center backdrop-blur-sm">
            <RiLiveLine className="w-4 h-4 text-yellow-400" />
          </div>
        </div>
        {/* <p className="text-white/80 text-sm font-semibold">Ready to Go Live</p> */}
        <p className="text-white/50 text-xs mt-1">No thumbnail available</p>
      </div>
    </div>
  );

  return (
    <div className={`w-full max-w-none flex bg-transparent items-center space-y-1 py-0.5 px-2 rounded-lg ${isSimpleLayout ? 'justify-center flex-col' : 'justify-between'}`}>
      {/* Stream Image - Different sizes based on layout */}
      <div className={`relative overflow-hidden border-2 border-yellow-400/50 ${isSimpleLayout ? 'w-full max-w-md aspect-video rounded-lg' : 'w-24 h-24 rounded-full'}`}>
        {loading ? (
          <div className="flex items-center justify-center w-full h-full bg-black">
            <p className="text-white text-sm">Loading</p>
          </div>
        ) : !hasImage && isSimpleLayout ? (
          // Show custom placeholder when no thumbnail is available in Gallery view
          <StreamPlaceholder />
        ) : hasImage && useRegularImg ? (
          // Use regular img tag for Livepeer CDN URLs to avoid Next.js optimization errors
          <img
            src={imageSrc as string}
            alt={streamName}
            className="absolute inset-0 w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : hasImage ? (
          <Image
            src={imageSrc as string | StaticImageData}
            alt={streamName}
            fill
            className="object-cover"
            sizes={isSimpleLayout ? "(max-width: 768px) 100vw, 512px" : "128px"}
            onError={handleImageError}
          />
        ) : null}
        
        {/* Live Status Badge - Only show in simple layout */}
        {isSimpleLayout && status && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-semibold flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* Stream Status Display - Only show in simple layout (Gallery) */}
      {isSimpleLayout && (
        <div className="w-full max-w-md flex items-center justify-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
          <div className={`w-2 h-2 rounded-full ${status ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className={`text-xs font-medium ${status ? 'text-green-400' : 'text-gray-400'}`}>
            {status ? 'Live' : 'Offline'}
          </span>
        </div>
      )}

      {/* Bold Stream Name - Only show if showName is true */}
      {showName && (
      <div className="text-center flex">
          <h2 className="text-white font-bold text-lg">{title || streamName}</h2>
        <h2 className="text-yellow-300 text-xs ">TV</h2>
          {/* Live Status Badge - Only show when name is visible */}
        {status && (
          <div className="absolute bottom-0 right-0 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-tl-lg rounded-br-lg font-semibold">
            LIVE
          </div>
        )}
        </div>
        )}

      {/* Social Media Links or Add Links Button - Only show if showSocialLinks is true */}
      {showSocialLinks && (
      <div className="flex items-center justify-center">
        {hasSocialLinks ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {socialLinks.twitter && (
              <a
                href={socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                title="Twitter"
              >
                <FaTwitter className="text-lg text-blue-400" />
              </a>
            )}
            {socialLinks.instagram && (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                title="Instagram"
              >
                <FaInstagram className="text-lg text-pink-500" />
              </a>
            )}
            {socialLinks.youtube && (
              <a
                href={socialLinks.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                title="YouTube"
              >
                <FaYoutube className="text-lg text-red-500" />
              </a>
            )}
            {socialLinks.website && (
              <a
                href={socialLinks.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                title="Website"
              >
                <FaLink className="text-lg text-yellow-400" />
              </a>
            )}
          </div>
        ) : (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors text-sm font-medium"
          >
            <FaLink className="text-sm" />
            Add Links
          </Link>
        )}
      </div>
      )}
    </div>
  );
};

