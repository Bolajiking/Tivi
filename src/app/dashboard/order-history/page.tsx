"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import Header from "@/components/Header"
import MobileSidebar from "@/components/MobileSidebar"
import BottomNav from "@/components/BottomNav"
import { usePrivy } from "@privy-io/react-auth"
import { useWalletAddress } from "@/app/hook/useWalletAddress"
import { getOrdersByBuyer } from "@/lib/supabase-service"
import type { SupabaseOrder } from "@/lib/supabase-types"
import { FaShoppingBag, FaDownload, FaPlay } from "react-icons/fa"
import { IoReceiptOutline } from "react-icons/io5"
import { ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"

const OrderHistory = () => {
  const { ready, authenticated } = usePrivy()
  const { walletAddress } = useWalletAddress()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "pending" | "failed">("all")
  const [orders, setOrders] = useState<SupabaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const fetchOrders = useCallback(async () => {
    if (!walletAddress) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await getOrdersByBuyer(walletAddress)
      setOrders(data)
    } catch (err) {
      console.error("Failed to fetch orders:", err)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    if (ready && authenticated) {
      fetchOrders()
    }
  }, [ready, authenticated, fetchOrders])

  const filteredOrders = useMemo(() => {
    if (activeTab === "all") return orders
    return orders.filter(o => o.status === activeTab)
  }, [orders, activeTab])

  const tabs = [
    { id: "all", label: "All" },
    { id: "completed", label: "Completed" },
    { id: "pending", label: "Pending" },
    { id: "failed", label: "Failed" },
  ]

  const statusColors: Record<string, string> = {
    completed: "text-emerald-400",
    pending: "text-yellow-400",
    failed: "text-red-400",
    refunded: "text-[#888]",
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
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
        <div className="mx-auto w-full max-w-[1200px] py-4 px-3 pt-14 pb-24 md:px-6 md:pt-6 md:pb-10 flex flex-col gap-6 h-full">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row pt-4 justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-2xl text-white font-bold font-funnel-display">Order history</h1>
              <p className="text-[#888] text-sm mt-1">View your purchases and transactions</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                  activeTab === tab.id
                    ? "bg-[#facc15]/10 border-[#facc15]/40 text-[#facc15]"
                    : "bg-[#1a1a1a] border-white/[0.07] text-[#888] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-4">
                  <Skeleton className="w-12 h-12 rounded-xl bg-[#0f0f0f]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded-md bg-[#0f0f0f]" />
                    <Skeleton className="h-3 w-1/2 rounded-md bg-[#0f0f0f]" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md bg-[#0f0f0f]" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const snapshot = order.productSnapshot as Record<string, any> | null
                const productName = snapshot?.name || "Product"
                const productImage = snapshot?.imageUrl || null
                const productType = snapshot?.productType || "physical"

                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-4 flex items-center gap-4 hover:border-white/[0.12] transition-colors"
                  >
                    {/* Product Image */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#0f0f0f] border border-white/[0.07] shrink-0 relative">
                      {productImage ? (
                        <Image
                          src={productImage}
                          alt={productName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <FaShoppingBag className="text-[#333]" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-[14px] truncate">{productName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[12px] text-[#555] capitalize">{productType}</span>
                        <span className="text-[12px] text-[#333]">&middot;</span>
                        <span className={`text-[12px] font-medium capitalize ${statusColors[order.status] || "text-[#888]"}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Amount + Date */}
                    <div className="text-right shrink-0">
                      <p className="text-[#facc15] font-bold text-[14px]">
                        ${Number(order.amount).toFixed(2)}
                      </p>
                      <p className="text-[12px] text-[#555]">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full border border-white/[0.07] bg-[#0f0f0f] flex items-center justify-center">
                <FaShoppingBag className="text-2xl text-[#888]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No orders yet</h3>
              <p className="text-[#888] text-sm max-w-xs mb-6">
                When you purchase products from creator stores, they&apos;ll appear here.
              </p>
              <button
                onClick={() => window.location.href = "/streamviews"}
                className="bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black font-semibold py-2.5 px-5 rounded-lg transition-all flex items-center gap-2 text-[14px]"
              >
                <FaPlay className="text-xs" />
                Explore creators
              </button>
            </div>
          )}
        </div>

        {/* Bottom Navigation - Mobile Only */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

export default OrderHistory
