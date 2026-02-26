import { Suspense } from 'react';
import { CreatorProfile, CreatorProfileLoading } from '@/components/templates/creator/CreatorProfile';

export default function CreatorVideoPage({
  params,
}: {
  params: { creatorId: string; playbackId: string };
}) {
  const creatorId = decodeURIComponent(params.creatorId);
  const playbackId = decodeURIComponent(params.playbackId);

  return (
    <div className="w-full h-full">
      <Suspense fallback={<CreatorProfileLoading />}>
        <CreatorProfile creatorId={creatorId} initialVideoPlaybackId={playbackId} />
      </Suspense>
    </div>
  );
}

