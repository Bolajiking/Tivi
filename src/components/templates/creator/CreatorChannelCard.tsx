'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image, { StaticImageData } from 'next/image';
import { FaTwitter, FaInstagram, FaYoutube } from 'react-icons/fa';
import { HiUsers, HiGlobeAlt, HiDotsVertical } from 'react-icons/hi';
import { Copy } from 'lucide-react';
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
  creatorRouteId?: string;
  compact?: boolean;
  chatCompact?: boolean;
  actionSlot?: React.ReactNode;
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
  creatorRouteId,
  compact = false,
  chatCompact = false,
  actionSlot,
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
    if (!creatorRouteId) {
      toast.error('Creator username unavailable for sharing.');
      return;
    }
    const channelUrl = `${window.location.origin}/${encodeURIComponent(creatorRouteId)}`;
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
  const isCompact = compact || chatCompact;
  const creatorProfileUrl = creatorRouteId && typeof window !== 'undefined'
    ? `${window.location.origin}/${encodeURIComponent(creatorRouteId)}`
    : '';

  // Format subscriber count
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  const handleCopyCreatorUrl = async () => {
    if (!creatorProfileUrl) {
      toast.error('Creator URL unavailable');
      return;
    }
    try {
      await navigator.clipboard.writeText(creatorProfileUrl);
      toast.success('Creator profile URL copied');
    } catch (error) {
      toast.error('Failed to copy creator URL');
    }
  };

  return (
    <div className="w-full">
      {/* Main Card Container */}
      <div
        className={
          chatCompact
            ? 'relative overflow-hidden rounded-none border border-white/[0.07] border-b-0 bg-[#0f0f0f]/95 backdrop-blur-xl md:rounded-t-[22px] md:rounded-b-none'
            : 'relative overflow-hidden rounded-2xl bg-[#0f0f0f] border border-white/[0.07]'
        }
      >
        {/* Decorative gradient orbs */}
        <div className="absolute -top-24 -right-24 hidden" />
        <div className="absolute -bottom-24 -left-24 hidden" />

        {/* Three-dot options menu */}
        {showOptionsMenu && (
          <div className="absolute top-3 right-3 z-20" ref={menuRef}>
            {/* Desktop: Dropdown menu */}
            <div className="hidden md:block relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-full bg-[#1a1a1a] hover:bg-[#242424] transition-colors"
              >
                <HiDotsVertical className="w-5 h-5 text-white" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#0f0f0f] border border-white/[0.07] rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={handleInstall}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#1a1a1a] transition-colors text-left"
                  >
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Install Channel
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#1a1a1a] transition-colors text-left"
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
              className="md:hidden p-2 rounded-full bg-[#1a1a1a] hover:bg-[#242424] transition-colors"
            >
              <HiDotsVertical className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className={
            chatCompact
              ? 'relative z-10 p-2 md:p-2.5'
              : compact
              ? 'relative z-10 p-3 md:p-4'
              : 'relative z-10 p-4 md:p-6'
          }
        >
          {chatCompact ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="relative flex-shrink-0">
                    <div className="h-11 w-11 overflow-hidden rounded-lg ring-1 ring-white/[0.16] shadow-lg shadow-black/40">
                      {useRegularImg ? (
                        <img
                          src={imageSrc as string}
                          alt={title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image
                          src={imageSrc}
                          alt={title}
                          fill
                          className="object-cover"
                          sizes="44px"
                        />
                      )}
                    </div>
                    {isActive && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#07101b] bg-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-semibold leading-[1.15] text-white">{title}</h2>
                    <p className="truncate text-[12px] leading-[1.2] text-gray-300">
                      {bio?.trim() || 'Channel group chat room'}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <div className="hidden items-center -space-x-1.5 md:flex">
                    <span className="h-5 w-5 rounded-full border border-white/[0.16] bg-[#252525]" />
                    <span className="h-5 w-5 rounded-full border border-white/[0.16] bg-[#2b2b2b]" />
                    <span className="h-5 w-5 rounded-full border border-white/[0.16] bg-[#1f1f1f]" />
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-[#121212] px-1.5 py-0.5 text-[11px] leading-none text-white sm:px-2">
                    <HiUsers className="h-3.5 w-3.5 text-[#facc15]" />
                    <span>{loadingCount ? '...' : formatCount(subscriberCount)}</span>
                  </div>
                  {creatorProfileUrl ? (
                    <button
                      type="button"
                      onClick={handleShare}
                      className="inline-flex h-7 items-center rounded-full border border-white/[0.12] bg-[#161616] px-2.5 text-[11px] font-semibold leading-none text-[#facc15] transition-colors hover:bg-[#202020] sm:px-3"
                    >
                      Invite
                    </button>
                  ) : null}
                  {actionSlot ? <div className="hidden md:block">{actionSlot}</div> : null}
                </div>
              </div>

              {actionSlot ? <div className="md:hidden">{actionSlot}</div> : null}
            </div>
          ) : (
          <>
          {/* Mobile Layout */}
          <div className="flex flex-col md:hidden">
            {/* Top Row: Avatar + Info */}
            <div className={isCompact ? 'flex items-start gap-2.5 mb-1.5' : 'flex items-start gap-4 mb-4'}>
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className={
                    chatCompact
                      ? 'w-11 h-11 rounded-lg overflow-hidden ring-1 ring-white/25 shadow-lg shadow-black/40'
                      : compact
                      ? 'w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-yellow-400/30 ring-offset-2 ring-offset-gray-900 shadow-lg shadow-yellow-500/10'
                      : 'w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-yellow-400/30 ring-offset-2 ring-offset-gray-900 shadow-lg shadow-yellow-500/10'
                  }
                >
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
                <h2
                  className={
                    chatCompact
                      ? 'text-white font-semibold text-[15px] leading-tight mb-1 truncate'
                      : compact
                      ? 'text-white font-bold text-base leading-tight mb-2 truncate'
                      : 'text-white font-bold text-lg leading-tight mb-2 truncate'
                  }
                >
                  {title}
                </h2>

                {/* Subscriber Count */}
                <div className={chatCompact ? 'flex items-center gap-1.5 mb-1' : 'flex items-center gap-2 mb-3'}>
                  <div
                    className={
                      chatCompact
                        ? 'flex items-center gap-1 px-2 py-0.5 bg-black/35 rounded-full border border-white/[0.15]'
                        : 'flex items-center gap-1.5 px-3 py-1.5 bg-[#0f0f0f] rounded-full border border-white/[0.07]'
                    }
                  >
                    <HiUsers className="w-4 h-4 text-yellow-400" />
                    <span
                      className={
                        chatCompact
                          ? 'text-white text-[10px] font-medium'
                          : compact
                          ? 'text-white text-xs font-medium'
                          : 'text-white text-sm font-medium'
                      }
                    >
                      {loadingCount ? (
                        <span className="inline-block w-8 h-4 bg-[#1a1a1a] rounded animate-pulse" />
                      ) : (
                        formatCount(subscriberCount)
                      )}
                    </span>
                    <span className={compact ? 'text-gray-400 text-[10px]' : 'text-gray-400 text-xs'}>subs</span>
                  </div>
                </div>

                {/* Social Links - Horizontal on mobile */}
                {!chatCompact && hasSocialLinks && (
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
            {bio && !chatCompact && (
              <div className="bg-[#0f0f0f] rounded-xl p-3 border border-white/5">
                <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">{bio}</p>
              </div>
            )}

            {/* One-click Share URL */}
            {creatorProfileUrl ? (
              <div className={chatCompact ? 'mt-1 flex items-center gap-1.5' : 'mt-2 flex items-center gap-2'}>
                <div
                  className={
                    chatCompact
                      ? 'inline-flex w-fit max-w-[210px] items-center gap-1 rounded-full border border-white/[0.15] bg-black/35 px-1.5 py-0.5'
                      : 'inline-flex w-fit max-w-[230px] items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/35 px-2 py-1 shadow-[0_8px_22px_rgba(0,0,0,0.3)]'
                  }
                >
                  <span className="text-[9px] uppercase tracking-[0.16em] text-gray-400">
                    {chatCompact ? 'URL' : 'Share'}
                  </span>
                  <p className={chatCompact ? 'max-w-[120px] truncate text-[9px] text-gray-200' : 'max-w-[140px] truncate text-[10px] text-gray-200'}>
                    {creatorProfileUrl}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyCreatorUrl}
                    className={
                      chatCompact
                        ? 'inline-flex items-center justify-center rounded-full border border-white/[0.07] bg-[#1a1a1a] p-0.5 text-white hover:bg-[#242424] transition-colors'
                        : 'inline-flex items-center justify-center rounded-full border border-white/[0.07] bg-[#1a1a1a] p-1 text-white hover:bg-[#242424] transition-colors'
                    }
                    aria-label="Copy creator profile URL"
                    title="Copy URL"
                  >
                    <Copy className={chatCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                  </button>
                </div>
                {actionSlot ? <div className="shrink-0">{actionSlot}</div> : null}
              </div>
            ) : actionSlot ? (
              <div className="mt-2">{actionSlot}</div>
            ) : null}
          </div>

          {/* Desktop Layout */}
            <div className={isCompact ? 'hidden md:flex items-center gap-3' : 'hidden md:flex items-center gap-6'}>
              {/* Left: Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className={
                    chatCompact
                      ? 'w-14 h-14 rounded-xl overflow-hidden ring-1 ring-white/25 shadow-xl shadow-black/40'
                      : compact
                      ? 'w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-yellow-400/30 ring-offset-3 ring-offset-gray-900 shadow-xl shadow-yellow-500/10'
                      : 'w-28 h-28 rounded-2xl overflow-hidden ring-2 ring-yellow-400/30 ring-offset-4 ring-offset-gray-900 shadow-xl shadow-yellow-500/10'
                  }
                >
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
                <div className={chatCompact ? 'flex items-center gap-2 mb-1.5' : compact ? 'flex items-center gap-3 mb-2.5' : 'flex items-center gap-4 mb-3'}>
                <h2 className={chatCompact ? 'text-white font-semibold text-lg truncate' : compact ? 'text-white font-bold text-xl truncate' : 'text-white font-bold text-2xl truncate'}>{title}</h2>

                {/* Subscriber Count Badge */}
                <div className={chatCompact ? 'flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/[0.15] bg-black/35' : compact ? 'flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-400/15 to-teal-500/15 rounded-full border border-white/[0.07]' : 'flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400/15 to-teal-500/15 rounded-full border border-white/[0.07]'}>
                  <HiUsers className="w-5 h-5 text-yellow-400" />
                  <span className="text-white font-semibold">
                    {loadingCount ? (
                      <span className="inline-block w-10 h-5 bg-[#1a1a1a] rounded animate-pulse" />
                    ) : (
                      formatCount(subscriberCount)
                    )}
                  </span>
                  <span className={chatCompact ? 'text-gray-400 text-[11px]' : compact ? 'text-gray-400 text-xs' : 'text-gray-400 text-sm'}>subscribers</span>
                </div>
              </div>

              {/* Bio */}
              {bio && !chatCompact && (
                <div className="mb-4">
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-2">{bio}</p>
                </div>
              )}

              {/* One-click Share URL */}
              {creatorProfileUrl ? (
                <div className={chatCompact ? 'mb-1.5 flex items-center gap-2' : 'mb-3 flex items-center gap-2'}>
                  <div
                    className={
                      chatCompact
                        ? 'inline-flex w-fit max-w-[360px] items-center gap-1.5 rounded-full border border-white/[0.15] bg-black/35 px-2 py-1'
                        : 'inline-flex w-fit max-w-[460px] items-center gap-2 rounded-full border border-white/[0.07] bg-black/35 px-2.5 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.28)]'
                    }
                  >
                    <span className="text-[9px] uppercase tracking-[0.16em] text-gray-400">
                      {chatCompact ? 'URL' : 'Share'}
                    </span>
                    <p className={chatCompact ? 'max-w-[250px] truncate text-[10px] text-gray-200' : 'max-w-[320px] truncate text-[11px] text-gray-200'}>
                      {creatorProfileUrl}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyCreatorUrl}
                      className={chatCompact ? 'inline-flex items-center justify-center rounded-full border border-white/[0.07] bg-[#1a1a1a] p-1 text-white hover:bg-[#242424] transition-colors' : 'inline-flex items-center justify-center rounded-full border border-white/[0.07] bg-[#1a1a1a] p-1.5 text-white hover:bg-[#242424] transition-colors'}
                      aria-label="Copy creator profile URL"
                      title="Copy URL"
                    >
                      <Copy className={chatCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    </button>
                  </div>
                  {actionSlot ? <div className="shrink-0">{actionSlot}</div> : null}
                </div>
              ) : actionSlot ? (
                <div className="mb-3">{actionSlot}</div>
              ) : null}

              {/* Social Links Row */}
              {!chatCompact && hasSocialLinks && (
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
              {!chatCompact && !hasSocialLinks && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <HiGlobeAlt className="w-4 h-4" />
                  <span>No social links available</span>
                </div>
              )}
            </div>
          </div>
          </>
          )}
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
          <div className="fixed inset-x-0 bottom-0 z-50 bg-[#0f0f0f] border-t border-white/[0.07] rounded-t-2xl p-4 animate-slide-up md:hidden">
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.07]">
              {logo ? (
                typeof logo === 'string' ? (
                  <img src={logo} alt={title} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <Image src={logo} alt={title} width={48} height={48} className="rounded-full object-cover" />
                )
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-400 to-teal-500 flex items-center justify-center text-black font-bold">
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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0f0f0f] hover:bg-[#1a1a1a] transition-colors"
              >
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-white">Install Channel</span>
              </button>
              <button
                onClick={handleShare}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0f0f0f] hover:bg-[#1a1a1a] transition-colors"
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
