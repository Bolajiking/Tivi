"use client"

import React, { useEffect, useState, useMemo } from "react"
import Header from "@/components/Header"
import MobileSidebar from "@/components/MobileSidebar"
import BottomNav from "@/components/BottomNav"
import { usePrivy } from "@privy-io/react-auth"
import { FaShoppingBag, FaDownload, FaPlay } from "react-icons/fa"
import { IoReceiptOutline } from "react-icons/io5"
import { ChevronRight } from "lucide-react"

interface Transaction {
  id: string
  type: "payment" | "download" | "subscription"
  creatorName: string
  contentTitle: string
  amount: string
  date: Date
  status: "completed" | "pending" | "failed"
}

const OrderHistory = () => {
  const { user, ready, authenticated } = usePrivy()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | "purchases" | "downloads" | "subscriptions">("all")

  // Get current user's wallet address
  const currentUserAddress = useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length === 0) return ""

    const firstAccount = user.linkedAccounts[0]
    if (firstAccount.type === "wallet" && "address" in firstAccount && firstAccount.address) {
      return firstAccount.address
    }

    const walletAccount = user.linkedAccounts.find((account: any) => account.type === "wallet" && "address" in account && account.address)
    if (walletAccount && "address" in walletAccount && walletAccount.address) {
      return walletAccount.address
    }

    return ""
  }, [user?.linkedAccounts])

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  // Placeholder transactions - in a real app, this would come from Supabase
  const transactions: Transaction[] = []

  const filteredTransactions = useMemo(() => {
    if (activeTab === "all") return transactions
    if (activeTab === "purchases") return transactions.filter(t => t.type === "payment")
    if (activeTab === "downloads") return transactions.filter(t => t.type === "download")
    if (activeTab === "subscriptions") return transactions.filter(t => t.type === "subscription")
    return transactions
  }, [transactions, activeTab])

  const tabs = [
    { id: "all", label: "All" },
    { id: "purchases", label: "Purchases" },
    { id: "downloads", label: "Downloads" },
    { id: "subscriptions", label: "Subscriptions" },
  ]

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <FaShoppingBag className="text-yellow-400" />
      case "download":
        return <FaDownload className="text-blue-400" />
      case "subscription":
        return <IoReceiptOutline className="text-green-400" />
      default:
        return <FaShoppingBag className="text-gray-400" />
    }
  }

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
        <div className="py-4 px-4 pb-24 md:pb-10 md:py-6 flex flex-col gap-6 h-full">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row pt-4 justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-2xl text-white font-bold">Order History</h1>
              <p className="text-gray-400 text-sm mt-1">View your purchases, downloads, and subscriptions</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-yellow-500 text-black"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {filteredTransactions.length > 0 ? (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 flex items-center gap-4 hover:bg-white/15 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    {getTypeIcon(transaction.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{transaction.contentTitle}</p>
                    <p className="text-gray-400 text-sm">{transaction.creatorName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{transaction.amount}</p>
                    <p className="text-gray-400 text-xs">{transaction.date.toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
                <FaShoppingBag className="text-4xl text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No orders yet</h3>
              <p className="text-gray-400 text-sm max-w-xs mb-6">
                When you purchase content, subscribe to creators, or download videos, they'll appear here.
              </p>
              <button
                onClick={() => window.location.href = "/streamviews"}
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
              >
                <FaPlay className="text-sm" />
                Explore Content
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
