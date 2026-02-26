import { Livepeer } from 'livepeer';
import type { ClipPayload, NewStreamPayload } from 'livepeer/models/components';
import { unstable_cache } from 'next/cache';

const livepeerApiKey = process.env.LIVEPEER_API_KEY;
const livepeer = livepeerApiKey
  ? new Livepeer({
      apiKey: livepeerApiKey,
    })
  : null;

export const getPlaybackInfoUncached = async (playbackId: string) => {
  if (!livepeer) {
    console.error('LIVEPEER_API_KEY is missing on server. Playback info lookup is unavailable.');
    return null;
  }
  try {
    const playbackInfo = await livepeer.playback.get(playbackId);

    if (!playbackInfo.playbackInfo) {
      console.error('Error fetching playback info', playbackInfo);

      return null;
    }
    return playbackInfo.playbackInfo;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const getPlaybackInfo = unstable_cache(
  async (playbackId: string) => getPlaybackInfoUncached(playbackId),
  ['get-playback-info'],
  {
    revalidate: 120,
  },
);

export const createStreamClip = async (opts: ClipPayload) => {
  if (!livepeer) {
    throw new Error('LIVEPEER_API_KEY is missing on server.');
  }
  const result = await livepeer.stream.createClip(opts);
  return result;
};
