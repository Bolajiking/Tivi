import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
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
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

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
  useEffect(() => {
    if (!stream || !publicKey || stream.viewMode === 'free') return;

    const walletAddress = publicKey.toBase58();
    
    // Check if viewer is the creator (owner of the stream)
    const isCreator = stream.creatorId?.toLowerCase() === walletAddress.toLowerCase();
    
    // Check if viewer has paid (is in Users array)
    const hasPaid = stream.Users?.some((userAddress) => 
      userAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    // Grant access if viewer is the creator or has paid
    if (isCreator || hasPaid) {
      setHasAccess(true);
    }
  }, [stream, publicKey]);

  // 3️⃣ Process payment when wallet is connected and stream is paid
  const processPayment = async (solAmount: number, recipientAddress: string) => {
    if (!stream || stream.viewMode === 'free' || hasAccess) return;
    if (!connected || !publicKey || !sendTransaction) {
      throw new Error('Wallet not connected or transaction not supported');
    }

    // Validate recipient address
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(recipientAddress);
    } catch (err) {
      throw new Error('Invalid recipient wallet address');
    }

    setProcessingPayment(true);
    try {
      console.log('Trying to send transaction', { solAmount, recipientAddress, playbackId });

      // Convert SOL to lamports, ensuring it's an integer
      // Use Math.floor to avoid decimal values that cause BigInt conversion errors
      const lamports = Math.floor(solAmount * 1e9);
      
      if (lamports <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }

      // Create and send transaction (simplified like Player.tsx)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction sent successfully, signature:', signature);

      // Add paying user to Supabase (non-blocking)
      const walletAddress = publicKey.toBase58();
      try {
        await addPayingUserToStream(playbackId, walletAddress);
        // Update local stream state
        if (stream) {
          setStream({
            ...stream,
            Users: [...(stream.Users || []), walletAddress],
          });
        }
      } catch (supabaseError: any) {
        console.error('Failed to add paying user to Supabase:', supabaseError);
        // Don't fail the payment if Supabase call fails
      }

      // Grant access
      setHasAccess(true);
      markPaid(walletAddress);

      return { success: true, signature };
    } catch (err: any) {
      console.error('Payment processing failed:', err);
      throw new Error(err?.message || 'Payment failed');
    } finally {
      setProcessingPayment(false);
    }
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
    walletReady: connected && !!publicKey,
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
