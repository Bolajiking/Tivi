'use client';

import React, { useEffect } from 'react';
import { toast } from 'sonner';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard route error:', error);
    toast.error('Dashboard failed to load. Please try again.');
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-black via-gray-950 to-black px-6 text-center text-white">
      <h2 className="text-2xl font-bold">Dashboard unavailable</h2>
      <p className="mt-3 max-w-md text-sm text-gray-300">
        We hit an error while loading your dashboard data.
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
