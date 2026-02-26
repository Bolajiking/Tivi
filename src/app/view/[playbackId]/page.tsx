import PlayerWithChat from './PlayerWithChat';
import { redirect } from 'next/navigation';

export default function PlayerPage({
  params,
  searchParams,
}: {
  params: { playbackId: string };
  searchParams: { streamName?: string; id?: string | string[] };
}) {
  const { playbackId } = params;
  const { streamName } = searchParams;
  const idParam = Array.isArray(searchParams.id) ? searchParams.id[0] : searchParams.id;

  if (idParam) {
    redirect(`/creator/${encodeURIComponent(idParam)}/live/${encodeURIComponent(playbackId)}`);
  }

  return <PlayerWithChat title={streamName ?? 'Live Stream'} playbackId={playbackId} id={idParam || ''} />;
}
