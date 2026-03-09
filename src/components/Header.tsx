'use client';

import { Menu, X } from 'lucide-react';

const Header = ({ toggleMenu, mobileOpen }: { toggleMenu: () => void; mobileOpen: boolean; title?: string }) => {
  return (
    <header className="fixed top-3 left-3 right-3 z-30 pointer-events-none">
      <div className="flex justify-between items-start">
        <div className="pointer-events-auto">
          <button
            onClick={toggleMenu}
            className="md:hidden inline-flex items-center justify-center rounded-full border border-white/20 bg-black/45 p-2 text-white backdrop-blur-sm"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-7 w-7 text-white" /> : <Menu className="h-7 w-7 text-white" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

