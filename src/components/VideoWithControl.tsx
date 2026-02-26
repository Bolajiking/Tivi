import React from 'react';
import * as Player from '@livepeer/react/player';
import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  LoadingIcon,
  MuteIcon,
  PauseIcon,
  PictureInPictureIcon,
  PlayIcon,
  UnmuteIcon,
} from '@livepeer/react/assets';
import type { Src } from '@livepeer/react';

const VideoWithControl = ({ src }: { src: Src[] }) => {
  return (
    <div>
      <Player.Root autoPlay src={src} timeout={20000}>
        <Player.Container className="relative h-full w-full overflow-hidden rounded-md bg-gray-950 outline outline-1 outline-white/50 data-[playing=true]:outline-white/80 data-[playing=true]:outline-2 data-[fullscreen=true]:outline-none data-[fullscreen=true]:rounded-none transition-all">
          <Player.Video title="ads" className="h-full w-full object-fit capitalize" />

          {/* Loading Indicator */}
          <Player.LoadingIndicator className="absolute inset-0 bg-black/50 backdrop-blur data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0">
            <div className="flex h-full w-full items-center justify-center">
              <LoadingIcon className="h-8 w-8 animate-spin text-white" />
            </div>
          </Player.LoadingIndicator>

          {/* Generic Error Indicator */}
          <Player.ErrorIndicator
            matcher="all"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-center backdrop-blur-lg data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
          >
            <div className="flex items-center justify-center">
              <LoadingIcon className="h-8 w-8 animate-spin text-white" />
            </div>
            {/* <p className="text-white">An error occurred</p> */}
          </Player.ErrorIndicator>

          {/* Player Controls */}
          <Player.Controls
            autoHide={0}
            className="bg-gradient-to-b gap-1 px-3 md:px-3 py-2 flex-col-reverse flex from-black/20 via-80% via-black/30 duration-1000 to-black/60 data-[visible=true]:animate-in data-[visible=false]:animate-out data-[visible=false]:fade-out-0 data-[visible=true]:fade-in-0"
          >
            <div className="flex justify-between gap-4">
              <div className="flex flex-1 items-center gap-3">
                <Player.PlayPauseTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0">
                  <Player.PlayingIndicator asChild matcher={false}>
                    <PlayIcon className="w-full h-full text-white" />
                  </Player.PlayingIndicator>
                  <Player.PlayingIndicator asChild>
                    <PauseIcon className="w-full h-full text-white" />
                  </Player.PlayingIndicator>
                </Player.PlayPauseTrigger>
                <Player.MuteTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0">
                  <Player.VolumeIndicator asChild matcher={false}>
                    <MuteIcon className="w-full text-white h-full" />
                  </Player.VolumeIndicator>
                  <Player.VolumeIndicator asChild matcher={true}>
                    <UnmuteIcon className="w-full text-white h-full" />
                  </Player.VolumeIndicator>
                </Player.MuteTrigger>
                <Player.Time className="text-white text-sm" />

                <Player.Volume className="relative mr-1 flex-1 group flex cursor-pointer items-center select-none touch-none max-w-[120px] h-5">
                  <Player.Track className="bg-white/30 relative grow rounded-full transition-all h-[2px] md:h-[3px] group-hover:h-[3px] group-hover:md:h-[4px]">
                    <Player.Range className="absolute bg-white rounded-full h-full" />
                  </Player.Track>
                  <Player.Thumb className="block transition-all group-hover:scale-110 w-3 h-3 bg-white rounded-full" />
                </Player.Volume>
              </div>
              <div className="flex sm:flex-1 md:flex-[1.5] justify-end items-center gap-2.5">
                <Player.PictureInPictureTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0">
                  <PictureInPictureIcon className="w-full h-full text-white" />
                </Player.PictureInPictureTrigger>

                <Player.FullscreenTrigger className="w-6 h-6 hover:scale-110 transition-all flex-shrink-0">
                  <Player.FullscreenIndicator asChild>
                    <ExitFullscreenIcon className="w-full h-full text-white" />
                  </Player.FullscreenIndicator>

                  <Player.FullscreenIndicator matcher={false} asChild>
                    <EnterFullscreenIcon className="w-full h-full text-white" />
                  </Player.FullscreenIndicator>
                </Player.FullscreenTrigger>
              </div>
            </div>
            <Player.Seek className="relative group flex cursor-pointer items-center select-none touch-none w-full h-5">
              <Player.Track className="bg-white/30 relative grow rounded-full transition-all h-[2px] md:h-[3px] group-hover:h-[3px] group-hover:md:h-[4px]">
                <Player.SeekBuffer className="absolute bg-black/30 transition-all duration-1000 rounded-full h-full" />
                <Player.Range className="absolute bg-white rounded-full h-full" />
              </Player.Track>
              <Player.Thumb className="block group-hover:scale-110 w-3 h-3 bg-white transition-all rounded-full" />
            </Player.Seek>
          </Player.Controls>
        </Player.Container>
      </Player.Root>
    </div>
  );
};

export default VideoWithControl;
