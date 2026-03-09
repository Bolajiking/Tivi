# Creator Store — Implementation Plan

> Comprehensive design and implementation plan for the creator store section within each TVinBio channel. This document serves as a complete handoff for building the store feature end-to-end.

---

## 1. Overview

### Problem
The TVinBio platform currently has "Shop Coming Soon" placeholders in the mobile BottomNav and no functional store within creator channels. Creators need a fully functional ecommerce portal to sell physical goods, digital products, merch, and ad space directly from their channel pages.

### Current State
- A "Shop Coming Soon" modal exists in `src/components/BottomNav.tsx` (line 182-206)
- An outdated store exists at `src/components/templates/monetization/Tabs/Store/` using an external API (`chaintv.onrender.com`) with light-theme styling — to be fully replaced
- A `Product` interface exists in `src/interfaces/index.ts` (lines 91-100) with basic fields
- USDC payment infrastructure exists at `src/lib/base-usdc-payment.ts`
- The Dashboard (`src/components/templates/dashboard/Dashboard.tsx`) has two tabs: Videos | Livestreams
- The public CreatorProfile (`src/components/templates/creator/CreatorProfile.tsx`) also has Videos | Livestreams tabs
- Order history page at `src/app/dashboard/order-history/page.tsx` has placeholder empty data

### Solution
Build a per-channel creator store on Supabase with USDC payments on Base chain. Add "Store" as a third tab in both the creator dashboard and public creator profile views. Replace all external API calls with Supabase CRUD operations.

---

## 2. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Supabase (not external API)** | Replace `chaintv.onrender.com` with Supabase — consistent with rest of platform, no external dependency |
| **Per-channel store** | Products tied to `playbackId` (channel), not just `creatorId`. A creator with multiple channels gets separate stores |
| **No Redux for products** | Products are channel-specific, fetched locally. Use `useState` + `useEffect` + `useCallback` pattern (matching existing old Store.tsx). Redux is only for Livepeer streams/assets shared across app |
| **`productSnapshot` on orders** | Freeze product details (name, price, image) at purchase time. Protects order history when products are later edited/deleted |
| **Reuse existing `uploadImage()`** | Supabase Storage upload with bucket fallback logic already handles missing buckets gracefully |
| **Reuse `sendBaseUsdcPayment()`** | Battle-tested in VideoPaymentGate, CreatorPaymentGate, StreamPaymentGate |

---

## 3. Database Layer

### 3.1 SQL Migration

Create file: **`store-schema.sql`** (project root, run in Supabase SQL editor)

```sql
-- =============================================
-- TVinBio Creator Store Schema
-- =============================================

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "playbackId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USDC',
  "imageUrl" TEXT,
  "productType" TEXT NOT NULL DEFAULT 'physical',
  "digitalFileUrl" TEXT,
  inventory INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_creator ON products ("creatorId");
CREATE INDEX IF NOT EXISTS idx_products_playback ON products ("playbackId");
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "productId" UUID NOT NULL REFERENCES products(id),
  "buyerAddress" TEXT NOT NULL,
  "sellerAddress" TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  "txHash" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "shippingInfo" JSONB,
  "productSnapshot" JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders ("buyerAddress");
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders ("sellerAddress");
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders ("productId");
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- RLS Policies (anon read, authenticated write — matching existing table patterns)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Products: anyone can read active products, creators can manage their own
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update" ON products FOR UPDATE USING (true);
CREATE POLICY "products_delete" ON products FOR DELETE USING (true);

-- Orders: buyers/sellers can read their own, anyone can insert
CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (true);
```

### 3.2 Column Reference

**`products` table:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Auto-generated primary key |
| `playbackId` | TEXT | Channel this product belongs to |
| `creatorId` | TEXT | Creator wallet address (owner) |
| `name` | TEXT | Product name (required) |
| `description` | TEXT | Product description |
| `price` | NUMERIC(12,2) | Price in USDC |
| `currency` | TEXT | Always 'USDC' |
| `imageUrl` | TEXT | Supabase Storage URL for product image |
| `productType` | TEXT | `physical` / `digital` / `merch` / `ad` |
| `digitalFileUrl` | TEXT | Download URL for digital products |
| `inventory` | INTEGER | Stock count (0 = unlimited or sold out based on status) |
| `status` | TEXT | `active` / `sold_out` / `archived` |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-set |

