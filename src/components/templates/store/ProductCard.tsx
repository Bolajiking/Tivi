'use client';

import Image from 'next/image';
import { Pencil, Trash2, ShoppingBag } from 'lucide-react';
import type { SupabaseProduct } from '@/lib/supabase-types';

interface ProductCardProps {
  product: SupabaseProduct;
  variant: 'creator' | 'public';
  onEdit?: (product: SupabaseProduct) => void;
  onDelete?: (product: SupabaseProduct) => void;
  onBuy?: (product: SupabaseProduct) => void;
}

const typeLabels: Record<string, string> = {
  physical: 'Physical',
  digital: 'Digital',
  merch: 'Merch',
  ad: 'Ad space',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500',
  sold_out: 'bg-red-500',
  archived: 'bg-[#555]',
};

export const ProductCard = ({ product, variant, onEdit, onDelete, onBuy }: ProductCardProps) => {
  return (
    <div className="group relative rounded-xl border border-white/[0.07] bg-[#1a1a1a] overflow-hidden transition-colors hover:border-white/[0.12]">
      {/* Image */}
      <div className="relative aspect-square bg-[#0f0f0f] overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ShoppingBag className="w-10 h-10 text-[#333]" />
          </div>
        )}

        {/* Creator actions overlay */}
        {variant === 'creator' && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                className="rounded-lg bg-black/70 backdrop-blur-sm p-2 text-white hover:bg-black/90 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(product); }}
                className="rounded-lg bg-black/70 backdrop-blur-sm p-2 text-red-400 hover:bg-black/90 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Status badge (creator only) */}
        {variant === 'creator' && product.status !== 'active' && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[11px] font-medium text-white capitalize">
              <span className={`w-1.5 h-1.5 rounded-full ${statusColors[product.status] || 'bg-[#555]'}`} />
              {product.status.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 space-y-2">
        {/* Type badge */}
        <span className="inline-block rounded-full bg-[#0f0f0f] border border-white/[0.07] px-2 py-0.5 text-[11px] text-[#888]">
          {typeLabels[product.productType] || product.productType}
        </span>

        {/* Name */}
        <h3 className="text-[15px] font-semibold text-white line-clamp-2 leading-tight">
          {product.name}
        </h3>

        {/* Price + inventory */}
        <div className="flex items-center justify-between">
          <span className="text-[#facc15] font-bold text-[15px]">
            ${Number(product.price).toFixed(2)} <span className="text-[12px] font-normal text-[#888]">USDC</span>
          </span>
          {variant === 'creator' && (
            <span className="text-[12px] text-[#555]">
              {product.inventory > 0 ? `${product.inventory} in stock` : 'No stock'}
            </span>
          )}
        </div>

        {/* Buy button (public only) */}
        {variant === 'public' && onBuy && product.status === 'active' && (
          <button
            onClick={() => onBuy(product)}
            className="w-full mt-1 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-teal-500 text-black text-[13px] font-semibold transition-all hover:from-yellow-500 hover:to-teal-600"
          >
            Buy now
          </button>
        )}

        {variant === 'public' && product.status === 'sold_out' && (
          <div className="w-full mt-1 py-2 rounded-lg bg-[#0f0f0f] border border-white/[0.07] text-center text-[13px] text-[#555] font-medium">
            Sold out
          </div>
        )}
      </div>
    </div>
  );
};
