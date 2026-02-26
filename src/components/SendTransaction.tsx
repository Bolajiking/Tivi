import React from 'react';
import { useRouter } from 'next/navigation';
import { isAddress, parseEther, toHex } from 'viem';
import { toast } from 'sonner';

type SendTransactionFn = (tx: { to: `0x${string}`; value: `0x${string}` }, options?: { address?: string }) => Promise<any>;

type Props = {
  sendTransaction: SendTransactionFn;
  amount: string;
  sendAddress: string;
};

function SendTransaction({ sendTransaction, amount, sendAddress }: Props) {
  const router = useRouter();

  const sendTx = async () => {
    try {
      if (!amount || Number(amount) <= 0) {
        toast.error('Enter a valid amount.');
        return;
      }

      if (!isAddress(sendAddress)) {
        toast.error('Enter a valid wallet address.');
        return;
      }

      const weiValue = parseEther(amount);
      const unsignedTx = {
        to: sendAddress as `0x${string}`,
        value: toHex(weiValue),
      };

      await sendTransaction(unsignedTx);
      toast.success('Transaction sent successfully!');
      router.push('/dashboard/monetization');
    } catch (error: any) {
      toast.error(error?.message || 'Transaction failed. Please try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={sendTx}
      disabled={!sendAddress || !amount}
      className="w-full mt-4 rounded-md bg-gradient-to-r from-yellow-500 to-teal-500 px-4 py-2 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {amount ? `Withdraw ${amount} ETH` : 'Withdraw'}
    </button>
  );
}

export default SendTransaction;
