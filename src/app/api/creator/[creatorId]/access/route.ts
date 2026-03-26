import { NextRequest, NextResponse } from 'next/server';
import { getStreamsByCreator } from '@/lib/supabase-service';

/**
 * API endpoint to check creator profile access requirements
 * Returns payment information if payment is required
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { creatorId: string } }
) {
  try {
    const creatorId = params.creatorId?.trim();

    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      );
    }

    // Basic input validation — reject obviously malicious or invalid IDs
    if (creatorId.length > 200 || /[<>"';&|`$]/.test(creatorId)) {
      return NextResponse.json(
        { error: 'Invalid creator ID' },
        { status: 400 }
      );
    }

    // Fetch the creator's streams to get viewMode and amount
    const streams = await getStreamsByCreator(creatorId);
    
    if (!streams || streams.length === 0) {
      // No streams found - allow free access
      return NextResponse.json({ 
        access: 'granted',
        viewMode: 'free',
        amount: 0
      }, { status: 200 });
    }

    // Use the first stream's viewMode for the channel
    const channelStream = streams[0];
    
    // If viewMode is 'free', grant access
    if (channelStream.viewMode === 'free') {
      return NextResponse.json({ 
        access: 'granted',
        viewMode: 'free',
        amount: 0
      }, { status: 200 });
    }

    // If viewMode is 'one-time' or 'monthly', return payment requirements
    const amount = channelStream.amount || 0;
    
    return NextResponse.json({
      access: 'payment_required',
      viewMode: channelStream.viewMode,
      amount: amount,
      currency: 'USDC',
      recipient: creatorId,
      description: `Access to ${channelStream.title || 'creator profile'}`,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error checking creator access:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
