'use client';
import Link from 'next/link';
import { FaSackDollar } from 'react-icons/fa6';
import { IoNotificationsOutline } from 'react-icons/io5';
import { TbHomeFilled } from 'react-icons/tb';
import { FaRegUserCircle } from 'react-icons/fa';

const BottomNav = () => {

  const navItems = [
    {
      name: 'Shop',
      href: '/dashboard',
      icon: FaSackDollar,
    },
    {
      name: 'Notifications',
      href: '/dashboard', // Placeholder - update when notifications page is created
      icon: IoNotificationsOutline,
    },
    {
      name: 'Feed',
      href: '/streamviews', // Using streamviews as feed
      icon: TbHomeFilled,
    },
    {
      name: 'Profile',
      href: '/dashboard/settings',
      icon: FaRegUserCircle,
    },
  ];

  return (
    <nav className="w-full bg-white/10 backdrop-blur-lg border-t border-white/20 shadow-lg">
      <div className="flex items-center justify-around gap-2 px-4 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-all duration-200 min-w-[60px] flex-1 text-gray-300 hover:text-white hover:bg-white/10"
            >
              <Icon className="w-6 h-6 mb-1 text-gray-300" />
              <span className="text-xs font-medium text-gray-300">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

