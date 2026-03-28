'use client';
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-56 rounded-md py-1 border bg-popover text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };

//Usage
import { useState } from 'react';
import { AiOutlineCloudDownload, AiOutlineEdit } from 'react-icons/ai';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { HiLink } from 'react-icons/hi';
import { PiCalendarCheckBold } from 'react-icons/pi';
import { RiDeleteBin6Line, RiTokenSwapFill } from 'react-icons/ri';
import { AlertDialogs } from './Alert';
import { AssetPopProps, PopupProps } from '@/interfaces/index';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { deleteStream, getAllStreams } from '@/features/streamAPI';
import { AppDispatch, RootState } from '@/store/store';
import { RotatingLines } from 'react-loader-spinner';
import { resetStreamStatus } from '@/features/streamSlice';
import { deleteAsset, getAssets } from '@/features/assetsAPI';
import { resetAssetStatus } from '@/features/assetsSlice';
import { UpdateLivestream } from './UpdateLivestream';
import { CustomizeChannelDialog } from './Dialog';
import { deleteStream as deleteStreamFromSupabase, deleteVideo as deleteVideoFromSupabase } from '@/lib/supabase-service';

const listItemClassNames = {
  option: 'flex items-center text-lg px-5 py-2 hover:bg-white/10 cursor-pointer text-white',
  icon: 'text-white text-xl font-bold',
};

export const Popup = ({ playbackId, streamId }: PopupProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { error } = useSelector((state: RootState) => state.streams);
  const [alertOpen, setAlertOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const host = process.env.NEXT_PUBLIC_BASE_URL;
  const playbackUrl =
    host && playbackId ? `${host.includes('localhost') ? 'http' : 'https'}://${host}/view/${playbackId}` : null;

  const handleEditDetails = () => {
    setIsDialogOpen(true);
  };

  const handleCopyStreamLink = () => {
    if (playbackUrl) {
      navigator.clipboard
        .writeText(playbackUrl)
        .then(() => {
          toast.success('Stream link copied!');
        })
        .catch(() => {
          toast.error("Stream link isn't available.");
        });
    } else {
      toast.error("Stream link isn't available.");
    }
  };

  const handleScheduleStream = () => {
    toast('Schedule stream clicked');
    // TODO: Open schedule modal or navigate accordingly.
  };

  // const handleCustomizeChannel = () => {
  //   toast('Customize channel clicked');
  //   // TODO: Open customization modal or navigate accordingly.
  // };

  const handleDeleteChannel = () => {
    // Simply open the alert dialog.
    setAlertOpen(true);
  };
  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      // Delete from Livepeer first — if this fails, Supabase record stays intact
      await dispatch(deleteStream(streamId)).unwrap();
      // Then clean up Supabase metadata
      await deleteStreamFromSupabase(playbackId);
      toast.success('Channel deleted successfully');
      dispatch(resetStreamStatus());
      dispatch(getAllStreams());
      setAlertOpen(false);
    } catch (err: any) {
      toast.error(err.message || error || 'Failed to delete channel');
    }
    setIsLoading(false);
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="p-2 hover:bg-white/10 rounded transition-colors relative z-10">
            <BsThreeDotsVertical className="text-lg cursor-pointer text-white focus:bg-purple-500 focus:ring-2 focus:ring-offset-2" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content 
            className="min-w-[200px] bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded shadow-md p-2 z-[9999]"
            sideOffset={5}
            align="end"
            side="bottom"
          >
          {/* <DropdownMenu.Item onSelect={handleEditDetails} className={`${listItemClassNames.option}  `}>
            <HiLink className={`${listItemClassNames.icon} text-main-blue`} />
            <p className="ml-2 text-sm text-white hover:text-main-blue font-medium">Edit Livestream/Channel</p>
          </DropdownMenu.Item> */}
          <DropdownMenu.Item onSelect={handleCopyStreamLink} className={listItemClassNames.option}>
            <AiOutlineEdit className={`${listItemClassNames.icon} text-green-500`} />
            <p className="ml-2 text-sm font-medium text-white hover:text-green-500">Copy Stream Link</p>
          </DropdownMenu.Item>
          {/* <DropdownMenu.Item onSelect={handleScheduleStream} className={listItemClassNames.option}>
            <PiCalendarCheckBold className={`${listItemClassNames.icon} text-blue-500`} />
            <p className="ml-2 text-sm font-medium text-white hover:text-blue-500">Schedule stream</p>
          </DropdownMenu.Item> */}
          <DropdownMenu.Item onSelect={handleDeleteChannel} className={listItemClassNames.option}>
            <RiDeleteBin6Line className={`${listItemClassNames.icon} text-red-700`} />
            <p className="ml-2 text-sm font-medium text-white hover:text-red-700">Delete channel</p>
          </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <AlertDialogs
        open={alertOpen}
        setOpen={setAlertOpen}
        title="Delete Channel"
        description="Are you sure you want to delete this channel? This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Yes, delete channel"
        onConfirm={confirmDelete}
        loading={isLoading}
      />
        {isDialogOpen && <UpdateLivestream open={isDialogOpen} onClose={() => setIsDialogOpen(false)} id={streamId} />}
    </>
  );
};

