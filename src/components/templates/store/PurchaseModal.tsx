'use client';

import { useState } from 'react';
import Image from 'next/image';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ShoppingBag, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSendTransaction } from '@privy-io/react-auth';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import { sendBaseUsdcPayment } from '@/lib/base-usdc-payment';
import { createOrder, decrementProductInventory } from '@/lib/supabase-service';
import type { SupabaseProduct } from '@/lib/supabase-types';

interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
  product: SupabaseProduct | null;
  onSuccess: () => void;
}

const typeLabels: Record<string, string> = {
  physical: 'Physical',
  digital: 'Digital',
  merch: 'Merch',
  ad: 'Ad space',
};

export const PurchaseModal = ({ open, onClose, product, onSuccess }: PurchaseModalProps) => {
  const { walletAddress } = useWalletAddress();
  const { sendTransaction } = useSendTransaction();
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [purchasedDigitalUrl, setPurchasedDigitalUrl] = useState<string | null>(null);

  if (!product) return null;

  const handlePurchase = async () => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!product.creatorId) {
      toast.error('Creator wallet not found');
      return;
    }

    try {
      setPaying(true);

      // Send USDC payment on Base
      const txHash = await sendBaseUsdcPayment({
        sendTransaction,
        payerAddress: walletAddress,
        recipientAddress: product.creatorId,
        amountUsd: Number(product.price),
      });

      // Create order record
      await createOrder({
        productId: product.id!,
        buyerAddress: walletAddress,
        sellerAddress: product.creatorId,
        amount: Number(product.price),
        txHash,
        status: 'completed',
        shippingInfo: null,
        productSnapshot: {
          name: product.name,
          description: product.description,
          price: product.price,
          currency: product.currency,
          imageUrl: product.imageUrl,
          productType: product.productType,
        },
      });

      // Decrement inventory
      try {
        await decrementProductInventory(product.id!);
      } catch {
        // Non-critical — inventory decrement can fail gracefully
      }

      // For digital products, reveal the download link
      if (product.productType === 'digital' && product.digitalFileUrl) {
        setPurchasedDigitalUrl(product.digitalFileUrl);
      }

      setSuccess(true);
      toast.success('Purchase complete!');
      onSuccess();
    } catch (err: any) {
      console.error('Purchase error:', err);
      toast.error(err?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setPurchasedDigitalUrl(null);
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#0f0f0f] border border-white/[0.07] shadow-2xl z-[101] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
            <Dialog.Title className="text-[18px] font-bold text-white font-funnel-display">
              {success ? 'Purchase complete' : 'Confirm purchase'}
            </Dialog.Title>
            <Dialog.Description className="sr-only">Review and confirm your product purchase</Dialog.Description>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1.5 text-[#555] hover:text-white hover:bg-white/[0.05] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-5">
            {/* Product Preview */}
            <div className="flex gap-4">
              <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/[0.07]">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ShoppingBag className="w-8 h-8 text-[#333]" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block rounded-full bg-[#1a1a1a] border border-white/[0.07] px-2 py-0.5 text-[11px] text-[#888] mb-1.5">
                  {typeLabels[product.productType] || product.productType}
                </span>
                <h3 className="text-[16px] font-semibold text-white leading-tight line-clamp-2">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-[13px] text-[#888] mt-1 line-clamp-2">{product.description}</p>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="rounded-xl bg-[#1a1a1a] border border-white/[0.07] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[#888]">Total</span>
                <span className="text-[20px] font-bold text-[#facc15]">
                  ${Number(product.price).toFixed(2)} <span className="text-[13px] font-normal text-[#888]">USDC</span>
                </span>
              </div>
            </div>

            {/* Success state */}
            {success && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-[14px] font-medium">Payment successful</span>
                </div>

                {purchasedDigitalUrl && (
                  <a
                    href={purchasedDigitalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[14px] font-medium hover:bg-emerald-500/30 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download your file
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.07]">
            {success ? (
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.07] text-[14px] text-white font-medium hover:bg-[#242424] transition-colors"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={paying}
                  className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.07] text-[14px] text-white font-medium hover:bg-[#242424] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={paying}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-teal-500 text-[14px] text-black font-semibold hover:from-yellow-500 hover:to-teal-600 transition-all disabled:opacity-50 min-w-[140px]"
                >
                  {paying ? 'Processing...' : `Pay $${Number(product.price).toFixed(2)} USDC`}
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
