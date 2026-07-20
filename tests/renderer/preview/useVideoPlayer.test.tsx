import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoPlayer } from '@renderer/features/preview/useVideoPlayer';
import type { PlayerState } from '@renderer/features/preview/useVideoPlayer';

type CapturedState = {
  playerState: PlayerState;
  currentTime: number;
  duration: number;
};

let captured: CapturedState = { playerState: 'not_ready', currentTime: 0, duration: 0 };

const Fixture = ({ src }: { src: string | null }) => {
  const player = useVideoPlayer(src);
  captured = {
    playerState: player.playerState,
    currentTime: player.currentTime,
    duration: player.duration,
  };
  return <video ref={player.videoRef} data-testid="video" />;
};

describe('useVideoPlayer', () => {
  beforeEach(() => {
    captured = { playerState: 'not_ready', currentTime: 0, duration: 0 };
  });

  it('starts in not_ready state when src is null', () => {
    render(<Fixture src={null} />);
    expect(captured.playerState).toBe('not_ready');
  });

  it('transitions to loading when src is provided', () => {
    render(<Fixture src="data:video/mp4;base64,AAAA" />);
    expect(captured.playerState).toBe('loading');
  });

  it('transitions to paused when loadedmetadata fires', async () => {
    const { getByTestId } = render(<Fixture src="data:video/mp4;base64,AAAA" />);
    const video = getByTestId('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 100, writable: true, configurable: true });
    await act(async () => {
      fireEvent(video, new Event('loadedmetadata'));
    });
    expect(captured.playerState).toBe('paused');
    expect(captured.duration).toBe(100);
  });

  it('transitions to playing when play event fires', async () => {
    const { getByTestId } = render(<Fixture src="data:video/mp4;base64,AAAA" />);
    const video = getByTestId('video');
    await act(async () => {
      fireEvent(video, new Event('play'));
    });
    expect(captured.playerState).toBe('playing');
  });

  it('transitions to error state when error event fires', async () => {
    const { getByTestId } = render(<Fixture src="data:video/mp4;base64,AAAA" />);
    const video = getByTestId('video');
    await act(async () => {
      fireEvent(video, new Event('error'));
    });
    expect(captured.playerState).toBe('error');
  });

  it('transitions to paused when ended event fires', async () => {
    const { getByTestId } = render(<Fixture src="data:video/mp4;base64,AAAA" />);
    const video = getByTestId('video');
    await act(async () => {
      fireEvent(video, new Event('play'));
    });
    await act(async () => {
      fireEvent(video, new Event('ended'));
    });
    expect(captured.playerState).toBe('paused');
  });

  it('updates currentTime on timeupdate event', async () => {
    const { getByTestId } = render(<Fixture src="data:video/mp4;base64,AAAA" />);
    const video = getByTestId('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 42.5, writable: true, configurable: true });
    await act(async () => {
      fireEvent(video, new Event('timeupdate'));
    });
    expect(captured.currentTime).toBe(42.5);
  });
});