**`orders` table:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Auto-generated primary key |
| `productId` | UUID | FK to products.id |
| `buyerAddress` | TEXT | Buyer wallet address |
| `sellerAddress` | TEXT | Seller/creator wallet address |
| `amount` | NUMERIC(12,2) | Amount paid in USDC |
| `txHash` | TEXT | On-chain transaction hash |
| `status` | TEXT | `pending` / `completed` / `failed` / `refunded` |
| `shippingInfo` | JSONB | Shipping details for physical products |
| `productSnapshot` | JSONB | Frozen product details at purchase time (name, price, image, etc.) |
| `created_at` | TIMESTAMPTZ | Auto-set |

---

## 4. TypeScript Types

### 4.1 Modify: `src/lib/supabase-types.ts`

Add after the `ChannelChatGroup` interface (before helper types section):

```typescript
// Product table types
export interface SupabaseProduct {
  id?: string;                          // UUID primary key (auto-generated)
  playbackId: string;                   // Channel this product belongs to
  creatorId: string;                    // Creator wallet address
  name: string;
  description: string | null;
  price: number;
  currency: string;                     // 'USDC'
  imageUrl: string | null;
  productType: 'physical' | 'digital' | 'merch' | 'ad';
  digitalFileUrl: string | null;        // Download URL for digital products
  inventory: number;
  status: 'active' | 'sold_out' | 'archived';
  created_at?: string;
  updated_at?: string;
}

// Order table types
export interface SupabaseOrder {
  id?: string;                          // UUID primary key (auto-generated)
  productId: string;                    // FK to products.id
  buyerAddress: string;                 // Buyer wallet address
  sellerAddress: string;                // Seller/creator wallet address
  amount: number;                       // Amount paid in USDC
  txHash: string;                       // On-chain transaction hash
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  shippingInfo: Record<string, any> | null;
  productSnapshot: Record<string, any> | null;
  created_at?: string;
}

// Helper types for database operations
export type ProductInsert = Omit<SupabaseProduct, 'id' | 'created_at' | 'updated_at'>;
export type ProductUpdate = Partial<Omit<SupabaseProduct, 'id' | 'created_at' | 'updated_at'>>;
export type OrderInsert = Omit<SupabaseOrder, 'id' | 'created_at'>;
```

### 4.2 Modify: `src/interfaces/index.ts`

Add deprecation comment to old `Product` interface:

```typescript
/** @deprecated Use SupabaseProduct from '@/lib/supabase-types' instead */
export interface Product {
  // ... existing fields unchanged for backward compat
}
```

---

## 5. Supabase Service Functions

### 5.1 Modify: `src/lib/supabase-service.ts`

Add imports for new types at the top, then add two new sections.

**Pattern to follow:** Each function validates inputs, calls Supabase client, handles errors with descriptive messages, returns typed data. Use `ilike` for wallet address comparisons (matching existing `getStreamsByCreator` pattern). Include table-unavailable handling following the `chatsTableUnavailable` pattern (lines 1653-1707 in the same file).

```
// ==================== PRODUCT OPERATIONS ====================

createProduct(data: ProductInsert): Promise<SupabaseProduct>
  - Validates: playbackId, creatorId, name required
  - Inserts to 'products' table
  - Returns created product

getProductsByChannel(playbackId: string): Promise<SupabaseProduct[]>
  - Fetches all products for a channel
  - Ordered by created_at desc

getProductsByCreator(creatorId: string): Promise<SupabaseProduct[]>
  - Uses .ilike('creatorId', creatorId) for case-insensitive wallet matching
  - Returns all products across all channels for a creator

getActiveProductsByChannel(playbackId: string): Promise<SupabaseProduct[]>
  - Like getProductsByChannel but filtered to status='active' AND inventory > 0
  - Used for public-facing store view

updateProduct(id: string, updates: ProductUpdate): Promise<SupabaseProduct>
  - Also sets updated_at to now()

deleteProduct(id: string): Promise<void>

decrementProductInventory(productId: string): Promise<SupabaseProduct>
  - Fetches current product, decrements inventory by 1
  - If inventory reaches 0, auto-updates status to 'sold_out'
  - Returns updated product

// ==================== ORDER OPERATIONS ====================

createOrder(data: OrderInsert): Promise<SupabaseOrder>
  - Validates: productId, buyerAddress, sellerAddress, amount, txHash required

getOrdersByBuyer(buyerAddress: string): Promise<SupabaseOrder[]>
  - Uses .ilike('buyerAddress', buyerAddress)
  - Ordered by created_at desc

getOrdersBySeller(sellerAddress: string): Promise<SupabaseOrder[]>
  - Uses .ilike('sellerAddress', sellerAddress)
  - Ordered by created_at desc

getOrdersByProduct(productId: string): Promise<SupabaseOrder[]>

updateOrderStatus(id: string, status: string): Promise<SupabaseOrder>
```

