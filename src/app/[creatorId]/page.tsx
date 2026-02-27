import { Suspense } from 'react';
import { CreatorProfile } from '@/components/templates/creator/CreatorProfile';
import { CreatorProfileLoading } from '@/components/templates/creator/CreatorProfile';

export default function CreatorProfileAliasPage({
  params,
}: {
  params: { creatorId: string };
}) {
  const creatorId = decodeURIComponent(params.creatorId);

  return (
    <div className="w-full h-full">
      <Suspense fallback={<CreatorProfileLoading />}>
        <CreatorProfile creatorId={creatorId} />
      </Suspense>
    </div>
  );
}

