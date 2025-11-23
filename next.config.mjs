/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extract Supabase hostname from environment variable
const getSupabaseHostname = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    return url.hostname;
  } catch (error) {
    console.warn('Invalid NEXT_PUBLIC_SUPABASE_URL:', error);
    return null;
  }
};

const supabaseHostname = getSupabaseHostname();

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID:
      process.env.NEXT_PUBLIC_PRIVY_ENVIRONMENT_ID,
  },
  images: {
    domains: [
      "vod-cdn.lp-playback.studio", 
      'recordings-cdn-s.lp-playback.studio',
      // Add Supabase hostname dynamically if available
      ...(supabaseHostname ? [supabaseHostname] : []),
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  webpack: (config, { webpack }) => {
    // Handle Solana packages that are transitive dependencies from x402 (via Privy)
    // Since we're using Ethereum-only wallets (walletChainType: 'ethereum-only'), 
    // we don't need Solana functionality
    // Replace problematic Solana imports with an empty module to prevent build errors
    
    // Replace @solana/kit imports with our empty module
    // This works for both direct imports and imports from compute-budget
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@solana\/kit$/,
        (resource) => {
          // Always replace @solana/kit with our empty module
          // This prevents the "isDurableNonceTransaction is not exported" error
          resource.request = path.resolve(__dirname, 'src/lib/empty-module.js');
        }
      )
    );
    
    // Also use resolve.alias as a fallback for better compatibility
    config.resolve.alias = {
      ...config.resolve.alias,
      '@solana/kit': path.resolve(__dirname, 'src/lib/empty-module.js'),
    };
    
    return config;
  },
};

export default nextConfig;
