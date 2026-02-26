'use client';

import { useState, useEffect } from 'react';
import { useSendTransaction } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import { usePrivy } from '@privy-io/react-auth';
import { addCreatorSubscriptionAndNotification } from '@/lib/supabase-service';
import type { Subscription, Notification } from '@/lib/supabase-types';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import { BASE_CHAIN_NAME, USDC_SYMBOL, sendBaseUsdcPayment } from '@/lib/base-usdc-payment';
import { useRouter } from 'next/navigation';

interface CreatorPaymentGateProps {
  creatorId: string;
  viewMode: 'free' | 'one-time' | 'monthly';
  amount: number; // Amount in USD
  streamName?: string;
  title?: string;
  onPaymentSuccess: () => void;
  children: React.ReactNode;
}

/**
 * Payment gate component for creator profiles
 * Shows payment UI if viewMode is not 'free', otherwise shows children
 * Supports both embedded and external wallets
 */
export function CreatorPaymentGate({
  creatorId,
  viewMode,
  amount,
  streamName,
  title,
  onPaymentSuccess,
  children,
}: CreatorPaymentGateProps) {
  const router = useRouter();
  const { authenticated, ready, user } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { walletAddress } = useWalletAddress();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Check if user already has access (from localStorage or previous payment)
  // Also check if the user is the owner of the channel
  useEffect(() => {
    if (viewMode === 'free') {
      setHasAccess(true);
      setCheckingAccess(false);
      return;
    }

    // Check if the current user is the owner of the channel
    // Compare wallet address with creatorId (both should be wallet addresses)
    if (walletAddress && creatorId) {
      const isOwner = walletAddress.toLowerCase() === creatorId.toLowerCase();
      if (isOwner) {
        setHasAccess(true);
        setCheckingAccess(false);
        return;
      }
    }

    // Check localStorage for payment record
    const paymentKey = `creator_access_${creatorId}`;
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
    
    setCheckingAccess(false);
  }, [creatorId, viewMode, walletAddress]);

  const handlePayment = async () => {
    if (!authenticated || !ready) {
      toast.error('Please sign in first');
      return;
    }

    if (!walletAddress) {
      toast.error('No wallet available. Please wait for your embedded wallet to be created, or connect an external wallet.');
      console.log('Wallet status:', { user: user?.linkedAccounts });
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
      
      // Continue with success flow...
      // Calculate expiration date for monthly subscriptions
      const expiresAt = viewMode === 'monthly' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        : null; // one-time never expires

      // Create subscription object
      const subscription: Subscription = {
        subscriberAddress: walletAddress,
        viewMode,
        amount,
        txHash,
        subscribedAt: new Date().toISOString(),
        expiresAt: expiresAt,
      };

      // Create notification object
      const notification: Notification = {
        type: 'payment',
        title: 'New Payment Received',
        message: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} paid $${amount.toFixed(2)} ${USDC_SYMBOL} on ${BASE_CHAIN_NAME} for ${viewMode} access`,
        walletAddress: walletAddress,
        txHash: txHash,
        amount: amount,
        createdAt: new Date().toISOString(),
        read: false,
      };

      // Save subscription and notification to Supabase
      try {
        await addCreatorSubscriptionAndNotification(creatorId, subscription, notification);
        console.log('Subscription and notification saved successfully');
      } catch (error) {
        console.error('Failed to save subscription/notification:', error);
        // Don't fail the payment if Supabase save fails - payment was successful
        toast.warning('Payment successful, but failed to save subscription details. Please contact support.');
      }

      // Store payment record in localStorage
      const paymentKey = `creator_access_${creatorId}`;
      const paymentRecord = {
        creatorId,
        viewMode,
        amount,
        txHash,
        paidAt: Date.now(),
        expiresAt: viewMode === 'monthly' 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
          : null, // one-time never expires
      };
      localStorage.setItem(paymentKey, JSON.stringify(paymentRecord));
      
      setHasAccess(true);
      onPaymentSuccess();
      toast.success('Payment successful! Access granted.');
    } catch (error: any) {
      console.error('Payment error:', error);
      const errorMessage = error?.message || error?.toString() || 'Payment failed. Please try again.';
      toast.error(errorMessage);
      
      // Log full error for debugging
      if (error?.stack) {
        console.error('Error stack:', error.stack);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClosePaywall = () => {
    // Return to the neutral browsing state with no channel selected.
    router.push('/streamviews');
  };

  // Show loading state while checking access
  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Bars width={40} height={40} color="#ffffff" />
      </div>
    );
  }

  // If free or already has access, show children
  if (viewMode === 'free' || hasAccess) {
    return <>{children}</>;
  }

  // Show payment gate UI - only cover the main content area, not the full screen
  return (
    <div className="flex items-center justify-center h-full w-full bg-gray-900/95 p-4 relative z-10">
      <div className="relative max-w-md w-full bg-gray-800 rounded-xl border border-white/20 p-8 text-center z-10">
        <button
          type="button"
          onClick={handleClosePaywall}
          aria-label="Close paywall"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors md:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-black"
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
          <h2 className="text-2xl font-bold text-white mb-2">Premium Content</h2>
          <p className="text-gray-400 mb-4">
            {title || 'This creator profile'} requires payment to access
          </p>
        </div>

        <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300">Access Type:</span>
            <span className="text-white font-semibold capitalize">{viewMode}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Amount:</span>
            <span className="text-white font-semibold">${amount.toFixed(2)} {USDC_SYMBOL}</span>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
            <span>Recipient:</span>
            <span className="font-mono">{creatorId.slice(0, 6)}...{creatorId.slice(-4)}</span>
          </div>
        </div>

        {!authenticated && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-400 text-sm">
              Please sign in to proceed with payment
            </p>
          </div>
        )}

        {authenticated && !walletAddress && (
          <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
            <p className="text-blue-400 text-sm">
              Setting up your wallet... Please wait a moment.
            </p>
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={isProcessing || !authenticated || !ready || !walletAddress}
          className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Bars width={20} height={20} color="#000000" />
              <span>Processing Payment...</span>
            </>
          ) : (
            `Pay $${amount.toFixed(2)} ${USDC_SYMBOL} to Access`
          )}
        </button>

        <p className="mt-4 text-xs text-gray-500">
          Payment will be processed as a direct {USDC_SYMBOL} transfer on {BASE_CHAIN_NAME}.
        </p>
      </div>
    </div>
  );
}