---

## 6. UI Components

### Design Spec (Dark Theme)

All new components follow the established dark theme:

| Token | Value | Usage |
|-------|-------|-------|
| Canvas | `bg-[#080808]` | Page background |
| Surface | `bg-[#0f0f0f]` | Modal backgrounds |
| Raised | `bg-[#1a1a1a]` | Cards, inputs |
| Border | `border-white/[0.07]` | All borders |
| Text primary | `text-white` | Headings, values |
| Text secondary | `text-[#888]` | Labels, metadata |
| Text tertiary | `text-[#555]` | Placeholders, disabled |
| Accent | `#facc15` | Active states, prices |
| CTA gradient | `from-yellow-400 to-teal-500` | Primary action buttons |
| Heading font | `font-funnel-display` | Section titles |
| Body font | `font-host-grotesk` | Form labels, body text |
| Input radius | `rounded-xl` | All inputs/cards |
| Focus ring | `ring-1 ring-[#facc15]/40` | Input focus state |

### 6.1 ProductCard

**New file: `src/components/templates/store/ProductCard.tsx`**

```typescript
interface ProductCardProps {
  product: SupabaseProduct;
  variant: 'creator' | 'public';
  onEdit?: (product: SupabaseProduct) => void;
  onDelete?: (product: SupabaseProduct) => void;
  onBuy?: (product: SupabaseProduct) => void;
}
```

**Layout:**
```
┌─────────────────────────┐
│  [Product Image]        │  ← aspect-square, rounded-t-xl
│  (edit/delete overlay)  │  ← creator variant only
├─────────────────────────┤
│  Physical               │  ← product type pill badge
│  Product Name           │  ← text-white font-semibold, line-clamp-2
│  $12.00 USDC           │  ← text-[#facc15] font-bold
│  12 in stock  ● Active  │  ← inventory + status badges
│                         │
│  [ Buy Now ]            │  ← public variant: gradient CTA
└─────────────────────────┘
```

- Card container: `rounded-xl border border-white/[0.07] bg-[#1a1a1a] overflow-hidden`
- Image: `aspect-square w-full object-cover` with fallback placeholder
- Product type: small pill `bg-[#0f0f0f] rounded-full px-2 py-0.5 text-[11px] text-[#888]`
- Status indicator: colored dot (green=active, red=sold_out, gray=archived)
- Creator variant: semi-transparent overlay with Edit (Pencil) and Delete (Trash2) icon buttons on hover
- Public variant: "Buy now" button `bg-gradient-to-r from-yellow-400 to-teal-500 text-black font-semibold rounded-lg`

### 6.2 AddEditProductModal

**New file: `src/components/templates/store/AddEditProductModal.tsx`**

```typescript
interface AddEditProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: SupabaseProduct | null;  // null = add, provided = edit
  playbackId: string;
  creatorId: string;
}
```

**Form fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text input | Yes | |
| Description | Textarea | No | |
| Price | Number input | Yes | Label: "Price (USDC)" |
| Product Type | 4-option radio/select | Yes | physical, digital, merch, ad |
| Image | Drag-and-drop upload | No | Uses `uploadImage('product-images')` from supabase-service |
| Digital File | File upload | No | Only shown when type=digital. Upload to Supabase Storage |
| Inventory | Number input | No | Default 0 |

**Behavior:**
- Radix `Dialog` (same pattern as `StreamSetupModal` at `src/components/StreamSetupModal.tsx`)
- Modal: `bg-[#0f0f0f] border border-white/[0.07] rounded-xl shadow-2xl`
- On submit: calls `createProduct()` or `updateProduct()` from supabase-service
- Image upload shows progress bar and preview (matching `AddProductDialog.tsx` pattern)
- Loading: `Bars` spinner from `react-loader-spinner` (consistent with existing codebase)
- Toast on success/error via `sonner`

### 6.3 CreatorStore (Dashboard Tab Content)

