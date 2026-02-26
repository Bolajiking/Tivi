'use client';

import { Client, ConsentState, IdentifierKind, SortDirection, getInboxIdForIdentifier } from '@xmtp/browser-sdk';
import { createWalletClient, custom, hexToBytes } from 'viem';
import { base } from 'viem/chains';

const XMTP_APP_VERSION = 'tivibio-chat/1.0.0';
const XMTP_CREATE_TIMEOUT_MS = 60000;
const XMTP_SYNC_TIMEOUT_MS = 20000;
const XMTP_ENV = 'production' as const;
const XMTP_HISTORY_PAGE_SIZE = 200;
const XMTP_HISTORY_MAX_MESSAGES = 5000;
const XMTP_TRANSIENT_ERROR_PATTERNS = [
  'from cursor',
  'synced ',
  'already processed',
  'welcome with cursor',
  'skipping welcome',
  'already in group',
  'timed out',
  'timeout',
  'temporary',
  'transient',
  'network',
  'opfs',
  'closure invoked recursively or after being dropped',
];

type PrivyWalletLike = {
  address?: string;
  getEthereumProvider?: () => Promise<any>;
};

type XmtpClient = any;
type XmtpConversation = any;
type XmtpMessage = any;

const clientCache = new Map<string, Promise<{ client: XmtpClient }>>();

export interface NormalizedChatMessage {
  id: string;
  sentAt: string;
  senderInboxId: string;
  content: string;
  attachment?: {
    kind: 'image' | 'file';
    filename: string;
    mimeType: string;
    dataUrl?: string;
    size?: number;
  };
}

const isLikelyAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const asArray = <T = any>(value: any): T[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
};

export function isTransientXmtpSyncError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (!message) return false;

  return XMTP_TRANSIENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function toIdentifier(address: string) {
  return {
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  };
}

const isInstallationLimitError = (message: string): boolean => {
  const value = message.toLowerCase();
  return (
    value.includes('already registered 10/10 installations') ||
    value.includes('has already registered 10/10 installations') ||
    (value.includes('installations') && value.includes('10/10'))
  );
};

function extractConversationId(conversation: XmtpConversation): string {
  return String(
    conversation?.id ||
      conversation?.conversationId ||
      conversation?.topic ||
      conversation?.metadata?.id ||
      '',
  );
}

