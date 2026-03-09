'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Bars } from 'react-loader-spinner';
import { ArrowLeft, Send, Sparkles, Shield, MessageCircleHeart, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  clearChannelChatHistory,
  getChatMessages,
  getChannelChatClearedAt,
  getStreamByPlaybackId,
  getUserProfile,
  getChannelChatEligibleAddresses,
  getChannelChatGroupMapping,
  hasActiveStreamSubscription,
  isUserSubscribedToCreator,
  persistChannelChatMessage,
  saveChannelChatGroupMapping,
  subscribeToChatMessages,
  subscribeToStreamStatus,
  uploadImage,
} from '@/lib/supabase-service';
import {
  createChannelConversation,
  getConversationById,
  getXmtpClient,
  isTransientXmtpSyncError,
  loadConversationMessages,
  resolveInboxIdMapForAddresses,
  resolveInboxWalletAddresses,
  type NormalizedChatMessage,
  sendConversationMessage,
  syncConversationMembers,
} from '@/lib/xmtp-chat';

interface ChannelChatExperienceProps {
  playbackId: string;
  creatorId: string;
  streamName: string;
  onBack: () => void;
  backLabel: string;
}

type ChatState = 'checking-access' | 'connecting' | 'ready' | 'blocked' | 'error';

const QUICK_REACTIONS = ['🔥', '👏', '😂', '💛'];
const CHAT_POLL_REFRESH_INTERVAL_MS = 6000;
const XMTP_HISTORY_SYNC_INTERVAL_MS = 4000;
const XMTP_HISTORY_SYNC_LIMIT = 300;
const XMTP_IMAGE_PREFIX = '__image__:';

const isLikelyAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);
const shortWallet = (value: string) =>
  value.length >= 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
const messageTimestampMs = (value: string) => new Date(value).getTime();
const messageIso = (value: string) => {
  const ts = messageTimestampMs(value);
  if (!Number.isFinite(ts)) return '1970-01-01T00:00:00.000Z';
  return new Date(ts).toISOString();
};
const messageSignature = (message: NormalizedChatMessage) =>
  `${message.senderInboxId}::${messageIso(message.sentAt)}::${message.content}`;
const hasAttachment = (message: NormalizedChatMessage) => Boolean(message.attachment);
const isNearDuplicateMessage = (
  left: NormalizedChatMessage,
  right: NormalizedChatMessage,
  windowMs: number = 2500,
) => {
  if (hasAttachment(left) || hasAttachment(right)) return false;
  if (left.content !== right.content) return false;
  const leftTs = messageTimestampMs(left.sentAt);
  const rightTs = messageTimestampMs(right.sentAt);
  if (!Number.isFinite(leftTs) || !Number.isFinite(rightTs)) return false;

  const senderMatches = left.senderInboxId === right.senderInboxId;
  const senderSourceDiffers = isLikelyAddress(left.senderInboxId) !== isLikelyAddress(right.senderInboxId);
  if (!senderMatches && !senderSourceDiffers) return false;

  return Math.abs(leftTs - rightTs) <= windowMs;
};

const extractImageUrlFromMessage = (message: NormalizedChatMessage): string | null => {
  if (message.attachment?.kind === 'image' && message.attachment?.dataUrl) {
    return message.attachment.dataUrl;
  }

  const content = String(message.content || '').trim();
  if (!content) return null;

  if (content.startsWith(XMTP_IMAGE_PREFIX)) {
    const candidate = content.slice(XMTP_IMAGE_PREFIX.length).trim();
    return candidate || null;
  }

  const urlMatch = content.match(/https?:\/\/\S+/i);
  const maybeUrl = urlMatch?.[0] || '';
  if (!maybeUrl) return null;
  const cleanUrl = maybeUrl.replace(/[)\]}.,]+$/, '');
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
};

const displayMessageContent = (message: NormalizedChatMessage): string => {
  const content = String(message.content || '').trim();
  if (!content) return '';
  if (content.startsWith(XMTP_IMAGE_PREFIX)) return '';
  return content;
};

const isTechnicalSenderLabel = (label: string, senderId: string): boolean => {
  const normalizedLabel = String(label || '').trim();
  const normalizedSender = String(senderId || '').trim();
  if (!normalizedLabel) return true;
  if (!normalizedSender) return false;
  if (normalizedLabel === normalizedSender) return true;
  if (normalizedLabel === shortWallet(normalizedSender)) return true;
  if (normalizedLabel.includes('...') && normalizedLabel.length <= 20) return true;
  return false;
};

