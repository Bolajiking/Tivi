import { useState, useEffect } from 'react';
import axios from 'axios';
import { getStreamByPlaybackId, addPayingUserToStream } from '@/lib/supabase-service';
import type { SupabaseStream } from '@/lib/supabase-types';

export interface Stream {
  playbackId: string;
  creatorId: string;
  viewMode: 'free' | 'one-time' | 'monthly';
  amount: number;
  Users?: string[]; // Array of wallet addresses (updated to match Supabase)
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

  // 2️⃣ Check if viewer's wallet address is in the Users array or if viewer is the creator
  // Note: This now relies on localStorage or external payment verification
  // Wallet address should be provided via props or context if needed
  useEffect(() => {
    if (!stream || stream.viewMode === 'free') {
      if (stream?.viewMode === 'free') {
        setHasAccess(true);
      }
      return;
    }

    // Check localStorage for payment record (for Ethereum-based payments)
    const paymentKey = `creator_access_${stream.creatorId}`;
    const paymentRecord = localStorage.getItem(paymentKey);
    
    if (paymentRecord) {
      try {
        const record = JSON.parse(paymentRecord);
        // Check if payment is still valid (for monthly, check expiration)
        if (stream.viewMode === 'one-time' || (stream.viewMode === 'monthly' && record.expiresAt > Date.now())) {
          setHasAccess(true);
        }
      } catch (e) {
        console.warn('Failed to parse payment record:', e);
      }
    }
  }, [stream]);

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
    if (stream?.Users?.some((addr) => addr.toLowerCase() === userAddress.toLowerCase())) {
      setHasAccess(true);
    }
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
