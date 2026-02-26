import { Suspense } from 'react';
import Dashboard from '@/components/templates/dashboard/Dashboard';
import Spinner from '@/components/Spinner';

export default function DashboardChatPage({
  searchParams,
}: {
  params: { creatorId: string };
  searchParams?: { channelId?: string };
}) {
  const initialChatPlaybackId = searchParams?.channelId
    ? decodeURIComponent(searchParams.channelId)
    : undefined;

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen bg-gradient-to-br from-black via-gray-950 to-black">
          <Spinner />
        </div>
      }
    >
      <Dashboard initialChatPlaybackId={initialChatPlaybackId} openChatView />
    </Suspense>
  );
}
