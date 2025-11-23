'use client';
import React, { useState, useEffect ,useMemo} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import InputField from '@/components/ui/InputField';
import { Copy, ExternalLink } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { AppDispatch } from '@/store/store';
import { uploadImage, getStreamsByCreator, updateStream, getUserProfile } from '@/lib/supabase-service';
import { createLivestream } from '@/features/streamAPI';
import { clsx } from 'clsx';

export function ProfileCustomization() {
  const { user } = usePrivy();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    avatar: '',
    socialLinks: {} as { twitter?: string; instagram?: string; youtube?: string; website?: string },
  });
  const [saving, setSaving] = useState(false);
  const [profileUrl, setProfileUrl] = useState('');
  const [errors, setErrors] = useState<{
    displayName?: string;
    bio?: string;
    avatar?: string;
    amount?: string;
  }>({});
  
  // Stream-related state
  type ViewMode = 'free' | 'one-time' | 'monthly';
  const [streamData, setStreamData] = useState({
    viewMode: 'free' as ViewMode,
    amount: 0,
    bgcolor: '#ffffff',
    color: '#000000',
    fontSize: '16',
    fontFamily: 'Arial',
    record: false,
    donations: [0, 0, 0, 0] as number[],
  });
  const [existingStream, setExistingStream] = useState<any>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Get creator address (wallet address)
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const creatorAddress = useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length === 0) return null;
    
    // Check if primary login method is a wallet
    const firstAccount = user.linkedAccounts[0];
    if (firstAccount.type === 'wallet' && 'address' in firstAccount && firstAccount.address) {
      return firstAccount.address;
    }
    
    // Find a wallet from linked accounts
    const walletAccount = user.linkedAccounts.find((account: any) => account.type === 'wallet' && 'address' in account && account.address);
    if (walletAccount && 'address' in walletAccount && walletAccount.address) {
      return walletAccount.address;
    }
    
    return null;
  }, [user?.linkedAccounts]);

  // Helper function to convert socialLinks from array of JSON strings to object format
  const parseSocialLinks = (socialLinksArray: string[] | null | undefined): { twitter?: string; instagram?: string; youtube?: string; website?: string } => {
    const socialLinks: { twitter?: string; instagram?: string; youtube?: string; website?: string } = {};
    
    if (Array.isArray(socialLinksArray)) {
      socialLinksArray.forEach((jsonString: string) => {
        if (typeof jsonString === 'string') {
          try {
            const parsed = JSON.parse(jsonString);
            Object.keys(parsed).forEach((key) => {
              const value = parsed[key];
              if (key === 'twitter' && value) {
                socialLinks.twitter = value;
              } else if (key === 'instagram' && value) {
                socialLinks.instagram = value;
              } else if (key === 'youtube' && value) {
                socialLinks.youtube = value;
              } else if (key === 'website' && value) {
                socialLinks.website = value;
              }
            });
          } catch (e) {
            console.warn('Failed to parse social link JSON:', jsonString);
          }
        }
      });
    }
    
    return socialLinks;
  };

  // Helper function to convert socialLinks object to array of JSON strings
  const stringifySocialLinks = (socialLinks: { twitter?: string; instagram?: string; youtube?: string; website?: string }): string[] => {
    const socialLinksArray: string[] = [];
    if (socialLinks.twitter) {
      socialLinksArray.push(JSON.stringify({ twitter: socialLinks.twitter }));
    }
    if (socialLinks.instagram) {
      socialLinksArray.push(JSON.stringify({ instagram: socialLinks.instagram }));
    }
    if (socialLinks.youtube) {
      socialLinksArray.push(JSON.stringify({ youtube: socialLinks.youtube }));
    }
    if (socialLinks.website) {
      socialLinksArray.push(JSON.stringify({ website: socialLinks.website }));
    }
    return socialLinksArray;
  };

  // Fetch existing stream data and load it into form
  useEffect(() => {
    const fetchExistingStream = async () => {
      if (!creatorAddress) return;
      
      try {
        setLoadingStream(true);
        const streams = await getStreamsByCreator(creatorAddress);
        if (streams && streams.length > 0) {
          // Use the first stream (or you could use the most recent one)
          const stream = streams[0];
          setExistingStream(stream);
          
          // Load stream data into form fields
          setProfileData({
            displayName: stream.title || stream.streamName || '',
            bio: stream.description || '',
            avatar: stream.logo || '',
            socialLinks: parseSocialLinks(stream.socialLinks),
          });
          
          setStreamData({
            viewMode: stream.viewMode || 'free',
            amount: stream.amount || 0,
            bgcolor: stream.bgcolor || '#ffffff',
            color: stream.color || '#000000',
            fontSize: stream.fontSize?.toString() || '16',
            fontFamily: stream.fontFamily || 'Arial',
            record: false, // Default to false (NO) - not stored in stream table
            donations: stream.donations || [0, 0, 0, 0],
          });
        }
      } catch (error: any) {
        console.error('Error fetching stream:', error);
        // Don't show error toast - stream might not exist yet
      } finally {
        setLoadingStream(false);
      }
    };

    fetchExistingStream();
  }, [creatorAddress]);

  const loading = loadingStream;

  // Fetch user profile to get username
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!creatorAddress) return;
      try {
        const profile = await getUserProfile(creatorAddress);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchUserProfile();
  }, [creatorAddress]);

  // Generate profile URL using username
  useEffect(() => {
    if (creatorAddress && userProfile?.displayName) {
      const host = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      // Use username (displayName) in the URL
      setProfileUrl(`${host}/creator/${encodeURIComponent(userProfile.displayName)}`);
    } else if (creatorAddress) {
      // Fallback to wallet address if username not available yet
      const host = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      setProfileUrl(`${host}/creator/${creatorAddress}`);
    }
  }, [creatorAddress, userProfile?.displayName]);

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user types
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [platform]: value
      }
    }));
  };


  const handleStreamChange = (field: string, value: any) => {
    setStreamData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user types
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setStreamData(prev => ({
      ...prev,
      viewMode: mode,
      amount: mode === 'free' ? 0 : prev.amount
    }));
  };

  const handleDonationChange = (index: number, value: string) => {
    const newDonations = [...streamData.donations];
    newDonations[index] = parseFloat(value) || 0;
    setStreamData(prev => ({
      ...prev,
      donations: newDonations
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show loading state
    const prevAvatar = profileData.avatar;
    setProfileData(prev => ({ ...prev, avatar: '' }));

    try {
      const imageUrl = await uploadImage(file, "user-avatars");
      
      if (imageUrl) {
        setProfileData(prev => ({
          ...prev,
          avatar: imageUrl
        }));
        toast.success('Avatar uploaded successfully');
      } else {
        setProfileData(prev => ({ ...prev, avatar: prevAvatar }));
        toast.error('Failed to upload avatar');
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setProfileData(prev => ({ ...prev, avatar: prevAvatar }));
      toast.error(error.message || 'Failed to upload avatar');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!profileData.displayName.trim()) {
      newErrors.displayName = 'Channel name is required';
    }
    
    if (!profileData.bio.trim()) {
      newErrors.bio = 'Channel description is required';
    }

    if (!profileData.avatar || !profileData.avatar.trim()) {
      newErrors.avatar = 'Channel logo is required';
    }

    // Validate stream amount if viewMode is not free
    if (streamData.viewMode !== 'free' && (streamData.amount === undefined || streamData.amount <= 0 || isNaN(streamData.amount))) {
      newErrors.amount = 'Amount is required for paid streams';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!creatorAddress) {
      toast.error('Wallet not connected');
      return;
    }

    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      
      // Handle Stream Creation/Update (only updating stream table, not users table)
      if (existingStream) {
        // Update existing stream
        await updateStream(existingStream.playbackId, {
          title: profileData.displayName,
          streamName: profileData.displayName, // Keep streamName for backward compatibility
          description: profileData.bio,
          logo: profileData.avatar,
          viewMode: streamData.viewMode,
          amount: streamData.viewMode !== 'free' ? streamData.amount : null,
          bgcolor: streamData.bgcolor,
          color: streamData.color,
          fontSize: parseInt(streamData.fontSize) || null,
          fontFamily: streamData.fontFamily,
          socialLinks: stringifySocialLinks(profileData.socialLinks),
          donations: streamData.donations,
        });
        toast.success('Channel updated successfully!');
      } else {
        // Create new stream on first save
        const streamResult = await dispatch(createLivestream({
          streamName: profileData.displayName,
          record: streamData.record,
          creatorId: creatorAddress,
          viewMode: streamData.viewMode,
          amount: streamData.viewMode !== 'free' ? streamData.amount : 0,
          description: profileData.bio,
          bgcolor: streamData.bgcolor,
          color: streamData.color,
          fontSize: streamData.fontSize,
          logo: profileData.avatar,
          donation: streamData.donations,
          socialLinks: stringifySocialLinks(profileData.socialLinks),
        })).unwrap();
        
        // Fetch the created stream to update existingStream state
        const streams = await getStreamsByCreator(creatorAddress);
        if (streams && streams.length > 0) {
          const newStream = streams[0];
          setExistingStream(newStream);
        }
        
        // Route to dashboard without channelId - content stays hidden until channel is selected
        router.push('/dashboard');
        toast.success('Channel created successfully!');
      }
    } catch (error: any) {
      console.error('Error saving channel:', error);
      toast.error(error?.message || `Failed to ${existingStream ? 'update' : 'create'} channel`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Profile URL copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const handlePreview = () => {
    window.open(profileUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8 bg-black! rounded-lg">
        <Bars width={40} height={40} color="#facc15" />
      </div>
    );
  }

  const hasRequiredFields = profileData?.displayName?.trim() && profileData?.bio?.trim();

  return (
    <div className="space-y-6">
      <div className="border-b border-white/20 pb-4">
        <h3 className="text-xl font-bold mb-2 text-white">Channel Profile</h3>
        <p className="text-gray-300">Customize your Channel profile that viewers will see</p>
      </div>

      {/* Profile URL Section - only show if required fields are filled */}
      {hasRequiredFields && (
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-white">Your Channel URL</h4>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={profileUrl}
              readOnly
              className="flex-1 p-2 border border-white/20 bg-white/10 backdrop-blur-sm rounded text-white"
            />
            <button
              onClick={handleCopyUrl}
              className="p-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded transition-colors"
              title="Copy URL"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handlePreview}
              className="p-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded hover:bg-white/20 transition-colors"
              title="Preview Channel"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h4 className="font-semibold text-white">Channel Information</h4>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-white">
            Channel Name <span className="text-red-400">*</span>
          </label>
          <InputField
            type="text"
            value={profileData?.displayName}
            onChange={(e) => handleInputChange('displayName', e.target.value)}
            placeholder="Enter your channel name"
            className={`w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 ${errors.displayName ? 'border-red-400' : ''}`}
          />
          {errors.displayName && (
            <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-white">
            Channel Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={profileData?.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder="Tell viewers about your channel..."
            className={`w-full p-3 border border-white/20 bg-white/10 backdrop-blur-sm rounded-lg resize-none h-24 text-white placeholder-gray-400 ${errors.bio ? 'border-red-400' : ''}`}
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-300">{profileData?.bio?.length}/500 characters</p>
            {errors.bio && (
              <p className="text-red-400 text-xs">{errors.bio}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-white">
            Channel Logo <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center space-x-4">
            {profileData?.avatar && (
              <img
                src={profileData?.avatar}
                alt="Channel Logo"
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className={`block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-yellow-500 file:to-teal-500 hover:file:from-yellow-600 hover:file:to-teal-600 file:text-black ${errors.avatar ? 'border-red-400' : ''}`}
            />
          </div>
          {errors.avatar && (
            <p className="text-red-400 text-xs mt-1">{errors.avatar}</p>
          )}
        </div>
      </div>

      {/* Social Links */}
      <div className="space-y-4">
        <h4 className="font-semibold text-white">Social Links <span className="text-sm font-normal text-gray-300">(Optional)</span></h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Twitter </label>
            <InputField
              type="url"
              value={profileData?.socialLinks?.twitter || ''}
              onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
              placeholder="https://twitter.com/username"
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Instagram </label>
            <InputField
              type="url"
              value={profileData?.socialLinks?.instagram || ''}
              onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
              placeholder="https://instagram.com/username"
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-white">YouTube </label>
            <InputField
              type="url"
              value={profileData?.socialLinks?.youtube || ''}
              onChange={(e) => handleSocialLinkChange('youtube', e.target.value)}
              placeholder="https://youtube.com/@channel"
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Website</label>
            <InputField
              type="url"
              value={profileData?.socialLinks?.website || ''}
              onChange={(e) => handleSocialLinkChange('website', e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-white">View Mode</label>
          <div className="flex gap-2 flex-wrap">
            {(['free', 'one-time', 'monthly'] as ViewMode[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleViewModeChange(option)}
                className={clsx(
                  'px-4 py-2 border capitalize text-sm rounded transition-colors',
                  streamData.viewMode === option 
                    ? 'bg-gradient-to-r from-yellow-500 to-teal-500 text-black border-transparent' 
                    : 'bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {streamData.viewMode !== 'free' && (
          <div>
            <label className="block text-sm font-medium mb-1 text-white">
              Amount (USDC) <span className="text-red-400">*</span>
            </label>
            <InputField
              type="number"
              step="any"
              min="0"
              value={streamData.amount === 0 ? '' : streamData.amount}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                handleStreamChange('amount', value);
              }}
              placeholder="0.00"
              className={`w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 ${errors.amount ? 'border-red-400' : ''}`}
            />
            {errors.amount && (
              <p className="text-red-400 text-xs mt-1">{errors.amount}</p>
            )}
          </div>
        )}

      </div>

      {/* Stream Customization */}
      <div className="space-y-4">
        <h4 className="font-semibold text-white">Stream & Video Settings</h4>
        
        {/* View Mode */}
      
        {/* Amount */}
      

        {/* Record Option */}
        {/* <div>
          <label className="block text-sm font-medium mb-1 text-white">Record Stream?</label>
          <select
            value={streamData.record ? 'yes' : 'no'}
            onChange={(e) => handleStreamChange('record', e.target.value === 'yes')}
            className="w-full p-2 border border-white/20 bg-white/10 backdrop-blur-sm rounded text-white"
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div> */}

        {/* Donation Presets */}
        <div>
          <label className="block text-sm font-medium mb-2 text-white">Donation Presets (USDC)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {streamData.donations.map((value, i) => (
              <InputField
                key={i}
                type="number"
                step="any"
                min="0"
                value={value === 0 ? '' : value}
                onChange={(e) => handleDonationChange(i, e.target.value)}
                placeholder={`Preset Amount ${i + 1}`}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400"
              />
            ))}
          </div>
        </div>

        {/* Background & Text Color */}
        <div className="grid grid-cols-2 gap-4">
          {/* Background Color */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Background Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleStreamChange('bgcolor', color)}
                  className={clsx(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    streamData.bgcolor === color ? 'ring-2 ring-yellow-400 scale-110' : 'border-white/30'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={streamData.bgcolor}
                onChange={(e) => handleStreamChange('bgcolor', e.target.value)}
                className="w-8 h-8 rounded-full border border-white/20 cursor-pointer"
                title="Custom background color"
              />
            </div>
          </div>
          
          {/* Text Color */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Text Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {['#000000', '#ffffff', '#ff00ff', '#00ffff', '#888888'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleStreamChange('color', color)}
                  className={clsx(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    streamData.color === color ? 'ring-2 ring-yellow-400 scale-110' : 'border-white/30'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={streamData.color}
                onChange={(e) => handleStreamChange('color', e.target.value)}
                className="w-8 h-8 rounded-full border border-white/20 cursor-pointer"
                title="Custom text color"
              />
            </div>
          </div>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            Font Size ({streamData.fontSize}px)
          </label>
          <input
            type="range"
            min="12"
            max="24"
            value={streamData.fontSize}
            onChange={(e) => handleStreamChange('fontSize', e.target.value)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-300 mt-1">
            <span>12px</span>
            <span>24px</span>
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className="block text-sm font-medium mb-1 text-white">Font Family</label>
          <select
            value={streamData.fontFamily}
            onChange={(e) => handleStreamChange('fontFamily', e.target.value)}
            className="w-full p-2 border border-white/20 bg-white/10 backdrop-blur-sm rounded text-white"
          >
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Verdana">Verdana</option>
            <option value="Georgia">Georgia</option>
            <option value="Palatino">Palatino</option>
            <option value="Garamond">Garamond</option>
            <option value="Comic Sans MS">Comic Sans MS</option>
            <option value="Impact">Impact</option>
          </select>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-white/20">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="flex items-center space-x-2">
              <Bars width={16} height={16} color="#ffffff" />
              <span>Saving...</span>
            </div>
          ) : (
            'Save Profile'
          )}
        </button>
      </div>
    </div>
  );
} 