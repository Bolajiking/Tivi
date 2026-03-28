import * as Dialog from '@radix-ui/react-dialog';
import React from 'react';
import { useState } from 'react';

import { usePrivy } from '@privy-io/react-auth';
import { ReactNode } from 'react';
import { FaRegUserCircle, FaWallet, FaGoogle, FaDiscord, FaTwitter } from 'react-icons/fa';
import { MdEmail } from 'react-icons/md';
import { IoClose } from 'react-icons/io5';
import { useRouter } from 'next/navigation';

interface LinkAccountProps {
  children: ReactNode;
}

const LinkAccount = ({ children }: LinkAccountProps) => {
  const { linkWallet, linkEmail, linkApple, linkDiscord, linkGithub, linkGoogle, linkPhone, linkTwitter } = usePrivy();
  const linkOptions = [
    { label: 'Email', action: linkEmail },
    { label: 'Wallet', action: linkWallet },
    { label: 'Apple', action: linkApple },
    { label: 'Discord', action: linkDiscord },
    { label: 'Github', action: linkGithub },
    { label: 'Google', action: linkGoogle },
    { label: 'Phone', action: linkPhone },
    { label: 'Twitter', action: linkTwitter },
  ];
  //   const router = useRouter();
  const [selectedLink, setSelectedLink] = useState<string>('');
  const handleLinkClick = () => {
    const selected = linkOptions.find((option) => option.label === selectedLink);
    if (selected) {
      selected.action();
    }
  };
  const { user } = usePrivy();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button>{children}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-[90vw] max-w-[850px] shadow-lg animate-content-show">
          <div className="space-y-6">
            <Dialog.Title className="text-2xl font-semibold border-b pb-4">Profile Details</Dialog.Title>
            <Dialog.Description className="sr-only">View and manage your linked accounts</Dialog.Description>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* User ID Card */}
              <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <FaRegUserCircle className="text-2xl text-blue-500" />
                  <label className="font-medium text-gray-700">User ID</label>
                </div>
                <p className="text-sm break-all text-gray-600">{user?.id}</p>
              </div>

              {/* Wallet Card */}
              <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <FaWallet className="text-2xl text-blue-500" />
                  <label className="font-medium text-gray-700">Wallet</label>
                </div>
                <p className="text-sm break-all text-gray-600">{user?.wallet?.address || 'Not connected'}</p>
              </div>

              {/* Email Card */}
              <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <MdEmail className="text-2xl text-blue-500" />
                  <label className="font-medium text-gray-700">Email</label>
                </div>
                <p className="text-sm break-all text-gray-600">{user?.email?.address || 'Not connected'}</p>
              </div>

              {/* Google Card */}
              <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <FaGoogle className="text-2xl text-blue-500" />
                  <label className="font-medium text-gray-700">Google</label>
                </div>
                <p className="text-sm break-all text-gray-600">{user?.google?.email || 'Not connected'}</p>
              </div>

              {/* Discord Card */}
              <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <FaDiscord className="text-2xl text-blue-500" />
                  <label className="font-medium text-gray-700">Discord</label>
                </div>
                <p className="text-sm break-all text-gray-600">{user?.discord?.username || 'Not connected'}</p>
              </div>

              {/* Twitter Card */}
              <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <FaTwitter className="text-2xl text-blue-500" />
                  <label className="font-medium text-gray-700">Twitter</label>
                </div>
                <p className="text-sm break-all text-gray-600">{user?.twitter?.username || 'Not connected'}</p>
              </div>
            </div>

            {/* Link New Account Section */}
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-medium mb-4">Link New Account</h3>
              <div className="flex gap-4 flex-wrap">
                <select
                  value={selectedLink}
                  onChange={(e) => setSelectedLink(e.target.value)}
                  className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Select an account to link</option>
                  {linkOptions.map((option, index) => (
                    <option key={index} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLinkClick}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Link Account
                </button>
              </div>
            </div>

            <Dialog.Close className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors">
              <IoClose className="text-xl" />
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default LinkAccount;
