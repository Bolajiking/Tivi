'use client';

import clsx from 'clsx';
import SidebarProfileTrigger from '@/components/SidebarProfileTrigger';

interface SidebarBottomLinksProps {
  sidebarCollapsed?: boolean;
  onProfileClick?: () => void;
}

const SidebarBottomLinks = ({ sidebarCollapsed, onProfileClick }: SidebarBottomLinksProps) => {
  return (
    <div className="p-2">
      {onProfileClick ? (
        <div className={clsx('flex', sidebarCollapsed ? 'justify-center' : 'justify-start')}>
          <SidebarProfileTrigger compact onClick={onProfileClick} />
        </div>
      ) : null}
    </div>
  );
};

export default SidebarBottomLinks;
