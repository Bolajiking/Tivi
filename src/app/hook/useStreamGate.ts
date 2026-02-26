import { useState, useEffect } from 'react';
import { getStreamByPlaybackId } from '@/lib/supabase-service';
import { useWalletAddress } from '@/app/hook/useWalletAddress';
import type { Subscription } from '@/lib/supabase-types';

export interface Stream {
  playbackId: string;
  creatorId: string;
  viewMode: 'free' | 'one-time' | 'monthly';
  amount: number;
  Users?: string[]; // Array of wallet addresses (updated to match Supabase)
  subscriptions?: Subscription[];
  description: string;
  streamName: string;
  logo: string;
  title: string;
  bgcolor: string;
  color: string;
  fontSize: string;
  fontFamily: string;
  donation: Array<number>;
}

export function useStreamGate(playbackId: string) {
  const { walletAddress } = useWalletAddress();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // 1️⃣ Fetch stream metadata from Supabase
  useEffect(() => {
    if (!playbackId) return;
    setLoading(true);
    setError(null);
    
    getStreamByPlaybackId(playbackId)
      .then((supabaseStream) => {
        if (supabaseStream) {
          // Convert Supabase stream to Stream interface
          const streamData: Stream = {
            playbackId: supabaseStream.playbackId,
            creatorId: supabaseStream.creatorId,
            viewMode: supabaseStream.viewMode,
            amount: supabaseStream.amount || 0,
            Users: supabaseStream.Users || [],
            subscriptions: supabaseStream.subscriptions || [],
            description: supabaseStream.description || '',
            streamName: supabaseStream.streamName,
            logo: supabaseStream.logo || '',
            title: supabaseStream.title || supabaseStream.streamName,
            bgcolor: supabaseStream.bgcolor || '',
            color: supabaseStream.color || '',
            fontSize: supabaseStream.fontSize?.toString() || '',
            fontFamily: supabaseStream.fontFamily || '',
            donation: supabaseStream.donations || [],
          };
          setStream(streamData);
          // auto‑open if free:
          if (streamData.viewMode === 'free') {
            setHasAccess(true);
          }
        } else {
          // Stream doesn't exist in Supabase yet - this is normal for newly created streams
          // Don't set an error, just leave stream as null
          setStream(null);
        }
      })
      .catch((err) => {
        // Only set error for actual failures, not for missing streams
        if (err.message && !err.message.includes('not found') && !err.message.includes('406')) {
          setError(err.message || 'Failed to fetch stream');
          console.error('Error fetching stream:', err);
        } else {
          // Stream not found - this is okay, might not be saved to Supabase yet
          setStream(null);
        }
      })
      .finally(() => setLoading(false));
  }, [playbackId]);

  const hasValidLocalPayment = (key: string, viewMode: Stream['viewMode']) => {
    const paymentRecord = localStorage.getItem(key);
    if (!paymentRecord) return false;

    try {
      const record = JSON.parse(paymentRecord);
      if (viewMode === 'one-time') {
        return true;
      }
      return Boolean(record?.expiresAt && Number(record.expiresAt) > Date.now());
    } catch {
      return false;
    }
  };

  const hasValidSubscription = (subscriptions: Subscription[] | undefined, viewerAddress: string, viewMode: Stream['viewMode']) => {
    if (!subscriptions || subscriptions.length === 0) return false;

    const viewer = viewerAddress.toLowerCase();
    return subscriptions.some((sub) => {
      const sameViewer =
        String(sub?.subscriberAddress || '').toLowerCase() === viewer;
      if (!sameViewer) return false;
      if (viewMode === 'one-time') return true;
      if (viewMode === 'monthly') {
        return Boolean(sub?.expiresAt && new Date(sub.expiresAt).getTime() > Date.now());
      }
      return true;
    });
  };

  // 2️⃣ Check if viewer already has access using creator ownership, Users array,
  // persisted local payment records, or subscriptions array.
  useEffect(() => {
    if (!stream || stream.viewMode === 'free') {
      if (stream?.viewMode === 'free') {
        setHasAccess(true);
      }
      return;
    }

    if (!walletAddress) {
      setHasAccess(false);
      return;
    }

    const viewer = walletAddress.toLowerCase();
    const isCreator = stream.creatorId.toLowerCase() === viewer;
    const isInUsers = Boolean(
      stream.Users?.some((addr) => String(addr).toLowerCase() === viewer),
    );
    const hasCreatorAccessRecord = hasValidLocalPayment(
      `creator_access_${stream.creatorId}`,
      stream.viewMode,
    );
    const hasStreamAccessRecord = hasValidLocalPayment(
      `stream_access_${stream.playbackId}`,
      stream.viewMode,
    );
    const hasSubscription = hasValidSubscription(
      stream.subscriptions,
      walletAddress,
      stream.viewMode,
    );

    setHasAccess(
      isCreator ||
        isInUsers ||
        hasCreatorAccessRecord ||
        hasStreamAccessRecord ||
        hasSubscription,
    );
  }, [stream, walletAddress]);

  // 3️⃣ Process payment - now handled externally via Ethereum/Privy
  // This function is kept for compatibility but should be handled by CreatorPaymentGate
  const processPayment = async (usdAmount: number, recipientAddress: string) => {
    if (!stream || stream.viewMode === 'free' || hasAccess) return;
    
    // Payment processing is now handled by CreatorPaymentGate component
    // which uses Privy for Ethereum transactions
    throw new Error('Payment processing should be handled by CreatorPaymentGate component');
  };

  // 4️⃣ Helper function to check if user has paid (for after payment confirmation)
  const markPaid = (userAddress: string) => {
    setHasAccess(true);
    setStream((prev) => {
      if (!prev) return prev;
      const existingUsers = prev.Users || [];
      const alreadyPresent = existingUsers.some(
        (addr) => addr.toLowerCase() === userAddress.toLowerCase(),
      );
      if (alreadyPresent) return prev;
      return {
        ...prev,
        Users: [...existingUsers, userAddress],
      };
    });
  };

  return { 
    stream, 
    loading, 
    error, 
    hasAccess, 
    setHasAccess, 
    markPaid, 
    processPayment, 
    processingPayment,
    walletReady: false, // No longer using Solana wallet adapter
  };
}

