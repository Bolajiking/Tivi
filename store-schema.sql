-- =============================================
-- TVinBio Creator Store Schema
-- Run this in Supabase SQL Editor
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

-- RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Products: public read, authenticated write
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update" ON products FOR UPDATE USING (true);
CREATE POLICY "products_delete" ON products FOR DELETE USING (true);

-- Orders: public read, authenticated write
CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (true);
