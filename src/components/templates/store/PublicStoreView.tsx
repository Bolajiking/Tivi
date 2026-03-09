'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from './ProductCard';
import { PurchaseModal } from './PurchaseModal';
import { getActiveProductsByChannel } from '@/lib/supabase-service';
import type { SupabaseProduct } from '@/lib/supabase-types';

interface PublicStoreViewProps {
  playbackId: string;
  creatorId: string;
}

export const PublicStoreView = ({ playbackId, creatorId }: PublicStoreViewProps) => {
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<SupabaseProduct | null>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!playbackId) return;
    try {
      setLoading(true);
      const data = await getActiveProductsByChannel(playbackId);
      setProducts(data);
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      toast.error('Failed to load store');
    } finally {
      setLoading(false);
    }
  }, [playbackId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleBuy = (product: SupabaseProduct) => {
    setSelectedProduct(product);
    setPurchaseModalOpen(true);
  };

  const handlePurchaseSuccess = () => {
    fetchProducts(); // Refresh to update inventory/status
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-20 rounded-lg bg-[#1a1a1a]" />
          <Skeleton className="h-5 w-16 rounded-md bg-[#1a1a1a]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl bg-[#1a1a1a]" />
              <Skeleton className="h-4 w-3/4 rounded-md bg-[#1a1a1a]" />
              <Skeleton className="h-5 w-20 rounded-md bg-[#1a1a1a]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-8 text-center">
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="rounded-full border border-white/[0.07] bg-[#0f0f0f] p-3 text-[#888]">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">No products available</h3>
          <p className="max-w-md text-sm text-gray-300">
            This creator hasn&apos;t added any products to their store yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Store</h3>
          <span className="text-xs text-gray-400">
            {products.length} item{products.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              variant="public"
              onBuy={handleBuy}
            />
          ))}
        </div>
      </div>

      {/* Purchase Modal */}
      <PurchaseModal
        open={purchaseModalOpen}
        onClose={() => {
          setPurchaseModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onSuccess={handlePurchaseSuccess}
      />
    </>
  );
};
