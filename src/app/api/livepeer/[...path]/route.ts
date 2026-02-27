import { NextResponse } from 'next/server';
import { hasCreatorInviteAccess } from '@/lib/supabase-service';

const LIVEPEER_API_BASE = 'https://livepeer.studio/api';
const STREAM_CREATE_ALLOWED_FIELDS = new Set(['name', 'record', 'playbackPolicy', 'creatorId']);
const STREAM_PATCH_ALLOWED_FIELDS = new Set(['name', 'record', 'playbackPolicy']);
const ASSET_REQUEST_UPLOAD_ALLOWED_FIELDS = new Set(['name', 'staticMP4', 'creatorId']);

const buildUpstreamUrl = (request: Request, path: string[]) => {
  const safePath = path.join('/');
  const upstream = new URL(`${LIVEPEER_API_BASE}/${safePath}`);
  const incoming = new URL(request.url);
  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });
  return upstream.toString();
};

const normalizeWalletAddress = (value: string | null | undefined): string =>
  String(value || '').trim().toLowerCase();

const isLikelyWalletAddress = (value: string | null | undefined): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());

const extractCreatorId = (payload: any): string | null => {
  const creatorId = payload?.creatorId;
  if (typeof creatorId === 'string' && creatorId.trim()) {
    return normalizeWalletAddress(creatorId);
  }
  if (
    creatorId &&
    typeof creatorId === 'object' &&
    typeof creatorId.value === 'string' &&
    creatorId.value.trim()
  ) {
    return normalizeWalletAddress(creatorId.value);
  }
  if (typeof payload?.creator?.id === 'string' && payload.creator.id.trim()) {
    return normalizeWalletAddress(payload.creator.id);
  }
  return null;
};

const sanitizePayload = (payload: any, allowedFields: Set<string>): Record<string, any> => {
  const safePayload: Record<string, any> = {};
  if (!payload || typeof payload !== 'object') return safePayload;

  Object.keys(payload).forEach((key) => {
    if (!allowedFields.has(key)) return;
    safePayload[key] = payload[key];
  });

  return safePayload;
};

const isAllowedReadPath = (path: string[]): boolean => {
  if (!path.length) return false;

  // Stream read routes (list/get/metrics/sessions) are read-only.
  if (path[0] === 'stream') return true;

  // Asset read routes (list/get).
  if (path[0] === 'asset') {
    return path.length === 1 || path.length === 2;
  }

  // Playback read route.
  if (path[0] === 'playback') {
    return path.length === 2;
  }

  // Viewer analytics routes consumed by hooks.
  if (path[0] === 'data' && path[1] === 'views') {
    if (path[2] === 'now' && path.length === 3) return true;
    if (path[2] === 'query' && path.length === 3) return true;
    if (path[2] === 'query' && path[3] === 'total' && path.length === 5) return true;
  }

  return false;
};

const isAllowedWritePath = (method: string, path: string[]): boolean => {
  if (method === 'POST') {
    return (
      (path.length === 1 && path[0] === 'stream') ||
      (path.length === 2 && path[0] === 'asset' && path[1] === 'request-upload')
    );
  }
  if (method === 'PATCH') {
    return path.length === 2 && path[0] === 'stream';
  }
  if (method === 'DELETE') {
    return (
      (path.length === 2 && path[0] === 'stream') ||
      (path.length === 2 && path[0] === 'asset') ||
      (path.length === 3 && path[0] === 'stream' && path[2] === 'terminate')
    );
  }
  return false;
};

