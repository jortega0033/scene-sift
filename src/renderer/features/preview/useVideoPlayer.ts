import { useRef, useState, useCallback, useEffect } from 'react';

export type PlayerState = 'not_ready' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

export type UseVideoPlayerReturn = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerState: PlayerState;
  currentTime: number;
  duration: number;
  playbackRate: number;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  retryLoad: () => void;
};

export const useVideoPlayer = (src: string | null): UseVideoPlayerReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('not_ready');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1.0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setPlayerState('not_ready');
      return;
    }

    setPlayerState('loading');
    setCurrentTime(0);
    setDuration(0);

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setPlayerState('paused');
    };
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setPlayerState('playing');
    const handlePause = () => setPlayerState('paused');
    const handleError = () => setPlayerState('error');
    const handleEnded = () => setPlayerState('paused');

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const play = useCallback(() => {
    void videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setPlaybackRateState(rate);
  }, []);

  const retryLoad = useCallback(() => {
    setPlayerState('loading');
    setCurrentTime(0);
    setDuration(0);
    videoRef.current?.load();
  }, []);

  return {
    videoRef,
    playerState,
    currentTime,
    duration,
    playbackRate,
    play,
    pause,
    seek,
    setPlaybackRate,
    retryLoad,
  };
};
