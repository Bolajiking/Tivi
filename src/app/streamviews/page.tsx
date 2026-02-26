'use client';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { getAllStreams } from '@/features/streamAPI';
import StreamsShowcase from '@/components/templates/landing/StreamsShowcase';
import Sidebar from '@/components/Sidebar';
import SidebarBottomLinks from '@/components/SidebarBottomLinks';
import MobileSidebar from '@/components/MobileSidebar';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Logo from '@/components/Logo';
import { LuArrowLeftFromLine, LuArrowRightFromLine } from 'react-icons/lu';
import clsx from 'clsx';
import { ChannelProvider } from '@/context/ChannelContext';

export default function StreamViews() {
  const dispatch = useDispatch<AppDispatch>();
  const { streams, loading } = useSelector((state: RootState) => state.streams);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Load streams for the showcase
    dispatch(getAllStreams());
    setIsLoading(false);
  }, [dispatch]);

  // Check if we're on mobile screen
  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);

      // Automatically collapse the sidebar on mobile
      if (isMobileView) {
        setSidebarCollapsed(true);
      }
    };

    // Initial check
    checkIfMobile();

    // Add event listener
    window.addEventListener('resize', checkIfMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const toggleSidebar = () => {
    // Only toggle the sidebar if not in mobile view
    if (!isMobile) {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const toggleMobileMenu = () => {
    // Toggle the mobile menu
    setMobileMenuOpen((prev) => !prev);
  };

  return (
    <ChannelProvider>
      <div className="text-white flex h-screen bg-gradient-to-br from-black via-gray-950 to-black font-sans overflow-hidden">
        {/* Sidebar for desktop */}
        <aside
          className={clsx(
            'md:relative z-20 h-full md:block px-2.5 py-2 gap-y-2.5 transition-all duration-300 ease-in-out border-r border-white/20 flex flex-col bg-white/10 backdrop-blur-sm',
            {
              'w-[80px]': sidebarCollapsed && !isMobile, // Collapsed sidebar for desktop
              'w-[240px]': !sidebarCollapsed && !isMobile, // Expanded sidebar for desktop
              hidden: isMobile && !mobileMenuOpen,
              block: isMobile && mobileMenuOpen,
            },
          )}
        >
          <div className="flex items-start justify-between pb-2 border-b border-white/20">
            {!sidebarCollapsed && (
              <div className="pt-0.5">
                <Logo size="sm" />
              </div>
            )}
            <button
              onClick={toggleSidebar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-gray-300 hover:text-white hover:bg-white/15 transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <LuArrowRightFromLine className="h-4 w-4" />
              ) : (
                <LuArrowLeftFromLine className="h-4 w-4" />
              )}
            </button>
          </div>
          <Sidebar sidebarCollapsed={sidebarCollapsed} />
          
          {/* Bottom Links Section - Fixed at bottom of screen */}
          <div className={clsx(
            'fixed bottom-0 left-0 z-30 backdrop-blur-lg border-t border-white/20 transition-all duration-300',
            {
              'w-[80px]': sidebarCollapsed && !isMobile,
              'w-[240px]': !sidebarCollapsed && !isMobile,
              'hidden': isMobile,
            }
          )}>
            <SidebarBottomLinks sidebarCollapsed={sidebarCollapsed} onCreateChannel={() => {}} />
          </div>
        </aside>

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
        <div className="flex-1 flex flex-col gap-4 h-screen overflow-hidden relative">
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 my-2 mx-2 flex flex-col relative">
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto pb-4">
                <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
                <StreamsShowcase streams={streams} loading={loading} />
              </div>
              {/* Bottom Navigation - Fixed at bottom of middle column */}
              <div className="flex-shrink-0 z-10">
                <BottomNav />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChannelProvider>
  );
}
