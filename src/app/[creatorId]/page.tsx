import { Suspense } from 'react';
import { CreatorProfile } from '@/components/templates/creator/CreatorProfile';
import { CreatorProfileLoading } from '@/components/templates/creator/CreatorProfile';
import { ChannelProvider } from '@/context/ChannelContext';

export default function CreatorProfileAliasPage({
  params,
}: {
  params: { creatorId: string };
}) {
  const creatorId = decodeURIComponent(params.creatorId);

  return (
    <div className="w-full h-full">
      <ChannelProvider>
        <Suspense fallback={<CreatorProfileLoading />}>
          <CreatorProfile creatorId={creatorId} />
        </Suspense>
      </ChannelProvider>
    </div>
  );
}
