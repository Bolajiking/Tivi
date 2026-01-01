'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image, { StaticImageData } from 'next/image';
import { FaTwitter, FaInstagram, FaYoutube } from 'react-icons/fa';
import { HiUsers, HiGlobeAlt, HiDotsVertical } from 'react-icons/hi';
import { getSubscriberCount } from '@/lib/supabase-service';
import { toast } from 'sonner';

interface CreatorChannelCardProps {
  title: string;
  logo: string | StaticImageData | null;
  bio: string | null;
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    website?: string;
  };
  defaultImage: StaticImageData;
  isActive?: boolean;
  creatorId?: string;
  showOptionsMenu?: boolean; // Show three-dot menu for viewers
}

export const CreatorChannelCard: React.FC<CreatorChannelCardProps> = ({
  title,
  logo,
  bio,
  socialLinks,
  defaultImage,
  isActive = false,
  creatorId,
  showOptionsMenu = false,
}) => {
  const [subscriberCount, setSubscriberCount] = useState<number>(0);
  const [loadingCount, setLoadingCount] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const deferredPromptRef = useRef<any>(null);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Handle PWA install
  const handleInstall = async () => {
    setMenuOpen(false);
    setShowMobileSheet(false);
    const prompt = deferredPromptRef.current;
    if (prompt) {
      try {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          toast.success(`Installing ${title}...`);
        }
        deferredPromptRef.current = null;
      } catch (error) {
        toast.error('Unable to install. Try adding to home screen from browser menu.');
      }
    } else {
      toast.info('To install: Open browser menu → "Add to Home Screen" or "Install App"');
    }
  };

  // Handle share
  const handleShare = async () => {
    setMenuOpen(false);
    setShowMobileSheet(false);
    const channelUrl = creatorId ? `${window.location.origin}/creator/${creatorId}` : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          url: channelUrl,
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(channelUrl);
        toast.success('Link copied to clipboard!');
      } catch (error) {
        toast.error('Failed to copy link');
      }
    }
  };

  // Fetch subscriber count
  useEffect(() => {
    const fetchSubscriberCount = async () => {
      if (!creatorId) {
        setLoadingCount(false);
        return;
      }
      try {
        const count = await getSubscriberCount(creatorId);
        setSubscriberCount(count);
      } catch (error) {
        console.error('Error fetching subscriber count:', error);
      } finally {
        setLoadingCount(false);
      }
    };

    fetchSubscriberCount();
  }, [creatorId]);

  // Helper to check if URL is from Livepeer CDN
  const isLivepeerCDN = (url: string | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    return url.includes('recordings-cdn-s.lp-playback.studio') || url.includes('vod-cdn.lp-playback.studio');
  };

  const imageSrc = logo || defaultImage;
  const useRegularImg = typeof imageSrc === 'string' && isLivepeerCDN(imageSrc);

  const hasSocialLinks = Object.values(socialLinks).some((link) => link && link.trim() !== '');

  // Format subscriber count
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  return (
    <div className="w-full">
      {/* Main Card Container */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl border border-white/10">
        {/* Decorative gradient orbs */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Three-dot options menu */}
        {showOptionsMenu && (
          <div className="absolute top-3 right-3 z-20" ref={menuRef}>
            {/* Desktop: Dropdown menu */}
            <div className="hidden md:block relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <HiDotsVertical className="w-5 h-5 text-white" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-white/20 rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={handleInstall}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors text-left"
                  >
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Install Channel
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors text-left"
                  >
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share Channel
                  </button>
                </div>
              )}
            </div>
            {/* Mobile: Button to open bottom sheet */}
            <button
              onClick={() => setShowMobileSheet(true)}
              className="md:hidden p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <HiDotsVertical className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 p-4 md:p-6">
          {/* Mobile Layout */}
          <div className="flex flex-col md:hidden">
            {/* Top Row: Avatar + Info */}
            <div className="flex items-start gap-4 mb-4">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-yellow-400/30 ring-offset-2 ring-offset-gray-900 shadow-lg shadow-yellow-500/10">
                  {useRegularImg ? (
                    <img
                      src={imageSrc as string}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={imageSrc}
                      alt={title}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  )}
                </div>
                {/* Live Badge */}
                {isActive && (
                  <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-green-500 to-emerald-400 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg shadow-green-500/30">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>

              {/* Title + Stats */}
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-lg leading-tight mb-2 truncate">{title}</h2>

                {/* Subscriber Count */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                    <HiUsers className="w-4 h-4 text-yellow-400" />
                    <span className="text-white text-sm font-medium">
                      {loadingCount ? (
                        <span className="inline-block w-8 h-4 bg-white/10 rounded animate-pulse" />
                      ) : (
                        formatCount(subscriberCount)
                      )}
                    </span>
                    <span className="text-gray-400 text-xs">subscribers</span>
                  </div>
                </div>

                {/* Social Links - Horizontal on mobile */}
                {hasSocialLinks && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {socialLinks.twitter && (
                      <a
                        href={socialLinks.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all hover:scale-110"
                        title="Twitter"
                      >
                        <FaTwitter className="text-sm text-blue-400" />
                      </a>
                    )}
                    {socialLinks.instagram && (
                      <a
                        href={socialLinks.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 transition-all hover:scale-110"
                        title="Instagram"
                      >
                        <FaInstagram className="text-sm text-pink-400" />
                      </a>
                    )}
                    {socialLinks.youtube && (
                      <a
                        href={socialLinks.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all hover:scale-110"
                        title="YouTube"
                      >
                        <FaYoutube className="text-sm text-red-400" />
                      </a>
                    )}
                    {socialLinks.website && (
                      <a
                        href={socialLinks.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 transition-all hover:scale-110"
                        title="Website"
                      >
                        <HiGlobeAlt className="text-sm text-yellow-400" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bio Section - Full width on mobile */}
            {bio && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
                <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">{bio}</p>
              </div>
            )}
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center gap-6">
            {/* Left: Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 rounded-2xl overflow-hidden ring-2 ring-yellow-400/30 ring-offset-4 ring-offset-gray-900 shadow-xl shadow-yellow-500/10">
                {useRegularImg ? (
                  <img
                    src={imageSrc as string}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image
                    src={imageSrc}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                )}
              </div>
              {/* Live Badge */}
              {isActive && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-400 text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-lg shadow-green-500/30">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
              )}
            </div>

            {/* Center: Title, Stats, and Bio */}
            <div className="flex-1 min-w-0">
              {/* Title Row */}
              <div className="flex items-center gap-4 mb-3">
                <h2 className="text-white font-bold text-2xl truncate">{title}</h2>

                {/* Subscriber Count Badge */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/10 to-teal-500/10 rounded-full border border-yellow-500/20">
                  <HiUsers className="w-5 h-5 text-yellow-400" />
                  <span className="text-white font-semibold">
                    {loadingCount ? (
                      <span className="inline-block w-10 h-5 bg-white/10 rounded animate-pulse" />
                    ) : (
                      formatCount(subscriberCount)
                    )}
                  </span>
                  <span className="text-gray-400 text-sm">subscribers</span>
                </div>
              </div>

              {/* Bio */}
              {bio && (
                <div className="mb-4">
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-2">{bio}</p>
                </div>
              )}

              {/* Social Links Row */}
              {hasSocialLinks && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wider mr-2">Connect</span>
                  {socialLinks.twitter && (
                    <a
                      href={socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all"
                      title="Twitter"
                    >
                      <FaTwitter className="text-blue-400 group-hover:scale-110 transition-transform" />
                      <span className="text-blue-400 text-xs font-medium hidden lg:inline">Twitter</span>
                    </a>
                  )}
                  {socialLinks.instagram && (
                    <a
                      href={socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 transition-all"
                      title="Instagram"
                    >
                      <FaInstagram className="text-pink-400 group-hover:scale-110 transition-transform" />
                      <span className="text-pink-400 text-xs font-medium hidden lg:inline">Instagram</span>
                    </a>
                  )}
                  {socialLinks.youtube && (
                    <a
                      href={socialLinks.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
                      title="YouTube"
                    >
                      <FaYoutube className="text-red-400 group-hover:scale-110 transition-transform" />
                      <span className="text-red-400 text-xs font-medium hidden lg:inline">YouTube</span>
                    </a>
                  )}
                  {socialLinks.website && (
                    <a
                      href={socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 transition-all"
                      title="Website"
                    >
                      <HiGlobeAlt className="text-yellow-400 group-hover:scale-110 transition-transform" />
                      <span className="text-yellow-400 text-xs font-medium hidden lg:inline">Website</span>
                    </a>
                  )}
                </div>
              )}

              {/* No social links message */}
              {!hasSocialLinks && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <HiGlobeAlt className="w-4 h-4" />
                  <span>No social links available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet for Options */}
      {showOptionsMenu && showMobileSheet && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setShowMobileSheet(false)}
          />
          {/* Bottom Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-white/20 rounded-t-2xl p-4 animate-slide-up md:hidden">
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
              {logo ? (
                typeof logo === 'string' ? (
                  <img src={logo} alt={title} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <Image src={logo} alt={title} width={48} height={48} className="rounded-full object-cover" />
                )
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black font-bold">
                  {title.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-white font-semibold">{title}</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleInstall}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-white">Install Channel</span>
              </button>
              <button
                onClick={handleShare}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="text-white">Share Channel</span>
              </button>
            </div>
            <button
              onClick={() => setShowMobileSheet(false)}
              className="w-full mt-4 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};
