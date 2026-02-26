import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import api from '@/utils/api';

interface LivepeerMetrics {
  totalViews: number;
  totalWatchTime: number;
  averageWatchTime: number;
  peakConcurrentViewers: number;
  viewerEngagement: number;
  playbackErrorRate: number;
  timeSeriesData: Array<{
    timestamp: string;
    views: number;
    watchTime: number;
  }>;
}

interface LivepeerAnalyticsProps {
  streamId?: string;
  assetId?: string;
  timeRange?: '24h' | '7d' | '30d' | 'all';
}

export const useLivepeerAnalytics = ({ streamId, assetId, timeRange = '24h' }: LivepeerAnalyticsProps) => {
  const { user } = usePrivy();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<LivepeerMetrics | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!user) {
      setError('User is not authenticated');
      return;
    }
    if (!streamId) {
      setError('Stream ID is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch stream metrics
      const streamResponse = await api.get(
        `/stream/${streamId}/metrics?from=${getTimeRangeStart(timeRange)}`,
      );

      if (streamResponse.status !== 200) {
        throw new Error('Failed to fetch stream metrics');
      }

      const streamData = streamResponse.data;

      // Process the data into our metrics format
      const processedMetrics: LivepeerMetrics = {
        totalViews: streamData.totalViews || 0,
        totalWatchTime: streamData.totalWatchTime || 0,
        averageWatchTime: streamData.averageWatchTime || 0,
        peakConcurrentViewers: streamData.peakConcurrentViewers || 0,
        viewerEngagement: streamData.viewerEngagement || 0,
        playbackErrorRate: streamData.playbackErrorRate || 0,
        timeSeriesData:
          streamData.timeSeriesData?.map((point: any) => ({
            timestamp: point.timestamp,
            views: point.views || 0,
            watchTime: point.watchTime || 0,
          })) || [],
      };

      setMetrics(processedMetrics);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Livepeer analytics');
      console.error('Error fetching Livepeer analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [streamId, timeRange, user]);

  useEffect(() => {
    fetchAnalytics();
    return () => {
      // Cleanup if needed
    };
  }, [fetchAnalytics]);

  return { metrics, loading, error, refetch: fetchAnalytics };
};

// Helper function to get timestamp for time range
function getTimeRangeStart(timeRange: string): number {
  const now = Date.now();
  switch (timeRange) {
    case '24h':
      return now - 24 * 60 * 60 * 1000;
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'all':
      return 0;
    default:
      return now - 24 * 60 * 60 * 1000;
  }
}
