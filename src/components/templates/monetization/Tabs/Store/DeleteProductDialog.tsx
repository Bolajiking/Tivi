'use client';

import axios from 'axios';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
interface DeleteProductDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteProduct: () => void;
  productId: string;
}

export const DeleteProductDialog = ({ isOpen, onOpenChange, onDeleteProduct, productId }: DeleteProductDialogProps) => {
  const { user } = usePrivy();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user?.wallet?.address || !productId) {
      toast.error('Invalid product or user information.');
      return;
    }

    try {
      setIsDeleting(true);
      const response = await axios.delete(
        `https://chaintv.onrender.com/api/delete/products/${productId}/${user?.wallet?.address}`,
      );
      toast.success(response.data.message || 'Product deleted successfully');
      onDeleteProduct();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      toast.error(error.response?.data?.message || 'Failed to delete product. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 mt-6 w-[90vw] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-bold">Delete Product</Dialog.Title>
            <Dialog.Description className="sr-only">Confirm product deletion</Dialog.Description>
            <Dialog.Close asChild>
              <button className="rounded-full p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete this product? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
