'use client';

import { useState, useEffect, useCallback } from 'react';
import type React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { X, Upload, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { createProduct, updateProduct, uploadImage } from '@/lib/supabase-service';
import type { SupabaseProduct, ProductInsert } from '@/lib/supabase-types';

interface AddEditProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: SupabaseProduct | null;
  playbackId: string;
  creatorId: string;
}

const productTypes = [
  { value: 'physical', label: 'Physical' },
  { value: 'digital', label: 'Digital' },
  { value: 'merch', label: 'Merch' },
  { value: 'ad', label: 'Ad space' },
] as const;

export const AddEditProductModal = ({
  open,
  onClose,
  onSuccess,
  product,
  playbackId,
  creatorId,
}: AddEditProductModalProps) => {
  const isEditing = Boolean(product);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [productType, setProductType] = useState<SupabaseProduct['productType']>('physical');
  const [inventory, setInventory] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [digitalFileUrl, setDigitalFileUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (product && open) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price?.toString() || '');
      setProductType(product.productType || 'physical');
      setInventory(product.inventory?.toString() || '0');
      setImageUrl(product.imageUrl || null);
      setImagePreview(product.imageUrl || null);
      setDigitalFileUrl(product.digitalFileUrl || null);
    } else if (!product && open) {
      resetForm();
    }
  }, [product, open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setProductType('physical');
    setInventory('0');
    setImageUrl(null);
    setImagePreview(null);
    setImageFile(null);
    setDigitalFileUrl(null);
    setUploading(false);
    setSubmitting(false);
  };

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleImageSelect(e.target.files[0]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handleImageSelect(e.dataTransfer.files[0]);
  }, []);

  const handleDigitalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const url = await uploadImage(file, 'digital-products');
      setDigitalFileUrl(url);
      toast.success('File uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!price || Number(price) <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    try {
      setSubmitting(true);

      // Upload image if a new file was selected
      let finalImageUrl = imageUrl;
      if (imageFile) {
        finalImageUrl = await uploadImage(imageFile, 'product-images');
      }

      if (isEditing && product?.id) {
        await updateProduct(product.id, {
          name: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          productType,
          imageUrl: finalImageUrl,
          digitalFileUrl: productType === 'digital' ? digitalFileUrl : null,
          inventory: Number(inventory) || 0,
        });
        toast.success('Product updated');
      } else {
        const data: ProductInsert = {
          playbackId,
          creatorId,
          name: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          currency: 'USDC',
          imageUrl: finalImageUrl,
          productType,
          digitalFileUrl: productType === 'digital' ? digitalFileUrl : null,
          inventory: Number(inventory) || 0,
          status: 'active',
        };
        await createProduct(data);
        toast.success('Product created');
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Product save error:', err);
      toast.error(err?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#0f0f0f] border border-white/[0.07] shadow-2xl z-[101] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
            <Dialog.Title className="text-[18px] font-bold text-white font-funnel-display">
              {isEditing ? 'Edit product' : 'Add product'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1.5 text-[#555] hover:text-white hover:bg-white/[0.05] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <div className="p-5 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-[14px] font-medium text-white mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product name"
                className="w-full bg-[#1a1a1a] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-[14px] placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-[#facc15]/40"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[14px] font-medium text-white mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your product"
                rows={3}
                className="w-full bg-[#1a1a1a] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-[14px] placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-[#facc15]/40 resize-none"
              />
            </div>

            {/* Price + Inventory row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[14px] font-medium text-white mb-1.5">Price (USDC)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-[#1a1a1a] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-[14px] placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-[#facc15]/40"
                />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-white mb-1.5">Inventory</label>
                <input
                  type="number"
                  value={inventory}
                  onChange={(e) => setInventory(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full bg-[#1a1a1a] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-[14px] placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-[#facc15]/40"
                />
              </div>
            </div>

            {/* Product Type */}
            <div>
              <label className="block text-[14px] font-medium text-white mb-2">Type</label>
              <div className="flex flex-wrap gap-2">
                {productTypes.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setProductType(pt.value)}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border ${
                      productType === pt.value
                        ? 'bg-[#facc15]/10 border-[#facc15]/40 text-[#facc15]'
                        : 'bg-[#1a1a1a] border-white/[0.07] text-[#888] hover:text-white'
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-[14px] font-medium text-white mb-1.5">Image</label>
              {imagePreview ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/[0.07]">
                  <Image
                    src={imagePreview}
                    alt="Product preview"
                    fill
                    className="object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setImageUrl(null);
                    }}
                    className="absolute top-2 right-2 rounded-lg bg-black/70 p-1.5 text-white hover:bg-black/90 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-[#1a1a1a] p-8 text-center cursor-pointer hover:border-white/[0.2] transition-colors"
                >
                  <Upload className="w-6 h-6 text-[#555]" />
                  <label className="cursor-pointer text-[13px] text-[#888] hover:text-white transition-colors">
                    Click to upload or drag and drop
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                </div>
              )}
            </div>

            {/* Digital File Upload (only for digital type) */}
            {productType === 'digital' && (
              <div>
                <label className="block text-[14px] font-medium text-white mb-1.5">Digital file</label>
                {digitalFileUrl ? (
                  <div className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] border border-white/[0.07] p-3">
                    <FileDown className="w-5 h-5 text-[#facc15]" />
                    <span className="text-[13px] text-white truncate flex-1">File uploaded</span>
                    <button
                      type="button"
                      onClick={() => setDigitalFileUrl(null)}
                      className="text-[#555] hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-[#1a1a1a] p-4 text-center cursor-pointer hover:border-white/[0.2] transition-colors">
                    <FileDown className="w-5 h-5 text-[#555]" />
                    <span className="text-[13px] text-[#888]">
                      {uploading ? 'Uploading...' : 'Upload downloadable file'}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleDigitalFileChange}
                      disabled={uploading}
                    />
                  </label>
                )}
                <p className="text-[12px] text-[#555] mt-1">Buyers will get access to this file after purchase.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.07] text-[14px] text-white font-medium hover:bg-[#242424] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-teal-500 text-[14px] text-black font-semibold hover:from-yellow-500 hover:to-teal-600 transition-all disabled:opacity-50 min-w-[100px]"
            >
              {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
