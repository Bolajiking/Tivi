'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-red-400">Unexpected Error</p>
          <h1 className="mt-3 text-2xl font-bold">Something went wrong.</h1>
          <p className="mt-2 max-w-md text-sm text-gray-300">
            {error?.message || 'An unrecoverable error occurred. Please try again.'}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-gradient-to-r from-yellow-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
