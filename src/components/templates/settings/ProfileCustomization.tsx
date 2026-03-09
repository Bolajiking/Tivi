'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { AppDispatch } from '@/store/store';
import {
  uploadImage,
  getStreamsByCreator,
  updateStream,
  getUserProfile,
  hasCreatorInviteAccess,
  redeemCreatorInviteCode,
} from '@/lib/supabase-service';
import { createLivestream } from '@/features/streamAPI';
import { clsx } from 'clsx';
import { useWalletAddress } from '@/app/hook/useWalletAddress';

/* ─── Shared input class ─── */
const inputCls =
  'w-full rounded-xl bg-raised border border-white/[0.07] px-3.5 py-2.5 text-[14px] text-white placeholder:text-[var(--text-3)] outline-none transition-all duration-150 focus:border-transparent focus:ring-1 focus:ring-[var(--accent)]/40';

const errorInputCls = 'border-red-500/50 focus:ring-red-500/30';

/* ─── Section wrapper — spacing only, no card ─── */
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-[13px] text-[var(--text-2)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ─── Field label ─── */
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-medium text-[var(--text-2)] mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

/* ─── Loading skeleton ─── */
function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 bg-raised rounded-lg w-48" />
      <div className="space-y-4">
        <div className="h-4 bg-raised rounded w-32" />
        <div className="h-11 bg-raised rounded-xl w-full" />
        <div className="h-4 bg-raised rounded w-24" />
        <div className="h-24 bg-raised rounded-xl w-full" />
      </div>
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-full bg-raised" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-raised rounded w-40" />
          <div className="h-9 bg-raised rounded-xl w-32" />
        </div>
      </div>
    </div>
  );
}

