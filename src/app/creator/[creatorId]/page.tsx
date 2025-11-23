import { Suspense } from 'react';
import { CreatorProfile } from '@/components/templates/creator/CreatorProfile';
import { CreatorProfileLoading } from '@/components/templates/creator/CreatorProfile';

export default function CreatorProfilePage({
  params,
}: {
  params: { creatorId: string };
}) {
  // Decode the creatorId parameter to handle URL encoding
  // Next.js automatically lowercases URL params, but we'll use case-insensitive DB queries
  const creatorId = decodeURIComponent(params.creatorId);

  return (
    <div className="w-full h-full">
      <Suspense fallback={<CreatorProfileLoading />}>
        <CreatorProfile creatorId={creatorId} />
      </Suspense>
    </div>
  );
} 