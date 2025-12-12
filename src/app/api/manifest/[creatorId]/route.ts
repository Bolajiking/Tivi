import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile, getUserProfileByUsername } from '@/lib/supabase-service';

/**
 * Dynamic PWA Manifest API Route
 * Generates a manifest.json file with creator-specific data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { creatorId: string } }
) {
  try {
    const creatorId = decodeURIComponent(params.creatorId);
    
    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      );
    }

    // Fetch creator profile
    let creatorProfile = await getUserProfileByUsername(creatorId);
    if (!creatorProfile) {
      creatorProfile = await getUserProfile(creatorId);
    }

    if (!creatorProfile) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    const displayName = creatorProfile.displayName || 'Creator Profile';
    const avatar = creatorProfile.avatar || '';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (request.headers.get('origin') || 'https://chainfrentv.com');
    
    // Generate manifest with creator-specific data
    const manifest = {
      name: `${displayName} - ChainfrenTV`,
      short_name: displayName.length > 12 ? displayName.substring(0, 12) : displayName,
      description: `Follow ${displayName} on ChainfrenTV - Live Streaming on Ethereum`,
      start_url: `/creator/${encodeURIComponent(creatorId)}`,
      display: 'standalone',
      background_color: '#000000',
      theme_color: '#facc15',
      orientation: 'portrait-primary',
      icons: [
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=72`,
          sizes: '72x72',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=96`,
          sizes: '96x96',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=128`,
          sizes: '128x128',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=144`,
          sizes: '144x144',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=152`,
          sizes: '152x152',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=192`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=384`,
          sizes: '384x384',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=512`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/api/icon/${encodeURIComponent(creatorId)}?size=512`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ],
      categories: ['entertainment', 'video', 'social'],
      screenshots: [],
      share_target: {
        action: `/creator/${encodeURIComponent(creatorId)}`,
        method: 'GET',
        enctype: 'application/x-www-form-urlencoded'
      },
      scope: '/',
      display_override: ['standalone', 'fullscreen']
    };

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error: any) {
    console.error('Error generating manifest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

