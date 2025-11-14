'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TbHomeFilled } from 'react-icons/tb';
import { CiStreamOn } from 'react-icons/ci';
import { BsFillBarChartLineFill } from 'react-icons/bs';
import { FaRegUserCircle } from 'react-icons/fa';
import clsx from 'clsx';

interface HorizontalNavbarProps {
  className?: string;
}

const HorizontalNavbar = ({ className }: HorizontalNavbarProps) => {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Home',
      href: '/',
      icon: TbHomeFilled,
    },
    {
      name: 'Streams',
      href: '/streamviews',
      icon: CiStreamOn,
    },
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: BsFillBarChartLineFill,
    },
    {
      name: 'Profile',
      href: '/dashboard/settings',
      icon: FaRegUserCircle,
    },
  ];

  return (
    <nav className={clsx(
      'fixed md:top-4 bottom-0 md:bottom-auto left-1/2 md:w-[50%] lg:w-[60%] w-full -translate-x-1/2 z-50 bg-white/10 backdrop-blur-lg md:rounded-full border border-white/20 shadow-lg px-4 py-2',
      className
    )}>
      <div className="flex items-center justify-around gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px]',
                isActive
                  ? 'text-yellow-400 bg-gradient-to-r from-yellow-500/20 to-teal-500/20'
                  : 'text-gray-300 hover:text-yellow-400 hover:bg-white/10'
              )}
            >
              <Icon className={clsx(
                'w-5 h-5 mb-1',
                isActive ? 'text-white' : 'text-gray-300'
              )} />
              <span className={clsx(
                'text-xs font-medium',
                isActive ? 'text-white' : 'text-gray-300'
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default HorizontalNavbar;