**New file: `src/components/templates/store/CreatorStore.tsx`**

```typescript
interface CreatorStoreProps {
  playbackId: string;
  creatorId: string;
}
```

**State management:**
```typescript
const [products, setProducts] = useState<SupabaseProduct[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [showAddModal, setShowAddModal] = useState(false);
const [editingProduct, setEditingProduct] = useState<SupabaseProduct | null>(null);
const [deletingProduct, setDeletingProduct] = useState<SupabaseProduct | null>(null);

const fetchProducts = useCallback(async () => {
  if (!playbackId) return;
  setLoading(true);
  try {
    const data = await getProductsByChannel(playbackId);
    setProducts(data);
  } catch (err) {
    setError('Failed to load products');
    toast.error('Failed to load products');
  } finally {
    setLoading(false);
  }
}, [playbackId]);
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Store                            [+ Add product]│
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Product  │  │ Product  │  │ Product  │      │
│  │  Card    │  │  Card    │  │  Card    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  ┌──────────┐  ┌──────────┐                      │
│  │ Product  │  │ Product  │                      │
│  │  Card    │  │  Card    │                      │
│  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────┘
```

- Header row: `flex items-center justify-between mb-6`
- "Store" heading: `text-[22px] font-bold text-white font-funnel-display`
- "Add product" button: gradient CTA with Plus icon
- Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Each item: `<ProductCard variant="creator" onEdit={...} onDelete={...} />`
- Empty state: reuse `EmptyStatePanel` pattern from Dashboard.tsx (line 410-429) with ShoppingBag icon
- Loading: `Skeleton` grid (3 cards, matching Dashboard video loading pattern)
- Delete confirmation: Radix AlertDialog or inline confirmation

### 6.4 PublicStoreView

**New file: `src/components/templates/store/PublicStoreView.tsx`**

```typescript
interface PublicStoreViewProps {
  playbackId: string;
  creatorId: string;
  creatorName?: string;
}
```

**Behavior:**
- Fetches products via `getActiveProductsByChannel(playbackId)` — only `status === 'active'` products shown
- Grid of `<ProductCard variant="public" onBuy={...} />`
- Clicking "Buy" opens PurchaseModal
- Empty state: "No products available" with shopping bag icon
- Loading: Skeleton grid

### 6.5 PurchaseModal

**New file: `src/components/templates/store/PurchaseModal.tsx`** (can be in same file as PublicStoreView or separate)

```typescript
interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
  product: SupabaseProduct;
  onSuccess: (order: SupabaseOrder) => void;
}
```

**Payment flow (follows `VideoPaymentGate.tsx` pattern):**

```
1. User clicks "Buy" on a ProductCard
2. PurchaseModal opens showing:
   - Product image (rounded-lg)
   - Product name (text-white font-semibold)
   - Product description (text-[#888] text-sm)
   - Price: "$X.XX USDC" (text-[#facc15] text-2xl font-bold)
   - "Pay X.XX USDC" gradient button

3. User clicks Pay:
   - Get sendTransaction from useSendTransaction()
   - Get payerAddress from useWalletAddress()
   - recipientAddress = product.creatorId
   - Call sendBaseUsdcPayment({ sendTransaction, payerAddress, recipientAddress, amountUsd: product.price })
   - Returns txHash on success

4. On payment success:
   - createOrder({
       productId: product.id,
       buyerAddress: payerAddress,
       sellerAddress: product.creatorId,
       amount: product.price,
       txHash: txHash,
       status: 'completed',
       shippingInfo: null, // future: collect for physical products
       productSnapshot: {
         name: product.name,
         price: product.price,
         imageUrl: product.imageUrl,
         productType: product.productType,
         creatorId: product.creatorId,
       }
     })
   - decrementProductInventory(product.id)
   - If productType === 'digital' && digitalFileUrl: show download button
   - Toast: "Purchase successful!"
   - Call onSuccess callback

5. On payment failure:
   - Toast error
   - Keep modal open for retry
```

**Reuse from codebase:**
- `useSendTransaction()` from `@privy-io/react-auth` (used in VideoPaymentGate.tsx)
- `sendBaseUsdcPayment()` from `src/lib/base-usdc-payment.ts`
- `useWalletAddress()` from `src/app/hook/useWalletAddress.ts`
- `Bars` spinner from `react-loader-spinner`
- `toast` from `sonner`

---

## 7. Integration Points

