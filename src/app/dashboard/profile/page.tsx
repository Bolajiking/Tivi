'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Header from '@/components/Header';
import MobileSidebar from '@/components/MobileSidebar';
import BottomNav from '@/components/BottomNav';
import { FaRegUserCircle, FaCopy, FaCheck, FaWallet, FaKey, FaEnvelope, FaLink, FaUpload } from 'react-icons/fa';
import Image from 'next/image';
import { toast } from 'sonner';
import { getUserProfile, uploadImage, updateUserProfile, createUserProfile } from '@/lib/supabase-service';
import type { SupabaseUser } from '@/lib/supabase-types';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

const ProfilePage: React.FC = () => {
  const { user, authenticated, ready } = usePrivy();
  const { walletAddress } = useWalletAddress();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<SupabaseUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Get primary login method (first account used to login)
  const primaryLoginMethod = useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length === 0) return null;
    const firstAccount = user.linkedAccounts[0];
    
    if (firstAccount.type === 'wallet') {
      return { 
        type: 'Wallet', 
        provider: (firstAccount as any).walletClientType || 'External', 
        address: firstAccount.address,
        chainType: (firstAccount as any).chainType || 'ethereum'
      };
    } else if (firstAccount.type === 'email') {
      return { type: 'Email', email: firstAccount.address };
    } else if (firstAccount.type === 'farcaster') {
      return { type: 'Farcaster', username: (firstAccount as any).username || (firstAccount as any).address || 'farcaster' };
    }
    return { type: firstAccount.type };
  }, [user?.linkedAccounts]);

  // Get all linked accounts (excluding the first one which is the login method)
  const linkedAccounts = useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length <= 1) return [];
    return user.linkedAccounts.slice(1).map((account: any) => {
      if (account.type === 'wallet') {
        return { 
          type: 'Wallet', 
          provider: account.walletClientType || 'External', 
          address: account.address,
          chainType: account.chainType || 'ethereum'
        };
      } else if (account.type === 'email') {
        return { type: 'Email', email: account.address };
      } else if (account.type === 'farcaster') {
        return { type: 'Farcaster', username: account.username || (account as any).address || 'farcaster' };
      }
      return { type: account.type };
    });
  }, [user?.linkedAccounts]);

  // Get creator address (wallet address)
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const creatorAddress = useMemo(() => walletAddress || null, [walletAddress]);

  // Fetch user profile from Supabase
  useEffect(() => {
    if (!creatorAddress || !ready) return;

    const fetchUserProfile = async () => {
      try {
        setLoadingProfile(true);
        const profile = await getUserProfile(creatorAddress);
        setUserProfile(profile);
      } catch (error: any) {
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [creatorAddress, ready]);

  // Get user display picture from Supabase
  const displayPicture = useMemo(() => {
    if (userProfile?.avatar) {
      return userProfile.avatar;
    }
    return null;
  }, [userProfile?.avatar]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Email':
        return <FaEnvelope className="text-blue-400" />;
      case 'Wallet':
        return <FaWallet className="text-green-400" />;
      case 'Farcaster':
        return <FaLink className="text-purple-400" />;
      default:
        return <FaRegUserCircle className="text-gray-400" />;
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!creatorAddress) {
      toast.error('Wallet not connected');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      
      // Upload image to Supabase storage
      const imageUrl = await uploadImage(file, 'user-avatars');
      
      if (!imageUrl) {
        toast.error('Failed to upload image');
        return;
      }

      // Update user profile in Supabase
      if (userProfile) {
        // Update existing profile
        const updatedProfile = await updateUserProfile(creatorAddress, { avatar: imageUrl });
        setUserProfile(updatedProfile);
      } else {
        // Create new profile if it doesn't exist
        try {
          const newProfile = await createUserProfile({
            creatorId: creatorAddress,
            displayName: null,
            bio: null,
            avatar: imageUrl,
            socialLinks: [],
            Channels: [],
          });
          setUserProfile(newProfile);
        } catch (error: any) {
          console.error('Error creating user profile:', error);
          toast.error(error.message || 'Failed to create user profile');
          return;
        }
      }

      toast.success('Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      e.target.value = '';
    }
  };

  if (!ready || !authenticated) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-black via-gray-950 to-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-black via-gray-950 to-black">
      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <MobileSidebar
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-auto pb-20">
          <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
          
          <div className="m-4 p-6">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6 space-y-6">
              <h1 className="text-2xl font-bold text-white mb-6">User Profile</h1>

              {/* Display Picture Section */}
              <div className="flex flex-col items-center gap-4 pb-6 border-b border-white/20">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-yellow-400/50 bg-white/10 flex items-center justify-center">
                  {loadingProfile ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : displayPicture ? (
                    <Image
                      src={displayPicture}
                      alt="Profile"
                      width={128}
                      height={128}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <FaRegUserCircle className="text-6xl text-gray-400" />
                  )}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-gray-300 text-sm">Profile Picture</p>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar || !creatorAddress}
                      className="hidden"
                      id="avatar-upload-input"
                    />
                    <label
                      htmlFor="avatar-upload-input"
                      className={`cursor-pointer inline-block ${uploadingAvatar || !creatorAddress ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        disabled={uploadingAvatar || !creatorAddress}
                        className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-600 text-black font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={(e) => {
                          if (!uploadingAvatar && creatorAddress) {
                            e.preventDefault();
                            document.getElementById('avatar-upload-input')?.click();
                          }
                        }}
                      >
                        {uploadingAvatar ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <FaUpload className="w-4 h-4" />
                            <span>Change Picture</span>
                          </>
                        )}
                      </button>
                    </label>
                  </div>
                  {!creatorAddress && (
                    <p className="text-gray-400 text-xs text-center">Connect wallet to upload picture</p>
                  )}
                </div>
              </div>

              {/* Primary Login Method Section */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FaKey className="text-yellow-400" />
                  Login Method
                </h2>
                <div className="space-y-2">
                  {primaryLoginMethod ? (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getAccountIcon(primaryLoginMethod.type)}
                        <div>
                          <p className="text-white font-medium">{primaryLoginMethod.type}</p>
                          {primaryLoginMethod.email && (
                            <p className="text-gray-400 text-sm">{primaryLoginMethod.email}</p>
                          )}
                          {primaryLoginMethod.username && (
                            <p className="text-gray-400 text-sm">@{primaryLoginMethod.username}</p>
                          )}
                          {primaryLoginMethod.address && (
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-gray-400 text-sm font-mono">
                                {formatAddress(primaryLoginMethod.address)}
                              </code>
                              <button
                                onClick={() => copyToClipboard(primaryLoginMethod.address, 'Address')}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Copy address"
                              >
                                {copiedAddress === primaryLoginMethod.address ? (
                                  <FaCheck className="text-green-400 text-xs" />
                                ) : (
                                  <FaCopy className="text-gray-400 text-xs" />
                                )}
                              </button>
                            </div>
                          )}
                          {primaryLoginMethod.provider && (
                            <p className="text-gray-400 text-xs mt-1">
                              Provider: {primaryLoginMethod.provider === 'privy' ? 'Embedded' : primaryLoginMethod.provider}
                            </p>
                          )}
                          {primaryLoginMethod.chainType && (
                            <p className="text-gray-400 text-xs mt-1">
                              Chain: {primaryLoginMethod.chainType}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No login method found</p>
                  )}
                </div>
              </div>

              {/* Linked Accounts Section */}
              {linkedAccounts.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/20">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FaLink className="text-yellow-400" />
                    Linked Accounts
                  </h2>
                  <div className="space-y-2">
                    {linkedAccounts.map((account: any, index: number) => (
                      <div
                        key={index}
                        className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {getAccountIcon(account.type)}
                          <div>
                            <p className="text-white font-medium">{account.type}</p>
                            {account.email && (
                              <p className="text-gray-400 text-sm">{account.email}</p>
                            )}
                            {account.username && (
                              <p className="text-gray-400 text-sm">@{account.username}</p>
                            )}
                            {account.address && (
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-gray-400 text-sm font-mono">
                                  {formatAddress(account.address)}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(account.address, 'Address')}
                                  className="p-1 hover:bg-white/10 rounded transition-colors"
                                  title="Copy address"
                                >
                                  {copiedAddress === account.address ? (
                                    <FaCheck className="text-green-400 text-xs" />
                                  ) : (
                                    <FaCopy className="text-gray-400 text-xs" />
                                  )}
                                </button>
                              </div>
                            )}
                            {account.provider && (
                              <p className="text-gray-400 text-xs mt-1">
                                Provider: {account.provider === 'privy' ? 'Embedded' : account.provider}
                              </p>
                            )}
                            {account.chainType && (
                              <p className="text-gray-400 text-xs mt-1">
                                Chain: {account.chainType}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    </div>
  );
};

export default ProfilePage;
