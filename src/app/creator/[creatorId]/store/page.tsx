'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import {
  getUserProfile,
  getUserProfileByUsername,
  getStreamsByCreator,
} from '@/lib/supabase-service';
import { PublicStoreView } from '@/components/templates/store/PublicStoreView';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Sidebar from '@/components/Sidebar';
import SidebarBottomLinks from '@/components/SidebarBottomLinks';
import SidebarUserPanel from '@/components/SidebarUserPanel';
import Logo from '@/components/Logo';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import clsx from 'clsx';

export default function CreatorStorePage() {
  const params = useParams();
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const searchParams = useSearchParams();
  const creatorId = typeof params?.creatorId === 'string' ? decodeURIComponent(params.creatorId) : '';
  const urlChannelId = searchParams?.get('channelId') || null;

  const [loading, setLoading] = useState(true);
  const [actualCreatorId, setActualCreatorId] = useState<string | null>(null);
  const [primaryPlaybackId, setPrimaryPlaybackId] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);

  const currentUserAddress = useMemo(() => walletAddress || '', [walletAddress]);

  const isCreator = useMemo(() => {
    if (!currentUserAddress || !actualCreatorId) return false;
    return currentUserAddress.toLowerCase() === actualCreatorId.toLowerCase();
  }, [currentUserAddress, actualCreatorId]);

  useEffect(() => {
    const resolve = async () => {
      try {
        setLoading(true);
        let user = await getUserProfileByUsername(creatorId);
        if (!user) {
          user = await getUserProfile(creatorId);
        }
        if (!user) {
          setLoading(false);
          return;
        }

        const wallet = user.creatorId;
        setActualCreatorId(wallet);
        setCreatorName(user.displayName || creatorId);

        const streams = await getStreamsByCreator(wallet);
        if (streams.length > 0) {
          // Prefer channelId from URL (preserves selection from BottomNav navigation)
          if (urlChannelId) {
            const matched = streams.find((s: any) => s.playbackId === urlChannelId);
            setPrimaryPlaybackId(matched ? matched.playbackId : streams[0].playbackId);
          } else {
            setPrimaryPlaybackId(streams[0].playbackId);
          }
        }
      } catch (err) {
        console.error('Failed to resolve creator:', err);
      } finally {
        setLoading(false);
      }
    };
    if (creatorId) resolve();
  }, [creatorId, urlChannelId]);

  // Redirect creator viewing own store to dashboard store
  useEffect(() => {
    if (!isCreator) return;
    const username = creatorName || creatorId;
    router.replace(`/dashboard/${encodeURIComponent(username)}/store`);
  }, [isCreator, creatorName, creatorId, router]);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
      return;
    }
    setSidebarCollapsed((prev) => !prev);
  };

  const toggleSidebarProfile = () => {
    setSidebarProfileOpen((prev) => {
      const next = !prev;
      if (next && !isMobile && sidebarCollapsed) {
        setSidebarCollapsed(false);
      }
      return next;
    });
  };

  // Derive the page title for the header
  const pageTitle = creatorName ? `${creatorName}'s Store` : 'Store';

  // Render the inner content based on state
  const renderContent = () => {
    if (loading) {
      return (
        <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
          <Skeleton className="h-4 w-32 rounded-md bg-[#1a1a1a] mb-5" />
          <Skeleton className="h-8 w-48 rounded-lg bg-[#1a1a1a] mb-2" />
          <Skeleton className="h-4 w-64 rounded-md bg-[#1a1a1a] mb-6" />
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-20 rounded-lg bg-[#1a1a1a]" />
              <Skeleton className="h-5 w-16 rounded-md bg-[#1a1a1a]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square w-full rounded-xl bg-[#1a1a1a]" />
                  <Skeleton className="h-4 w-3/4 rounded-md bg-[#1a1a1a]" />
                  <Skeleton className="h-5 w-20 rounded-md bg-[#1a1a1a]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (!actualCreatorId || !primaryPlaybackId) {
      return (
        <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
          {/* Back link */}
          <button
            onClick={() => router.push(`/creator/${encodeURIComponent(creatorId)}`)}
            className="mb-5 text-[13px] text-[#888] hover:text-white transition-colors"
          >
            &larr; Back to {creatorName || 'channel'}
          </button>

          <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-8 text-center mt-8">
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="rounded-full border border-white/[0.07] bg-[#0f0f0f] p-3 text-[#888]">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Store not available</h3>
              <p className="max-w-md text-sm text-gray-300">
                This creator doesn&apos;t have a store yet.
              </p>
              <button
                onClick={() => router.push(`/creator/${encodeURIComponent(creatorId)}`)}
                className="mt-2 px-4 py-2 rounded-lg bg-[#0f0f0f] border border-white/[0.07] text-white text-sm font-medium hover:bg-[#242424] transition-colors"
              >
                Back to channel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
        {/* Back link */}
        <button
          onClick={() => router.push(`/creator/${encodeURIComponent(creatorId)}`)}
          className="mb-5 text-[13px] text-[#888] hover:text-white transition-colors"
        >
          &larr; Back to {creatorName || 'channel'}
        </button>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white font-funnel-display">
            {creatorName}&apos;s Store
          </h1>
          <p className="text-[14px] text-[#888] mt-1">
            Browse and purchase products from this creator.
          </p>
        </div>

        <PublicStoreView
          playbackId={primaryPlaybackId}
          creatorId={actualCreatorId}
        />
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      {/* Sidebar */}
      <aside
        className={clsx(
          'md:relative z-20 h-full md:block px-2.5 py-2 gap-y-2.5 transition-all duration-300 ease-in-out border-r border-white/[0.07] flex flex-col bg-[#1a1a1a] overflow-hidden',
          {
            'w-[80px]': sidebarCollapsed && !isMobile,
            'w-[240px]': !sidebarCollapsed && !isMobile,
            hidden: isMobile && !mobileMenuOpen,
            block: isMobile && mobileMenuOpen,
          },
        )}
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.07]">
          <div className={clsx('pt-0.5', sidebarCollapsed && 'hidden')}>
            <Logo size="sm" iconOnly />
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07] bg-[#0f0f0f] text-gray-300 hover:text-white hover:bg-[#1a1a1a] transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <Sidebar sidebarCollapsed={sidebarCollapsed} />
        </div>
        <div className={clsx(
          'z-30 border-t border-white/[0.07] transition-all duration-300',
          {
            'fixed bottom-0 left-0 w-[80px]': sidebarCollapsed && !isMobile,
            'fixed bottom-0 left-0 w-[240px]': !sidebarCollapsed && !isMobile,
            'mt-auto w-full': isMobile,
          }
        )}>
          <SidebarBottomLinks sidebarCollapsed={sidebarCollapsed} onProfileClick={toggleSidebarProfile} />
        </div>
        <SidebarUserPanel
          variant="sheet"
          open={sidebarProfileOpen}
          onClose={() => setSidebarProfileOpen(false)}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative gap-0 md:gap-4">
        <div className="flex-1 flex overflow-hidden gap-0 md:gap-4">
          <div className="flex-1 w-full max-w-[1380px] mx-auto flex flex-col relative my-0 md:my-2 mx-0 md:mx-2">
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
              <Header
                toggleMenu={() => setMobileMenuOpen((x) => !x)}
                mobileOpen={mobileMenuOpen}
                title={loading ? undefined : pageTitle}
              />

              {renderContent()}
            </div>

            {/* Bottom Navigation — pinned at bottom */}
            <div className="flex-shrink-0 z-10">
              <BottomNav />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
