'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from './ProductCard';
import { AddEditProductModal } from './AddEditProductModal';
import { getProductsByChannel, deleteProduct } from '@/lib/supabase-service';
import type { SupabaseProduct } from '@/lib/supabase-types';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface CreatorStoreProps {
  playbackId: string;
  creatorId: string;
}

export const CreatorStore = ({ playbackId, creatorId }: CreatorStoreProps) => {
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupabaseProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<SupabaseProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!playbackId) return;
    try {
      setLoading(true);
      const data = await getProductsByChannel(playbackId);
      setProducts(data);
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [playbackId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleEdit = (product: SupabaseProduct) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct?.id) return;
    try {
      setDeleting(true);
      await deleteProduct(deletingProduct.id);
      toast.success('Product deleted');
      setDeletingProduct(null);
      fetchProducts();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err?.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24 rounded-lg bg-[#1a1a1a]" />
          <Skeleton className="h-10 w-32 rounded-lg bg-[#1a1a1a]" />
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

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Store</h3>
            <p className="text-[13px] text-[#888] mt-0.5">
              {products.length} product{products.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-yellow-400 to-teal-500 text-black text-[14px] font-semibold transition-all hover:from-yellow-500 hover:to-teal-600"
          >
            <Plus className="w-4 h-4" />
            Add product
          </button>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#1a1a1a] p-8 text-center">
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="rounded-full border border-white/[0.07] bg-[#0f0f0f] p-3 text-[#888]">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">No products yet</h3>
              <p className="max-w-md text-sm text-gray-300">
                Add your first product to start selling directly from your channel.
              </p>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-teal-500 hover:from-yellow-500 hover:to-teal-600 text-black font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add product
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="creator"
                onEdit={handleEdit}
                onDelete={setDeletingProduct}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AddEditProductModal
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={fetchProducts}
        product={editingProduct}
        playbackId={playbackId}
        creatorId={creatorId}
      />

      {/* Delete Confirmation */}
      <AlertDialog.Root open={!!deletingProduct} onOpenChange={(open) => { if (!open) setDeletingProduct(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[90vw] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#0f0f0f] border border-white/[0.07] shadow-2xl z-[101] p-6">
            <AlertDialog.Title className="text-[18px] font-bold text-white font-funnel-display">
              Delete product
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[14px] text-[#888]">
              Are you sure you want to delete &quot;{deletingProduct?.name}&quot;? This action cannot be undone.
            </AlertDialog.Description>
            <div className="flex items-center justify-end gap-3 mt-6">
              <AlertDialog.Cancel asChild>
                <button
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.07] text-[14px] text-white font-medium hover:bg-[#242424] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-[14px] text-red-400 font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
};