### 7.1 Dashboard — Add Store Tab

**Modify: `src/components/templates/dashboard/Dashboard.tsx`**

Current (lines 726-740):
```tsx
<Tabs value={activeTab} onValueChange={...}>
  <TabsList className="grid w-full grid-cols-2 ...">
    <TabsTrigger value="videos">Videos</TabsTrigger>
    <TabsTrigger value="livestreams">Livestreams</TabsTrigger>
  </TabsList>
  <TabsContent value="videos">...</TabsContent>
  <TabsContent value="livestreams">...</TabsContent>
</Tabs>
```

Changes:
1. Add import: `import { CreatorStore } from '@/components/templates/store/CreatorStore'`
2. Update `activeTab` type: `'videos' | 'livestreams' | 'store'`
3. Add `?tab` search param handling: if `searchParams.get('tab') === 'store'`, set initial activeTab to `'store'`
4. Change `grid-cols-2` → `grid-cols-3`
5. Add trigger:
```tsx
<TabsTrigger value="store" className="...same styling as others...">
  Store
</TabsTrigger>
```
6. Add content:
```tsx
<TabsContent value="store" className="mt-4">
  <CreatorStore
    playbackId={selectedChannel?.playbackId || ''}
    creatorId={creatorAddress || ''}
  />
</TabsContent>
```

### 7.2 CreatorProfile — Add Store Tab

**Modify: `src/components/templates/creator/CreatorProfile.tsx`**

Same pattern as Dashboard:
1. Import `PublicStoreView`
2. Update tab type to include `'store'`
3. Add `?tab` search param handling
4. Change `grid-cols-2` → `grid-cols-3`
5. Add Store trigger and content with `<PublicStoreView />`

### 7.3 BottomNav — Replace "Coming Soon"

**Modify: `src/components/BottomNav.tsx`**

Remove:
- `const [showShopModal, setShowShopModal] = useState(false);` (line 22)
- The entire `Dialog.Root` block (lines 182-206)
- The `isModal: true` / `onClick` pattern for Shop item

Add:
```typescript
const shopHref = useMemo(() => {
  // If on a creator route, go to that creator's store
  if (pathname?.startsWith('/creator/')) {
    const creatorIdParam = params?.creatorId as string | undefined;
    if (creatorIdParam) {
      return `/creator/${encodeURIComponent(decodeURIComponent(creatorIdParam))}?tab=store`;
    }
  }
  // If logged in, go to own creator store
  if (isLoggedIn && (ownCreatorRouteId || currentUserAddress)) {
    return `/creator/${encodeURIComponent(ownCreatorRouteId || currentUserAddress)}?tab=store`;
  }
  return '/dashboard';
}, [pathname, params, isLoggedIn, ownCreatorRouteId, currentUserAddress]);
```

Update nav item:
```typescript
{ name: 'Shop', href: shopHref, icon: FaSackDollar, isModal: false }
```

Update `activeItemName` to check for `tab=store` query param.

### 7.4 Order History — Wire Real Data

**Modify: `src/app/dashboard/order-history/page.tsx`**

Changes:
1. Import `getOrdersByBuyer`, `SupabaseOrder` from supabase-service/types
2. Import `useWalletAddress` from `src/app/hook/useWalletAddress`
3. Replace empty `transactions` with real data fetching:
```typescript
const { walletAddress } = useWalletAddress();
const [orders, setOrders] = useState<SupabaseOrder[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!walletAddress) return;
  getOrdersByBuyer(walletAddress)
    .then(setOrders)
    .catch(console.error)
    .finally(() => setLoading(false));
}, [walletAddress]);
```
4. Map `SupabaseOrder` to display: use `productSnapshot` for product name/image/creator
5. Update theme from `bg-gradient-to-br from-black via-gray-900 to-black` to `bg-[#080808]`
6. Add Skeleton loading state

---

## 8. File Inventory

### New Files (6)

| File | Description |
|------|-------------|
| `store-schema.sql` | Supabase SQL migration for products + orders tables |
| `src/components/templates/store/ProductCard.tsx` | Product card component (creator & public variants) |
| `src/components/templates/store/AddEditProductModal.tsx` | Add/edit product form dialog |
| `src/components/templates/store/CreatorStore.tsx` | Creator dashboard store management tab content |
| `src/components/templates/store/PublicStoreView.tsx` | Public-facing store grid for viewers |
| `src/components/templates/store/PurchaseModal.tsx` | Purchase confirmation + USDC payment modal |

