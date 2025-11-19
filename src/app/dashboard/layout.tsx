'use client';
import Sidebar from '@/components/Sidebar';
import SidebarBottomLinks from '@/components/SidebarBottomLinks';
import AuthGuard from '@/components/AuthGuard';
import React, { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { LuArrowLeftFromLine, LuArrowRightFromLine } from 'react-icons/lu';
import clsx from 'clsx';
import { X } from 'lucide-react';
import Logo from '@/components/Logo';
import { ChannelProvider } from '@/context/ChannelContext';

const DashboardLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
    <AuthGuard>
      <ChannelProvider>
        <div className="text-white flex h-screen bg-gradient-to-br from-black via-gray-950 to-black font-sans">
        {/* Sidebar for desktop */}

        <aside
          className={clsx(
            'md:relative z-20 h-full md:block px-4 gap-y-4 transition-all duration-300 ease-in-out border-r border-white/20 flex flex-col bg-white/10 backdrop-blur-sm',
            {
              'w-[100px]': sidebarCollapsed && !isMobile, // Collapsed sidebar for desktop
              'w-72 p-4': !sidebarCollapsed && !isMobile, // Expanded sidebar for desktop
              hidden: isMobile && !mobileMenuOpen,
              block: isMobile && mobileMenuOpen,
            },
          )}
        >
          <div className="flex items-center justify-between py-4 border-b border-white/20">
            {!sidebarCollapsed && (
              <div className="">
               <Logo size="lg" />
              </div>
            )}
            <button onClick={toggleSidebar} className="ml-auto text-gray-300 hover:text-white transition-colors">
              {sidebarCollapsed ? (
                <LuArrowRightFromLine className="h-5 w-5" />
              ) : (
                <LuArrowLeftFromLine className="h-5 w-5" />
              )}
            </button>
          </div>
          <Sidebar sidebarCollapsed={sidebarCollapsed} />
          
          {/* Bottom Links Section - Fixed at bottom of screen */}
          <div className={clsx(
            'fixed bottom-0 left-0 z-30  backdrop-blur-lg border-t border-white/20 transition-all duration-300',
            {
              'w-[100px]': sidebarCollapsed && !isMobile,
              'w-72': !sidebarCollapsed && !isMobile,
              'hidden': isMobile,
            }
          )}>
            <SidebarBottomLinks sidebarCollapsed={sidebarCollapsed} onCreateChannel={() => {}} />
          </div>
        </aside>
        {/* Mobile menu overlay */}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Pass state values as props to children */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="container mx-auto px-1">{children}</div>
          </main>
        </div>
      </div>
      </ChannelProvider>
    </AuthGuard>
  );
};

export default DashboardLayout;
