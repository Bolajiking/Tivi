'use client';

import React, { useState, useEffect } from 'react';
import { useSendTransaction } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import { usePrivy } from '@privy-io/react-auth';
import {
  getVideoByPlaybackId,
  addPayingUserToVideo,
  addSubscriptionToVideo,
  addNotificationToVideo,
} from '@/lib/supabase-service';
import type { Subscription, Notification } from '@/lib/supabase-types';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import { BASE_CHAIN_NAME, USDC_SYMBOL, sendBaseUsdcPayment } from '@/lib/base-usdc-payment';

interface VideoPaymentGateProps {
  playbackId: string;
  creatorId: string;
  children: React.ReactNode;
  onPlayClick?: () => void; // Optional callback for when play is clicked
  enforceAccess?: boolean;
}

/**
 * Payment gate component for individual videos
 * Gates only the video card/content area, not the full screen
 */
export function VideoPaymentGate({
  playbackId,
  creatorId,
  children,
  onPlayClick,
  enforceAccess = false,
}: VideoPaymentGateProps) {
  const { authenticated, ready } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { walletAddress } = useWalletAddress();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [videoData, setVideoData] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const hasValidLocalPayment = (key: string, viewMode: 'free' | 'one-time' | 'monthly') => {
    const paymentRecord = localStorage.getItem(key);
    if (!paymentRecord) return false;

    try {
      const record = JSON.parse(paymentRecord);
      if (viewMode === 'one-time') {
        return true;
      }
      return Boolean(record?.expiresAt && Number(record.expiresAt) > Date.now());
    } catch {
      return false;
    }
  };

  const hasValidSubscription = (
    subscriptions: Subscription[] | null | undefined,
    viewerAddress: string,
    viewMode: 'free' | 'one-time' | 'monthly',
  ) => {
    if (!subscriptions || subscriptions.length === 0) return false;

    const viewer = viewerAddress.toLowerCase();
    return subscriptions.some((sub) => {
      const sameViewer =
        String(sub?.subscriberAddress || '').toLowerCase() === viewer;
      if (!sameViewer) return false;

      if (viewMode === 'one-time') return true;
      if (viewMode === 'monthly') {
        return Boolean(sub?.expiresAt && new Date(sub.expiresAt).getTime() > Date.now());
      }
      return true;
    });
  };

  // Fetch video data and check access
  useEffect(() => {
    const checkAccess = async () => {
      if (!playbackId) {
        setCheckingAccess(false);
        return;
      }

      try {
        setCheckingAccess(true);
        const video = await getVideoByPlaybackId(playbackId);
        
        if (!video) {
          setHasAccess(true); // If video doesn't exist, allow access
          setCheckingAccess(false);
          return;
        }

        setVideoData(video);

        const viewMode = (video.viewMode || 'free') as 'free' | 'one-time' | 'monthly';
        const amount = Number(video.amount || 0);
        const resolvedCreatorId = String(video.creatorId || creatorId || '');

        // If free, grant access
        if (viewMode === 'free' || amount <= 0) {
          setHasAccess(true);
          setCheckingAccess(false);
          return;
        }

        if (!walletAddress) {
          setHasAccess(false);
          return;
        }

        const viewer = walletAddress.toLowerCase();
        const isCreator = resolvedCreatorId.toLowerCase() === viewer;
        const isInUsers = Boolean(
          (video.Users || []).some((addr: string) => String(addr).toLowerCase() === viewer),
        );
        const hasVideoAccessRecord = hasValidLocalPayment(
          `video_access_${playbackId}`,
          viewMode,
        );
        const hasCreatorAccessRecord = resolvedCreatorId
          ? hasValidLocalPayment(`creator_access_${resolvedCreatorId}`, viewMode)
          : false;
        const hasSubscription = hasValidSubscription(
          video.subscriptions,
          walletAddress,
          viewMode,
        );

        setHasAccess(
          isCreator ||
            isInUsers ||
            hasVideoAccessRecord ||
            hasCreatorAccessRecord ||
            hasSubscription,
        );
      } catch (error) {
        console.error('Error checking video access:', error);
        // On error, allow access (fail open)
        setHasAccess(true);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [playbackId, creatorId, walletAddress]);

  const handlePayment = async () => {
    if (!authenticated || !ready) {
      toast.error('Please sign in first');
      return;
    }

    if (!walletAddress) {
      toast.error('No wallet available. Please wait for your embedded wallet to be created, or connect an external wallet.');
      return;
    }

    if (!videoData) {
      toast.error('Video data not available');
      return;
    }

    const viewMode = videoData.viewMode || 'free';
    const amount = videoData.amount || 0;
    const resolvedCreatorId = String(videoData.creatorId || creatorId || '');

    if (viewMode === 'free' || amount <= 0) {
      toast.error('Invalid payment configuration');
      return;
    }
    if (!resolvedCreatorId) {
      toast.error('Creator wallet not available for this video.');
      return;
    }

    setIsProcessing(true);

    try {
      const txHash = await sendBaseUsdcPayment({
        sendTransaction: sendTransaction as any,
        payerAddress: walletAddress,
        recipientAddress: resolvedCreatorId,
        amountUsd: amount,
      });

      // Calculate expiration date for monthly subscriptions
      const expiresAt = viewMode === 'monthly' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create subscription object
      const subscription: Subscription = {
        subscriberAddress: walletAddress,
        viewMode: viewMode,
        amount,
        txHash,
        subscribedAt: new Date().toISOString(),
        expiresAt: expiresAt,
      };

      // Create notification object
      const notification: Notification = {
        type: 'payment',
        title: 'New Video Payment Received',
        message: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} paid $${amount.toFixed(2)} ${USDC_SYMBOL} on ${BASE_CHAIN_NAME} for ${viewMode} access to video`,
        walletAddress: walletAddress,
        txHash: txHash,
        amount: amount,
        createdAt: new Date().toISOString(),
        read: false,
      };

      // Save subscription and notification to Supabase
      try {
        await Promise.all([
          addPayingUserToVideo(playbackId, walletAddress),
          addSubscriptionToVideo(playbackId, subscription),
          addNotificationToVideo(playbackId, notification),
        ]);
        console.log('Subscription and notification saved successfully');
      } catch (error) {
        console.error('Failed to save subscription/notification:', error);
        toast.warning('Payment successful, but failed to save subscription details.');
      }

      // Store payment record in localStorage
      const paymentKey = `video_access_${playbackId}`;
      const paymentRecord = {
        playbackId,
        creatorId: resolvedCreatorId,
        viewMode,
        amount,
        txHash,
        paidAt: Date.now(),
        expiresAt: viewMode === 'monthly' 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000
          : null,
      };
      localStorage.setItem(paymentKey, JSON.stringify(paymentRecord));
      localStorage.setItem(`creator_access_${resolvedCreatorId}`, JSON.stringify(paymentRecord));
      
      setHasAccess(true);
      setVideoData((prev: any) => {
        if (!prev) return prev;
        const existingUsers: string[] = Array.isArray(prev.Users) ? prev.Users : [];
        const alreadyPresent = existingUsers.some(
          (addr) => String(addr).toLowerCase() === walletAddress.toLowerCase(),
        );
        if (alreadyPresent) return prev;
        return {
          ...prev,
          Users: [...existingUsers, walletAddress],
        };
      });
      setShowPaymentModal(false);
      toast.success('Payment successful! Access granted.');
      
      // Automatically play video after successful payment
      if (onPlayClick) {
        onPlayClick();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      const errorMessage = error?.message || error?.toString() || 'Payment failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle play click - check access first
  const handlePlayClick = () => {
    // If free or has access, proceed with play
    if (!videoData || videoData.viewMode === 'free' || hasAccess) {
      if (onPlayClick) {
        onPlayClick();
      }
      return;
    }

    // If paid and no access, show payment modal
    setShowPaymentModal(true);
  };

  // Clone children to inject our play click handler if it's a valid React element
  const childrenWithHandler = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement, {
        onPlayClick: handlePlayClick,
      })
    : children;

  const viewMode = videoData?.viewMode || 'free';
  const amount = videoData?.amount || 0;
  const isPaid = videoData && viewMode !== 'free' && amount > 0;

  // Show loading state while checking access
  if (checkingAccess) {
    return (
      <div className="relative">
        {children}
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-lg">
          <Bars width={30} height={30} color="#facc15" />
        </div>
      </div>
    );
  }

  // Always show children (video card) with price badge if paid
  return (
    <>
      <div className="relative">
        {childrenWithHandler}
        
        {/* Price badge - only show if paid and no access */}
        {isPaid && !hasAccess && (
          <div className="absolute bottom-2 right-2 bg-gradient-to-r from-yellow-500 to-teal-500 text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-lg z-10">
            ${amount.toFixed(2)}
          </div>
        )}

        {enforceAccess && isPaid && !hasAccess && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-gray-900/80 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="rounded-lg bg-gradient-to-r from-yellow-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black"
            >
              Unlock Video
            </button>
          </div>
        )}
      </div>

      {/* Payment Modal - only shows when user clicks play */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative max-w-md w-full mx-4 bg-gray-800 rounded-xl border border-white/20 p-6 text-center">
            {/* Close button */}
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Premium Video</h3>
              <p className="text-gray-400 text-sm">This video requires payment to access</p>
            </div>

            <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300 text-sm">Access Type:</span>
                <span className="text-white font-semibold text-sm capitalize">{viewMode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Amount:</span>
                <span className="text-white font-semibold text-sm">${amount.toFixed(2)} {USDC_SYMBOL}</span>
              </div>
            </div>

            {!authenticated && (
              <div className="mb-3 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                <p className="text-yellow-400 text-xs">Please sign in to proceed with payment</p>
              </div>
            )}

            {authenticated && !walletAddress && (
              <div className="mb-3 p-2 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                <p className="text-blue-400 text-xs">Setting up your wallet...</p>
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={isProcessing || !authenticated || !ready || !walletAddress}
              className="w-full px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Bars width={16} height={16} color="#000000" />
                  <span>Processing...</span>
                </>
              ) : (
                `Pay $${amount.toFixed(2)} ${USDC_SYMBOL}`
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
