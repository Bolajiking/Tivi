'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Header from '@/components/Header';
import MobileSidebar from '@/components/MobileSidebar';
import { ProfileCustomization } from './ProfileCustomization';
import BottomNav from '@/components/BottomNav';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { getAllStreams } from '@/features/streamAPI';
import { getAssets } from '@/features/assetsAPI';
import { useViewerMetrics } from '@/app/hook/useViewerMetrics';
import { usePlaybackMetrics } from '@/app/hook/usePlaybackView';
import { ArrowUpRight, ArrowDownRight, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSubscribers } from '@/lib/supabase-service';
import type { SupabaseUser } from '@/lib/supabase-types';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

/* ─── Analytics sub-components (redesigned) ─── */

const AnalyticCard = ({
  title,
  value,
}: {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
}) => (
  <div className="rounded-xl bg-raised border border-white/[0.07] p-4">
    <span className="text-[13px] text-[var(--text-2)]">{title}</span>
    <p className="text-[22px] font-bold text-white mt-1 tracking-tight">{value}</p>
  </div>
);

const MetricCard = ({ playbackId, name, type }: { playbackId: string; name: string; type: 'stream' | 'asset' }) => {
  const { views, loading, error } = usePlaybackMetrics(playbackId);

  return (
    <div className="flex-shrink-0 w-[240px] rounded-xl border border-white/[0.07] bg-raised flex flex-col justify-between p-4 gap-y-3 h-[150px]">
      <div>
        <p className="text-[15px] font-semibold text-white break-words line-clamp-2">{name}</p>
        <p className="text-[12px] text-[var(--text-3)] capitalize mt-0.5">{type}</p>
      </div>
      {error ? (
        <p className="text-[12px] text-[var(--error)]">{error}</p>
      ) : (
        <div>
          <p className="text-[28px] font-bold text-white tracking-tight">{views?.viewCount ?? 0}</p>
          <p className="text-[12px] text-[var(--text-3)]">total views</p>
        </div>
      )}
    </div>
  );
};