export function useGetStreamDetails(playbackId: string) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playbackId) return;
    setLoading(true);
    setError(null);

    getStreamByPlaybackId(playbackId)
      .then((supabaseStream) => {
        if (supabaseStream) {
          // Convert Supabase stream to Stream interface
          const streamData: Stream = {
            playbackId: supabaseStream.playbackId,
            creatorId: supabaseStream.creatorId,
            viewMode: supabaseStream.viewMode,
            amount: supabaseStream.amount || 0,
            Users: supabaseStream.Users || [],
            subscriptions: supabaseStream.subscriptions || [],
            description: supabaseStream.description || '',
            streamName: supabaseStream.streamName,
            logo: supabaseStream.logo || '',
            title: supabaseStream.title || supabaseStream.streamName,
            bgcolor: supabaseStream.bgcolor || '',
            color: supabaseStream.color || '',
            fontSize: supabaseStream.fontSize?.toString() || '',
            fontFamily: supabaseStream.fontFamily || '',
            donation: supabaseStream.donations || [],
          };
          setStream(streamData);
        } else {
          // Stream doesn't exist in Supabase yet - this is normal for newly created streams
          setStream(null);
        }
      })
      .catch((err) => {
        // Only set error for actual failures, not for missing streams
        if (err.message && !err.message.includes('not found') && !err.message.includes('406')) {
          setError(err.message || 'Failed to fetch stream');
          console.error('Error fetching stream:', err);
        } else {
          // Stream not found - this is okay, might not be saved to Supabase yet
          setStream(null);
        }
      })
      .finally(() => setLoading(false));
  }, [playbackId]);

  return { stream, loading, error };
}
