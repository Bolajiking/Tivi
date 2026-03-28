'use client';

import axios from 'axios';
import { useState } from 'react';
import type React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Image from 'next/image';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Upload } from 'lucide-react';
import { ColorRing } from 'react-loader-spinner';
import type { Product } from '@/interfaces';
import { toast } from 'sonner';

interface AddProductDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddProduct: () => void;
}

export const AddProductDialog = ({ isOpen, onOpenChange, onAddProduct }: AddProductDialogProps) => {
  const { user } = usePrivy();
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      uploadImage(file);
    }
  };

  const uploadImage = (file: File) => {
    setProductImage(file);
    setIsUploading(true);

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setIsUploading(false);

        // Create a preview URL
        const reader = new FileReader();
        reader.onload = () => {
          setProductImagePreview(reader.result as string);
        };

        reader.readAsDataURL(file);
      }
    }, 200);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      uploadImage(file);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (!productName || !price || !productImage) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Create new product object
    const newProduct: Omit<Product, 'id'> = {
      user_id: user?.wallet?.address || '',
      name: productName,
      price: Number.parseFloat(price),
      imageUrl: productImagePreview,
      description: description,
      currency: '$',
      quantity: Number.parseInt(quantity) || 0,
    };

    if (!newProduct || !user?.wallet?.address) {
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await axios.post('https://chaintv.onrender.com/api/post/products', newProduct);
      console.log('Product added successfully:', response.data);

      toast.success(response.data.message || 'Product added successfully');

      // Call the callback to update parent component
      onAddProduct();

      // Reset form and close dialog
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add product:', error);
      toast.error('Failed to add product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setProductName('');
    setProductImage(null);
    setProductImagePreview(null);
    setDescription('');
    setPrice('');
    setQuantity('');
    setUploadProgress(0);
    setIsUploading(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 mt-6 w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg overflow-auto max-h-[80vh]">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-bold">Add New Product</Dialog.Title>
            <Dialog.Description className="sr-only">Fill in the details for a new product</Dialog.Description>
            <Dialog.Close asChild>
              <button className="rounded-full p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <input
                type="text"
                className="w-full border rounded-md p-2"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter product name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Product Images</label>
              <div
                className={`border border-dashed rounded-md p-4 text-center ${isDragging ? 'bg-main-blue/10 border-blue-300' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isUploading ? (
                  <div className="py-4">
                    <div className="flex items-center justify-center mb-2">
                      <Upload className="h-8 w-8 text-blue-500 animate-pulse" />
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div className="bg-main-blue h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-500">Uploading... {uploadProgress}%</p>
                  </div>
                ) : productImagePreview ? (
                  <div className="relative w-32 h-32 mx-auto">
                    <Image
                      src={productImagePreview || '/placeholder.svg'}
                      alt="Product preview"
                      fill
                      className="object-contain"
                    />
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      onClick={() => {
                        setProductImage(null);
                        setProductImagePreview(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-center mb-2">
                      <div className="w-16 h-16 bg-gray-100 flex items-center justify-center rounded-md">
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>
                    <label className="cursor-pointer text-blue-600 hover:underline">
                      Click to upload
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                    </label>
                    <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter product description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Pricing</h3>
                <div>
                  <label className="block text-sm mb-1">Price (USD)</label>
                  <input
                    type="number"
                    className="w-full border rounded-md p-2"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Inventory</h3>
                <div>
                  <label className="block text-sm mb-1">Quantity</label>
                  <input
                    type="number"
                    className="w-full border rounded-md p-2"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-main-blue text-white hover:bg-blue-700 transition-colors flex items-center justify-center min-w-[100px]"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <ColorRing
                      visible={true}
                      height="100"
                      width="80"
                      ariaLabel="color-ring-loading"
                      wrapperStyle={{ margin: '4px' }}
                      wrapperClass="color-ring-wrapper"
                      colors={['#000000', '#000000', '#000000', '#000000', '#000000']}
                    />
                    <span>Adding...</span>
                  </>
                ) : (
                  'Add Product'
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
