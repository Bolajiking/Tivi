'use client';

import { LuArrowLeftFromLine, LuArrowRightFromLine } from 'react-icons/lu';
import Sidebar from './Sidebar';
import SidebarBottomLinks from './SidebarBottomLinks';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { SupabaseStream } from '@/lib/supabase-types';
import { getUserProfile } from '@/lib/supabase-service';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ChannelOptionsSheetState {
  channel: SupabaseStream;
  isOwned: boolean;
  profileIdentifier?: string;
}

interface MobileSidebarProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export default function MobileSidebar({
  sidebarCollapsed,
  toggleSidebar,
  mobileMenuOpen,
  setMobileMenuOpen,
}: MobileSidebarProps) {
  const router = useRouter();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [bottomSheetChannel, setBottomSheetChannel] = useState<ChannelOptionsSheetState | null>(null);

  const closeMenus = () => {
    setBottomSheetChannel(null);
    setMobileMenuOpen(false);
  };

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (mobileMenuOpen && !target.closest('[data-sidebar="true"]') && !target.closest('[data-bottom-sheet="true"]')) {
        setMobileMenuOpen(false);
        setBottomSheetChannel(null);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling when sidebar is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen, setMobileMenuOpen]);

  const handleToggleMobileExpand = () => {
    setMobileExpanded(!mobileExpanded);
  };

  return (
    <>
      {/* Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed left-0 inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden"
          onClick={() => closeMenus()}
        />
      )}

      {/* Sidebar */}
      <aside
        data-sidebar="true"
        className={clsx(
          'fixed md:relative z-40 left-0 h-full bg-gradient-to-b from-black via-gray-950 to-black transition-all duration-300 ease-in-out border-r border-white/20 flex flex-col shadow-2xl',
          {
            // Mobile states - use mobileExpanded instead of sidebarCollapsed
            'w-[70%] left-0': mobileMenuOpen && mobileExpanded, // Expanded sidebar for mobile
            'w-[20%] items-center': mobileMenuOpen && !mobileExpanded, // Collapsed sidebar for mobile (icons only)
            '-left-full': !mobileMenuOpen, // Hidden sidebar
          },
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/20 bg-white/5">
          {mobileExpanded && (
            <div className="transition-all ease-in-out duration-500 font-bold flex justify-center items-center uppercase text-white">
              <h1>TVinBio</h1>
            </div>
          )}

          {/* Mobile toggle button */}
          <button onClick={handleToggleMobileExpand} className="ml-auto block">
            {!mobileExpanded ? (
              <LuArrowRightFromLine className="h-5 w-5 text-[#fff]" />
            ) : (
              <LuArrowLeftFromLine className="h-5 w-5 text-[#fff]" />
            )}
          </button>
        </div>
        <div className="px-2 overflow-y-auto flex-1">
          <Sidebar
            sidebarCollapsed={!mobileExpanded}
            isMobileView={true}
            onChannelOptionsClick={(channel, options) =>
              setBottomSheetChannel({
                channel,
                isOwned: Boolean(options?.isOwned),
                profileIdentifier: options?.profileIdentifier,
              })
            }
          />
        </div>

        <div className="shrink-0 border-t border-white/20 bg-white/5 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <SidebarBottomLinks sidebarCollapsed={!mobileExpanded} />
        </div>
      </aside>

      {/* Bottom Sheet for Channel Options (Mobile) */}
      {bottomSheetChannel && (
        <div
          data-bottom-sheet="true"
          className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-white/20 rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-slide-up md:hidden"
        >
          <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
            {bottomSheetChannel.channel.logo ? (
              <img
                src={bottomSheetChannel.channel.logo}
                alt={bottomSheetChannel.channel.title || 'Channel'}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black font-bold">
                {(bottomSheetChannel.channel.title || bottomSheetChannel.channel.streamName || 'CH').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <p className="text-white font-semibold">{bottomSheetChannel.channel.title || bottomSheetChannel.channel.streamName || 'Channel'}</p>
            </div>
          </div>
          <div className="space-y-2">
            {bottomSheetChannel.isOwned ? (
              <button
                onClick={() => {
                  router.push(
                    bottomSheetChannel.channel.playbackId
                      ? `/dashboard/settings?channelId=${encodeURIComponent(bottomSheetChannel.channel.playbackId)}`
                      : '/dashboard/settings',
                  );
                  closeMenus();
                }}
                className="w-full flex min-h-12 items-center gap-3 rounded-lg bg-white/5 px-4 py-3 text-left hover:bg-white/10 transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317a1 1 0 011.35-.936l1.175.47a1 1 0 00.95 0l1.175-.47a1 1 0 011.35.936l.176 1.268a1 1 0 00.57.757l1.13.565a1 1 0 01.447 1.341l-.56 1.121a1 1 0 000 .894l.56 1.121a1 1 0 01-.447 1.341l-1.13.565a1 1 0 00-.57.757l-.176 1.268a1 1 0 01-1.35.936l-1.175-.47a1 1 0 00-.95 0l-1.175.47a1 1 0 01-1.35-.936l-.176-1.268a1 1 0 00-.57-.757l-1.13-.565a1 1 0 01-.447-1.341l.56-1.121a1 1 0 000-.894l-.56-1.121a1 1 0 01.447-1.341l1.13-.565a1 1 0 00.57-.757l.176-1.268z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
                <span className="text-white">Settings</span>
              </button>
            ) : null}
            <button
              onClick={() => {
                // Trigger PWA install
                const installEvent = new CustomEvent('installChannel', { detail: bottomSheetChannel.channel });
                window.dispatchEvent(installEvent);
                closeMenus();
              }}
              className="w-full flex min-h-12 items-center gap-3 rounded-lg bg-white/5 px-4 py-3 text-left hover:bg-white/10 transition-colors touch-manipulation"
            >
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-white">Install</span>
            </button>
            <button
              onClick={async () => {
                let creatorRouteId = bottomSheetChannel.profileIdentifier?.trim() || '';
                try {
                  if (!creatorRouteId) {
                    const creator = await getUserProfile(bottomSheetChannel.channel.creatorId);
                    creatorRouteId = creator?.displayName?.trim() || '';
                  }
                } catch (error) {
                  console.error('Failed to resolve creator username:', error);
                }

                if (!creatorRouteId) {
                  toast.error('Creator username unavailable');
                  closeMenus();
                  return;
                }

                const channelUrl = `${window.location.origin}/creator/${encodeURIComponent(creatorRouteId)}`;
                if (navigator.share) {
                  await navigator.share({
                    title:
                      bottomSheetChannel.channel.title ||
                      bottomSheetChannel.channel.streamName ||
                      'Channel',
                    url: channelUrl,
                  }).catch(() => undefined);
                } else {
                  await navigator.clipboard.writeText(channelUrl);
                  toast.success('Link copied!');
                }
                closeMenus();
              }}
              className="w-full flex min-h-12 items-center gap-3 rounded-lg bg-white/5 px-4 py-3 text-left hover:bg-white/10 transition-colors touch-manipulation"
            >
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="text-white">Share</span>
            </button>
          </div>
          <button
            onClick={() => closeMenus()}
            className="w-full mt-4 py-3 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
