import * as Dialog from '@radix-ui/react-dialog';
import React, { useEffect, useRef } from 'react';

interface StreamGateModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}

export function StreamGateModal({ open, onClose, title = 'This is a gated stream', children }: StreamGateModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !overlayRef.current) return;

    // Add click handler to allow wallet modal to work
    const handleOverlayClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If clicking on wallet-related elements, allow it
      if (
        target.closest('[data-rk], .wallet-adapter-modal, .wallet-adapter-dropdown, [data-radix-popper-content-wrapper]')
      ) {
        e.stopPropagation();
        return;
      }
    };

    const overlay = overlayRef.current;
    overlay.addEventListener('click', handleOverlayClick, true);
    
    return () => {
      overlay.removeEventListener('click', handleOverlayClick, true);
    };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()} modal={false}>
      <Dialog.Portal>
        {/* dimmed backdrop - allow clicks through for wallet modal */}
        <Dialog.Overlay 
          ref={overlayRef}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40"
        />

        {/* center‑screen container */}
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          onPointerDownOutside={(e) => {
            // Don't close if clicking wallet modal
            const target = e.target as HTMLElement;
            if (target.closest('[data-rk], .wallet-adapter-modal, .wallet-adapter-dropdown, [data-radix-popper-content-wrapper]')) {
              e.preventDefault();
            }
          }}
        >
          <div className="w-full max-h-[84vh] rounded-xl border border-white/20 bg-gradient-to-br from-gray-900 via-black to-gray-900 shadow-2xl flex flex-col overflow-hidden relative pointer-events-auto">
            <div className="border-b border-white/10 px-5 py-3">
              <Dialog.Title className="text-sm font-semibold tracking-wide text-white">{title}</Dialog.Title>
            </div>
            {/* scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
