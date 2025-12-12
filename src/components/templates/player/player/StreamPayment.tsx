'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/utils';

interface StreamPaymentProps {
  playbackId: string;
  usdAmount: number;
  recipientAddress: string;
  onPaymentSuccess: () => void;
  processPayment: (solAmount: number, recipientAddress: string) => Promise<any>;
  processingPayment: boolean;
  walletReady: boolean;
}

export function StreamPayment({ 
  playbackId, 
  usdAmount,
  recipientAddress,
  onPaymentSuccess, 
  processPayment,
  processingPayment,
  walletReady,
}: StreamPaymentProps) {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const connected = authenticated && ready && wallets && wallets.length > 0;

  const handlePay = async () => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!walletReady) {
      toast.error('Wallet not ready. Please wait a moment.');
      return;
    }

    try {
      // processPayment now expects USD amount, not SOL
      await processPayment(usdAmount, recipientAddress);
      onPaymentSuccess();
      toast.success('Payment successful! Access granted.');
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-transparent">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Required</h2>
      <p className="text-gray-600 dark:text-gray-400">This stream requires payment to access.</p>

      {/* Price Display */}
      <div className="w-full max-w-md space-y-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Price:</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            ${formatNumber(usdAmount, 2)} USDC
          </span>
        </div>
        
          <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500 dark:text-gray-500">Payment Method:</span>
            <span className="text-gray-700 dark:text-gray-300">
            Ethereum (USDC)
            </span>
          </div>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Connect your wallet to proceed</p>
          <p className="text-xs text-gray-400">Please connect your wallet using the Privy authentication</p>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4 w-full max-w-md">
          <button
            onClick={handlePay}
            disabled={processingPayment || !walletReady}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {processingPayment ? 'Processing Payment...' : 'Pay & Access Stream'}
          </button>
          {!walletReady && (
            <p className="text-sm text-yellow-600">Initializing wallet...</p>
          )}
        </div>
      )}
    </div>
  );
}
