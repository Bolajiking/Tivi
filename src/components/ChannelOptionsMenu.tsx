'use client';

import { useState } from 'react';
import { HiDotsVertical } from 'react-icons/hi';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { SupabaseStream } from '@/lib/supabase-types';

interface ChannelOptionsMenuProps {
  channel: SupabaseStream;
  profileIdentifier: string;
  onSettings?: (channel: SupabaseStream) => void;
  onInstall: (channel: SupabaseStream) => void;
  onShare: (channel: SupabaseStream, profileIdentifier: string) => void;
}

export default function ChannelOptionsMenu({
  channel,
  profileIdentifier,
  onSettings,
  onInstall,
  onShare,
}: ChannelOptionsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-full hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
        >
          <HiDotsVertical className="w-4 h-4 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] bg-gray-900 border border-white/20 rounded-lg p-1 shadow-lg z-50"
          sideOffset={5}
          align="end"
        >
          {onSettings ? (
            <DropdownMenu.Item
              onClick={() => {
                onSettings(channel);
                setOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-md cursor-pointer outline-none"
            >
              <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317a1 1 0 011.35-.936l1.175.47a1 1 0 00.95 0l1.175-.47a1 1 0 011.35.936l.176 1.268a1 1 0 00.57.757l1.13.565a1 1 0 01.447 1.341l-.56 1.121a1 1 0 000 .894l.56 1.121a1 1 0 01-.447 1.341l-1.13.565a1 1 0 00-.57.757l-.176 1.268a1 1 0 01-1.35.936l-1.175-.47a1 1 0 00-.95 0l-1.175.47a1 1 0 01-1.35-.936l-.176-1.268a1 1 0 00-.57-.757l-1.13-.565a1 1 0 01-.447-1.341l.56-1.121a1 1 0 000-.894l-.56-1.121a1 1 0 01.447-1.341l1.13-.565a1 1 0 00.57-.757l.176-1.268z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              Settings
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item
            onClick={() => {
              onInstall(channel);
              setOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-md cursor-pointer outline-none"
          >
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Install
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onClick={() => {
              onShare(channel, profileIdentifier);
              setOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-md cursor-pointer outline-none"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