// deletevideo
export const AssetPopup = ({ asset }: AssetPopProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { error } = useSelector((state: RootState) => state.assets);
  const [alertOpen, setAlertOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDeleteAsset = () => {
    // Simply open the alert dialog.
    setAlertOpen(true);
  };

  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      // Delete from Livepeer first — if this fails, Supabase record stays intact
      await dispatch(deleteAsset(asset.id)).unwrap();
      // Then clean up Supabase metadata
      await deleteVideoFromSupabase(asset.playbackId);
      toast.success('Asset deleted successfully');
      dispatch(resetAssetStatus());
      // Refresh assets list
      dispatch(getAssets());
      setAlertOpen(false);
    } catch (err: any) {
      toast.error(err.message || error || 'Failed to delete asset');
    }
    setIsLoading(false);
  };
  const handleCopyAssetLink = () => {
    // Copy the stream link to the clipboard.
    if (asset.downloadUrl) {
      navigator.clipboard
        .writeText(asset.downloadUrl)
        .then(() => {
          toast.success('Download Link copied!');
        })
        .catch(() => {
          toast.error("Download Link isn't available.");
        });
    }
  };
  const handleDownloadAds = () => {
    if (asset.downloadUrl) {
      window.open(asset.downloadUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Download URL not available.');
    }
  };
  const handlePlaybackId = () => {
    // Copy the stream link to the clipboard.
    if (asset.playbackId) {
      navigator.clipboard
        .writeText(asset.playbackId)
        .then(() => {
          toast.success('Playback ID copied!');
        })
        .catch(() => {
          toast.error("Playback ID isn't available.");
        });
    }
  };
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="p-2">
            <BsThreeDotsVertical className="text-lg cursor-pointer text-black-primary-text focus:bg-main-blue focus:ring-2 focus:ring-offset-2" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="min-w-[200px] min-h-fit z-50 bg-white rounded shadow-md p-2">
          {/* <DropdownMenu.Item onSelect={handleCopyAssetLink} className="flex items-center text-lg px-5 py-2 hover:bg-gray-100 cursor-pointer text-black">
            <RiTokenSwapFill className="text-black text-xl font-bold" />
            <p className="ml-2 text-sm font-medium text-black">Copy Download URL</p>
          </DropdownMenu.Item>

          <DropdownMenu.Item onSelect={handleDownloadAds} className="flex items-center text-lg px-5 py-2 hover:bg-gray-100 cursor-pointer text-black">
            <AiOutlineCloudDownload className="text-black text-xl font-bold" />
            <p className="ml-2 text-sm font-medium text-black">Download video</p>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={handlePlaybackId} className="flex items-center text-lg px-5 py-2 hover:bg-gray-100 cursor-pointer text-black">
            <HiLink className="text-black text-xl font-bold" />
            <p className="ml-2 text-sm text-black font-medium">Copy PlaybackId</p>
          </DropdownMenu.Item> */}

          <DropdownMenu.Item onSelect={handleDeleteAsset} className="flex items-center text-lg px-5 py-2 hover:bg-gray-100 cursor-pointer text-black">
            <RiDeleteBin6Line className="text-red-700 text-xl font-bold" />
            <p className="ml-2 text-sm font-medium text-red-700">Delete video</p>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <AlertDialogs
        open={alertOpen}
        setOpen={setAlertOpen}
        title="Delete Asset"
        description="Are you sure you want to delete this Video? This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Yes, Delete Asset"
        onConfirm={confirmDelete}
        loading={isLoading}
      />
    </>
  );
};
