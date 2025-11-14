'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BsFillBarChartLineFill } from 'react-icons/bs';
import { CiStreamOn } from 'react-icons/ci';
import { FaSackDollar } from 'react-icons/fa6';
import { IoSettings } from 'react-icons/io5';
import { RiEditFill } from 'react-icons/ri';
import { TbHomeFilled } from 'react-icons/tb';
import { usePrivy } from '@privy-io/react-auth';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useEffect, useState } from 'react';
import { getSubscribedChannels } from '@/lib/supabase-service';
import { SupabaseUser } from '@/lib/supabase-types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HiPlus } from 'react-icons/hi';

interface SidebarProps {
  sidebarCollapsed?: boolean;
}

const Sidebar = ({ sidebarCollapsed }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, authenticated, ready } = usePrivy();
  const solanaWalletAddress = useSelector((state: RootState) => state.user.solanaWalletAddress);
  const [subscribedChannels, setSubscribedChannels] = useState<SupabaseUser[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Get current user's wallet address
  const currentUserAddress =
    user?.wallet?.chainType === 'solana' && user?.wallet?.address
      ? user.wallet.address
      : solanaWalletAddress || '';

  const isLoggedIn = authenticated && ready && !!currentUserAddress;

  // Fetch subscribed channels
  useEffect(() => {
    const fetchSubscribedChannels = async () => {
      if (!isLoggedIn || !currentUserAddress) {
        setSubscribedChannels([]);
        return;
      }

      setLoadingChannels(true);
      try {
        const channels = await getSubscribedChannels(currentUserAddress);
        setSubscribedChannels(channels);
      } catch (error) {
        console.error('Failed to fetch subscribed channels:', error);
      } finally {
        setLoadingChannels(false);
      }
    };

    fetchSubscribedChannels();
  }, [isLoggedIn, currentUserAddress]);

  const handleAddChannel = () => {
    if (!isLoggedIn) {
      setShowSignupModal(true);
      return;
    }
    router.push('/streamviews');
  };

  const handleSignup = () => {
    setShowSignupModal(false);
    router.push('/dashboard');
  };

  const links = [
    { href: '/', icon: TbHomeFilled, text: 'Home' },
    { href: '/dashboard', icon: BsFillBarChartLineFill, text: 'Dashboard' },
    { href: '/dashboard/settings', icon: IoSettings, text: 'Profile' },
  ];

  return (
    <>
      {/* <nav className="w-full mt-2 backdrop-blur-sm border border-white/20 rounded-lg p-2">
        <div className="flex flex-col gap-2">
          {links.map((link) => {
            const IconComponent = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link href={link.href} key={link.text}>
                <div
                  className={clsx(
                    'flex items-center rounded-md py-3 gap-3 px-4 transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-yellow-500 to-teal-500 text-black shadow-lg'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/20',
                    sidebarCollapsed && 'justify-center',
                  )}
                >
                  <IconComponent className={'inline-block h-5 w-5'} />

                  {!sidebarCollapsed && <p className="font-bold">{link.text}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      </nav> */}

      {/* Subscribed Channels Section */}
      {!sidebarCollapsed && (
        <div className="w-full mt-4 backdrop-blur-sm border border-white/20 rounded-lg p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-white font-bold text-sm">Subscribed Channels</h3>
          </div>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {loadingChannels ? (
              <div className="text-gray-400 text-sm px-2 py-2">Loading...</div>
            ) : !isLoggedIn ? (
              <div className="text-gray-400 text-sm px-2 py-2">Sign in to see channels</div>
            ) : subscribedChannels.length === 0 ? (
              <div className="text-gray-400 text-sm px-2 py-2">No subscribed channels</div>
            ) : (
              subscribedChannels.map((channel) => (
                <Link
                  key={channel.creatorId}
                  href={`/creator/${channel.creatorId}`}
                  className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-white/10 transition-colors"
                >
                  {channel.avatar ? (
                    <img
                      src={channel.avatar}
                      alt={channel.displayName || 'Channel'}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-xs font-bold">
                      {(channel.displayName || channel.creatorId.slice(0, 2)).toUpperCase()}
                    </div>
                  )}
                  <span className="text-gray-300 text-sm truncate flex-1">
                    {channel.displayName || channel.creatorId.slice(0, 8) + '...'}
                  </span>
                </Link>
              ))
            )}
          </div>
          <button
            onClick={handleAddChannel}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-md transition-all duration-200 text-sm font-semibold"
          >
            <HiPlus className="w-4 h-4" />
            Add Channel
          </button>
        </div>
      )}

      {/* Collapsed Add Channel Button */}
      {sidebarCollapsed && (
        <div className="w-full mt-4">
          <button
            onClick={handleAddChannel}
            className="w-full flex items-center justify-center p-3 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-md transition-all duration-200"
            title="Add Channel"
          >
            <HiPlus className="w-5 h-5" />
          </button>
        </div>
      )}


      {/* Signup Modal */}
      <AlertDialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Up Required</AlertDialogTitle>
            <AlertDialogDescription>
              You need to sign up and connect your wallet to add channels. Would you like to sign up now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSignupModal(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignup}
              className="bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black"
            >
              Sign Up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
export default Sidebar;
