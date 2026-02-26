'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Header from '@/components/Header';
import MobileSidebar from '@/components/MobileSidebar';
import { ProfileCustomization } from './ProfileCustomization';
import BottomNav from '@/components/BottomNav';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { IoSettingsOutline, IoStatsChartOutline } from 'react-icons/io5';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { getAllStreams } from '@/features/streamAPI';
import { getAssets } from '@/features/assetsAPI';
import { useViewerMetrics } from '@/app/hook/useViewerMetrics';
import { usePlaybackMetrics } from '@/app/hook/usePlaybackView';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSubscribers } from '@/lib/supabase-service';
import type { SupabaseUser } from '@/lib/supabase-types';

// Analytics Card Component
const AnalyticCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
}) => {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-xs">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
};

// Metric Card for individual streams/assets
const MetricCard = ({ playbackId, name, type }: { playbackId: string; name: string; type: 'stream' | 'asset' }) => {
  const { views, loading, error } = usePlaybackMetrics(playbackId);

  return (
    <div className="flex-shrink-0 w-[260px] border border-white/20 flex flex-col justify-between bg-white/10 backdrop-blur-sm rounded-lg p-4 gap-y-4 h-[160px]">
      <div>
        <p className="text-base font-bold text-white capitalize break-words line-clamp-2">{name}</p>
        <p className="text-xs text-gray-300 capitalize">{type}</p>
      </div>
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : (
        <div>
          <p className="text-3xl font-extrabold tracking-wide text-white">{views?.viewCount ?? 0} Views</p>
          <p className="text-xs flex items-center gap-1">
            <span className="text-gray-300">since start</span>
          </p>
        </div>
      )}
    </div>
  );
};