const PerformanceTable = ({ metrics, loading }: { metrics: any; loading: boolean }) => {
  const metricItems = [
    { title: 'Total views', value: metrics?.viewCount?.toString() ?? '0', trend: 'up' },
    { title: 'Playtime (min)', value: metrics?.playtimeMins?.toFixed(2) ?? '0', trend: 'up' },
    { title: 'Time to first frame (ms)', value: metrics?.ttffMs?.toFixed(0) ?? '0', trend: 'down' },
    { title: 'Rebuffer ratio (%)', value: ((metrics?.rebufferRatio ?? 0) * 100).toFixed(2), trend: 'down' },
    { title: 'Error rate (%)', value: ((metrics?.errorRate ?? 0) * 100).toFixed(2), trend: 'down' },
    { title: 'Exits before start', value: metrics?.exitsBeforeStart?.toString() ?? '0', trend: 'down' },
  ];

  if (loading && !metrics?.viewCount) {
    return (
      <div className="space-y-3">
        <h3 className="text-[15px] font-semibold text-white">Performance</h3>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full bg-raised rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-white mb-3">Performance</h3>
      <div className="rounded-xl border border-white/[0.07] overflow-hidden">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="py-2.5 px-4 text-left text-[13px] font-medium text-[var(--text-2)]">Metric</th>
              <th className="py-2.5 px-4 text-left text-[13px] font-medium text-[var(--text-2)]">Value</th>
              <th className="py-2.5 px-4 text-left text-[13px] font-medium text-[var(--text-2)]">Trend</th>
            </tr>
          </thead>
          <tbody>
            {metricItems.map((item, idx) => (
              <tr key={idx} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4 text-white">{item.title}</td>
                <td className="py-3 px-4 text-[var(--text-2)]">{item.value}</td>
                <td className="py-3 px-4">
                  {item.trend === 'up' ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── Main Settings Component ─── */

const Settings: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'analytics'>('settings');
  const [showSubscribers, setShowSubscribers] = useState(false);
  const { authenticated, ready } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const dispatch = useDispatch<AppDispatch>();
  const { streams } = useSelector((state: RootState) => state.streams);
  const { assets } = useSelector((state: RootState) => state.assets);
  const [subscribers, setSubscribers] = useState<SupabaseUser[]>([]);
  const [subscribersLoading, setSubscribersLoading] = useState(false);

  const creatorId = useMemo(() => walletAddress || '', [walletAddress]);

  const creatorStreams = streams.filter((stream: any) => {
    if (!stream.playbackId) return false;
    const addr = creatorId.toLowerCase();
    return stream.creatorId?.value?.toLowerCase() === addr || stream.supabaseCreatorId?.toLowerCase() === addr;
  });
  const creatorAssets = assets.filter((asset: any) => {
    if (!asset.playbackId) return false;
    const addr = creatorId.toLowerCase();
    return asset.creatorId?.value?.toLowerCase() === addr || asset.supabaseCreatorId?.toLowerCase() === addr;
  });

  const { viewMetrics, loading: metricsLoading } = useViewerMetrics({ filter: 'all' });

  useEffect(() => {
    dispatch(getAllStreams());
    dispatch(getAssets());
  }, [dispatch]);

  useEffect(() => {
    const fetchSubscribers = async () => {
      if (!creatorId) { setSubscribers([]); return; }
      try {
        setSubscribersLoading(true);
        const data = await getSubscribers(creatorId);
        setSubscribers(data);
      } catch (error) {
        console.error('Failed to load subscribers:', error);
        setSubscribers([]);
      } finally {
        setSubscribersLoading(false);
      }
    };
    fetchSubscribers();
  }, [creatorId]);

  const insightsData = [
    { title: 'Total streams', value: creatorStreams.length },
    { title: 'Total videos', value: creatorAssets.length },
    { title: 'Total views', value: viewMetrics?.viewCount ?? 0 },
    { title: 'Playtime (min)', value: viewMetrics?.playtimeMins?.toFixed(1) ?? '0' },
  ];

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  if (!ready || !authenticated) {
    return (
      <div className="flex justify-center items-center h-screen bg-canvas">
        <div className="animate-pulse space-y-3 w-60">
          <div className="h-4 bg-raised rounded w-3/4 mx-auto" />
          <div className="h-4 bg-raised rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      {mobileMenuOpen && (
        <MobileSidebar
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
          <div className="mx-auto w-full max-w-[860px] px-4 pt-14 pb-8 md:px-6 md:pt-8">

            {/* ── Tab bar — weight-based, no fills ── */}
            <div className="flex items-center gap-6 mb-8 border-b border-white/[0.07]">
              {(['settings', 'analytics'] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-[15px] capitalize transition-colors ${
                      isActive
                        ? 'text-white font-semibold'
                        : 'text-[var(--text-3)] font-normal hover:text-[var(--text-2)]'
                    }`}
                  >
                    {tab}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Settings tab ── */}
            {activeTab === 'settings' && <ProfileCustomization />}

            {/* ── Analytics tab ── */}
            {activeTab === 'analytics' && (
              <div className="space-y-8">
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {insightsData.map((item) => (
                    <AnalyticCard key={item.title} title={item.title} value={item.value} />
                  ))}
                </div>

                {/* Subscribers */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSubscribers((prev) => !prev)}
                    className="flex items-center gap-2 group"
                  >
                    <h3 className="text-[15px] font-semibold text-white">
                      Subscribers ({subscribers.length})
                    </h3>
                    <ChevronDown className={`w-4 h-4 text-[var(--text-3)] transition-transform ${showSubscribers ? 'rotate-180' : ''}`} />
                  </button>
                  <p className="text-[13px] text-[var(--text-3)] mt-1">Users currently subscribed to your channel.</p>

                  {showSubscribers && (
                    <div className="mt-3">
                      {subscribersLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-10 w-full bg-raised rounded-lg" />
                          ))}
                        </div>
                      ) : subscribers.length === 0 ? (
                        <p className="text-[var(--text-3)] text-[13px] py-4">No subscribers yet.</p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto space-y-1.5">
                          {subscribers.map((subscriber) => (
                            <div
                              key={subscriber.creatorId}
                              className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-raised px-4 py-2.5"
                            >
                              <div>
                                <p className="text-[14px] font-medium text-white">
                                  {subscriber.displayName || 'Unnamed subscriber'}
                                </p>
                                <p className="text-[12px] text-[var(--text-3)]">{subscriber.creatorId}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Stream Metrics */}
                {creatorStreams.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[15px] font-semibold text-white">Stream metrics</h3>
                    <div className="flex overflow-x-auto pb-2 gap-3 -mx-1 px-1">
                      {creatorStreams.map((stream: any) => (
                        <MetricCard key={stream.id} playbackId={stream.playbackId} name={stream.name || stream.title} type="stream" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Video Metrics */}
                {creatorAssets.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[15px] font-semibold text-white">Video metrics</h3>
                    <div className="flex overflow-x-auto pb-2 gap-3 -mx-1 px-1">
                      {creatorAssets.map((asset: any) => (
                        <MetricCard key={asset.id} playbackId={asset.playbackId} name={asset.name} type="asset" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Performance Table */}
                <PerformanceTable metrics={viewMetrics || {}} loading={metricsLoading} />

                {/* Empty State */}
                {creatorStreams.length === 0 && creatorAssets.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-full bg-raised flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                    <p className="text-[15px] text-[var(--text-2)] font-medium">No content yet</p>
                    <p className="text-[13px] text-[var(--text-3)] mt-1">Start creating streams or uploading videos to see analytics.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="w-full flex-shrink-0">
          <BottomNav />
        </div>
      </div>
    </div>
  );
};

export default Settings;
