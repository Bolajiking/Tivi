'use client';

import { useState, useEffect } from 'react';
import { useSendTransaction } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import { usePrivy } from '@privy-io/react-auth';
import { getStreamByPlaybackId, addSubscriptionToStream, addNotificationToStream } from '@/lib/supabase-service';
import type { Subscription, Notification } from '@/lib/supabase-types';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import { BASE_CHAIN_NAME, USDC_SYMBOL, sendBaseUsdcPayment } from '@/lib/base-usdc-payment';

interface StreamPaymentGateProps {
  playbackId: string;
  creatorId: string;
  children: React.ReactNode;
}

/**
 * Payment gate component for individual streams
 * Gates only the stream card/content area, not the full screen
 */
export function StreamPaymentGate({
  playbackId,
  creatorId,
  children,
}: StreamPaymentGateProps) {
  const { authenticated, ready } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { walletAddress } = useWalletAddress();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [streamData, setStreamData] = useState<any>(null);

  // Fetch stream data and check access
  useEffect(() => {
    const checkAccess = async () => {
      if (!playbackId) {
        setCheckingAccess(false);
        return;
      }

      try {
        setCheckingAccess(true);
        const stream = await getStreamByPlaybackId(playbackId);
        
        if (!stream) {
          setHasAccess(true); // If stream doesn't exist, allow access
          setCheckingAccess(false);
          return;
        }

        setStreamData(stream);

        const streamMode = stream.streamMode || stream.viewMode || 'free';
        const streamAmount = stream.streamAmount || stream.amount || 0;

        // If free, grant access
        if (streamMode === 'free') {
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
        const paymentKey = `stream_access_${playbackId}`;
        const paymentRecord = localStorage.getItem(paymentKey);
        
        if (paymentRecord) {
          try {
            const record = JSON.parse(paymentRecord);
            // Check if payment is still valid (for monthly, check expiration)
            if (streamMode === 'one-time' || (streamMode === 'monthly' && record.expiresAt > Date.now())) {
              setHasAccess(true);
            }
          } catch (e) {
            console.warn('Failed to parse payment record:', e);
          }
        }

        // Check subscriptions array in stream
        if (stream.subscriptions && Array.isArray(stream.subscriptions)) {
          const userSubscription = stream.subscriptions.find(
            (sub: Subscription) => 
              sub.subscriberAddress.toLowerCase() === walletAddress?.toLowerCase() &&
              (streamMode === 'one-time' || 
               (streamMode === 'monthly' && sub.expiresAt && new Date(sub.expiresAt) > new Date()))
          );
          if (userSubscription) {
            setHasAccess(true);
          }
        }
      } catch (error) {
        console.error('Error checking stream access:', error);
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

    if (!streamData) {
      toast.error('Stream data not available');
      return;
    }

    const streamMode = streamData.streamMode || streamData.viewMode || 'free';
    const amount = streamData.streamAmount || streamData.amount || 0;

    if (streamMode === 'free' || amount <= 0) {
      toast.error('Invalid payment configuration');
      return;
    }

    setIsProcessing(true);

    try {
      const txHash = await sendBaseUsdcPayment({
        sendTransaction: sendTransaction as any,
        payerAddress: walletAddress,
        recipientAddress: creatorId,
        amountUsd: amount,
      });

      // Calculate expiration date for monthly subscriptions
      const expiresAt = streamMode === 'monthly' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create subscription object
      const subscription: Subscription = {
        subscriberAddress: walletAddress,
        viewMode: streamMode,
        amount,
        txHash,
        subscribedAt: new Date().toISOString(),
        expiresAt: expiresAt,
      };

      // Create notification object
      const notification: Notification = {
        type: 'payment',
        title: 'New Stream Payment Received',
        message: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} paid $${amount.toFixed(2)} ${USDC_SYMBOL} on ${BASE_CHAIN_NAME} for ${streamMode} access to stream`,
        walletAddress: walletAddress,
        txHash: txHash,
        amount: amount,
        createdAt: new Date().toISOString(),
        read: false,
      };

      // Save subscription and notification to Supabase
      try {
        await Promise.all([
          addSubscriptionToStream(playbackId, subscription),
          addNotificationToStream(playbackId, notification),
        ]);
        console.log('Subscription and notification saved successfully');
      } catch (error) {
        console.error('Failed to save subscription/notification:', error);
        toast.warning('Payment successful, but failed to save subscription details.');
      }

      // Store payment record in localStorage
      const paymentKey = `stream_access_${playbackId}`;
      const paymentRecord = {
        playbackId,
        creatorId,
        streamMode,
        amount,
        txHash,
        paidAt: Date.now(),
        expiresAt: streamMode === 'monthly' 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000
          : null,
      };
      localStorage.setItem(paymentKey, JSON.stringify(paymentRecord));
      
      setHasAccess(true);
      toast.success('Payment successful! Access granted.');
    } catch (error: any) {
      console.error('Payment error:', error);
      const errorMessage = error?.message || error?.toString() || 'Payment failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

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

  // If free or already has access, show children
  if (!streamData || streamData.streamMode === 'free' || hasAccess) {
    return <>{children}</>;
  }

  const streamMode = streamData.streamMode || streamData.viewMode || 'free';
  const amount = streamData.streamAmount || streamData.amount || 0;

  // Show payment gate overlay - only covers the stream card area
  return (
    <div className="relative">
      {/* Blurred/covered content */}
      <div className="opacity-30 pointer-events-none">
        {children}
      </div>
      
      {/* Payment gate overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm rounded-lg border border-white/20 p-4 z-10">
        <div className="max-w-sm w-full bg-gray-800 rounded-xl border border-white/20 p-6 text-center">
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
            <h3 className="text-lg font-bold text-white mb-1">Premium Stream</h3>
            <p className="text-gray-400 text-sm">This stream requires payment to access</p>
          </div>

          <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300 text-sm">Access Type:</span>
              <span className="text-white font-semibold text-sm capitalize">{streamMode}</span>
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
    </div>
  );
}
