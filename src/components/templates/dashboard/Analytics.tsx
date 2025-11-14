'use client';
import { AnalyticCard } from '@/components/Card/Card';
import clsx from 'clsx';
import React, { useState } from 'react';
import { useViewerMetrics } from '@/app/hook/useViewerMetrics';

const Analytics = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'month' | 'year'>('all'); // Filter state
  const [isLoading, setIsLoading] = useState(false);
  const { viewMetrics, refetch } = useViewerMetrics({ filter: activeFilter }); // Fetch view metrics
  const insightsData = [
    {
      title: 'Total Views',
      views: viewMetrics?.viewCount ? viewMetrics?.viewCount : '---',
      value: -11.02,
      change: '30 from last stream',
    },
    {
      title: 'Total Watch time',
      playtimeMins: viewMetrics?.playtimeMins
        ? `${Math.floor(viewMetrics.playtimeMins / 60)}h:${(viewMetrics.playtimeMins % 60).toFixed(1)}mins`
        : '0h:0.0m',
      value: 11.02,
      change: '30 from last stream',
    },
  ];

  const handleFilterChange = async (filterType: 'all' | 'month' | 'year') => {
    setIsLoading(true);
    setActiveFilter(filterType);
    await refetch();
    setIsLoading(false);
  };

  return (
    <div className="grid bg-white/10 backdrop-blur-sm border border-white/20 grid-cols-2 gap-6 md:grid-cols-4 p-3 md:p-6 rounded-lg">
      {insightsData.map((insightsData) => (
        <AnalyticCard key={insightsData.title} {...insightsData} loading={isLoading} />
      ))}
      <div className="w-full h-full">
        <ul className="flex flex-col gap-y-2 h-full">
          {['all', 'LastMonth', 'Year'].map((filter) => (
            <li
              key={filter}
              className={clsx(
                'text-sm pl-2 py-1 text-gray-300 cursor-pointer font-semibold hover:text-white transition-colors',
                activeFilter === filter && 'border-l-4 text-white border-yellow-400',
              )}
              onClick={() => handleFilterChange(filter as 'all' | 'month' | 'year')}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1).replace(/([A-Z])/g, ' $1')}
            </li>
          ))}
          <div className="flex justify-start items-end w-2/3 h-full">
            <button
              className="w-full font-semibold text-white text-sm flex justify-center items-center py-2 border border-white/20 bg-white/10 backdrop-blur-sm rounded-md self-end hover:bg-white/20 transition-colors"
              onClick={() => handleFilterChange('all')}
            >
              View All
            </button>
          </div>
        </ul>
      </div>
    </div>
  );
};

export default Analytics;
