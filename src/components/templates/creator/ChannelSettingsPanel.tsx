'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { getAllStreams } from '@/features/streamAPI';
import { getAssets } from '@/features/assetsAPI';
import { useViewerMetrics } from '@/app/hook/useViewerMetrics';
import { usePlaybackMetrics } from '@/app/hook/usePlaybackView';
import { ChevronRight } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { IoSettingsOutline, IoStatsChartOutline } from 'react-icons/io5';

interface ChannelSettingsPanelProps {
  creatorId: string;
  onClose: () => void;
}

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
      description: 'Total number of unique views',
    },
    {
      title: 'Playtime (min)',
      value: metrics?.playtimeMins?.toFixed(2) ?? '0',
      trend: 'up',
      description: 'Total playtime in minutes',
    },
    {
      title: 'Time to First Frame (ms)',
      value: metrics?.ttffMs?.toFixed(0) ?? '0',
      trend: 'down',
      description: 'Average time to render first frame',
    },
    {
      title: 'Rebuffer Ratio (%)',
      value: ((metrics?.rebufferRatio ?? 0) * 100).toFixed(2),
      trend: 'down',
      description: 'Percentage of time spent buffering',
    },
    {
      title: 'Error Rate (%)',
      value: ((metrics?.errorRate ?? 0) * 100).toFixed(2),
      trend: 'down',
      description: 'Percentage of playback attempts that failed',
    },
    {
      title: 'Exits Before Start',
      value: metrics?.exitsBeforeStart?.toString() ?? '0',
      trend: 'down',
      description: 'Viewers who left before content started',
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

export function ChannelSettingsPanel({ creatorId, onClose }: ChannelSettingsPanelProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { streams } = useSelector((state: RootState) => state.streams);
  const { assets } = useSelector((state: RootState) => state.assets);
  const [activeTab, setActiveTab] = useState<'settings' | 'analytics'>('settings');

  // Get all playback IDs for this creator
  const creatorStreams = streams.filter((stream: any) => stream.creatorId?.value === creatorId && !!stream.playbackId);
  const creatorAssets = assets.filter((asset: any) => asset.creatorId?.value === creatorId && !!asset.playbackId);
  const allPlaybackIds = [
    ...creatorStreams.map((s: any) => s.playbackId),
    ...creatorAssets.map((a: any) => a.playbackId),
  ].filter(Boolean);

  // Fetch aggregated metrics
  const { viewMetrics, loading: metricsLoading } = useViewerMetrics(allPlaybackIds);

  // Fetch streams and assets on mount
  useEffect(() => {
    dispatch(getAllStreams());
    dispatch(getAssets());
  }, [dispatch]);

  // Summary data for analytics
  const insightsData = [
    { title: 'Total Streams', value: creatorStreams.length },
    { title: 'Total Videos', value: creatorAssets.length },
    { title: 'Total Views', value: viewMetrics?.viewCount ?? 0 },
    { title: 'Playtime (min)', value: viewMetrics?.playtimeMins?.toFixed(1) ?? '0' },
  ];

  return (
    <div className="w-full bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <h2 className="text-lg font-bold text-white">Channel Management</h2>
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          Close
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'settings' | 'analytics')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/10 border-b border-white/20 rounded-none p-0">
          <TabsTrigger
            value="settings"
            className="flex items-center gap-2 py-3 rounded-none data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400 text-gray-300"
          >
            <IoSettingsOutline className="w-4 h-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="flex items-center gap-2 py-3 rounded-none data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400 text-gray-300"
          >
            <IoStatsChartOutline className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="p-4">
          <div className="space-y-6">
            <div className="text-center py-8">
              <IoSettingsOutline className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Channel Settings</h3>
              <p className="text-gray-400 text-sm mb-4">
                Customize your channel appearance, branding, and monetization settings.
              </p>
              <a
                href="/dashboard/customise-channel"
                className="inline-block px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold rounded-lg transition-colors"
              >
                Open Full Settings
              </a>
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {insightsData.map((item) => (
                <AnalyticCard key={item.title} title={item.title} value={item.value} />
              ))}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ChannelSettingsPanel;
