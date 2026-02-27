"use client"

import { AnalyticCard } from "@/components/Card/Card"
import type React from "react"
import { useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import MobileSidebar from "@/components/MobileSidebar"
import { usePrivy } from "@privy-io/react-auth"
import { useDispatch, useSelector } from "react-redux"
import { getAllStreams } from "@/features/streamAPI"
import { getAssets } from "@/features/assetsAPI"
import type { RootState, AppDispatch } from "@/store/store"
import type { Asset, Stream } from "@/interfaces"
import { useViewerMetrics } from "@/app/hook/useViewerMetrics"
import { Bars } from "react-loader-spinner"
import { usePlaybackMetrics } from "@/app/hook/usePlaybackView"
import { ChevronRight } from "lucide-react"
import Performance from "../analytics/Performance"
import BottomNav from "@/components/BottomNav"
import { useWalletAddress } from "@/app/hook/useWalletAddress"

const Analytics = () => {
  const { ready, authenticated } = usePrivy()
  const { walletAddress } = useWalletAddress()
  const dispatch = useDispatch<AppDispatch>()
  const { streams, loading: streamsLoading } = useSelector((state: RootState) => state.streams)
  const { assets, loading: assetsLoading, error: assetsError } = useSelector((state: RootState) => state.assets)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { viewMetrics, loading } = useViewerMetrics({ filter: "all" }) // Fetch view metrics

  const creatorAddress = useMemo(() => walletAddress || '', [walletAddress])

  const insightsData = [
    {
      title: "Total Views",
      views: viewMetrics?.viewCount ? viewMetrics?.viewCount : "---",
      change: "from all stream and assets",
    },
    {
      title: "Total Watch time",
      playtimeMins: viewMetrics?.playtimeMins
        ? `${Math.floor(viewMetrics.playtimeMins / 60)}h:${(viewMetrics.playtimeMins % 60).toFixed(1)}mins`
        : "0h:0.0m",
      change: "from all stream and assets",
    },
  ]

  useEffect(() => {
    if (ready && authenticated) {
      dispatch(getAllStreams())
      dispatch(getAssets())
    }
  }, [dispatch, ready, authenticated])

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const filteredStreams = useMemo(() => {
    return streams.filter((stream: Stream) => !!stream.playbackId && stream.creatorId?.value === creatorAddress)
  }, [streams, creatorAddress])

  const filteredAssets = useMemo(() => {
    return assets.filter((asset: Asset) => !!asset.playbackId && asset.creatorId?.value === creatorAddress)
  }, [assets, creatorAddress])

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  // A small sub‐component so hooks rules aren't broken
  const MetricCard: React.FC<{ playbackId: string; name: string; type: "stream" | "asset" }> = ({
    playbackId,
    name,
    type,
  }) => {
    const { views, loading, error } = usePlaybackMetrics(playbackId)

    return (
      <div className="flex-shrink-0 w-[280px] border border-white/20 flex flex-col justify-between bg-white/10 backdrop-blur-sm rounded-lg p-4 gap-y-5 h-[180px]">
        <div>
          <p className="text-lg font-bold text-white capitalize break-words line-clamp-2">{name}</p>
          <p className="text-sm text-gray-300 capitalize">{type}</p>
        </div>
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : (
          <div>

              <p className="text-4xl font-extrabold tracking-wide text-white">{views?.viewCount ?? 0} Views</p>

            <p className="text-sm flex items-center gap-1">
              <span className="text-gray-300">since start</span>
            </p>
          </div>
        )}
      </div>
    )
  }

  const SectionTitle = ({ title, count }: { title: string; count: number }) => (
    <div className="flex flex-col">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="text-sm text-gray-300">{count} items</p>
    </div>
  )

  const HorizontalScroll = ({
    title,
    count,
    children,
    emptyMessage,
  }: {
    title: string
    count: number
    children: React.ReactNode
    emptyMessage: string
  }) => (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <SectionTitle title={title} count={count} />
        {count > 0 && (
          <button className="text-sm text-yellow-400 hover:text-yellow-300 flex items-center transition-colors">
            View all <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {count > 0 ? (
        <div className="relative">
          <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {children}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[180px] border border-dashed border-white/20 rounded-lg bg-white/5 backdrop-blur-sm">
          <p className="text-gray-400">{emptyMessage}</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black">
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
      <div className="flex-1 flex flex-col h-screen overflow-auto">
        <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
        <div className="py-4 px-4 pb-10 md:py-6 flex flex-col gap-8 h-full">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row pt-4 justify-between">
              <h1 className="text-xl md:text-xl lg:text-2xl text-white font-bold">Analytics Dashboard</h1>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:gap-6 md:grid-cols-4">
              {insightsData.map((insightsData) => (
                <AnalyticCard key={insightsData.title} {...insightsData} />
              ))}
            </div>

            {/* Streams Section */}
            <HorizontalScroll
              title="Stream Metrics"
              count={filteredStreams.length}
              emptyMessage="No streams available. Start streaming to see metrics."
            >
              {filteredStreams.map((stream) => (
                <MetricCard key={stream.playbackId} playbackId={stream.playbackId!} name={stream.name} type="stream" />
              ))}
            </HorizontalScroll>

            {/* Assets Section */}
            <HorizontalScroll
              title="Asset Metrics"
              count={filteredAssets.length}
              emptyMessage="No assets available. Upload content to see metrics."
            >
              {filteredAssets.map((asset) => (
                <MetricCard key={asset.id} playbackId={asset.playbackId} name={asset.name} type="asset" />
              ))}
            </HorizontalScroll>

            {/* Performance Metrics */}
            <Performance metrics={viewMetrics || {}} loading={loading} />
          </div>
        </div>

        {/* Bottom Navigation - Mobile Only */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

export default Analytics
