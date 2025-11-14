'use client';

import { LuArrowLeftFromLine, LuArrowRightFromLine } from 'react-icons/lu';
import { IoMdClose } from 'react-icons/io';
import Sidebar from './Sidebar';
import { useEffect } from 'react';
import clsx from 'clsx';

interface MobileSidebarProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export default function MobileSidebar({
  sidebarCollapsed,
  toggleSidebar,
  mobileMenuOpen,
  setMobileMenuOpen,
}: MobileSidebarProps) {
  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (mobileMenuOpen && !target.closest('[data-sidebar="true"]')) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling when sidebar is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen, setMobileMenuOpen]);

  return (
    <>
      {/* Overlay */}
      {mobileMenuOpen && (
        <div className="fixed left-0 inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        data-sidebar="true"
        className={clsx(
          'fixed md:relative z-40 left-0 h-full bg-black transition-all duration-300 ease-in-out border-r border-white/20 flex flex-col',
          {
            // Mobile states
            'w-[60%] left-0': mobileMenuOpen && !sidebarCollapsed, // Expanded sidebar for mobile
            'w-[15%] items-center': mobileMenuOpen && sidebarCollapsed, // Collapsed sidebar for mobile
            '-left-full': !mobileMenuOpen, // Hidden sidebar
          },
        )}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="ml-auto md:hidden p-2 mt-3 rounded-full mr-3 bg-[#f0f0f0] hover:bg-[#e0e0e0] transition-colors duration-200"
          aria-label="Close menu"
        >
          <IoMdClose className="h-6 w-6 text-[#53525f]" />
        </button>
        <div className="flex items-center justify-between p-4 border-b border-[#dfe0e1]">
          {!sidebarCollapsed && (
            <div className="transition-all ease-in-out duration-500 font-bold flex justify-center items-center uppercase text-black-primary-text">
              <h1>ChainfrenTV</h1>
            </div>
          )}

          {/* Desktop toggle button */}
          <button onClick={toggleSidebar} className="ml-auto block">
            {sidebarCollapsed ? (
              <LuArrowRightFromLine className="h-5 w-5 text-[#fff]" />
            ) : (
              <LuArrowLeftFromLine className="h-5 w-5 text-[#fff]" />
            )}
          </button>
        </div>
        <div className="px-2">
          <Sidebar sidebarCollapsed={sidebarCollapsed} />
        </div>
      </aside>
    </>
  );
}
