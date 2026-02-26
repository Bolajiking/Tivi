import { Suspense } from 'react';
import { CreatorProfile, CreatorProfileLoading } from '@/components/templates/creator/CreatorProfile';

export default function CreatorChatPage({
  params,
  searchParams,
}: {
  params: { creatorId: string };
  searchParams?: { channelId?: string };
}) {
  const creatorId = decodeURIComponent(params.creatorId);
  const initialChatPlaybackId = searchParams?.channelId
    ? decodeURIComponent(searchParams.channelId)
    : undefined;

  return (
    <div className="w-full h-full">
      <Suspense fallback={<CreatorProfileLoading />}>
        <CreatorProfile creatorId={creatorId} initialChatPlaybackId={initialChatPlaybackId} openChatView />
      </Suspense>
    </div>
  );
}