### Modified Files (7)

| File | Change Summary |
|------|----------------|
| `src/lib/supabase-types.ts` | Add SupabaseProduct, SupabaseOrder, ProductInsert, ProductUpdate, OrderInsert |
| `src/lib/supabase-service.ts` | Add ~12 product/order CRUD functions |
| `src/components/templates/dashboard/Dashboard.tsx` | Add Store as 3rd tab (grid-cols-3, new trigger + content) |
| `src/components/templates/creator/CreatorProfile.tsx` | Add Store as 3rd tab in public view |
| `src/components/BottomNav.tsx` | Replace "Coming Soon" modal with actual store navigation link |
| `src/app/dashboard/order-history/page.tsx` | Wire real order data from Supabase, update dark theme |
| `src/interfaces/index.ts` | Deprecate old Product interface |

### Existing Code to Reuse

| What | Location | Used For |
|------|----------|----------|
| `uploadImage(file, bucketName)` | `src/lib/supabase-service.ts:69` | Product image uploads |
| `sendBaseUsdcPayment()` | `src/lib/base-usdc-payment.ts:52` | USDC payment execution |
| `useSendTransaction` | `@privy-io/react-auth` | Privy wallet transaction hook |
| `useWalletAddress()` | `src/app/hook/useWalletAddress.ts` | Get current user wallet |
| `Tabs/TabsList/TabsTrigger/TabsContent` | `src/components/ui/Tabs.tsx` | Tab navigation |
| Radix `Dialog` pattern | `src/components/StreamSetupModal.tsx` | Modal structure |
| `EmptyStatePanel` pattern | `src/components/templates/dashboard/Dashboard.tsx:410` | Empty states |
| Table-unavailable handling | `src/lib/supabase-service.ts:1653` | Graceful degradation |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Loading states |
| `toast` | `sonner` | Success/error notifications |

---

## 9. Implementation Order

```
Step 1: Database & Types (Foundation)
  ├── Run store-schema.sql in Supabase
  ├── Add types to supabase-types.ts
  └── Add CRUD functions to supabase-service.ts

Step 2: Store Components
  ├── ProductCard.tsx
  ├── AddEditProductModal.tsx
  ├── CreatorStore.tsx
  ├── PublicStoreView.tsx
  └── PurchaseModal.tsx

Step 3: Dashboard Integration
  └── Dashboard.tsx — Add Store tab

Step 4: Public Store Integration
  └── CreatorProfile.tsx — Add Store tab

Step 5: Navigation
  └── BottomNav.tsx — Replace "Coming Soon" with link

Step 6: Order History
  └── order-history/page.tsx — Wire real data

Step 7: Polish
  ├── Error handling & table-unavailable guards
  ├── Inventory management edge cases
  └── Digital product download flow
```

**Dependency chain:** Step 1 → Steps 2-7 (all depend on database). Steps 2-5 can be parallelized after Step 1. Step 6 depends on Step 1 only.

---

## 10. Verification Checklist

- [ ] **SQL Migration**: Tables `products` and `orders` exist in Supabase with correct columns and indexes
- [ ] **CRUD**: Can create, read, update, delete products via supabase-service functions
- [ ] **Creator Store Tab**: Dashboard shows Videos | Livestreams | Store tabs. Store tab shows product grid with Add/Edit/Delete functionality
- [ ] **Add Product**: Creator can add a product with image, name, price, type, inventory. Product appears in grid.
- [ ] **Edit Product**: Creator can edit product details. Changes persist.
- [ ] **Delete Product**: Creator can delete a product with confirmation.
- [ ] **Public Store Tab**: CreatorProfile shows Store tab with active products only
- [ ] **Purchase Flow**: Viewer can click "Buy", complete USDC payment, order is created in Supabase
- [ ] **Digital Download**: After purchasing a digital product, download link is shown
- [ ] **Inventory**: Inventory decrements on purchase. Auto-marks as sold_out at 0.
- [ ] **Order History**: `/dashboard/order-history` shows real purchases with product details from snapshot
- [ ] **BottomNav**: Shop button navigates to store tab (no "Coming Soon" modal)
- [ ] **Dark Theme**: All new components match the platform dark theme (no white backgrounds, no light-theme remnants)
- [ ] **Mobile**: All views are responsive and functional on mobile viewports