const toDateLabel = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ChannelChatExperience({
  playbackId,
  creatorId,
  streamName,
  onBack,
  backLabel,
}: ChannelChatExperienceProps) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const [chatState, setChatState] = useState<ChatState>('checking-access');
  const [statusMessage, setStatusMessage] = useState('Preparing channel room...');
  const [messages, setMessages] = useState<NormalizedChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [senderLabels, setSenderLabels] = useState<Record<string, string>>({});

  const conversationRef = useRef<any>(null);
  const cleanupStreamRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const xmtpHistoryRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatRealtimeCleanupRef = useRef<(() => void) | null>(null);
  const selfInboxIdRef = useRef<string>('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const walletRef = useRef<any>(null);
  const xmtpClientRef = useRef<any>(null);
  const streamNameRef = useRef(streamName);
  const initializeConversationRef = useRef<(() => Promise<void>) | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const initKeyRef = useRef<string>('');
  const senderLabelsRef = useRef<Record<string, string>>({});
  const resolvingSendersRef = useRef<Set<string>>(new Set());
  const resolvingWalletLabelsRef = useRef<Set<string>>(new Set());
  const inboxToWalletRef = useRef<Record<string, string>>({});
  const clearedAtMsRef = useRef<number>(0);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const persistedSyncInFlightRef = useRef(false);
  const initGenerationRef = useRef(0);
  const componentMountedRef = useRef(true);
  const xmtpHistorySyncInFlightRef = useRef(false);

  const wallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return null;
    const preferred = wallets.find((candidate: any) => {
      const type = String(candidate?.walletClientType || candidate?.clientType || '').toLowerCase();
      return type.includes('privy') || type.includes('injected') || type.includes('walletconnect');
    });
    return preferred || wallets[0] || null;
  }, [wallets]);

  const walletAddress = String(wallet?.address || '').toLowerCase();
  const [resolvedCreatorId, setResolvedCreatorId] = useState(() =>
    String(creatorId || '').trim().toLowerCase(),
  );
  const channelCreatorId = useMemo(
    () => String(resolvedCreatorId || creatorId || '').trim().toLowerCase(),
    [creatorId, resolvedCreatorId],
  );
  const isChannelAdmin = Boolean(walletAddress && channelCreatorId && walletAddress === channelCreatorId);

  useEffect(() => {
    let cancelled = false;

    const resolveChannelCreator = async () => {
      if (!playbackId) return;
      try {
        const stream = await getStreamByPlaybackId(playbackId);
        if (cancelled) return;
        const streamCreator = String(stream?.creatorId || '').trim().toLowerCase();
        if (streamCreator) {
          setResolvedCreatorId(streamCreator);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to resolve channel creator for chat admin role:', error);
        }
      }
    };

    void resolveChannelCreator();
    return () => {
      cancelled = true;
    };
  }, [playbackId]);

  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  useEffect(() => {
    streamNameRef.current = streamName || streamNameRef.current;
  }, [streamName]);

  useEffect(() => {
    senderLabelsRef.current = senderLabels;
  }, [senderLabels]);

  const resolveDisplayNameForWallet = useCallback(async (walletCandidate: string): Promise<string> => {
    const wallet = String(walletCandidate || '').trim().toLowerCase();
    if (!isLikelyAddress(wallet)) return shortWallet(walletCandidate);

    const cached = String(senderLabelsRef.current[wallet] || '').trim();
    if (cached) return cached;
    if (resolvingWalletLabelsRef.current.has(wallet)) {
      return shortWallet(wallet);
    }

    resolvingWalletLabelsRef.current.add(wallet);
    try {
      const profile = await getUserProfile(wallet);
      const resolved = String(profile?.displayName || '').trim() || shortWallet(wallet);
      setSenderLabels((previous) => ({ ...previous, [wallet]: resolved }));
      return resolved;
    } catch {
      const fallback = shortWallet(wallet);
      setSenderLabels((previous) => ({ ...previous, [wallet]: fallback }));
      return fallback;
    } finally {
      resolvingWalletLabelsRef.current.delete(wallet);
    }
  }, []);

  useEffect(() => {
    if (!walletAddress || !isLikelyAddress(walletAddress)) return;
    if (senderLabelsRef.current[walletAddress]) return;
    void resolveDisplayNameForWallet(walletAddress);
  }, [resolveDisplayNameForWallet, walletAddress]);

  const isMessageAfterClearCutoff = useCallback((message: NormalizedChatMessage) => {
    const cutoff = clearedAtMsRef.current;
    if (!Number.isFinite(cutoff) || cutoff <= 0) return true;
    const sentAtMs = messageTimestampMs(message.sentAt);
    if (!Number.isFinite(sentAtMs)) return true;
    return sentAtMs > cutoff;
  }, []);

  const mergeMessages = useCallback((base: NormalizedChatMessage[], incoming: NormalizedChatMessage[]) => {
    const merged: NormalizedChatMessage[] = [];
    const idToIndex = new Map<string, number>();
    const signatureToIndex = new Map<string, number>();

    const combined = [...base, ...incoming]
      .filter((message) => message?.content?.trim())
      .filter((message) => isMessageAfterClearCutoff(message))
      .sort((a, b) => messageTimestampMs(a.sentAt) - messageTimestampMs(b.sentAt));

    for (const message of combined) {
      const normalizedId = String(message.id || '').trim();
      const signature = messageSignature(message);

      const maybeReplaceAt = (index: number) => {
        const existing = merged[index];
        if (!existing) return false;
        if (hasAttachment(message) && !hasAttachment(existing)) {
          merged[index] = message;
          return true;
        }
        return false;
      };

      if (normalizedId && idToIndex.has(normalizedId)) {
        maybeReplaceAt(idToIndex.get(normalizedId)!);
        continue;
      }

      if (signatureToIndex.has(signature)) {
        maybeReplaceAt(signatureToIndex.get(signature)!);
        continue;
      }

      const nearDuplicateIndex = merged.findIndex((existing) => isNearDuplicateMessage(existing, message));
      if (nearDuplicateIndex >= 0) {
        maybeReplaceAt(nearDuplicateIndex);
        continue;
      }

      const nextIndex = merged.push(message) - 1;
      if (normalizedId) idToIndex.set(normalizedId, nextIndex);
      signatureToIndex.set(signature, nextIndex);
    }

    return merged;
  }, [isMessageAfterClearCutoff]);

  const appendMessage = useCallback((incoming: NormalizedChatMessage) => {
    if (!incoming?.content?.trim()) return;
    if (!isMessageAfterClearCutoff(incoming)) return;
    setMessages((previous) => mergeMessages(previous, [incoming]));
  }, [isMessageAfterClearCutoff, mergeMessages]);

  const teardownStream = useCallback(() => {
    if (cleanupStreamRef.current) {
      cleanupStreamRef.current();
      cleanupStreamRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (accessSyncTimerRef.current) {
      clearTimeout(accessSyncTimerRef.current);
      accessSyncTimerRef.current = null;
    }
    if (chatRefreshTimerRef.current) {
      clearInterval(chatRefreshTimerRef.current);
      chatRefreshTimerRef.current = null;
    }
    if (xmtpHistoryRefreshTimerRef.current) {
      clearInterval(xmtpHistoryRefreshTimerRef.current);
      xmtpHistoryRefreshTimerRef.current = null;
    }
    if (chatRealtimeCleanupRef.current) {
      chatRealtimeCleanupRef.current();
      chatRealtimeCleanupRef.current = null;
    }
  }, []);

  const syncPersistedMessages = useCallback(async () => {
    if (!playbackId) return;
    if (persistedSyncInFlightRef.current) return;

    persistedSyncInFlightRef.current = true;
    try {
      const persistedRows = await getChatMessages(playbackId);
      const persistedMessages: NormalizedChatMessage[] = (persistedRows || [])
        .map((row) => ({
          id: String(row.id || `${row.stream_id}-${row.timestamp}-${Math.random()}`),
          sentAt: String(row.timestamp || row.created_at || new Date().toISOString()),
          senderInboxId: String(row.wallet_address || ''),
          content: String(row.message || ''),
        }))
        .filter((message) => message.content.trim().length > 0)
        .filter((message) => isMessageAfterClearCutoff(message));

      const labelsFromPersisted: Record<string, string> = {};
      for (const row of persistedRows || []) {
        const senderIdentifier = String(row.wallet_address || '').trim();
        const senderLabel = String(row.sender || '').trim();
        if (senderIdentifier && senderLabel && !isTechnicalSenderLabel(senderLabel, senderIdentifier)) {
          labelsFromPersisted[senderIdentifier] = senderLabel;
        }
      }
      if (Object.keys(labelsFromPersisted).length > 0) {
        setSenderLabels((previous) => ({ ...previous, ...labelsFromPersisted }));
      }

      setMessages((previous) => mergeMessages(previous, persistedMessages));
    } catch (error) {
      console.error('Failed to load persisted channel chat history:', error);
    } finally {
      persistedSyncInFlightRef.current = false;
    }
  }, [isMessageAfterClearCutoff, mergeMessages, playbackId]);

  const refreshKnownMemberSenderMappings = useCallback(async () => {
    const client = xmtpClientRef.current;
    if (!client || !playbackId || !channelCreatorId) return;

    const eligibleAddresses = await getChannelChatEligibleAddresses(playbackId, channelCreatorId);
    if (!eligibleAddresses.length) return;

    const inboxToWallet = await resolveInboxIdMapForAddresses(client, eligibleAddresses);
    if (!Object.keys(inboxToWallet).length) return;

    inboxToWalletRef.current = { ...inboxToWalletRef.current, ...inboxToWallet };

    const updates: Record<string, string> = {};
    await Promise.all(
      Object.entries(inboxToWallet).map(async ([inboxId, wallet]) => {
        const label = await resolveDisplayNameForWallet(wallet);
        updates[inboxId] = label;
        updates[wallet] = label;
      }),
    );

    if (Object.keys(updates).length > 0) {
      setSenderLabels((previous) => ({ ...previous, ...updates }));
    }
  }, [channelCreatorId, playbackId, resolveDisplayNameForWallet]);

  const syncXmtpMessages = useCallback(async () => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    if (xmtpHistorySyncInFlightRef.current) return;

    xmtpHistorySyncInFlightRef.current = true;
    try {
      const xmtpHistory = await loadConversationMessages(conversation, XMTP_HISTORY_SYNC_LIMIT);
      if (!Array.isArray(xmtpHistory) || xmtpHistory.length === 0) return;
      const filtered = xmtpHistory.filter((message) => isMessageAfterClearCutoff(message));
      if (!filtered.length) return;
      setMessages((previous) => mergeMessages(previous, filtered));
    } catch (error) {
      // Best effort fallback when Supabase persistence is unavailable or delayed.
      console.error('Failed to sync XMTP history:', error);
    } finally {
      xmtpHistorySyncInFlightRef.current = false;
    }
  }, [isMessageAfterClearCutoff, mergeMessages]);

  const scheduleAccessSyncRetry = useCallback(() => {
    if (accessSyncTimerRef.current) return;

    accessSyncTimerRef.current = setTimeout(() => {
      accessSyncTimerRef.current = null;
      initializeConversationRef.current?.().catch((error: any) => {
        console.error('Automatic chat access sync retry failed:', error);
      });
    }, 5000);
  }, []);

  const syncSubscriberMemberships = useCallback(
    async (creatorWalletAddress: string, streamPlaybackId: string) => {
      if (!xmtpClientRef.current || !conversationRef.current) return;
      const allMembers = await getChannelChatEligibleAddresses(streamPlaybackId, creatorWalletAddress);
      await syncConversationMembers(xmtpClientRef.current, conversationRef.current, allMembers);
    },
    [],
  );

  const initializeConversation = useCallback(async () => {
    const initKey = `${playbackId}:${walletAddress}:${authenticated ? '1' : '0'}:${ready ? '1' : '0'}:${isChannelAdmin ? '1' : '0'}`;
    if (initPromiseRef.current && initKeyRef.current === initKey) {
      return initPromiseRef.current;
    }

    const run = (async () => {
      const currentGeneration = ++initGenerationRef.current;
      const isStaleRun = () =>
        !componentMountedRef.current || initGenerationRef.current !== currentGeneration;

      teardownStream();

      if (!playbackId || !isLikelyAddress(channelCreatorId)) {
        setChatState('error');
        setStatusMessage('Channel chat is unavailable because the channel identity is invalid.');
        return;
      }

      const walletForInit = walletRef.current;
      if (!ready || !authenticated || !walletForInit || !isLikelyAddress(walletAddress)) {
        setChatState('blocked');
        setStatusMessage('Connect your wallet to enter this channel chat.');
        return;
      }

      setChatState('checking-access');
      setStatusMessage('Checking channel access...');

      if (!isChannelAdmin) {
        const [isFollowerSubscribed, hasPaidSubscription] = await Promise.all([
          isUserSubscribedToCreator(walletAddress, channelCreatorId),
          hasActiveStreamSubscription(playbackId, walletAddress),
        ]);
        const hasSubscription = isFollowerSubscribed || hasPaidSubscription;

        if (!hasSubscription) {
          setChatState('blocked');
          setStatusMessage('Subscribe to this channel to unlock the group chat.');
          return;
        }
      }

      setChatState('connecting');
      setStatusMessage('Connecting to XMTP room...');

      setStatusMessage('Finding channel room...');
      const mapping = await getChannelChatGroupMapping(playbackId);
      if (!isChannelAdmin && !mapping?.xmtpGroupId) {
        setChatState('connecting');
        setStatusMessage('Chat is provisioning. Waiting for room setup...');
        scheduleAccessSyncRetry();
        return;
      }

      setStatusMessage('Authorizing XMTP wallet session...');
      const { client } = await getXmtpClient(walletForInit);
      if (isStaleRun()) return;
      xmtpClientRef.current = client;
      selfInboxIdRef.current = String(client?.inboxId || '');
      if (walletAddress) {
        inboxToWalletRef.current[selfInboxIdRef.current] = walletAddress;
      }

      let conversation =
        mapping?.xmtpGroupId
          ? await getConversationById(client, mapping.xmtpGroupId)
          : null;
      if (isStaleRun()) return;

      if (!conversation && !isChannelAdmin) {
        setStatusMessage('Finalizing your chat access...');
        for (let attempt = 0; attempt < 10 && !conversation; attempt += 1) {
          try {
            await client?.conversations?.syncAll?.();
          } catch {
            // no-op
          }
          await sleep(1000);
          conversation = await getConversationById(client, mapping?.xmtpGroupId || '');
          if (isStaleRun()) return;
        }
      }

      if (!conversation && !isChannelAdmin) {
        setChatState('connecting');
        setStatusMessage('Syncing your chat access automatically...');
        scheduleAccessSyncRetry();
        return;
      }

      if (!conversation && isChannelAdmin) {
        setStatusMessage('Creating your channel group chat...');
        const created = await createChannelConversation(client, streamNameRef.current || 'Channel', playbackId);
        if (isStaleRun()) return;
        conversation = created.conversation;
        await saveChannelChatGroupMapping({
          playbackId,
          creatorId: channelCreatorId,
          xmtpGroupId: created.conversationId,
        }, walletAddress);
        if (isStaleRun()) return;
      }

      if (!conversation) {
        setChatState('error');
        setStatusMessage('Unable to initialize chat conversation.');
        return;
      }

      conversationRef.current = conversation;

      const clearedAtIso = await getChannelChatClearedAt(playbackId).catch(() => null);
      const clearedAtMs = clearedAtIso ? messageTimestampMs(clearedAtIso) : 0;
      clearedAtMsRef.current = Number.isFinite(clearedAtMs) ? clearedAtMs : 0;
      if (isStaleRun()) return;

      await syncPersistedMessages();
      if (isStaleRun()) return;

      await syncXmtpMessages();
      if (isStaleRun()) return;

      try {
        await refreshKnownMemberSenderMappings();
      } catch (error) {
        console.error('Failed to pre-resolve channel sender mappings:', error);
      }
      if (isStaleRun()) return;

      if (isChannelAdmin) {
        setStatusMessage('Syncing subscribers into the room...');
        try {
          await syncSubscriberMemberships(channelCreatorId, playbackId);
        } catch (error) {
          console.error('Failed to sync XMTP chat members:', error);
        }
        if (isStaleRun()) return;
      }

      if (chatRefreshTimerRef.current) {
        clearInterval(chatRefreshTimerRef.current);
      }
      chatRefreshTimerRef.current = setInterval(() => {
        void syncPersistedMessages();
      }, CHAT_POLL_REFRESH_INTERVAL_MS);

      if (xmtpHistoryRefreshTimerRef.current) {
        clearInterval(xmtpHistoryRefreshTimerRef.current);
      }
      xmtpHistoryRefreshTimerRef.current = setInterval(() => {
        void syncXmtpMessages();
      }, XMTP_HISTORY_SYNC_INTERVAL_MS);

      if (chatRealtimeCleanupRef.current) {
        chatRealtimeCleanupRef.current();
      }
      chatRealtimeCleanupRef.current = subscribeToChatMessages(playbackId, (row) => {
        const incoming: NormalizedChatMessage = {
          id: String(row.id || `${row.stream_id}-${row.timestamp}-${Math.random()}`),
          sentAt: String(row.timestamp || row.created_at || new Date().toISOString()),
          senderInboxId: String(row.wallet_address || ''),
          content: String(row.message || ''),
        };
        if (!isMessageAfterClearCutoff(incoming)) return;
        const rowSender = String(row.wallet_address || '').trim();
        const rowLabel = String(row.sender || '').trim();
        if (rowSender && rowLabel && !isTechnicalSenderLabel(rowLabel, rowSender)) {
          setSenderLabels((previous) => {
            if (previous[rowSender] === rowLabel) return previous;
            return { ...previous, [rowSender]: rowLabel };
          });
        } else if (rowSender && isLikelyAddress(rowSender)) {
          void resolveDisplayNameForWallet(rowSender);
        }
        appendMessage(incoming);
      });

      setChatState('ready');
      setStatusMessage('Room connected');
      if (accessSyncTimerRef.current) {
        clearTimeout(accessSyncTimerRef.current);
        accessSyncTimerRef.current = null;
      }
    })();

    initPromiseRef.current = run;
    initKeyRef.current = initKey;

    try {
      await run;
    } finally {
      if (initPromiseRef.current === run) {
        initPromiseRef.current = null;
      }
    }
  }, [
    appendMessage,
    authenticated,
    channelCreatorId,
    isChannelAdmin,
    playbackId,
    ready,
    scheduleAccessSyncRetry,
    resolveDisplayNameForWallet,
    syncPersistedMessages,
    syncSubscriberMemberships,
    syncXmtpMessages,
    teardownStream,
    walletAddress,
    isMessageAfterClearCutoff,
    refreshKnownMemberSenderMappings,
  ]);

  useEffect(() => {
    initializeConversationRef.current = initializeConversation;
  }, [initializeConversation]);

  useEffect(() => {
    componentMountedRef.current = true;

    initializeConversation().catch((error: any) => {
      console.error('Failed to initialize channel chat:', error);
      if (isTransientXmtpSyncError(error)) {
        setChatState('connecting');
        setStatusMessage('Chat sync is catching up. Retrying automatically...');
        scheduleAccessSyncRetry();
        return;
      }
      setChatState('error');
      setStatusMessage(error?.message || 'Unable to connect chat right now.');
    });

    return () => {
      componentMountedRef.current = false;
      initGenerationRef.current += 1;
      teardownStream();
      conversationRef.current = null;
      xmtpClientRef.current = null;
      initPromiseRef.current = null;
    };
  }, [initializeConversation, scheduleAccessSyncRetry, teardownStream]);

  useEffect(() => {
    if (!isChannelAdmin || chatState !== 'ready' || !channelCreatorId) return;

    const intervalId = setInterval(() => {
      syncSubscriberMemberships(channelCreatorId, playbackId).catch((error) => {
        console.error('Background subscriber membership sync failed:', error);
      });
    }, 10000);

    return () => clearInterval(intervalId);
  }, [chatState, channelCreatorId, isChannelAdmin, playbackId, syncSubscriberMemberships]);

  useEffect(() => {
    if (!playbackId) return;

    const unsubscribe = subscribeToStreamStatus(playbackId, () => {
      getChannelChatClearedAt(playbackId)
        .then((clearedAtIso) => {
          if (!clearedAtIso) return;
          const nextClearedAtMs = messageTimestampMs(clearedAtIso);
          if (!Number.isFinite(nextClearedAtMs)) return;
          if (nextClearedAtMs <= clearedAtMsRef.current) return;

          clearedAtMsRef.current = nextClearedAtMs;
          setMessages([]);
          if (chatState === 'ready') {
            toast.info('Channel chat history was cleared by the creator.');
          }
        })
        .catch(() => {
          // best effort sync for clear marker updates
        });
    });

    return () => {
      unsubscribe();
    };
  }, [chatState, playbackId]);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const resolveSenderLabels = useCallback(
    async (senderIds: string[]) => {
      const unknownSenderIds = Array.from(
        new Set(
          senderIds
            .map((senderId) => String(senderId || '').trim())
            .filter(
              (senderId) =>
                senderId &&
                !senderLabelsRef.current[senderId] &&
                !resolvingSendersRef.current.has(senderId),
            ),
        ),
      );

      if (unknownSenderIds.length === 0) return;
      unknownSenderIds.forEach((senderId) => resolvingSendersRef.current.add(senderId));

      try {
        const updates: Record<string, string> = {};
        const addressSenders = unknownSenderIds.filter((senderId) => isLikelyAddress(senderId));
        const inboxSenders = unknownSenderIds.filter((senderId) => !isLikelyAddress(senderId));

        await Promise.all(
          addressSenders.map(async (senderAddress) => {
            updates[senderAddress] = await resolveDisplayNameForWallet(senderAddress);
          }),
        );

        if (inboxSenders.length > 0 && xmtpClientRef.current) {
          try {
            const inboxWalletMap = await resolveInboxWalletAddresses(xmtpClientRef.current, inboxSenders);
            Object.assign(inboxToWalletRef.current, inboxWalletMap);
            await Promise.all(
              inboxSenders.map(async (inboxId) => {
                const mappedWallet = String(
                  inboxWalletMap[inboxId] || inboxToWalletRef.current[inboxId] || '',
                ).toLowerCase();
                if (isLikelyAddress(mappedWallet)) {
                  const mappedLabel = await resolveDisplayNameForWallet(mappedWallet);
                  updates[inboxId] = mappedLabel;
                  updates[mappedWallet] = mappedLabel;
                  return;
                }
                updates[inboxId] = `${inboxId.slice(0, 8)}...`;
              }),
            );
          } catch {
            try {
              await refreshKnownMemberSenderMappings();
            } catch {
              // no-op
            }
            inboxSenders.forEach((inboxId) => {
              const mappedWallet = String(inboxToWalletRef.current[inboxId] || '').toLowerCase();
              if (isLikelyAddress(mappedWallet)) {
                updates[inboxId] =
                  String(senderLabelsRef.current[mappedWallet] || senderLabelsRef.current[inboxId] || '').trim() ||
                  shortWallet(mappedWallet);
                return;
              }
              updates[inboxId] = `${inboxId.slice(0, 8)}...`;
            });
          }
        } else {
          inboxSenders.forEach((inboxId) => {
            updates[inboxId] = `${inboxId.slice(0, 8)}...`;
          });
        }

        if (Object.keys(updates).length > 0) {
          setSenderLabels((previous) => ({ ...previous, ...updates }));
        }
      } finally {
        unknownSenderIds.forEach((senderId) => resolvingSendersRef.current.delete(senderId));
      }
    },
    [refreshKnownMemberSenderMappings, resolveDisplayNameForWallet],
  );

  useEffect(() => {
    if (messages.length === 0) return;
    resolveSenderLabels(messages.map((message) => message.senderInboxId)).catch(() => {
      // Label resolution is best effort.
    });
  }, [messages, resolveSenderLabels]);

  const handleSend = useCallback(async () => {
    const value = inputValue.trim();
    if (!value || !conversationRef.current || sending) return;

    setSending(true);
    try {
      const sent = await sendConversationMessage(conversationRef.current, value);
      const sentMessage: NormalizedChatMessage = {
        id: String(sent?.id || `${Date.now()}-${Math.random()}`),
        sentAt: String(sent?.sentAt || new Date().toISOString()),
        senderInboxId: walletAddress || selfInboxIdRef.current || 'self',
        content: value,
      };
      appendMessage(sentMessage);
      const senderLabel = isLikelyAddress(sentMessage.senderInboxId)
        ? await resolveDisplayNameForWallet(sentMessage.senderInboxId)
        : String(senderLabelsRef.current[sentMessage.senderInboxId] || shortWallet(sentMessage.senderInboxId));
      await persistChannelChatMessage({
        streamId: playbackId,
        sender: senderLabel,
        senderIdentifier: sentMessage.senderInboxId,
        message: sentMessage.content,
        timestamp: sentMessage.sentAt,
      });
      setInputValue('');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [appendMessage, inputValue, playbackId, resolveDisplayNameForWallet, sending, walletAddress]);

  const handleImageSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !conversationRef.current || sending) return;
    if (!String(file.type || '').startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be 10MB or smaller.');
      return;
    }

    setSending(true);
    try {
      const imageUrl = await uploadImage(file, 'images');
      if (!imageUrl) {
        throw new Error('Failed to upload image.');
      }
      const content = `${XMTP_IMAGE_PREFIX}${imageUrl}`;
      const sent = await sendConversationMessage(conversationRef.current, content);
      const sentMessage: NormalizedChatMessage = {
        id: String(sent?.id || `${Date.now()}-${Math.random()}`),
        sentAt: String(sent?.sentAt || new Date().toISOString()),
        senderInboxId: walletAddress || selfInboxIdRef.current || 'self',
        content,
      };
      appendMessage(sentMessage);
      const senderLabel = isLikelyAddress(sentMessage.senderInboxId)
        ? await resolveDisplayNameForWallet(sentMessage.senderInboxId)
        : String(senderLabelsRef.current[sentMessage.senderInboxId] || shortWallet(sentMessage.senderInboxId));
      await persistChannelChatMessage({
        streamId: playbackId,
        sender: senderLabel,
        senderIdentifier: sentMessage.senderInboxId,
        message: sentMessage.content,
        timestamp: sentMessage.sentAt,
      });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send image');
    } finally {
      setSending(false);
    }
  }, [appendMessage, playbackId, resolveDisplayNameForWallet, sending, walletAddress]);

  const openImagePicker = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleReaction = useCallback(
    (reaction: string) => {
      setInputValue((previous) => `${previous}${reaction}`);
    },
    [],
  );

  const handleClearHistory = useCallback(async () => {
    if (!isChannelAdmin || clearingHistory) return;

    const confirmed = window.confirm(
      'Clear channel chat history for everyone? This hides all previous messages and cannot be undone.',
    );
    if (!confirmed) return;

    setClearingHistory(true);
    try {
      const clearedAt = await clearChannelChatHistory(playbackId, walletAddress);
      const clearedAtMs = messageTimestampMs(clearedAt);
      clearedAtMsRef.current = Number.isFinite(clearedAtMs) ? clearedAtMs : Date.now();
      setMessages([]);
      toast.success('Chat history cleared.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to clear chat history');
    } finally {
      setClearingHistory(false);
    }
  }, [clearingHistory, isChannelAdmin, playbackId, walletAddress]);

  const isReady = chatState === 'ready';

  return (
    <section className="relative -mt-px min-h-[calc(100dvh-248px)] overflow-hidden rounded-none border border-white/[0.07] border-t-0 bg-[#080808] md:min-h-[calc(100dvh-260px)] md:rounded-b-[22px] md:rounded-t-none">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#080808_0%,#0b0b0d_55%,#080808_100%)]" />
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.07),transparent_36%),radial-gradient(circle_at_84%_92%,rgba(255,255,255,0.05),transparent_30%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:26px_26px]" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100dvh-260px)] flex-col">
        <header className="border-b border-white/[0.07] bg-[#0f0f0f]/90 px-2.5 py-2 backdrop-blur-xl sm:px-5 sm:py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <button
                onClick={onBack}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white transition-colors hover:bg-black/65 sm:h-9 sm:w-9"
                aria-label={backLabel}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                    isReady
                      ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-200'
                      : 'border-yellow-200/35 bg-yellow-400/12 text-yellow-100'
                  }`}
                  title={statusMessage}
                  aria-label={statusMessage}
                >
                  <span className={`h-2 w-2 rounded-full ${isReady ? 'bg-emerald-300' : 'animate-pulse bg-yellow-300'}`} />
                </span>
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/[0.03] text-gray-100"
                  title="Realtime chat"
                  aria-label="Realtime chat"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/[0.03] text-gray-100"
                  title={isChannelAdmin ? 'Creator admin' : 'Subscriber access'}
                  aria-label={isChannelAdmin ? 'Creator admin' : 'Subscriber access'}
                >
                  <Shield className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {isChannelAdmin ? (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={!isReady || clearingHistory}
                  className="inline-flex items-center gap-1 rounded-full border border-red-300/35 bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-100 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:px-2.5 sm:py-1 sm:text-[11px]"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{clearingHistory ? 'Clearing' : 'Clear'}</span>
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 pb-4 pt-2 sm:px-5 sm:pb-6 sm:pt-4">
          {isReady && messages.length === 0 ? (
            <div className="mx-auto mt-14 max-w-sm rounded-3xl border border-white/[0.1] bg-[#0f0f0f]/95 p-6 text-center shadow-[0_18px_50px_rgba(0,0,0,0.4)] backdrop-blur-sm">
              <MessageCircleHeart className="mx-auto mb-3 h-7 w-7 text-[#facc15]" />
              <p className="text-sm font-medium text-white">Room is live. Drop the first message.</p>
            </div>
          ) : null}

          {!isReady && chatState !== 'blocked' && chatState !== 'error' ? (
            <div className="mt-14 flex justify-center">
              <div className="rounded-2xl border border-white/[0.1] bg-[#0f0f0f]/95 px-5 py-4 shadow-[0_16px_45px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                <div className="flex items-center gap-3 text-sm font-medium text-white">
                  <Bars width={18} height={18} color="#facc15" />
                  <span>{statusMessage}</span>
                </div>
              </div>
            </div>
          ) : null}

          {chatState === 'blocked' ? (
            <div className="mx-auto mt-14 max-w-md rounded-3xl border border-white/[0.1] bg-[#0f0f0f]/95 p-6 text-center shadow-[0_16px_45px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="text-base font-semibold text-white">Chat access locked</p>
              <p className="mt-2 text-sm text-gray-300">{statusMessage}</p>
              {!authenticated ? (
                <button
                  onClick={login}
                  className="mt-4 rounded-full bg-gradient-to-r from-yellow-400 to-teal-500 px-4 py-2 text-sm font-semibold text-black"
                >
                  Connect wallet
                </button>
              ) : null}
            </div>
          ) : null}

          {chatState === 'error' ? (
            <div className="mx-auto mt-14 max-w-md rounded-3xl border border-white/[0.1] bg-[#0f0f0f]/95 p-6 text-center shadow-[0_16px_45px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="text-base font-semibold text-white">Chat unavailable</p>
              <p className="mt-2 text-sm text-gray-300">{statusMessage}</p>
              <button
                onClick={() => initializeConversation()}
                className="mt-4 rounded-full border border-white/[0.14] bg-[#1a1a1a] px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </div>
          ) : null}

          {isReady ? (
            <div className="space-y-2.5 pb-2 sm:space-y-3 sm:pb-3">
              {messages.map((message) => {
                const normalizedSender = String(message.senderInboxId || '').toLowerCase();
                const isSelfByWallet = Boolean(walletAddress && normalizedSender === walletAddress);
                const isSelfByInbox =
                  Boolean(selfInboxIdRef.current) &&
                  normalizedSender === String(selfInboxIdRef.current).toLowerCase();
                const isSelf = isSelfByWallet || isSelfByInbox;
                const senderLabel = isSelf
                  ? 'You'
                  : senderLabels[message.senderInboxId] || `${message.senderInboxId.slice(0, 8)}...`;
                const senderInitial = senderLabel.slice(0, 1).toUpperCase();
                const imageUrl = extractImageUrlFromMessage(message);
                const displayText = displayMessageContent(message);

                return (
                  <article
                    key={message.id}
                    className={`group flex max-w-[98%] items-end gap-2 sm:max-w-[96%] sm:gap-2.5 ${isSelf ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold sm:h-9 sm:w-9 sm:text-xs ${
                        isSelf
                          ? 'bg-gradient-to-br from-yellow-300 to-teal-300 text-gray-900'
                          : 'bg-[#141414] text-white ring-1 ring-white/[0.15]'
                      }`}
                    >
                      {isSelf ? 'You' : senderInitial || '•'}
                    </div>
                    <div
                      className={`rounded-[20px] px-2.5 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.26)] backdrop-blur-sm sm:rounded-[22px] sm:px-3 sm:py-2.5 ${
                        isSelf
                          ? 'border border-yellow-300/35 bg-gradient-to-br from-yellow-400/18 to-teal-400/16 text-white'
                          : 'border border-white/[0.12] bg-[#121316] text-white'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] leading-none">
                        <span className="font-semibold leading-none text-white/95">{senderLabel}</span>
                        <span className="text-gray-400">{toDateLabel(message.sentAt)}</span>
                      </div>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="Shared image"
                          className="mb-2 max-h-[360px] w-full rounded-2xl border border-white/[0.1] object-contain"
                          loading="lazy"
                        />
                      ) : null}
                      {displayText ? <p className="break-words text-[14px] leading-[1.45]">{displayText}</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-white/[0.07] bg-[#0f0f0f]/96 px-2 pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-1.5 backdrop-blur-xl sm:px-5 sm:pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:pt-2">
          <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:mb-2 sm:pb-1">
            {QUICK_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => handleReaction(reaction)}
                disabled={!isReady}
                className="inline-flex h-6.5 min-w-6.5 items-center justify-center rounded-full border border-white/[0.12] bg-[#171717] px-2 text-[13px] text-white transition-colors hover:bg-[#202020] disabled:cursor-not-allowed disabled:opacity-50 sm:h-7 sm:min-w-7 sm:text-sm"
              >
                {reaction}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.1] bg-[#0f0f0f] p-1.5 shadow-[0_18px_36px_rgba(0,0,0,0.36)] sm:p-2">
            <div className="flex items-end gap-1.5 sm:gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={openImagePicker}
                disabled={!isReady || sending}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-[#161616] text-white transition-colors hover:bg-[#202020] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
                aria-label="Send image"
                title="Send image"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!isReady || sending}
                rows={1}
                placeholder={isReady ? `Message ${streamName || 'channel'}...` : 'Chat is unavailable right now'}
                className="max-h-28 min-h-[36px] flex-1 resize-none rounded-xl border border-white/[0.1] bg-[#161616] px-2.5 py-1.5 text-[14px] leading-[1.35] text-white placeholder:text-white/45 focus:border-[#facc15]/50 focus:outline-none sm:min-h-[40px] sm:px-3 sm:py-2"
              />
              <button
                onClick={handleSend}
                disabled={!isReady || sending || !inputValue.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-yellow-400 to-teal-500 text-black transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
                aria-label="Send message"
              >
                {sending ? <Bars width={14} height={14} color="#0b0b0b" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}
