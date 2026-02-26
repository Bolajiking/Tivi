import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile, getUserProfileByUsername } from '@/lib/supabase-service';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Dynamic PWA Icon API Route
 * Generates a PWA icon with creator's profile image and name
 * Converts SVG to PNG using Sharp for better compatibility
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { creatorId: string } }
) {
  try {
    const creatorId = decodeURIComponent(params.creatorId);
    const requestedSize = parseInt(request.nextUrl.searchParams.get('size') || '192', 10);
    const size = Number.isFinite(requestedSize)
      ? Math.max(64, Math.min(requestedSize, 1024))
      : 192;
    const format = request.nextUrl.searchParams.get('format') || 'png';
    
    if (!creatorId) {
      return new NextResponse('Creator ID is required', { status: 400 });
    }

    // Fetch creator profile
    let creatorProfile = await getUserProfileByUsername(creatorId);
    if (!creatorProfile) {
      creatorProfile = await getUserProfile(creatorId);
    }

    if (!creatorProfile) {
      return new NextResponse('Creator not found', { status: 404 });
    }

    const displayName = creatorProfile.displayName || 'Creator';
    const avatar = creatorProfile.avatar || '';
    
    // Generate SVG icon
    const svgIcon = generateIconSVG(displayName, avatar, size);
    
    // Convert SVG to PNG using Sharp (dynamic import to avoid build-time issues)
    if (format === 'png') {
      try {
        // Dynamically import sharp only when needed (at runtime, not build time)
        const sharp = (await import('sharp')).default;
        const pngBuffer = await sharp(Buffer.from(svgIcon))
          .resize(size, size)
          .png()
          .toBuffer();
        
        return new NextResponse(pngBuffer as unknown as BodyInit, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        });
      } catch (sharpError: any) {
        // If sharp fails (e.g., not available in build environment), fall back to SVG
        console.warn('Sharp not available, falling back to SVG:', sharpError.message);
        return new NextResponse(svgIcon, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        });
      }
    } else {
      // Return SVG directly
      return new NextResponse(svgIcon, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    }
  } catch (error: any) {
    console.error('Error generating icon:', error);
    // Fallback to SVG if Sharp fails
    try {
      const creatorId = decodeURIComponent(params.creatorId);
      const requestedSize = parseInt(request.nextUrl.searchParams.get('size') || '192', 10);
      const size = Number.isFinite(requestedSize)
        ? Math.max(64, Math.min(requestedSize, 1024))
        : 192;
      let creatorProfile = await getUserProfileByUsername(creatorId);
      if (!creatorProfile) {
        creatorProfile = await getUserProfile(creatorId);
      }
      const displayName = creatorProfile?.displayName || 'Creator';
      const avatar = creatorProfile?.avatar || '';
      const svgIcon = generateIconSVG(displayName, avatar, size);
      
      return new NextResponse(svgIcon, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    } catch (fallbackError) {
      return new NextResponse('Internal server error', { status: 500 });
    }
  }
}

/**
 * Generate SVG icon with creator's name and avatar
 */
function generateIconSVG(name: string, avatarUrl: string, size: number): string {
  const fontSize = Math.max(12, size / 8);
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 2) || 'TV';

  const sanitizeAvatarUrl = (value: string): string => {
    const candidate = String(value || '').trim();
    if (!candidate) return '';
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return '';
      }
      return parsed.toString();
    } catch {
      return '';
    }
  };
  
  // Escape the avatar URL for use in SVG
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl);
  const escapedAvatarUrl = safeAvatarUrl ? safeAvatarUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '';
  
  // If avatar exists, use it as background, otherwise use gradient
  const background = escapedAvatarUrl 
    ? `<defs>
         <clipPath id="circle">
           <circle cx="${size/2}" cy="${size/2}" r="${size/2}"/>
         </clipPath>
       </defs>
       <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.2}"/>
       <image href="${escapedAvatarUrl}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#circle)"/>
       <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>`
    : `<defs>
         <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
           <stop offset="0%" style="stop-color:#facc15;stop-opacity:1" />
           <stop offset="100%" style="stop-color:#14b8a6;stop-opacity:1" />
         </linearGradient>
       </defs>
       <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.2}"/>`;
  
  // Always include initials as fallback (will show if image fails to load)
  const initialsText = `<text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${background}
  ${escapedAvatarUrl ? `<g opacity="0.9">${initialsText}</g>` : initialsText}
</svg>`;
}
