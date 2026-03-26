'use client';

import { useEffect, useRef } from 'react';
import * as Broadcast from '@livepeer/react/broadcast';

interface BroadcastStatusSyncProps {
  onStatusChange: (status: string) => void;
}

/**
 * Reads Livepeer broadcast status from context and reports status transitions.
 * Must be rendered inside <Broadcast.Root>.
 */
export function BroadcastStatusSync({ onStatusChange }: BroadcastStatusSyncProps) {
  const prevStatusRef = useRef<string | null>(null);

  let status: string | null = null;
  try {
    const broadcastContext = (Broadcast as any).useBroadcastContext('BroadcastStatusSync', undefined as any);
    status = (Broadcast as any).useStore(
      broadcastContext.store,
      ({ status: s }: { status: string }) => s,
    );
  } catch (err) {
    console.error('[BroadcastStatusSync] Failed to read broadcast context:', err);
  }

  useEffect(() => {
    if (status && status !== prevStatusRef.current) {
      console.log(`[BroadcastStatusSync] Status: ${prevStatusRef.current} → ${status}`);
      prevStatusRef.current = status;
      onStatusChange(status);
    }
  }, [onStatusChange, status]);

  return null;
}
