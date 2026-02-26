'use client';
import Link from 'next/link';
import { usePathname, useParams, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FaSackDollar } from 'react-icons/fa6';
import { FaTv } from 'react-icons/fa';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { X } from 'lucide-react';
import { getUserProfile } from '@/lib/supabase-service';
import { useChannel } from '@/context/ChannelContext';

const BottomNav = () => {
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const { selectedChannelId } = useChannel();
  const { user, authenticated, ready } = usePrivy();
  const [showShopModal, setShowShopModal] = useState(false);
  const [ownCreatorRouteId, setOwnCreatorRouteId] = useState<string>('');

  // Get current user's wallet address
  const currentUserAddress = useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length === 0) return '';
    
    // Check if primary login method is a wallet
    const firstAccount = user.linkedAccounts[0];
    if (firstAccount.type === 'wallet' && 'address' in firstAccount && firstAccount.address) {
      return firstAccount.address;
    }
    
    // Find a wallet from linked accounts
    const walletAccount = user.linkedAccounts.find((account: any) => account.type === 'wallet' && 'address' in account && account.address);
    if (walletAccount && 'address' in walletAccount && walletAccount.address) {
      return walletAccount.address;
    }
    
    return '';
  }, [user?.linkedAccounts]);

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

  const watchHref = useMemo(() => {
    // If currently on a creator route, "Watch" should go to that creator's main page.
    if (pathname?.startsWith('/creator/')) {
      const creatorIdParam = params?.creatorId as string | undefined;
      if (creatorIdParam) {
        const decoded = decodeURIComponent(creatorIdParam);
        return `/creator/${encodeURIComponent(decoded)}`;
      }
    }

    // Otherwise, send logged-in users to their own creator page.
    if (isLoggedIn && (ownCreatorRouteId || currentUserAddress)) {
      const routeId = ownCreatorRouteId || currentUserAddress;
      return `/creator/${encodeURIComponent(routeId)}`;
    }

    // Fallback when creator context is unavailable.
    return '/dashboard';
  }, [pathname, params, isLoggedIn, ownCreatorRouteId, currentUserAddress]);

  const activePlaybackId = useMemo(() => {
    const queryChannelId = searchParams?.get('channelId');
    const paramsPlaybackId = typeof params?.playbackId === 'string' ? decodeURIComponent(params.playbackId) : '';
    return queryChannelId || paramsPlaybackId || selectedChannelId || '';
  }, [params?.playbackId, searchParams, selectedChannelId]);

  const chatHref = useMemo(() => {
    const withChannel = (baseHref: string) =>
      activePlaybackId ? `${baseHref}?channelId=${encodeURIComponent(activePlaybackId)}` : baseHref;

    if (pathname?.startsWith('/creator/')) {
      const creatorIdParam = typeof params?.creatorId === 'string' ? decodeURIComponent(params.creatorId) : '';
      if (creatorIdParam) {
        return withChannel(`/creator/${encodeURIComponent(creatorIdParam)}/chat`);
      }
    }

    const dashboardRouteId = ownCreatorRouteId || currentUserAddress;
    if (dashboardRouteId) {
      return withChannel(`/dashboard/${encodeURIComponent(dashboardRouteId)}/chat`);
    }

    return '/dashboard';
  }, [activePlaybackId, currentUserAddress, ownCreatorRouteId, params?.creatorId, pathname]);

  const navItems = [
    {
      name: 'Shop',
      icon: FaSackDollar,
      onClick: () => setShowShopModal(true),
      isModal: true,
    },
    {
      name: 'Watch',
      href: watchHref,
      icon: FaTv,
      isModal: false,
    },
    {
      name: 'Chat',
      href: chatHref,
      icon: IoChatbubbleEllipsesOutline,
      isModal: false,
    },
  ];

  const activeItemName = useMemo(() => {
    if (showShopModal) return 'Shop';
    if (pathname?.includes('/chat')) return 'Chat';
    if (pathname?.startsWith('/creator/')) return 'Watch';

    if (pathname?.startsWith('/dashboard/')) {
      // Keep settings out of watch highlight so only true watch/chat routes glow.
      if (pathname.startsWith('/dashboard/settings')) return '';
      return 'Watch';
    }

    if (pathname?.startsWith('/dashboard')) return 'Watch';
    return '';
  }, [pathname, showShopModal]);

  return (
    <>
      <nav className="w-full bg-gradient-to-r from-black/75 via-gray-900/70 to-black/75 backdrop-blur-lg border-t border-white/10 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-around gap-2 px-4 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeItemName === item.name;
            
            if (item.isModal && item.onClick) {
              return (
                <button
                  key={item.name}
                  onClick={item.onClick}
                  className="flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all duration-200 min-w-[60px] flex-1 text-gray-300 hover:text-white hover:bg-white/10"
                >
                  <Icon className="w-5 h-5 mb-1 text-gray-300" />
                  <span className="text-[11px] font-medium text-gray-300">
                    {item.name}
                  </span>
                </button>
              );
            }
            
            return (
              <Link
                key={item.name}
                href={item.href || '#'}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all duration-200 min-w-[60px] flex-1 ${
                  active
                    ? 'bg-gradient-to-r from-yellow-500/25 to-teal-500/25 border border-yellow-400/30 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${active ? 'text-yellow-300' : 'text-gray-300'}`} />
                <span className={`text-[11px] font-semibold ${active ? 'text-white' : 'text-gray-300'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Shop Modal */}
      <Dialog.Root open={showShopModal} onOpenChange={setShowShopModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-white/20 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/20">
              <Dialog.Title className="text-white text-2xl font-bold">Shop</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                <FaSackDollar className="w-16 h-16 text-yellow-500 mb-4" />
                <h3 className="text-white text-xl font-semibold mb-2">Shop Coming Soon</h3>
                <p className="text-gray-400 text-sm">
                  The shop feature is currently under development. Check back soon for exciting updates!
                </p>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};

export default BottomNav;