export function ProfileCustomization() {
  const { walletAddress } = useWalletAddress();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    avatar: '',
    socialLinks: {} as { twitter?: string; instagram?: string; youtube?: string; website?: string },
  });
  const [saving, setSaving] = useState(false);
  const [profileUrl, setProfileUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    bio?: string;
    avatar?: string;
    amount?: string;
  }>({});

  type ViewMode = 'free' | 'one-time' | 'monthly';
  const [streamData, setStreamData] = useState({
    viewMode: 'free' as ViewMode,
    amount: 0,
    bgcolor: '#0f0f0f',
    color: '#ffffff',
    fontSize: '16',
    fontFamily: 'Arial',
    record: false,
    donations: [0, 0, 0, 0] as number[],
  });
  const [existingStream, setExistingStream] = useState<any>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasCreatorAccess, setHasCreatorAccess] = useState(false);
  const [creatorAccessLoading, setCreatorAccessLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);

  const creatorAddress = useMemo(() => walletAddress || null, [walletAddress]);

  const parseSocialLinks = (socialLinksArray: string[] | null | undefined): { twitter?: string; instagram?: string; youtube?: string; website?: string } => {
    const socialLinks: { twitter?: string; instagram?: string; youtube?: string; website?: string } = {};
    if (Array.isArray(socialLinksArray)) {
      socialLinksArray.forEach((jsonString: string) => {
        if (typeof jsonString === 'string') {
          try {
            const parsed = JSON.parse(jsonString);
            Object.keys(parsed).forEach((key) => {
              const value = parsed[key];
              if (['twitter', 'instagram', 'youtube', 'website'].includes(key) && value) {
                (socialLinks as any)[key] = value;
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

  const stringifySocialLinks = (socialLinks: { twitter?: string; instagram?: string; youtube?: string; website?: string }): string[] => {
    const arr: string[] = [];
    if (socialLinks.twitter) arr.push(JSON.stringify({ twitter: socialLinks.twitter }));
    if (socialLinks.instagram) arr.push(JSON.stringify({ instagram: socialLinks.instagram }));
    if (socialLinks.youtube) arr.push(JSON.stringify({ youtube: socialLinks.youtube }));
    if (socialLinks.website) arr.push(JSON.stringify({ website: socialLinks.website }));
    return arr;
  };

  useEffect(() => {
    const fetchExistingStream = async () => {
      if (!creatorAddress) { setHasCreatorAccess(false); return; }
      try {
        setLoadingStream(true);
        setCreatorAccessLoading(true);
        const streams = await getStreamsByCreator(creatorAddress);
        if (streams && streams.length > 0) {
          const stream = streams[0];
          setExistingStream(stream);
          setHasCreatorAccess(true);
          setProfileData({
            displayName: stream.title || stream.streamName || '',
            bio: stream.description || '',
            avatar: stream.logo || '',
            socialLinks: parseSocialLinks(stream.socialLinks),
          });
          setStreamData({
            viewMode: stream.streamMode || stream.viewMode || 'free',
            amount: stream.streamAmount ?? stream.amount ?? 0,
            bgcolor: stream.bgcolor || '#0f0f0f',
            color: stream.color || '#ffffff',
            fontSize: stream.fontSize?.toString() || '16',
            fontFamily: stream.fontFamily || 'Arial',
            record: false,
            donations: stream.donations || [0, 0, 0, 0],
          });
        } else {
          setExistingStream(null);
          const access = await hasCreatorInviteAccess(creatorAddress);
          setHasCreatorAccess(access);
        }
      } catch (error: any) {
        console.error('Error fetching stream:', error);
        toast.error(error?.message || 'Failed to verify creator access');
        setHasCreatorAccess(false);
      } finally {
        setLoadingStream(false);
        setCreatorAccessLoading(false);
      }
    };
    fetchExistingStream();
  }, [creatorAddress]);

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

  useEffect(() => {
    if (creatorAddress && userProfile?.displayName) {
      const configuredBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
      const baseUrl = configuredBase
        ? configuredBase.startsWith('http') ? configuredBase : `https://${configuredBase}`
        : window.location.origin;
      setProfileUrl(`${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(userProfile.displayName)}`);
    } else {
      setProfileUrl('');
    }
  }, [creatorAddress, userProfile?.displayName]);

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setProfileData(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, [platform]: value } }));
  };

  const handleStreamChange = (field: string, value: any) => {
    setStreamData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setStreamData(prev => ({ ...prev, viewMode: mode, amount: mode === 'free' ? 0 : prev.amount }));
  };

  const isPaidLivestreamMode = streamData.viewMode !== 'free';

  const handleLivestreamModeToggle = (mode: 'free' | 'paid') => {
    if (mode === 'free') { handleViewModeChange('free'); return; }
    const nextMode: ViewMode = streamData.viewMode === 'free' ? 'one-time' : streamData.viewMode;
    handleViewModeChange(nextMode);
  };

  const handleDonationChange = (index: number, value: string) => {
    const newDonations = [...streamData.donations];
    newDonations[index] = parseFloat(value) || 0;
    setStreamData(prev => ({ ...prev, donations: newDonations }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const prevAvatar = profileData.avatar;
    setProfileData(prev => ({ ...prev, avatar: '' }));
    try {
      const imageUrl = await uploadImage(file, 'user-avatars');
      if (imageUrl) {
        setProfileData(prev => ({ ...prev, avatar: imageUrl }));
        toast.success('Logo uploaded');
      } else {
        setProfileData(prev => ({ ...prev, avatar: prevAvatar }));
        toast.error('Failed to upload logo');
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setProfileData(prev => ({ ...prev, avatar: prevAvatar }));
      toast.error(error.message || 'Failed to upload logo');
    }
  };

  const handleRedeemInviteCode = async () => {
    if (!creatorAddress) { toast.error('Wallet not connected'); return; }
    if (!inviteCode.trim()) { toast.error('Enter an invite code'); return; }
    try {
      setRedeemingCode(true);
      const result = await redeemCreatorInviteCode(creatorAddress, inviteCode);
      setHasCreatorAccess(true);
      setInviteCode('');
      toast.success(result.alreadyGranted ? 'Creator access already granted.' : 'Invite code redeemed. Access granted.');
    } catch (error: any) {
      console.error('Invite code redemption failed:', error);
      toast.error(error?.message || 'Failed to redeem invite code');
    } finally {
      setRedeemingCode(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    if (!profileData.displayName.trim()) newErrors.displayName = 'Channel name is required';
    if (!profileData.bio.trim()) newErrors.bio = 'Channel description is required';
    if (!profileData.avatar || !profileData.avatar.trim()) newErrors.avatar = 'Channel logo is required';
    if (streamData.viewMode !== 'free' && (streamData.amount === undefined || streamData.amount <= 0 || isNaN(streamData.amount)))
      newErrors.amount = 'Amount is required for paid streams';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!creatorAddress) { toast.error('Wallet not connected'); return; }
    if (!existingStream && !hasCreatorAccess) { toast.error('Creator invite access is required.'); return; }
    if (!validateForm()) { toast.error('Please fill in all required fields'); return; }

    try {
      setSaving(true);
      const creatorStreams = await getStreamsByCreator(creatorAddress);
      const activeStream = existingStream || creatorStreams?.[0] || null;

      if (activeStream) {
        await updateStream(activeStream.playbackId, {
          title: profileData.displayName,
          streamName: profileData.displayName,
          description: profileData.bio,
          logo: profileData.avatar,
          viewMode: streamData.viewMode,
          streamMode: streamData.viewMode,
          amount: streamData.viewMode !== 'free' ? streamData.amount : null,
          streamAmount: streamData.viewMode !== 'free' ? streamData.amount : null,
          bgcolor: streamData.bgcolor,
          color: streamData.color,
          fontSize: parseInt(streamData.fontSize) || null,
          fontFamily: streamData.fontFamily,
          socialLinks: stringifySocialLinks(profileData.socialLinks),
          donations: streamData.donations,
        });
        setExistingStream(activeStream);
        toast.success('Channel updated successfully!');
      } else {
        await dispatch(createLivestream({
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
        const streams = await getStreamsByCreator(creatorAddress);
        if (streams && streams.length > 0) setExistingStream(streams[0]);
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
    if (!profileUrl) { toast.error('Username is required to generate a URL.'); return; }
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast.success('URL copied!');
    } catch { toast.error('Failed to copy URL'); }
  };

  const handlePreview = () => {
    if (!profileUrl) { toast.error('Username is required to preview.'); return; }
    window.open(profileUrl, '_blank');
  };

  /* ─── Loading state ─── */
  if (loadingStream) return <FormSkeleton />;

  const hasRequiredFields = profileData?.displayName?.trim() && profileData?.bio?.trim();

  return (
    <div className="space-y-10">

      {/* ── Page title ── */}
      <h1 className="text-[28px] md:text-[34px] font-bold font-funnel-display text-white tracking-[-0.4px]">
        Channel settings
      </h1>

      {/* ── Creator invite access (new creators only) ── */}
      {!existingStream && (
        <div className="rounded-xl border border-white/[0.07] bg-raised p-5">
          <h4 className="text-[15px] font-semibold text-white">Creator invite access</h4>
          {creatorAccessLoading ? (
            <p className="text-[13px] text-[var(--text-2)] mt-2">Checking access...</p>
          ) : hasCreatorAccess ? (
            <p className="text-[13px] text-emerald-400 mt-2">
              Access granted. Complete your profile below and save to create your channel.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-[var(--text-2)] mt-2">
                Creator accounts are invite-only. Redeem an invite code to get started.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter invite code"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={handleRedeemInviteCode}
                  disabled={redeemingCode}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-teal-500 text-black text-[14px] font-semibold hover:from-yellow-500 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
                >
                  {redeemingCode ? 'Redeeming...' : 'Redeem'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Channel URL ── */}
      {hasRequiredFields && (
        <Section title="Channel URL" subtitle="Share this link with your audience">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={profileUrl}
              readOnly
              className={`${inputCls} flex-1 text-[var(--text-2)] cursor-default`}
            />
            <button
              onClick={handleCopyUrl}
              className="p-2.5 rounded-xl bg-raised border border-white/[0.07] text-[var(--text-2)] hover:text-white hover:border-white/[0.15] transition-all"
              title="Copy URL"
            >
              {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handlePreview}
              className="p-2.5 rounded-xl bg-raised border border-white/[0.07] text-[var(--text-2)] hover:text-white hover:border-white/[0.15] transition-all"
              title="Preview channel"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </Section>
      )}

      {/* ── Live preview ── */}
      <Section title="Preview">
        <div className="rounded-xl border border-white/[0.07] overflow-hidden">
          <div className="px-3 py-2 border-b border-white/[0.04]">
            <span className="text-[11px] tracking-widest text-[var(--text-3)] font-medium">live preview</span>
          </div>
          <div className="p-4" style={{ backgroundColor: streamData.bgcolor || '#0f0f0f' }}>
            <div className="flex items-center gap-3">
              {profileData.avatar ? (
                <img src={profileData.avatar} alt="Preview" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-400 to-teal-500 flex items-center justify-center text-black text-sm font-bold">
                  {(profileData.displayName || 'TV').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h4
                  className="font-bold leading-tight"
                  style={{
                    color: streamData.color || '#ffffff',
                    fontSize: `${Math.max(parseInt(streamData.fontSize || '16'), 14)}px`,
                    fontFamily: streamData.fontFamily || 'Arial',
                  }}
                >
                  {profileData.displayName || 'Your channel name'}
                </h4>
                <p className="text-[12px] mt-0.5" style={{ color: streamData.color || '#d1d5db' }}>
                  {streamData.viewMode === 'free'
                    ? 'Free access'
                    : `Paid access \u00b7 $${(streamData.amount || 0).toFixed(2)} USDC`}
                </p>
              </div>
            </div>
            <p
              className="mt-3 text-[13px] line-clamp-3 leading-relaxed"
              style={{ color: streamData.color || '#e5e7eb', fontFamily: streamData.fontFamily || 'Arial' }}
            >
              {profileData.bio || 'Your channel description will appear here...'}
            </p>
          </div>
        </div>
      </Section>

      {/* ── Channel information ── */}
      <Section title="Channel information" subtitle="Basic details viewers will see on your profile">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-6 items-start">
          <div className="space-y-5">
            <div>
              <Label required>Channel name</Label>
              <input
                type="text"
                value={profileData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                placeholder="Enter your channel name"
                className={`${inputCls} ${errors.displayName ? errorInputCls : ''}`}
              />
              {errors.displayName && <p className="text-red-400 text-[12px] mt-1">{errors.displayName}</p>}
            </div>

            <div>
              <Label required>Description</Label>
              <textarea
                value={profileData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell viewers about your channel..."
                className={`${inputCls} resize-none h-[100px] ${errors.bio ? errorInputCls : ''}`}
                maxLength={500}
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-[12px] text-[var(--text-3)]">{profileData.bio?.length || 0}/500</span>
                {errors.bio && <p className="text-red-400 text-[12px]">{errors.bio}</p>}
              </div>
            </div>
          </div>

          {/* Avatar upload — right column on desktop */}
          <div className="flex flex-col items-center gap-3 lg:pt-6">
            <div
              className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/[0.07] cursor-pointer group"
              onClick={() => avatarInputRef.current?.click()}
            >
              {profileData.avatar ? (
                <img src={profileData.avatar} alt="Channel logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-raised flex items-center justify-center">
                  <span className="text-[var(--text-3)] text-2xl">+</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-[11px] font-medium">Change</span>
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="text-[13px] text-[var(--text-2)] hover:text-white transition-colors"
            >
              {profileData.avatar ? 'Change logo' : 'Upload logo'}
            </button>
            {errors.avatar && <p className="text-red-400 text-[12px]">{errors.avatar}</p>}
          </div>
        </div>
      </Section>

      {/* ── Social links ── */}
      <Section title="Social links" subtitle="Optional - help viewers find you elsewhere">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { key: 'twitter', label: 'Twitter', placeholder: 'https://twitter.com/username' },
            { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
            { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel' },
            { key: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' },
          ] as const).map(({ key, label, placeholder }) => (
            <div key={key}>
              <Label>{label}</Label>
              <input
                type="url"
                value={profileData.socialLinks?.[key] || ''}
                onChange={(e) => handleSocialLinkChange(key, e.target.value)}
                placeholder={placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Stream & video settings ── */}
      <Section title="Stream & video settings" subtitle="Configure how your livestreams and content are delivered">

        {/* Livestream mode toggle */}
        <div>
          <Label>Livestream mode</Label>
          <p className="text-[12px] text-[var(--text-3)] mb-3">Open to everyone, or paid access only.</p>
          <div className="inline-flex rounded-xl border border-white/[0.07] bg-surface p-1 gap-0.5">
            {(['free', 'paid'] as const).map((mode) => {
              const isActive = mode === 'free' ? !isPaidLivestreamMode : isPaidLivestreamMode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleLivestreamModeToggle(mode)}
                  className={clsx(
                    'min-w-[88px] rounded-lg px-4 py-2 text-[13px] font-semibold capitalize transition-all',
                    isActive
                      ? 'bg-raised text-white'
                      : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                  )}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {isPaidLivestreamMode && (
          <div className="max-w-xs">
            <Label required>Price (USDC)</Label>
            <input
              type="number"
              step="any"
              min="0"
              value={streamData.amount === 0 ? '' : streamData.amount}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                handleStreamChange('amount', value);
              }}
              placeholder="0.00"
              className={`${inputCls} ${errors.amount ? errorInputCls : ''}`}
            />
            {errors.amount && <p className="text-red-400 text-[12px] mt-1">{errors.amount}</p>}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-white/[0.04]" />

        {/* Donation presets */}
        <div>
          <Label>Gift presets (USDC)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {streamData.donations.map((value, i) => (
              <input
                key={i}
                type="number"
                step="any"
                min="0"
                value={value === 0 ? '' : value}
                onChange={(e) => handleDonationChange(i, e.target.value)}
                placeholder={`$${(i + 1) * 5}`}
                className={inputCls}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.04]" />

        {/* Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {([
            { label: 'Background color', field: 'bgcolor', swatches: ['#0f0f0f', '#1a1a1a', '#1a1a2e', '#16213e', '#080808'] },
            { label: 'Text color', field: 'color', swatches: ['#ffffff', '#facc15', '#14b8a6', '#888888', '#000000'] },
          ] as const).map(({ label, field, swatches }) => (
            <div key={field}>
              <Label>{label}</Label>
              <div className="flex items-center gap-2 mt-1">
                {swatches.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleStreamChange(field, c)}
                    className={clsx(
                      'w-7 h-7 rounded-full transition-all border',
                      (streamData as any)[field] === c
                        ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-canvas border-transparent scale-110'
                        : 'border-white/[0.1] hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={(streamData as any)[field]}
                  onChange={(e) => handleStreamChange(field, e.target.value)}
                  className="w-7 h-7 rounded-full border border-white/[0.1] cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0.5"
                  title="Custom color"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Font size */}
        <div>
          <Label>Font size ({streamData.fontSize}px)</Label>
          <input
            type="range"
            min="12"
            max="24"
            value={streamData.fontSize}
            onChange={(e) => handleStreamChange('fontSize', e.target.value)}
            className="w-full max-w-sm h-1.5 bg-raised rounded-full appearance-none cursor-pointer accent-[var(--accent)] mt-1"
          />
          <div className="flex justify-between max-w-sm text-[11px] text-[var(--text-3)] mt-1">
            <span>12px</span>
            <span>24px</span>
          </div>
        </div>

        {/* Font family */}
        <div className="max-w-xs">
          <Label>Font family</Label>
          <select
            value={streamData.fontFamily}
            onChange={(e) => handleStreamChange('fontFamily', e.target.value)}
            className={`${inputCls} cursor-pointer`}
          >
            {['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS', 'Impact'].map((font) => (
              <option key={font} value={font} className="bg-raised text-white">
                {font}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* ── Save button ── */}
      <div className="flex items-center justify-between pt-6 border-t border-white/[0.07]">
        <p className="text-[13px] text-[var(--text-3)] hidden sm:block">
          {existingStream ? 'Changes save to your existing channel.' : 'This will create your channel.'}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || (!existingStream && !hasCreatorAccess)}
          className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-teal-500 text-black text-[14px] font-semibold hover:from-yellow-500 hover:to-teal-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : !existingStream && !hasCreatorAccess ? 'Invite required' : existingStream ? 'Save changes' : 'Create channel'}
        </button>
      </div>
    </div>
  );
}
