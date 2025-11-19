'use client';

import { useState, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import { uploadImage, getUserProfile, upsertUserProfile, isDisplayNameUnique } from '@/lib/supabase-service';
import * as Dialog from '@radix-ui/react-dialog';
import { IoMdClose } from 'react-icons/io';
import InputField from '@/components/ui/InputField';
import { useMemo } from 'react';

interface UserSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserSetupModal({ open, onClose, onSuccess }: UserSetupModalProps) {
  const { user } = usePrivy();
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    avatar?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get creator address (wallet address)
  const creatorAddress = useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length === 0) return null;
    
    const firstAccount = user.linkedAccounts[0];
    if (firstAccount.type === 'wallet' && 'address' in firstAccount && firstAccount.address) {
      return firstAccount.address;
    }
    
    const walletAccount = user.linkedAccounts.find((account: any) => account.type === 'wallet' && 'address' in account && account.address);
    if (walletAccount && 'address' in walletAccount && walletAccount.address) {
      return walletAccount.address;
    }
    
    return null;
  }, [user?.linkedAccounts]);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatar: 'Please select an image file' }));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, avatar: 'Image size must be less than 5MB' }));
      return;
    }

    setAvatarFile(file);
    setErrors(prev => ({ ...prev, avatar: undefined }));

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: typeof errors = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Username is required';
    } else if (displayName.trim().length < 3) {
      newErrors.displayName = 'Username must be at least 3 characters';
    } else if (displayName.trim().length > 30) {
      newErrors.displayName = 'Username must be less than 30 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(displayName.trim())) {
      newErrors.displayName = 'Username can only contain letters, numbers, underscores, and hyphens';
    } else {
      // Check if displayName is unique
      try {
        const isUnique = await isDisplayNameUnique(displayName.trim(), creatorAddress || undefined);
        if (!isUnique) {
          newErrors.displayName = 'This username is already taken';
        }
      } catch (error: any) {
        newErrors.displayName = 'Failed to check username availability';
        console.error('Error checking username:', error);
      }
    }

    if (!avatar && !avatarFile) {
      newErrors.avatar = 'Profile picture is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!creatorAddress) {
      toast.error('Wallet not connected');
      return;
    }

    const isValid = await validateForm();
    if (!isValid) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    try {
      setLoading(true);

      let avatarUrl = avatar;

      // Upload avatar if a new file was selected
      if (avatarFile) {
        const uploadedUrl = await uploadImage(avatarFile, 'user-avatars');
        if (!uploadedUrl) {
          toast.error('Failed to upload profile picture');
          setLoading(false);
          return;
        }
        avatarUrl = uploadedUrl;
      }

      // Get existing profile to preserve Channels
      const existingProfile = await getUserProfile(creatorAddress);
      const existingChannels = existingProfile?.Channels || [];

      // Create or update user profile
      await upsertUserProfile({
        creatorId: creatorAddress,
        displayName: displayName.trim(),
        avatar: avatarUrl,
        bio: existingProfile?.bio || null,
        socialLinks: existingProfile?.socialLinks || [],
        Channels: existingChannels,
      });

      toast.success('Profile setup complete!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error setting up profile:', error);
      toast.error(error?.message || 'Failed to setup profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-white/20 px-8 py-6 shadow-2xl z-[101]">
          <Dialog.Title className="text-white text-center text-2xl font-bold mb-2">
            Complete Your Profile
          </Dialog.Title>
          <Dialog.Description className="text-gray-300 text-center text-sm mb-6">
            Please provide a username and profile picture to continue
          </Dialog.Description>

          <div className="w-full space-y-4">
            {/* Avatar Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Profile Picture <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-4">
                {avatar ? (
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-yellow-400">
                    <img
                      src={avatar}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-r from-yellow-500/30 to-teal-500/30 flex items-center justify-center border-2 border-yellow-400">
                    <span className="text-yellow-400 text-2xl">?</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg hover:bg-white/20 transition-colors text-sm"
                >
                  {avatar ? 'Change Picture' : 'Select Picture'}
                </button>
              </div>
              {errors.avatar && (
                <p className="text-red-400 text-xs mt-1">{errors.avatar}</p>
              )}
            </div>

            {/* Display Name Input */}
            <div>
              <label className="block text-sm font-medium mb-1 text-white">
                Username <span className="text-red-400">*</span>
              </label>
              <InputField
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.displayName) {
                    setErrors(prev => ({ ...prev, displayName: undefined }));
                  }
                }}
                placeholder="Enter your username"
                className={`w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 ${errors.displayName ? 'border-red-400' : ''}`}
                maxLength={30}
              />
              {errors.displayName && (
                <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>
              )}
              <p className="text-gray-400 text-xs mt-1">
                {displayName.length}/30 characters (letters, numbers, _, - only)
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 w-full mt-6">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Bars width={16} height={16} color="#000000" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save & Continue'
              )}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-2.5 top-2.5 inline-flex size-[25px] appearance-none items-center justify-center rounded-full text-white hover:bg-white/10 focus:shadow-[0_0_0_2px] focus:shadow-yellow-500 focus:outline-none transition-colors"
              aria-label="Close"
              disabled={loading}
            >
              <IoMdClose className="text-white font-medium text-2xl" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

