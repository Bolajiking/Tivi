'use client';
import Link from 'next/link';
import { usePathname, useParams, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, useMemo } from 'react';
import { FaSackDollar } from 'react-icons/fa6';
import { FaTv } from 'react-icons/fa';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { getUserProfile } from '@/lib/supabase-service';
import { useChannel } from '@/context/ChannelContext';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

const RESERVED_ROOT_SEGMENTS = new Set([
  'api',
  'auth',
  'creator',
  'dashboard',
  'player',
  'streamviews',
  'testin',
  'view',
  '_next',
]);

const BottomNav = () => {
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const { selectedChannelId } = useChannel();
  const { authenticated, ready } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const [ownCreatorRouteId, setOwnCreatorRouteId] = useState<string>('');

  // Get current user's wallet address
  const currentUserAddress = useMemo(() => walletAddress || '', [walletAddress]);

  const isLoggedIn = authenticated && ready && !!currentUserAddress;

  // Resolve current user's creator route id (prefer username, fallback wallet)
  useEffect(() => {
    let cancelled = false;

    const resolveOwnCreatorRoute = async () => {
      if (!isLoggedIn || !currentUserAddress) {
        setOwnCreatorRouteId('');
        return;
      }

      try {
        const profile = await getUserProfile(currentUserAddress);
        if (!cancelled) {
          const routeId = profile?.displayName?.trim() || currentUserAddress;
          setOwnCreatorRouteId(routeId);
        }
      } catch (error) {
        console.error('Error resolving creator route ID:', error);
        if (!cancelled) {
          setOwnCreatorRouteId(currentUserAddress);
        }
      }
    };

    resolveOwnCreatorRoute();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, currentUserAddress]);

  const activePlaybackId = useMemo(() => {
    const queryChannelId = searchParams?.get('channelId');
    const paramsPlaybackId = typeof params?.playbackId === 'string' ? decodeURIComponent(params.playbackId) : '';
    return queryChannelId || paramsPlaybackId || selectedChannelId || '';
  }, [params?.playbackId, searchParams, selectedChannelId]);

  const currentRouteCreatorId = useMemo(() => {
    const creatorIdParam = typeof params?.creatorId === 'string' ? decodeURIComponent(params.creatorId) : '';
    const segments = pathname?.split('/').filter(Boolean) || [];
    const first = segments[0]?.toLowerCase() || '';

    // Derive creator from pathname first so routing stays stable even before params hydrate.
    if (segments[0] === 'creator' && segments[1]) {
      return decodeURIComponent(segments[1]);
    }

    // Canonical creator watch route: /{username}
    if (segments.length === 1 && !RESERVED_ROOT_SEGMENTS.has(first)) {
      return decodeURIComponent(segments[0]);
    }

    // Fallbacks in case pathname shape is unusual but params are present.
    if (pathname?.startsWith('/creator/') && creatorIdParam) {
      return creatorIdParam;
    }

    return '';
  }, [params?.creatorId, pathname]);

  const watchHref = useMemo(() => {
    // If currently scoped to a creator channel, keep navigation pinned to that channel.
    // Canonical watch URL is /{creatorId}.
    if (currentRouteCreatorId) {
      const base = `/${encodeURIComponent(currentRouteCreatorId)}`;
      return activePlaybackId ? `${base}?channelId=${encodeURIComponent(activePlaybackId)}` : base;
    }

    // Otherwise, send logged-in users to their own creator page.
    if (isLoggedIn && (ownCreatorRouteId || currentUserAddress)) {
      const routeId = ownCreatorRouteId || currentUserAddress;
      return `/${encodeURIComponent(routeId)}`;
    }

    // Fallback when creator context is unavailable.
    return '/dashboard';
  }, [currentRouteCreatorId, isLoggedIn, ownCreatorRouteId, currentUserAddress, activePlaybackId]);

  const chatHref = useMemo(() => {
    const withChannel = (baseHref: string) =>
      activePlaybackId ? `${baseHref}?channelId=${encodeURIComponent(activePlaybackId)}` : baseHref;

    if (currentRouteCreatorId) {
      return withChannel(`/creator/${encodeURIComponent(currentRouteCreatorId)}/chat`);
    }

    if (!isLoggedIn) {
      return '/dashboard';
    }

    const dashboardRouteId = ownCreatorRouteId || currentUserAddress;
    if (dashboardRouteId) {
      // Canonical dashboard chat URL (selected channel is resolved from context/fallback in the page).
      return `/dashboard/${encodeURIComponent(dashboardRouteId)}/chat`;
    }

    return '/dashboard';
  }, [activePlaybackId, currentRouteCreatorId, currentUserAddress, isLoggedIn, ownCreatorRouteId]);

  // Shop navigates to the standalone store page
  const shopHref = useMemo(() => {
    // If scoped to a creator page, stay on that creator's store and preserve channel selection.
    if (currentRouteCreatorId) {
      const base = `/creator/${encodeURIComponent(currentRouteCreatorId)}/store`;
      return activePlaybackId ? `${base}?channelId=${encodeURIComponent(activePlaybackId)}` : base;
    }

    // If on dashboard and authenticated, link to own store management page
    if (isLoggedIn && pathname?.startsWith('/dashboard/')) {
      const dashboardCreatorId = params?.creatorId as string | undefined;
      if (dashboardCreatorId) {
        return `/dashboard/${encodeURIComponent(decodeURIComponent(dashboardCreatorId))}/store`;
      }
    }

    // If logged in, link to own dashboard store
    if (isLoggedIn && (ownCreatorRouteId || currentUserAddress)) {
      const routeId = ownCreatorRouteId || currentUserAddress;
      return `/dashboard/${encodeURIComponent(routeId)}/store`;
    }

    return '/dashboard';
  }, [pathname, params, currentRouteCreatorId, isLoggedIn, ownCreatorRouteId, currentUserAddress, activePlaybackId]);

  const navItems = [
    {
      name: 'Shop',
      href: shopHref,
      icon: FaSackDollar,
    },
    {
      name: 'Watch',
      href: watchHref,
      icon: FaTv,
    },
    {
      name: 'Chat',
      href: chatHref,
      icon: IoChatbubbleEllipsesOutline,
    },
  ];

  const activeItemName = useMemo(() => {
    const segments = pathname?.split('/').filter(Boolean) || [];
    const isRootCreatorPage =
      segments.length === 1 && !RESERVED_ROOT_SEGMENTS.has((segments[0] || '').toLowerCase());

    if (pathname?.includes('/store')) return 'Shop';
    if (pathname?.includes('/chat')) return 'Chat';
    if (pathname?.startsWith('/creator/')) return 'Watch';
    if (isRootCreatorPage) return 'Watch';

    if (pathname?.startsWith('/dashboard/')) {
      if (pathname.startsWith('/dashboard/settings')) return '';
      return 'Watch';
    }

    if (pathname?.startsWith('/dashboard')) return 'Watch';
    return '';
  }, [pathname]);

  return (
    <nav className="w-full bg-[#0f0f0f] border-t border-white/[0.07]">
      <div className="flex items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeItemName === item.name;

          return (
            <Link
              key={item.name}
              href={item.href || '#'}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center py-2 px-4 min-w-[60px] flex-1 rounded-lg transition-all duration-150"
            >
              <Icon className={`w-5 h-5 mb-0.5 ${active ? 'text-[#facc15]' : 'text-[#555]'}`} />
              <span className={`text-[11px] ${active ? 'text-[#facc15] font-semibold' : 'text-[#555] font-medium'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
