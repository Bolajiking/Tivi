'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useSendTransaction } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/utils';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import {
  addNotificationToStream,
  addPayingUserToStream,
  addSubscriptionToStream,
} from '@/lib/supabase-service';
import type { Notification, Subscription } from '@/lib/supabase-types';
import { BASE_CHAIN_NAME, USDC_SYMBOL, sendBaseUsdcPayment } from '@/lib/base-usdc-payment';
import { useState } from 'react';

interface StreamPaymentProps {
  playbackId: string;
  usdAmount: number;
  recipientAddress: string;
  viewMode?: 'free' | 'one-time' | 'monthly';
  onPaymentSuccess: () => void;
}

export function StreamPayment({ 
  playbackId, 
  usdAmount,
  recipientAddress,
  viewMode = 'one-time',
  onPaymentSuccess, 
}: StreamPaymentProps) {
  const { authenticated, ready } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { walletAddress } = useWalletAddress();
  const connected = authenticated && ready && !!walletAddress;
  const [processingPayment, setProcessingPayment] = useState(false);

  const handlePay = async () => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setProcessingPayment(true);
      const txHash = await sendBaseUsdcPayment({
        sendTransaction: sendTransaction as any,
        payerAddress: walletAddress!,
        recipientAddress,
        amountUsd: usdAmount,
      });

      const expiresAt =
        viewMode === 'monthly' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;

      const subscription: Subscription = {
        subscriberAddress: walletAddress!,
        viewMode,
        amount: usdAmount,
        txHash,
        subscribedAt: new Date().toISOString(),
        expiresAt,
      };

      const notification: Notification = {
        type: 'payment',
        title: 'New Stream Payment Received',
        message: `${walletAddress!.slice(0, 6)}...${walletAddress!.slice(-4)} paid $${usdAmount.toFixed(2)} ${USDC_SYMBOL} on ${BASE_CHAIN_NAME} for ${viewMode} stream access`,
        walletAddress: walletAddress!,
        txHash,
        amount: usdAmount,
        createdAt: new Date().toISOString(),
        read: false,
      };

      try {
        await Promise.all([
          addPayingUserToStream(playbackId, walletAddress!),
          addSubscriptionToStream(playbackId, subscription),
          addNotificationToStream(playbackId, notification),
        ]);
      } catch (error) {
        console.error('Failed to persist stream payment metadata:', error);
      }

      // Persist both keys so stream/player gate checks are consistent after reload.
      try {
        const expiresAtMs =
          viewMode === 'monthly' && expiresAt ? new Date(expiresAt).getTime() : null;
        const record = {
          playbackId,
          creatorId: recipientAddress,
          viewMode,
          amount: usdAmount,
          txHash,
          paidAt: Date.now(),
          expiresAt: expiresAtMs,
        };
        localStorage.setItem(`stream_access_${playbackId}`, JSON.stringify(record));
        localStorage.setItem(`creator_access_${recipientAddress}`, JSON.stringify(record));
      } catch (storageError) {
        console.warn('Failed to persist local stream payment record:', storageError);
      }

      onPaymentSuccess();
      toast.success('Payment successful! Access granted.');
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-transparent text-center">
      <h2 className="text-2xl font-bold text-white">Unlock Stream Access</h2>
      <p className="text-gray-300">This stream requires payment to view.</p>

      {/* Price Display */}
      <div className="w-full max-w-md space-y-3 rounded-lg border border-white/15 bg-white/5 p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Price:</span>
          <span className="text-lg font-semibold text-white">
            ${formatNumber(usdAmount, 2)} USDC
          </span>
        </div>
        
          <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Payment Method:</span>
            <span className="text-gray-200">
            {BASE_CHAIN_NAME} ({USDC_SYMBOL})
            </span>
          </div>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-sm text-gray-300">Connect your wallet to proceed</p>
          <p className="text-xs text-gray-500">Use Privy authentication to continue.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4 w-full max-w-md">
          <button
            onClick={handlePay}
            disabled={processingPayment || !walletAddress}
            className="w-full bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {processingPayment ? 'Processing Payment...' : 'Pay & Access Stream'}
          </button>
          {!walletAddress && (
            <p className="text-sm text-yellow-300">Initializing wallet...</p>
          )}
        </div>
      )}
    </div>
  );
}
