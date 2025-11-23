'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import { usePrivy } from '@privy-io/react-auth';
import { parseUnits, encodeFunctionData, erc20Abi } from 'viem';
import { addCreatorSubscriptionAndNotification } from '@/lib/supabase-service';
import type { Subscription, Notification } from '@/lib/supabase-types';

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
  const { authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Get wallet address - prioritize external wallets, but get the actual wallet object too
  const walletAddress = useMemo(() => {
    // First, try to get external wallet (non-embedded) - these should work with sendTransaction
    if (wallets && wallets.length > 0) {
      // Prefer external wallet over embedded wallet
      const externalWallet = wallets.find((w: any) => 
        w.walletClientType !== 'privy' && 
        w.clientType !== 'privy' &&
        w.connectorType !== 'privy'
      );
      if (externalWallet?.address) {
        return externalWallet.address;
      }
      
      // Fallback to embedded wallet
      const embeddedWallet = wallets.find((w: any) => 
        w.walletClientType === 'privy' || 
        w.clientType === 'privy' ||
        w.connectorType === 'privy'
      );
      if (embeddedWallet?.address) {
        return embeddedWallet.address;
      }
      
      // Fallback to first wallet
      if (wallets[0]?.address) {
        return wallets[0].address;
      }
    }
    
    // If no wallet in wallets array, check user's linked accounts
    if (user?.linkedAccounts && user.linkedAccounts.length > 0) {
      // Find wallet account - need to check type properly
      const walletAccount = user.linkedAccounts.find(
        (account: any) => account.type === 'wallet' && 'address' in account && account.address
      );
      if (walletAccount && 'address' in walletAccount && walletAccount.address) {
        return walletAccount.address;
      }
    }
    
    return null;
  }, [wallets, user?.linkedAccounts]);

  // Check if user already has access (from localStorage or previous payment)
  useEffect(() => {
    if (viewMode === 'free') {
      setHasAccess(true);
      setCheckingAccess(false);
      return;
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
  }, [creatorId, viewMode]);

  const handlePayment = async () => {
    if (!authenticated || !ready) {
      toast.error('Please sign in first');
      return;
    }

    if (!walletAddress) {
      toast.error('No wallet available. Please wait for your embedded wallet to be created, or connect an external wallet.');
      console.log('Wallet status:', { wallets, user: user?.linkedAccounts });
      return;
    }

    setIsProcessing(true);

    try {
      // USDC token contract addresses on different networks
      // Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
      // Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
      // Ethereum Mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
      // For now, we'll use Base Sepolia testnet
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

      console.log('Sending USDC transfer:', {
        to: USDC_CONTRACT,
        recipient: recipientAddress,
        amount: amount,
        usdcAmount: usdcAmount.toString(),
      });

      // Create the transaction
      const unsignedTx = {
        to: USDC_CONTRACT,
        value: '0x0' as `0x${string}`, // No ETH value, this is a token transfer
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
        message: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} paid $${amount.toFixed(2)} USDC for ${viewMode} access`,
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
      <div className="max-w-md w-full bg-gray-800 rounded-xl border border-white/20 p-8 text-center z-10">
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
            <span className="text-white font-semibold">${amount.toFixed(2)} USDC</span>
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
            `Pay $${amount.toFixed(2)} USDC to Access`
          )}
        </button>

        <p className="mt-4 text-xs text-gray-500">
          Payment will be processed as a direct USDC transfer to the creator's wallet.
        </p>
      </div>
    </div>
  );
}