// Performance Table Component
const PerformanceTable = ({ metrics, loading }: { metrics: any; loading: boolean }) => {
  const metricItems = [
    {
      title: 'Total Views',
      value: metrics?.viewCount?.toString() ?? '0',
      trend: 'up',
    },
    {
      title: 'Playtime (min)',
      value: metrics?.playtimeMins?.toFixed(2) ?? '0',
      trend: 'up',
    },
    {
      title: 'Time to First Frame (ms)',
      value: metrics?.ttffMs?.toFixed(0) ?? '0',
      trend: 'down',
    },
    {
      title: 'Rebuffer Ratio (%)',
      value: ((metrics?.rebufferRatio ?? 0) * 100).toFixed(2),
      trend: 'down',
    },
    {
      title: 'Error Rate (%)',
      value: ((metrics?.errorRate ?? 0) * 100).toFixed(2),
      trend: 'down',
    },
    {
      title: 'Exits Before Start',
      value: metrics?.exitsBeforeStart?.toString() ?? '0',
      trend: 'down',
    },
  ];

  if (loading && !metrics?.viewCount) {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-4">
        <h1 className="font-semibold text-base text-white pb-4">Performance Metrics</h1>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full bg-white/20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-4">
      <h1 className="font-semibold text-base text-white pb-4">Performance Metrics</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="font-bold border-b border-white/20">
              <th className="py-2 text-left text-white">Metric</th>
              <th className="py-2 text-left text-white">Value</th>
              <th className="py-2 text-left text-white">Trend</th>
            </tr>
          </thead>
          <tbody>
            {metricItems.map((item, idx) => (
              <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                <td className="py-3 font-medium text-white">{item.title}</td>
                <td className="py-3 text-gray-200">{item.value}</td>
                <td className="py-3">
                  {item.trend === 'up' ? (
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
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

const Settings: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'analytics'>('settings');
  const [showSubscribers, setShowSubscribers] = useState(false);
  const { user, authenticated, ready } = usePrivy();
  const dispatch = useDispatch<AppDispatch>();
  const { streams } = useSelector((state: RootState) => state.streams);
  const { assets } = useSelector((state: RootState) => state.assets);
  const [subscribers, setSubscribers] = useState<SupabaseUser[]>([]);
  const [subscribersLoading, setSubscribersLoading] = useState(false);

  // Get current user's wallet address (creatorId)
  const creatorId = useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length === 0) return '';
    const firstAccount = user.linkedAccounts[0];
    if (firstAccount.type === 'wallet' && 'address' in firstAccount && firstAccount.address) {
      return firstAccount.address;
    }
    const walletAccount = user.linkedAccounts.find((account: any) => account.type === 'wallet' && 'address' in account && account.address);
    if (walletAccount && 'address' in walletAccount && walletAccount.address) {
      return walletAccount.address;
    }
    return '';
  }, [user?.linkedAccounts]);

  // Get all playback IDs for this creator
  const creatorStreams = streams.filter((stream: any) => stream.creatorId?.value === creatorId && !!stream.playbackId);
  const creatorAssets = assets.filter((asset: any) => asset.creatorId?.value === creatorId && !!asset.playbackId);
  const allPlaybackIds = [
    ...creatorStreams.map((s: any) => s.playbackId),
    ...creatorAssets.map((a: any) => a.playbackId),
  ].filter(Boolean);

  // Fetch aggregated metrics
  const { viewMetrics, loading: metricsLoading } = useViewerMetrics({ filter: 'all' });

  // Fetch streams and assets on mount
  useEffect(() => {
    dispatch(getAllStreams());
    dispatch(getAssets());
  }, [dispatch]);

  useEffect(() => {
    const fetchSubscribers = async () => {
      if (!creatorId) {
        setSubscribers([]);
        return;
      }

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

  // Summary data for analytics
  const insightsData = [
    { title: 'Total Streams', value: creatorStreams.length },
    { title: 'Total Videos', value: creatorAssets.length },
    { title: 'Total Views', value: viewMetrics?.viewCount ?? 0 },
    { title: 'Playtime (min)', value: viewMetrics?.playtimeMins?.toFixed(1) ?? '0' },
  ];

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  if (!ready || !authenticated) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-black via-gray-950 to-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-black via-gray-950 to-black">
      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <MobileSidebar
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-auto pb-20">
          <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
          <div className="m-4 p-6">
            {/* Tabs for Settings and Analytics */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'settings' | 'analytics')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/10 backdrop-blur-sm border border-white/20 p-1 mb-6">
                <TabsTrigger
                  value="settings"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-teal-500 data-[state=active]:text-black text-white"
                >
                  <IoSettingsOutline className="w-4 h-4" />
                  Settings
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-teal-500 data-[state=active]:text-black text-white"
                >
                  <IoStatsChartOutline className="w-4 h-4" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              {/* Settings Tab - Original Profile Customization */}
              <TabsContent value="settings">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                  <ProfileCustomization />
                </div>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {insightsData.map((item) => (
                    <AnalyticCard key={item.title} title={item.title} value={item.value} />
                  ))}
                </div>

                {/* Subscribers List */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-white font-semibold text-lg">Subscribers ({subscribers.length})</h3>
                      <p className="text-gray-400 text-sm mt-1">Users currently subscribed to your channel.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSubscribers((prev) => !prev)}
                      className="rounded-md bg-gradient-to-r from-yellow-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
                    >
                      {showSubscribers ? 'Hide Subscribers' : 'View Subscribers'}
                    </button>
                  </div>

                  {showSubscribers && (
                    subscribersLoading ? (
                      <div className="space-y-2 mt-4">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-10 w-full bg-white/20" />
                        ))}
                      </div>
                    ) : subscribers.length === 0 ? (
                      <p className="text-gray-400 text-sm mt-4">No subscribers yet.</p>
                    ) : (
                      <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                        {subscribers.map((subscriber) => (
                          <div
                            key={subscriber.creatorId}
                            className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div>
                              <p className="text-white text-sm font-medium">
                                {subscriber.displayName || 'Unnamed subscriber'}
                              </p>
                              <p className="text-gray-400 text-xs">{subscriber.creatorId}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* Stream Metrics */}
                {creatorStreams.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-white font-semibold text-sm">Stream Metrics</h3>
                    <div className="flex overflow-x-auto pb-3 gap-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                      {creatorStreams.map((stream: any) => (
                        <MetricCard key={stream.id} playbackId={stream.playbackId} name={stream.name || stream.title} type="stream" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Video Metrics */}
                {creatorAssets.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-white font-semibold text-sm">Video Metrics</h3>
                    <div className="flex overflow-x-auto pb-3 gap-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
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
                  <div className="text-center py-12">
                    <IoStatsChartOutline className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-white font-semibold text-lg mb-2">No Content Yet</h3>
                    <p className="text-gray-400 text-sm">
                      Start creating streams or uploading videos to see your analytics here.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Bottom Navigation - Contained within Settings content */}
        <div className="w-full">
          <BottomNav />
        </div>
      </div>
    </div>
  );
};

export default Settings;
