'use client';
import Sidebar from '@/components/Sidebar';
import SidebarBottomLinks from '@/components/SidebarBottomLinks';
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import Logo from '@/components/Logo';
import { ChannelProvider } from '@/context/ChannelContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SidebarUserPanel from '@/components/SidebarUserPanel';

const DashboardLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);

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

  const toggleSidebarProfile = () => {
    setSidebarProfileOpen((prev) => {
      const next = !prev;
      if (next && !isMobile && sidebarCollapsed) {
        setSidebarCollapsed(false);
      }
      return next;
    });
  };

  return (
    <ChannelProvider>
      <div className="text-white flex h-screen bg-gradient-to-br from-black via-gray-950 to-black font-sans overflow-hidden">
        {/* Sidebar for desktop */}

        <aside
          className={clsx(
            'md:relative z-20 h-full md:block px-2.5 py-2 gap-y-2.5 transition-all duration-300 ease-in-out border-r border-white/20 flex flex-col bg-white/10 backdrop-blur-sm overflow-hidden',
            {
              'w-[80px]': sidebarCollapsed && !isMobile, // Collapsed sidebar for desktop
              'w-[240px]': !sidebarCollapsed && !isMobile, // Expanded sidebar for desktop
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
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07] bg-[#0f0f0f] text-gray-300 hover:text-white hover:bg-[#1a1a1a] transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <Sidebar sidebarCollapsed={sidebarCollapsed} />
          </div>
          
          {/* Bottom Links Section */}
          <div className={clsx(
            'z-30 border-t border-white/20 transition-all duration-300',
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
        {/* Mobile menu overlay */}

        {/* Main content area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Pass state values as props to children */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] px-2 sm:px-3 md:px-4">{children}</div>
          </main>
        </div>
      </div>
    </ChannelProvider>
  );
};

export default DashboardLayout;
