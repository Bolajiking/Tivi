'use client';
import { Suspense, useEffect, useState } from 'react';
import StreamsShowcase from '@/components/templates/landing/StreamsShowcase';
import Sidebar from '@/components/Sidebar';
import SidebarBottomLinks from '@/components/SidebarBottomLinks';
import MobileSidebar from '@/components/MobileSidebar';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Logo from '@/components/Logo';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { ChannelProvider } from '@/context/ChannelContext';
import SidebarUserPanel from '@/components/SidebarUserPanel';

export default function StreamViews() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      if (isMobileView) {
        setSidebarCollapsed(true);
      }
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const toggleSidebar = () => {
    if (!isMobile) {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const toggleSidebarProfile = () => {
    setSidebarProfileOpen((prev) => {
      const next = !prev;
      if (next && !isMobile && sidebarCollapsed) {
        setSidebarCollapsed(false);
      }
      return next;
    });
  };

  const content = (
    <div className="text-white flex h-screen bg-canvas font-sans overflow-hidden">
      {/* Sidebar — matches dashboard layout */}
      <aside
        className={clsx(
          'md:relative z-20 h-full md:block px-2.5 py-2 gap-y-2.5 transition-all duration-300 ease-in-out border-r border-white/[0.07] flex flex-col bg-surface overflow-hidden',
          {
            'w-[80px]': sidebarCollapsed && !isMobile,
            'w-[240px]': !sidebarCollapsed && !isMobile,
            hidden: isMobile && !mobileMenuOpen,
            block: isMobile && mobileMenuOpen,
          },
        )}
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.07]">
          <div className={clsx('pt-0.5', sidebarCollapsed && 'hidden')}>
            <Logo size="sm" iconOnly />
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07] bg-surface text-gray-300 hover:text-white hover:bg-raised transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <Sidebar sidebarCollapsed={sidebarCollapsed} />
        </div>

        {/* Bottom Links */}
        <div className={clsx(
          'z-30 border-t border-white/[0.07] transition-all duration-300',
          {
            'fixed bottom-0 left-0 backdrop-blur-lg w-[80px]': sidebarCollapsed && !isMobile,
            'fixed bottom-0 left-0 backdrop-blur-lg w-[240px]': !sidebarCollapsed && !isMobile,
            'mt-auto w-full': isMobile,
          }
        )}>
          <SidebarBottomLinks
            sidebarCollapsed={sidebarCollapsed}
            onProfileClick={toggleSidebarProfile}
          />
        </div>
        <SidebarUserPanel
          variant="sheet"
          open={sidebarProfileOpen}
          onClose={() => setSidebarProfileOpen(false)}
        />
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
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-2 sm:px-3 md:px-4">
            <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
            <StreamsShowcase />
          </div>
        </main>
        {/* Bottom Navigation */}
        <div className="flex-shrink-0 z-10">
          <BottomNav />
        </div>
      </div>
    </div>
  );

  return (
    <ChannelProvider>
      <Suspense fallback={<div className="h-screen w-full bg-canvas" />}>
        {content}
      </Suspense>
    </ChannelProvider>
  );
}
