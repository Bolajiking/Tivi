'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import { usePrivy } from '@privy-io/react-auth';
import { parseUnits, encodeFunctionData, erc20Abi } from 'viem';
import { getVideoByPlaybackId, addSubscriptionToVideo, addNotificationToVideo } from '@/lib/supabase-service';
import type { Subscription, Notification } from '@/lib/supabase-types';

interface VideoPaymentGateProps {
  playbackId: string;
  creatorId: string;
  children: React.ReactNode;
  onPlayClick?: () => void; // Optional callback for when play is clicked
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
}: VideoPaymentGateProps) {
  const { authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [videoData, setVideoData] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Get wallet address
  const walletAddress = useMemo(() => {
    if (wallets && wallets.length > 0) {
      const embeddedWallet = wallets.find((w: any) => 
        w.walletClientType === 'privy' || 
        w.clientType === 'privy' ||
        w.connectorType === 'privy'
      );
      if (embeddedWallet?.address) {
        return embeddedWallet.address;
      }
      if (wallets[0]?.address) {
        return wallets[0].address;
      }
    }
    
    if (user?.linkedAccounts && user.linkedAccounts.length > 0) {
      const walletAccount = user.linkedAccounts.find(
        (account: any) => account.type === 'wallet' && 'address' in account && account.address
      );
      if (walletAccount && 'address' in walletAccount && walletAccount.address) {
        return walletAccount.address;
      }
    }
    
    return null;
  }, [wallets, user?.linkedAccounts]);

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

        const viewMode = video.viewMode || 'free';
        const amount = video.amount || 0;

        // If free, grant access
        if (viewMode === 'free') {
          setHasAccess(true);
          setCheckingAccess(false);
          return;
        }

        // Check if user is the creator
        if (walletAddress && walletAddress.toLowerCase() === creatorId.toLowerCase()) {
          setHasAccess(true);
          setCheckingAccess(false);
          return;
        }

        // Check localStorage for payment record
        const paymentKey = `video_access_${playbackId}`;
        const paymentRecord = localStorage.getItem(paymentKey);
        
        if (paymentRecord) {
          try {
            const record = JSON.parse(paymentRecord);
            // Check if payment is still valid (for monthly, check expiration)
            if (viewMode === 'one-time' || (viewMode === 'monthly' && record.expiresAt > Date.now())) {
              setHasAccess(true);
            }
          } catch (e) {
            console.warn('Failed to parse payment record:', e);
          }
        }

        // Check subscriptions array in video
        if (video.subscriptions && Array.isArray(video.subscriptions)) {
          const userSubscription = video.subscriptions.find(
            (sub: Subscription) => 
              sub.subscriberAddress.toLowerCase() === walletAddress?.toLowerCase() &&
              (viewMode === 'one-time' || 
               (viewMode === 'monthly' && sub.expiresAt && new Date(sub.expiresAt) > new Date()))
          );
          if (userSubscription) {
            setHasAccess(true);
          }
        }
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

    if (viewMode === 'free' || amount <= 0) {
      toast.error('Invalid payment configuration');
      return;
    }

    setIsProcessing(true);

    try {
      // USDC token contract addresses
      const USDC_CONTRACT = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`; // Base Sepolia USDC
      const USDC_DECIMALS = 6;

      // Convert USD amount to USDC (6 decimals)
      const usdcAmount = parseUnits(amount.toFixed(6), USDC_DECIMALS);

      // Ensure creatorId is a valid address
      const recipientAddress = creatorId.startsWith('0x') 
        ? creatorId as `0x${string}`
        : `0x${creatorId}` as `0x${string}`;

      // Encode the ERC20 transfer function call
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipientAddress, usdcAmount],
      });

      // Create the transaction
      const unsignedTx = {
        to: USDC_CONTRACT,
        value: '0x0' as `0x${string}`,
        data: data,
      };

      // Log wallet info for debugging
      console.log('Wallet info:', {
        walletAddress,
        wallets: wallets?.map((w: any) => ({ address: w.address, type: w.walletClientType })),
      });

      // Use useSendTransaction with the address option to specify which wallet to use
      // This is recommended for external wallets to ensure reliable functionality
      const txResult = await sendTransaction(unsignedTx, {
        address: walletAddress, // Specify the wallet to use for signing
      });
      
      const txHash = txResult.hash;
      console.log('Transaction sent successfully:', txHash);

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
        message: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} paid $${amount.toFixed(2)} USDC for ${viewMode} access to video`,
        walletAddress: walletAddress,
        txHash: txHash,
        amount: amount,
        createdAt: new Date().toISOString(),
        read: false,
      };

      // Save subscription and notification to Supabase
      try {
        await Promise.all([
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
        creatorId,
        viewMode,
        amount,
        txHash,
        paidAt: Date.now(),
        expiresAt: viewMode === 'monthly' 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000
          : null,
      };
      localStorage.setItem(paymentKey, JSON.stringify(paymentRecord));
      
      setHasAccess(true);
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
                <span className="text-white font-semibold text-sm">${amount.toFixed(2)} USDC</span>
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
                `Pay $${amount.toFixed(2)} USDC`
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

