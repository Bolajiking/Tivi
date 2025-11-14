'use client';
import VideoWithControl from '@/components/VideoWithControl';
import { PlayerLoading } from '../player/player/Player';
import { usePlaybackInfo } from '@/app/hook/usePlaybckInfo';
import { ColorRing } from 'react-loader-spinner';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { useEffect } from 'react';
import { getStreamById } from '@/features/streamAPI';

interface VideoPlayerDialogProps {
  playbackId: string;
}

export const VideoPlayer: React.FC<VideoPlayerDialogProps> = ({ playbackId }) => {
  const { src, loading, error } = usePlaybackInfo(playbackId);
  if (loading) {
    return (
      <PlayerLoading>
        <div className="absolute flex flex-col bg-black-secondary-text inset-0 justify-center items-center">
          <span className="text-sm text-white">Loading video...</span>
        </div>
      </PlayerLoading>
    );
  }

  if (error || !src) {
    return (
      <PlayerLoading>
        <div className="absolute flex flex-col bg-black-secondary-text inset-0 justify-center items-center">
          <span className="text-sm text-white">{error || 'Video is not available.'}</span>
          <span className="text-sm text-white">
            <ColorRing
              visible={true}
              height="100"
              width="50"
              ariaLabel="color-ring-loading"
              wrapperStyle={{}}
              wrapperClass="color-ring-wrapper"
              colors={['#facc15', '#14b8a6', '#facc15', '#14b8a6', '#facc15']}
            />
          </span>
        </div>
      </PlayerLoading>
    );
  }

  return (
    <div>
      <VideoWithControl src={src} />
    </div>
  );
};
