'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import { useChannel } from '@/context/ChannelContext';
import { getUserProfile, getStreamsByCreator } from '@/lib/supabase-service';
import { CreatorStore } from '@/components/templates/store/CreatorStore';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import MobileSidebar from '@/components/MobileSidebar';
import Spinner from '@/components/Spinner';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardStorePage() {
  const params = useParams();
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const { selectedChannelId, setSelectedChannelId } = useChannel();
  const dashboardRouteCreatorId = typeof params?.creatorId === 'string' ? decodeURIComponent(params.creatorId) : '';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatorUsername, setCreatorUsername] = useState<string | null>(null);
  const [channels, setChannels] = useState<any[]>([]);

  const creatorAddress = useMemo(() => walletAddress || null, [walletAddress]);

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/dashboard');
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!ready || authenticated) return;
    if (selectedChannelId) {
      setSelectedChannelId(null);
    }
  }, [ready, authenticated, selectedChannelId, setSelectedChannelId]);

  useEffect(() => {
    const resolve = async () => {
      if (!creatorAddress) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const profile = await getUserProfile(creatorAddress);
        setCreatorUsername(profile?.displayName?.trim() || null);

        const streams = await getStreamsByCreator(creatorAddress);
        setChannels(streams);

        if (!selectedChannelId && streams.length > 0) {
          setSelectedChannelId(streams[0].playbackId);
        }
      } catch (err) {
        console.error('Failed to resolve store data:', err);
      } finally {
        setLoading(false);
      }
    };
    if (ready && authenticated) resolve();
  }, [ready, authenticated, creatorAddress, selectedChannelId, setSelectedChannelId]);

  const activeChannel = useMemo(() => {
    if (!selectedChannelId) return channels[0] || null;
    return channels.find((c: any) => c.playbackId === selectedChannelId) || channels[0] || null;
  }, [channels, selectedChannelId]);

  if (!ready) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#080808]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      {mobileMenuOpen && (
        <MobileSidebar
          sidebarCollapsed={false}
          toggleSidebar={() => {}}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 w-full max-w-none mx-0 flex flex-col relative my-0 md:my-2 mx-0 md:px-2">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
              <Header
                toggleMenu={() => setMobileMenuOpen((x) => !x)}
                mobileOpen={mobileMenuOpen}
              />

              <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
                {/* Back link */}
                <button
                  onClick={() => {
                    const routeId = creatorUsername || dashboardRouteCreatorId;
                    router.push(routeId ? `/dashboard/${encodeURIComponent(routeId)}` : '/dashboard');
                  }}
                  className="mb-5 text-[13px] text-[#888] hover:text-white transition-colors"
                >
                  &larr; Back to dashboard
                </button>

                <div className="mb-6">
                  <h1 className="text-2xl md:text-3xl font-bold text-white font-funnel-display">
                    My Store
                  </h1>
                  <p className="text-[14px] text-[#888] mt-1">
                    Manage your products and storefront.
                  </p>
                </div>

                {channels.length > 1 && (
                  <div className="mb-6 flex flex-wrap gap-2">
                    {channels.map((ch: any) => (
                      <button
                        key={ch.playbackId}
                        onClick={() => setSelectedChannelId(ch.playbackId)}
                        className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border ${
                          activeChannel?.playbackId === ch.playbackId
                            ? 'bg-[#facc15]/10 border-[#facc15]/40 text-[#facc15]'
                            : 'bg-[#1a1a1a] border-white/[0.07] text-[#888] hover:text-white'
                        }`}
                      >
                        {ch.title || ch.streamName || ch.playbackId?.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                )}

                {!authenticated ? (
                  <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-8 text-center">
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">Store preview locked</h3>
                      <p className="max-w-md text-sm text-gray-300">
                        Sign in to manage store pages for your channel.
                      </p>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-8 w-24 rounded-lg bg-[#1a1a1a]" />
                      <Skeleton className="h-10 w-32 rounded-lg bg-[#1a1a1a]" />
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
                ) : activeChannel && creatorAddress ? (
                  <CreatorStore
                    playbackId={activeChannel.playbackId}
                    creatorId={creatorAddress}
                  />
                ) : (
                  <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-8 text-center">
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">No channel found</h3>
                      <p className="max-w-md text-sm text-gray-300">
                        Create a channel first, then come back to set up your store.
                      </p>
                      <button
                        onClick={() => router.push('/dashboard/settings')}
                        className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black font-semibold rounded-lg transition-all duration-200"
                      >
                        Create channel
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