function extractMessageId(message: XmtpMessage): string {
  try {
    return String(message?.id || message?.messageId || `${Date.now()}-${Math.random()}`);
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

function extractMessageContent(message: XmtpMessage): string {
  try {
    const content = message?.content;
    if (typeof content === 'string') return content;
    if (typeof content?.text === 'string') return content.text;
    if (typeof message?.body === 'string') return message.body;
    if (typeof message?.text === 'string') return message.text;
    return '';
  } catch {
    return '';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  if (!bytes?.length) return '';
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as number[]);
  }
  return btoa(binary);
}

function extractAttachmentFromMessage(message: XmtpMessage): NormalizedChatMessage['attachment'] | undefined {
  try {
    const content = message?.content;
    if (!content || typeof content !== 'object') return undefined;

    const filename = String(content?.filename || content?.name || '').trim();
    const mimeType = String(content?.mimeType || content?.type || '').trim().toLowerCase();
    const rawData = content?.data;
    let data: Uint8Array | null = null;
    if (rawData instanceof Uint8Array) {
      data = rawData;
    } else if (Array.isArray(rawData)) {
      data = new Uint8Array(rawData);
    }

    if (!filename && !mimeType && !data) return undefined;

    const isImage = mimeType.startsWith('image/');
    const dataUrl = data && mimeType ? `data:${mimeType};base64,${bytesToBase64(data)}` : undefined;

    return {
      kind: isImage ? 'image' : 'file',
      filename: filename || (isImage ? 'image' : 'attachment'),
      mimeType: mimeType || 'application/octet-stream',
      dataUrl,
      size: data?.byteLength,
    };
  } catch {
    return undefined;
  }
}

function extractMessageSentAt(message: XmtpMessage): string {
  try {
    const sentAt = message?.sentAt || message?.sent || message?.createdAt || message?.timestamp;
    if (!sentAt) return new Date().toISOString();
    if (sentAt instanceof Date) return sentAt.toISOString();
    return new Date(sentAt).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function extractSenderInboxId(message: XmtpMessage): string {
  try {
    return String(message?.senderInboxId || message?.sender?.inboxId || message?.senderAddress || 'unknown');
  } catch {
    return 'unknown';
  }
}

function extractMessageSentAtNs(message: XmtpMessage): bigint | null {
  const sentAtNs = message?.sentAtNs;
  if (typeof sentAtNs === 'bigint') return sentAtNs;
  if (typeof sentAtNs === 'number' && Number.isFinite(sentAtNs)) return BigInt(Math.floor(sentAtNs));
  if (typeof sentAtNs === 'string' && sentAtNs.trim()) {
    try {
      return BigInt(sentAtNs.trim());
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeMessage(message: XmtpMessage): NormalizedChatMessage {
  try {
    const attachment = extractAttachmentFromMessage(message);
    const content = extractMessageContent(message);
    const normalizedContent = content.trim()
      ? content
      : attachment
        ? attachment.kind === 'image'
          ? `[Image] ${attachment.filename}`
          : `[Attachment] ${attachment.filename}`
        : '';

    return {
      id: extractMessageId(message),
      sentAt: extractMessageSentAt(message),
      senderInboxId: extractSenderInboxId(message),
      content: normalizedContent,
      attachment,
    };
  } catch {
    return {
      id: `${Date.now()}-${Math.random()}`,
      sentAt: new Date().toISOString(),
      senderInboxId: 'unknown',
      content: '',
    };
  }
}

async function createSignerForWallet(wallet: PrivyWalletLike) {
  if (!wallet?.address || !wallet?.getEthereumProvider) {
    throw new Error('Wallet is not ready for XMTP initialization.');
  }

  const normalizedAddress = String(wallet.address).toLowerCase();
  const provider = await wallet.getEthereumProvider();
  const walletClient = createWalletClient({
    account: normalizedAddress as `0x${string}`,
    chain: base,
    transport: custom(provider),
  });

  const signMessageToBytes = async (message: string): Promise<Uint8Array> => {
    const signature: any = await walletClient.signMessage({
      account: normalizedAddress as `0x${string}`,
      message,
    });

    if (signature && signature.constructor?.name === 'Uint8Array') {
      return signature;
    }
    if (typeof signature === 'string') {
      return hexToBytes(signature as `0x${string}`);
    }
    return new Uint8Array(signature || []);
  };

  return {
    type: 'EOA' as const,
    getIdentifier: () => toIdentifier(normalizedAddress),
    signMessage: signMessageToBytes,
  };
}

async function recoverFromInstallationLimit(signer: any, address: string): Promise<void> {
  const identifier = toIdentifier(address);
  const inboxId = await getInboxIdForIdentifier(identifier, XMTP_ENV);
  if (!inboxId) {
    throw new Error('Unable to resolve XMTP inbox for installation recovery.');
  }

  const inboxStates = await Client.fetchInboxStates([inboxId], XMTP_ENV);
  const inboxState = asArray<any>(inboxStates)[0];
  const installations = asArray<any>(inboxState?.installations);
  const installationBytes = installations
    .map((installation) => installation?.bytes)
    .filter((bytes): bytes is Uint8Array => bytes instanceof Uint8Array && bytes.length > 0);

  if (installationBytes.length === 0) {
    throw new Error('No XMTP installations available to revoke.');
  }

  await Client.revokeInstallations(signer, inboxId, installationBytes, XMTP_ENV);
}

export async function getXmtpClient(wallet: PrivyWalletLike): Promise<{ client: XmtpClient }> {
  const address = String(wallet?.address || '').toLowerCase();
  if (!isLikelyAddress(address)) {
    throw new Error('Invalid wallet address for XMTP client creation.');
  }

  const existing = clientCache.get(address);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const signer = await createSignerForWallet(wallet);
    const clientOptions = {
      env: XMTP_ENV,
      appVersion: XMTP_APP_VERSION,
      // Use SDK default persistent dbPath to avoid bundler URL edge-cases from custom overrides.
      disableDeviceSync: true,
    };
    const createClient = () =>
      withTimeout(
        Client.create(signer, clientOptions),
        XMTP_CREATE_TIMEOUT_MS,
        'XMTP client initialization',
      );

    let client: XmtpClient;
    try {
      client = await createClient();
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      if (isInstallationLimitError(message)) {
        try {
          await recoverFromInstallationLimit(signer, address);
          client = await createClient();
        } catch {
          throw new Error(
            'XMTP installation limit reached. Close other chat sessions and reconnect to refresh installations.',
          );
        }
      } else if (message.includes('timed out') || message.includes('opfs')) {
        throw new Error(
          'XMTP initialization timed out. Close other tabs using chat and retry.',
        );
      } else {
        throw error;
      }
    }

    if (!client) {
      throw new Error('Unable to initialize XMTP client.');
    }

    try {
      await withTimeout(
        client?.conversations?.syncAll?.([ConsentState.Allowed]),
        XMTP_SYNC_TIMEOUT_MS,
        'XMTP conversation sync',
      );
    } catch {
      // syncAll can fail transiently; keep client usable for realtime stream attempts.
    }

    return { client };
  })().catch((error) => {
    clientCache.delete(address);
    throw error;
  });

  clientCache.set(address, promise);
  return promise;
}

export async function getConversationById(
  client: XmtpClient,
  conversationId: string,
): Promise<XmtpConversation | null> {
  if (!conversationId) return null;

  try {
    const direct = await client?.conversations?.getConversationById?.(conversationId);
    if (direct) return direct;
  } catch {
    // Continue with list-based lookups; direct lookup can fail transiently during sync.
  }

  // Fallback: some SDK states may not hydrate direct lookup immediately after membership updates.
  try {
    const groups = await client?.conversations?.listGroups?.();
    const matchedGroup = asArray<XmtpConversation>(groups).find((group) => extractConversationId(group) === conversationId);
    if (matchedGroup) return matchedGroup;
  } catch {
    // no-op
  }

  try {
    const allConversations = await client?.conversations?.list?.();
    const matchedConversation = asArray<XmtpConversation>(allConversations).find(
      (conversation) => extractConversationId(conversation) === conversationId,
    );
    if (matchedConversation) return matchedConversation;
  } catch {
    // no-op
  }

  return null;
}

export async function createChannelConversation(
  client: XmtpClient,
  streamName: string,
  playbackId: string,
): Promise<{ conversation: XmtpConversation; conversationId: string }> {
  const metadata = {
    name: `${streamName || 'Channel'} Chat`,
    imageUrl: 'https://tvinbio.com/assets/images/icon.png',
    description: `TVinBio channel chat for playback ${playbackId}`,
  };

  let conversation: XmtpConversation | null = null;

  if (typeof client?.conversations?.createGroup === 'function') {
    conversation = await client.conversations.createGroup([], metadata);
  } else if (typeof client?.conversations?.newGroup === 'function') {
    conversation = await client.conversations.newGroup([], metadata);
  }

  if (!conversation) {
    throw new Error('Unable to create XMTP group conversation.');
  }

  const conversationId = extractConversationId(conversation);
  if (!conversationId) {
    throw new Error('XMTP conversation ID is missing after creation.');
  }

  return { conversation, conversationId };
}

async function resolveInboxIdByClient(client: XmtpClient, address: string): Promise<string | null> {
  const lower = address.toLowerCase();
  const identifier = toIdentifier(lower);

  try {
    const inboxId = await client?.getInboxIdByIdentifier?.(identifier);
    if (inboxId) {
      return String(inboxId);
    }
  } catch {
    // continue to fallback methods below
  }

  const candidates: Array<[string, any[]]> = [
    ['findInboxIdByIdentifier', [identifier]],
    ['findInboxIdByIdentifier', [lower]],
    ['findInboxIdFromIdentifier', [identifier]],
    ['getInboxIdByIdentifier', [identifier]],
  ];

  for (const [methodName, args] of candidates) {
    const method = client?.[methodName] || client?.conversations?.[methodName];
    if (typeof method !== 'function') continue;
    try {
      const result = await method(...args);
      const inboxId = String(result?.inboxId || result?.id || result || '');
      if (inboxId) return inboxId;
    } catch {
      // Try next resolver method.
    }
  }

  return null;
}

async function resolveInboxIdsFromAddresses(
  client: XmtpClient,
  addresses: string[],
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  const uniqueAddresses = Array.from(new Set(addresses.map((address) => address.toLowerCase())));
  if (uniqueAddresses.length === 0) return resolved;

  let canMessageMap: Map<string, boolean> | null = null;
  try {
    const identifiers = uniqueAddresses.map((address) => toIdentifier(address));
    canMessageMap = await Client.canMessage(identifiers, 'production');
  } catch {
    canMessageMap = null;
  }

  for (const address of uniqueAddresses) {
    const allowed = canMessageMap?.get(address) ?? true;
    if (!allowed) continue;

    const inboxId = await resolveInboxIdByClient(client, address);
    if (inboxId) {
      resolved[address] = inboxId;
    }
  }

  return resolved;
}

export async function resolveInboxIdMapForAddresses(
  client: XmtpClient,
  addresses: string[],
): Promise<Record<string, string>> {
  const addressToInbox = await resolveInboxIdsFromAddresses(client, addresses);
  const inboxToAddress: Record<string, string> = {};
  for (const [address, inboxId] of Object.entries(addressToInbox)) {
    const normalizedAddress = String(address || '').toLowerCase();
    const normalizedInboxId = String(inboxId || '').trim();
    if (!normalizedAddress || !normalizedInboxId) continue;
    inboxToAddress[normalizedInboxId] = normalizedAddress;
  }
  return inboxToAddress;
}

export async function syncConversationMembers(
  client: XmtpClient,
  conversation: XmtpConversation,
  addresses: string[],
): Promise<number> {
  const uniqueAddresses = Array.from(
    new Set(addresses.map((address) => String(address || '').toLowerCase()).filter((address) => isLikelyAddress(address))),
  );
  if (uniqueAddresses.length === 0) return 0;

  const inboxMap = await resolveInboxIdsFromAddresses(client, uniqueAddresses);
  let existingInboxIds: string[] = [];
  try {
    const members =
      (await conversation?.members?.()) ||
      (await conversation?.listMembers?.()) ||
      (await conversation?.listMembersByInboxId?.()) ||
      [];
    existingInboxIds = asArray<any>(members)
      .map((member) => String(member?.inboxId || member?.memberInboxId || member || ''))
      .filter(Boolean);
  } catch {
    existingInboxIds = [];
  }

  const missingInboxIdsByAddress = new Map<string, string>();
  for (const address of uniqueAddresses) {
    const inboxId = inboxMap[address];
    if (!inboxId || existingInboxIds.includes(inboxId)) continue;
    missingInboxIdsByAddress.set(address, inboxId);
  }

  const missingAddressesForIdentifierAdds = Array.from(missingInboxIdsByAddress.keys());
  const missingInboxIds = Array.from(new Set(missingAddressesForIdentifierAdds.map((address) => missingInboxIdsByAddress.get(address)).filter(Boolean))) as string[];

  // Fallback path: if inbox IDs aren't resolved yet, we can still attempt identifier adds
  // for unresolved addresses (minus creator/self cases already handled by API errors).
  const unresolvedAddresses = uniqueAddresses.filter((address) => !inboxMap[address]);
  const addressesForIdentifierAdds = Array.from(
    new Set([...missingAddressesForIdentifierAdds, ...unresolvedAddresses]),
  );

  let addedByIdentifier = 0;
  if (typeof conversation?.addMembersByIdentifiers === 'function' && addressesForIdentifierAdds.length > 0) {
    for (const address of addressesForIdentifierAdds) {
      try {
        await conversation.addMembersByIdentifiers([toIdentifier(address)]);
        addedByIdentifier += 1;
      } catch (error: any) {
        const message = String(error?.message || '').toLowerCase();
        const isSafeDuplicate =
          message.includes('already') ||
          message.includes('exists') ||
          message.includes('member') ||
          message.includes('duplicate') ||
          message.includes('cannot add self') ||
          message.includes('already processed') ||
          message.includes('already in group');
        if (!isSafeDuplicate) {
          // Continue with inbox-id fallback path below.
        }
      }
    }
  }

  if (missingInboxIds.length > 0) {
    if (typeof conversation?.addMembersByInboxId === 'function') {
      await conversation.addMembersByInboxId(missingInboxIds);
    } else if (typeof conversation?.addMembers === 'function') {
      await conversation.addMembers(missingInboxIds);
    }
  }

  return missingInboxIds.length + addedByIdentifier;
}

export async function loadConversationMessages(
  conversation: XmtpConversation,
  limit: number = XMTP_HISTORY_MAX_MESSAGES,
): Promise<NormalizedChatMessage[]> {
  if (!conversation?.messages) return [];

  const safeLimit = Math.max(1, Math.min(limit, XMTP_HISTORY_MAX_MESSAGES));
  const maxPages = Math.ceil(safeLimit / XMTP_HISTORY_PAGE_SIZE);
  const collected: XmtpMessage[] = [];
  let cursorBeforeNs: bigint | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const remaining = safeLimit - collected.length;
    if (remaining <= 0) break;

    const pageSize = Math.min(XMTP_HISTORY_PAGE_SIZE, remaining);
    const options: any = {
      limit: BigInt(pageSize),
      direction: SortDirection.Descending,
    };
    if (cursorBeforeNs && cursorBeforeNs > BigInt(0)) {
      options.sentBeforeNs = cursorBeforeNs;
    }

    let pageMessages: XmtpMessage[] = [];
    try {
      pageMessages = asArray<XmtpMessage>(await conversation.messages(options));
    } catch (error) {
      if (isTransientXmtpSyncError(error)) {
        break;
      }
      throw error;
    }
    if (pageMessages.length === 0) break;
    collected.push(...pageMessages);

    const oldestInPage = pageMessages
      .map(extractMessageSentAtNs)
      .filter((value): value is bigint => value !== null)
      .reduce<bigint | null>((oldest, current) => {
        if (oldest === null) return current;
        return current < oldest ? current : oldest;
      }, null);

    if (oldestInPage === null || oldestInPage <= BigInt(0) || pageMessages.length < pageSize) {
      break;
    }

    cursorBeforeNs = oldestInPage - BigInt(1);
  }

  const deduped = new Map<string, NormalizedChatMessage>();
  for (const message of collected) {
    let normalized: NormalizedChatMessage;
    try {
      normalized = normalizeMessage(message);
    } catch {
      continue;
    }
    if (!normalized.content.trim()) continue;
    deduped.set(normalized.id, normalized);
  }

  return Array.from(deduped.values()).sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );
}

export async function streamConversationMessages(
  conversation: XmtpConversation,
  onMessage: (message: NormalizedChatMessage) => void,
): Promise<() => void> {
  let closed = false;

  if (typeof conversation?.stream === 'function') {
    const stream = await conversation.stream({
      onValue: (message: XmtpMessage) => {
        if (closed) return;
        let normalized: NormalizedChatMessage;
        try {
          normalized = normalizeMessage(message);
        } catch {
          return;
        }
        if (!normalized.content.trim()) return;
        onMessage(normalized);
      },
      onError: () => {
        // Conversation stream auto-retries by default in the browser SDK.
      },
      onFail: () => {
        // Surface no-op here; caller can reinitialize the conversation if needed.
      },
    });

    return () => {
      if (closed) return;
      closed = true;
      try {
        stream?.return?.();
      } catch {
        // no-op
      }
    };
  }

  const stream =
    (typeof conversation?.streamMessages === 'function'
      ? await conversation.streamMessages()
      : null);

  (async () => {
    if (!stream) return;
    try {
      for await (const message of stream) {
        if (closed) break;
        let normalized: NormalizedChatMessage;
        try {
          normalized = normalizeMessage(message);
        } catch {
          continue;
        }
        if (!normalized.content.trim()) continue;
        onMessage(normalized);
      }
    } catch {
      // caller handles retry strategy by re-initializing stream.
    }
  })();

  return () => {
    if (closed) return;
    closed = true;
    try {
      stream?.return?.();
    } catch {
      // no-op
    }
  };
}

export async function sendConversationMessage(
  conversation: XmtpConversation,
  text: string,
): Promise<NormalizedChatMessage | null> {
  const content = text.trim();
  if (!content) return null;

  const sentId =
    (typeof conversation?.sendText === 'function'
      ? await conversation.sendText(content, false)
      : await conversation?.send?.(content));

  try {
    await conversation?.publishMessages?.();
  } catch {
    // publish can fail transiently; stream/polling will still reconcile once delivered.
  }

  return {
    id: String(sentId || `${Date.now()}-${Math.random()}`),
    content,
    senderInboxId: 'self',
    sentAt: new Date().toISOString(),
  };
}

export async function sendConversationImageAttachment(
  conversation: XmtpConversation,
  file: File,
): Promise<NormalizedChatMessage | null> {
  if (!file) return null;
  const mimeType = String(file.type || '').toLowerCase();
  if (!mimeType.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }
  if (file.size > 1024 * 1024) {
    throw new Error('Image must be 1MB or smaller for direct XMTP attachment.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const sentId = await conversation?.sendAttachment?.({
    filename: file.name,
    mimeType: mimeType || 'image/jpeg',
    data,
  });

  try {
    await conversation?.publishMessages?.();
  } catch {
    // publish can fail transiently; stream/polling will still reconcile once delivered.
  }

  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${bytesToBase64(data)}`;

  return {
    id: String(sentId || `${Date.now()}-${Math.random()}`),
    content: `[Image] ${file.name}`,
    senderInboxId: 'self',
    sentAt: new Date().toISOString(),
    attachment: {
      kind: 'image',
      filename: file.name,
      mimeType: mimeType || 'image/jpeg',
      dataUrl,
      size: file.size,
    },
  };
}

export async function resolveInboxWalletAddresses(
  client: XmtpClient,
  inboxIds: string[],
): Promise<Record<string, string>> {
  const uniqueInboxIds = Array.from(
    new Set(inboxIds.map((inboxId) => String(inboxId || '').trim()).filter(Boolean)),
  );
  if (uniqueInboxIds.length === 0) return {};

  let inboxStates: any[] = [];
  try {
    inboxStates = asArray<any>(await client?.preferences?.getInboxStates?.(uniqueInboxIds, true));
  } catch {
    try {
      inboxStates = asArray<any>(await client?.preferences?.getInboxStates?.(uniqueInboxIds));
    } catch {
      return {};
    }
  }

  const results: Record<string, string> = {};
  for (const state of inboxStates) {
    const inboxId = String(state?.inboxId || '').trim();
    if (!inboxId) continue;

    const accountIdentifiers = asArray<any>(state?.accountIdentifiers);
    let matchedAddress = accountIdentifiers
      .map((identifier) => String(identifier?.identifier || '').toLowerCase())
      .find((identifier) => isLikelyAddress(identifier));

    if (!matchedAddress) {
      const recoveryIdentifier = String(state?.recoveryIdentifier?.identifier || '').toLowerCase();
      if (isLikelyAddress(recoveryIdentifier)) {
        matchedAddress = recoveryIdentifier;
      }
    }

    if (matchedAddress) {
      results[inboxId] = matchedAddress;
    }
  }

  return results;
}

export function clearXmtpClientCache(address?: string) {
  if (address && isLikelyAddress(address)) {
    clientCache.delete(address.toLowerCase());
    return;
  }
  clientCache.clear();
}