const fetchStreamOwnerCreatorId = async (key: string, streamId: string): Promise<string | null> => {
  const response = await fetch(`${LIVEPEER_API_BASE}/stream/${encodeURIComponent(streamId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return extractCreatorId(payload);
};

const fetchAssetOwnerCreatorId = async (key: string, assetId: string): Promise<string | null> => {
  const response = await fetch(`${LIVEPEER_API_BASE}/asset/${encodeURIComponent(assetId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return extractCreatorId(payload);
};

const proxy = async (request: Request, path: string[]) => {
  const key = process.env.LIVEPEER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'LIVEPEER_API_KEY is missing. Add a server-side management API key in .env.local.' },
      { status: 500 },
    );
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  if (method === 'GET') {
    if (!isAllowedReadPath(path)) {
      return NextResponse.json({ error: 'Unsupported Livepeer API read path' }, { status: 400 });
    }
  } else if (!isAllowedWritePath(method, path)) {
    return NextResponse.json({ error: 'Unsupported Livepeer API write path' }, { status: 400 });
  }

  let parsedPayload: any = null;
  let requestBody: string | undefined;

  if (hasBody) {
    requestBody = await request.text();
    if (requestBody) {
      try {
        parsedPayload = JSON.parse(requestBody);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }
  }

  if (method !== 'GET') {
    const requesterCreatorId = normalizeWalletAddress(request.headers.get('x-creator-id'));
    if (!isLikelyWalletAddress(requesterCreatorId)) {
      return NextResponse.json(
        { error: 'x-creator-id header (wallet address) is required for stream write operations.' },
        { status: 401 },
      );
    }

    if (method === 'POST') {
      if (path[0] === 'stream') {
        const creatorId = extractCreatorId(parsedPayload);
        if (!creatorId || !isLikelyWalletAddress(creatorId)) {
          return NextResponse.json({ error: 'creatorId is required to create a channel' }, { status: 400 });
        }
        if (creatorId !== requesterCreatorId) {
          return NextResponse.json(
            { error: 'Creator mismatch. Request header and payload creatorId must match.' },
            { status: 403 },
          );
        }

        try {
          const hasAccess = await hasCreatorInviteAccess(creatorId);
          if (!hasAccess) {
            return NextResponse.json(
              {
                error:
                  'Creator access invite required. Redeem a valid invite code before creating a channel.',
              },
              { status: 403 },
            );
          }
        } catch (error: any) {
          return NextResponse.json(
            { error: error?.message || 'Failed to verify creator invite access' },
            { status: 500 },
          );
        }

        const sanitized = sanitizePayload(parsedPayload, STREAM_CREATE_ALLOWED_FIELDS);
        requestBody = JSON.stringify(sanitized);
      } else if (path[0] === 'asset' && path[1] === 'request-upload') {
        const creatorId = extractCreatorId(parsedPayload);
        if (!creatorId || !isLikelyWalletAddress(creatorId)) {
          return NextResponse.json(
            { error: 'creatorId is required to request asset upload.' },
            { status: 400 },
          );
        }
        if (creatorId !== requesterCreatorId) {
          return NextResponse.json(
            { error: 'Creator mismatch. Request header and payload creatorId must match.' },
            { status: 403 },
          );
        }

        const sanitized = sanitizePayload(parsedPayload, ASSET_REQUEST_UPLOAD_ALLOWED_FIELDS);
        requestBody = JSON.stringify(sanitized);
      }
    }

    if (method === 'PATCH' || method === 'DELETE') {
      if (path[0] === 'stream') {
        const streamId = path[1];
        if (!streamId) {
          return NextResponse.json({ error: 'Stream ID is required' }, { status: 400 });
        }

        const ownerCreatorId = await fetchStreamOwnerCreatorId(key, streamId);
        if (!ownerCreatorId || !isLikelyWalletAddress(ownerCreatorId)) {
          return NextResponse.json(
            { error: 'Unable to verify stream owner for this action.' },
            { status: 403 },
          );
        }

        if (ownerCreatorId !== requesterCreatorId) {
          return NextResponse.json(
            { error: 'Only the stream owner can modify or terminate this stream.' },
            { status: 403 },
          );
        }
      }

      if (path[0] === 'asset') {
        const assetId = path[1];
        if (!assetId) {
          return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
        }

        const ownerCreatorId = await fetchAssetOwnerCreatorId(key, assetId);
        if (!ownerCreatorId || !isLikelyWalletAddress(ownerCreatorId)) {
          return NextResponse.json(
            { error: 'Unable to verify asset owner for this action.' },
            { status: 403 },
          );
        }

        if (ownerCreatorId !== requesterCreatorId) {
          return NextResponse.json(
            { error: 'Only the asset owner can modify or delete this asset.' },
            { status: 403 },
          );
        }
      }
    }

    if (method === 'PATCH') {
      const sanitized = sanitizePayload(parsedPayload, STREAM_PATCH_ALLOWED_FIELDS);
      if (Object.keys(sanitized).length === 0) {
        return NextResponse.json(
          { error: 'No supported fields in patch payload. Allowed: name, record, playbackPolicy.' },
          { status: 400 },
        );
      }
      requestBody = JSON.stringify(sanitized);
    }
  }

  if (!path.length) {
    return NextResponse.json({ error: 'Unsupported Livepeer API path' }, { status: 400 });
  }

  const upstreamUrl = buildUpstreamUrl(request, path);

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${key}`);
  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      method,
      headers,
      cache: 'no-store',
      body: requestBody,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Livepeer upstream request failed',
        details: error?.message || 'Unknown network error',
      },
      { status: 502 },
    );
  }

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const contentType = response.headers.get('content-type') || 'application/json';
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': contentType, 'cache-control': 'no-store' },
  });
};

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path || []);
}

export async function POST(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path || []);
}

export async function PATCH(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path || []);
}

export async function DELETE(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxy(request, params.path || []);
}
