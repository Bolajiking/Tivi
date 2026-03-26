'use client';

import { PlayerWithControls } from '@/components/templates/player/player/Player';
import { useLivePlaybackInfo } from '@/app/hook/useLivePlaybackInfo';

export default function PlayerWithChat({
  title,
  playbackId,
  id,
}: {
  title: string;
  playbackId: string;
  id: string;
}) {
  const { src, status, error } = useLivePlaybackInfo(playbackId);

  // Show a not-found state when the playback ID is invalid
  if (error && status === 'offline' && !src?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-root,#0a0a0a)] text-white">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Stream Not Found</h2>
        <p className="text-[#888] text-sm mb-6">{error}</p>
        <a href="/" className="text-[#facc15] text-sm hover:underline">Back to home</a>
      </div>
    );
  }

  // Render player immediately so active streams are not blocked by transient source polling lag.
  return (
    <PlayerWithControls
      src={src || []}
      streamStatus={status}
      title={title}
      playbackId={playbackId}
      id={id}
    />
  );
}
