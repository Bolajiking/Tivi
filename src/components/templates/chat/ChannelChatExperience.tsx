'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Bars } from 'react-loader-spinner';
import { ArrowLeft, Send, Sparkles, Users, Shield, MessageCircleHeart, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  clearChannelChatHistory,
  getChatMessages,
  getChannelChatClearedAt,
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
  const [memberCount, setMemberCount] = useState(0);
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
  const creatorAddressRaw = String(creatorId || '');
  const normalizedCreatorId = creatorAddressRaw.toLowerCase();
  const isCreator = Boolean(walletAddress && normalizedCreatorId && walletAddress === normalizedCreatorId);

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
    if (!client || !playbackId || !creatorAddressRaw) return;

    const eligibleAddresses = await getChannelChatEligibleAddresses(playbackId, creatorAddressRaw);
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
  }, [creatorAddressRaw, playbackId, resolveDisplayNameForWallet]);

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
    const initKey = `${playbackId}:${walletAddress}:${authenticated ? '1' : '0'}:${ready ? '1' : '0'}:${isCreator ? '1' : '0'}`;
    if (initPromiseRef.current && initKeyRef.current === initKey) {
      return initPromiseRef.current;
    }

    const run = (async () => {
      const currentGeneration = ++initGenerationRef.current;
      const isStaleRun = () =>
        !componentMountedRef.current || initGenerationRef.current !== currentGeneration;

      teardownStream();

      if (!playbackId || !isLikelyAddress(creatorAddressRaw)) {
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

      if (!isCreator) {
        const [isFollowerSubscribed, hasPaidSubscription] = await Promise.all([
          isUserSubscribedToCreator(walletAddress, normalizedCreatorId),
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
      if (!isCreator && !mapping?.xmtpGroupId) {
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

      if (!conversation && !isCreator) {
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

      if (!conversation && !isCreator) {
        setChatState('connecting');
        setStatusMessage('Syncing your chat access automatically...');
        scheduleAccessSyncRetry();
        return;
      }

      if (!conversation && isCreator) {
        setStatusMessage('Creating your channel group chat...');
        const created = await createChannelConversation(client, streamNameRef.current || 'Channel', playbackId);
        if (isStaleRun()) return;
        conversation = created.conversation;
        await saveChannelChatGroupMapping({
          playbackId,
          creatorId: creatorAddressRaw,
          xmtpGroupId: created.conversationId,
        });
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

      if (!isCreator) {
        // If the subscriber has XMTP initialized now, try to ensure membership immediately.
        try {
          await syncConversationMembers(client, conversation, [walletAddress]);
        } catch {
          // Non-admin subscribers may not be allowed to add themselves, so ignore.
        }
        if (isStaleRun()) return;
      }

      try {
        await refreshKnownMemberSenderMappings();
      } catch (error) {
        console.error('Failed to pre-resolve channel sender mappings:', error);
      }
      if (isStaleRun()) return;

      if (isCreator) {
        setStatusMessage('Syncing subscribers into the room...');
        try {
          await syncSubscriberMemberships(creatorAddressRaw, playbackId);
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

      try {
        const members =
          (await conversation?.members?.()) ||
          (await conversation?.listMembers?.()) ||
          [];
        setMemberCount(Array.isArray(members) ? members.length : 0);
      } catch {
        setMemberCount(0);
      }

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
    creatorAddressRaw,
    isCreator,
    normalizedCreatorId,
    playbackId,
    ready,
    scheduleAccessSyncRetry,
    resolveDisplayNameForWallet,
    syncPersistedMessages,
    syncSubscriberMemberships,
    syncXmtpMessages,
    teardownStream,
    walletAddress,
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
    if (!isCreator || chatState !== 'ready' || !creatorAddressRaw) return;

    const intervalId = setInterval(() => {
      syncSubscriberMemberships(creatorAddressRaw, playbackId).catch((error) => {
        console.error('Background subscriber membership sync failed:', error);
      });
    }, 10000);

    return () => clearInterval(intervalId);
  }, [chatState, creatorAddressRaw, isCreator, playbackId, syncSubscriberMemberships]);

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
    if (!isCreator || clearingHistory) return;

    const confirmed = window.confirm(
      'Clear channel chat history for everyone? This hides all previous messages and cannot be undone.',
    );
    if (!confirmed) return;

    setClearingHistory(true);
    try {
      const clearedAt = await clearChannelChatHistory(playbackId, walletAddress || creatorAddressRaw);
      const clearedAtMs = messageTimestampMs(clearedAt);
      clearedAtMsRef.current = Number.isFinite(clearedAtMs) ? clearedAtMs : Date.now();
      setMessages([]);
      toast.success('Chat history cleared.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to clear chat history');
    } finally {
      setClearingHistory(false);
    }
  }, [clearingHistory, creatorAddressRaw, isCreator, playbackId, walletAddress]);

  const isReady = chatState === 'ready';

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#070b12] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(250,204,21,0.18),transparent_40%),radial-gradient(circle_at_85%_18%,rgba(20,184,166,0.20),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.14),transparent_48%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.62))]" />
      </div>

      <div className="relative z-10 flex h-[calc(100vh-215px)] min-h-[560px] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-[0.2em] text-cyan-200/75">Channel group chat</p>
              <h2 className="truncate text-lg font-semibold text-white">{streamName || 'Channel Room'}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCreator ? (
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={!isReady || clearingHistory}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-300/35 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{clearingHistory ? 'Clearing...' : 'Clear history'}</span>
              </button>
            ) : null}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs text-gray-200">
              <Users className="h-3.5 w-3.5 text-teal-300" />
              <span>{memberCount > 0 ? `${memberCount} members` : 'XMTP room'}</span>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 text-xs sm:px-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-500/15 px-2.5 py-1 text-teal-100">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Realtime XMTP</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300/30 bg-yellow-500/15 px-2.5 py-1 text-yellow-100">
            <Shield className="h-3.5 w-3.5" />
            <span>{isCreator ? 'Admin mode' : 'Subscriber room'}</span>
          </div>
          <div className="text-gray-300">{statusMessage}</div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          {isReady && messages.length === 0 ? (
            <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-md">
              <MessageCircleHeart className="mx-auto mb-3 h-7 w-7 text-yellow-300" />
              <p className="text-sm text-white">Room is live. Send the first message to start the vibe.</p>
            </div>
          ) : null}

          {!isReady && chatState !== 'blocked' && chatState !== 'error' ? (
            <div className="mt-16 flex justify-center">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-md">
                <div className="flex items-center gap-3 text-sm text-white">
                  <Bars width={18} height={18} color="#facc15" />
                  <span>{statusMessage}</span>
                </div>
              </div>
            </div>
          ) : null}

          {chatState === 'blocked' ? (
            <div className="mx-auto mt-16 max-w-md rounded-2xl border border-white/20 bg-[#111827]/80 p-6 text-center backdrop-blur-md">
              <p className="text-base font-semibold text-white">Chat access locked</p>
              <p className="mt-2 text-sm text-gray-300">{statusMessage}</p>
              {!authenticated ? (
                <button
                  onClick={login}
                  className="mt-4 rounded-lg bg-gradient-to-r from-yellow-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black"
                >
                  Connect wallet
                </button>
              ) : null}
            </div>
          ) : null}

          {chatState === 'error' ? (
            <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-300/40 bg-red-900/20 p-6 text-center backdrop-blur-md">
              <p className="text-base font-semibold text-red-200">Chat unavailable</p>
              <p className="mt-2 text-sm text-red-100/90">{statusMessage}</p>
              <button
                onClick={() => initializeConversation()}
                className="mt-4 rounded-lg border border-red-200/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100"
              >
                Retry
              </button>
            </div>
          ) : null}

          {isReady ? (
            <div className="space-y-3 pb-4">
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
                const imageUrl = extractImageUrlFromMessage(message);
                const displayText = displayMessageContent(message);
                return (
                  <article
                    key={message.id}
                    className={`max-w-[86%] rounded-2xl border px-4 py-2.5 text-sm shadow-sm backdrop-blur-md ${
                      isSelf
                        ? 'ml-auto border-yellow-300/35 bg-gradient-to-br from-yellow-400/20 to-teal-400/20 text-white'
                        : 'border-white/20 bg-white/10 text-gray-100'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-4 text-[11px]">
                      <span className={`${isSelf ? 'text-yellow-200' : 'text-cyan-200/80'} truncate`}>
                        {senderLabel}
                      </span>
                      <span className="text-gray-300">{toDateLabel(message.sentAt)}</span>
                    </div>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Shared image"
                        className="mb-2 max-h-[320px] w-full rounded-xl border border-white/10 object-contain"
                        loading="lazy"
                      />
                    ) : null}
                    {displayText ? <p className="break-words leading-relaxed">{displayText}</p> : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-white/10 bg-black/25 px-3 py-3 backdrop-blur-xl sm:px-6">
          <div className="mb-2 flex flex-wrap gap-2">
            {QUICK_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => handleReaction(reaction)}
                disabled={!isReady}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 px-2 text-sm text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reaction}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
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
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-300 focus:border-yellow-300/70 focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!isReady || sending || !inputValue.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-yellow-500 to-teal-500 text-black transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              {sending ? <Bars width={14} height={14} color="#0b0b0b" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
