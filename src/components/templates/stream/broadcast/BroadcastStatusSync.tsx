'use client';

import { useEffect } from 'react';
import * as Broadcast from '@livepeer/react/broadcast';

interface BroadcastStatusSyncProps {
  onStatusChange: (status: string) => void;
}

/**
 * Reads Livepeer broadcast status from context and reports status transitions.
 * Must be rendered inside <Broadcast.Root>.
 */
export function BroadcastStatusSync({ onStatusChange }: BroadcastStatusSyncProps) {
  const broadcastContext = (Broadcast as any).useBroadcastContext('BroadcastStatusSync', undefined as any);
  const status = (Broadcast as any).useStore(
    broadcastContext.store,
    ({ status }: { status: string }) => status,
  );

  useEffect(() => {
    if (status) {
      onStatusChange(status);
    }
  }, [onStatusChange, status]);

  return null;
}
