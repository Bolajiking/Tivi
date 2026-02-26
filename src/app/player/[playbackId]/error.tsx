'use client';

import React, { useEffect } from 'react';
import { toast } from 'sonner';

export default function PlayerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Player route error:', error);
    toast.error('Player failed to load. Please try again.');
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-black via-gray-950 to-black px-6 text-center text-white">
      <h2 className="text-2xl font-bold">Playback unavailable</h2>
      <p className="mt-3 max-w-md text-sm text-gray-300">
        An error occurred while loading this stream.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-gradient-to-r from-yellow-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black"
      >
        Retry
      </button>
    </div>
  );
}
