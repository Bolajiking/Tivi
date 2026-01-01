'use client';

import { LuArrowLeftFromLine, LuArrowRightFromLine } from 'react-icons/lu';
import Sidebar from './Sidebar';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { SupabaseStream } from '@/lib/supabase-types';

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
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [bottomSheetChannel, setBottomSheetChannel] = useState<SupabaseStream | null>(null);

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
        <div className="fixed left-0 inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        data-sidebar="true"
        className={clsx(
          'fixed md:relative z-40 left-0 h-full bg-black transition-all duration-300 ease-in-out border-r border-white/20 flex flex-col',
          {
            // Mobile states - use mobileExpanded instead of sidebarCollapsed
            'w-[70%] left-0': mobileMenuOpen && mobileExpanded, // Expanded sidebar for mobile
            'w-[20%] items-center': mobileMenuOpen && !mobileExpanded, // Collapsed sidebar for mobile (icons only)
            '-left-full': !mobileMenuOpen, // Hidden sidebar
          },
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/20">
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
            onChannelOptionsClick={(channel) => setBottomSheetChannel(channel)}
          />
        </div>
      </aside>

      {/* Bottom Sheet for Channel Options (Mobile) */}
      {bottomSheetChannel && (
        <div
          data-bottom-sheet="true"
          className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-white/20 rounded-t-2xl p-4 animate-slide-up md:hidden"
        >
          <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
            {bottomSheetChannel.logo ? (
              <img
                src={bottomSheetChannel.logo}
                alt={bottomSheetChannel.title || 'Channel'}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black font-bold">
                {(bottomSheetChannel.title || bottomSheetChannel.streamName || 'CH').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <p className="text-white font-semibold">{bottomSheetChannel.title || bottomSheetChannel.streamName || 'Channel'}</p>
            </div>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => {
                // Trigger PWA install
                const installEvent = new CustomEvent('installChannel', { detail: bottomSheetChannel });
                window.dispatchEvent(installEvent);
                setBottomSheetChannel(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-white">Install Channel</span>
            </button>
            <button
              onClick={() => {
                const channelUrl = `${window.location.origin}/creator/${bottomSheetChannel.creatorId}`;
                if (navigator.share) {
                  navigator.share({
                    title: bottomSheetChannel.title || bottomSheetChannel.streamName || 'Channel',
                    url: channelUrl,
                  });
                } else {
                  navigator.clipboard.writeText(channelUrl);
                  // Show toast
                  const toast = document.createElement('div');
                  toast.textContent = 'Link copied!';
                  toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg z-50';
                  document.body.appendChild(toast);
                  setTimeout(() => toast.remove(), 2000);
                }
                setBottomSheetChannel(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="text-white">Share Channel</span>
            </button>
          </div>
          <button
            onClick={() => setBottomSheetChannel(null)}
            className="w-full mt-4 py-3 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
