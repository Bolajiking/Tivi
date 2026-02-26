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
  const { src, status } = useLivePlaybackInfo(playbackId);

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
