import type { DatabaseService } from '@main/services/database/databaseService';
import type { VideoCueItem } from '@shared/schemas/video';
import { AppError } from '@main/utils/errors';

export class VideoService {
  constructor(private readonly db: DatabaseService) {}

  public resolveVideoPath(projectId: string): string | null {
    const project = this.db.getProject(projectId);
    return project?.videoPath ?? null;
  }

  public getPlaybackUrl(projectId: string): { url: string } {
    const project = this.db.getProject(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }
    return { url: `local:///video/${projectId}` };
  }

  public getCues(projectId: string): { cues: VideoCueItem[] } {
    const project = this.db.getProject(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }
    const { subtitleStatus } = project;
    if (subtitleStatus !== 'ready' && subtitleStatus !== 'ready_with_warnings') {
      throw new AppError('SUBTITLE_DATA_CORRUPT', 'Subtitle not ready for this project.');
    }
    const doc = this.db.getSubtitleDocument(projectId);
    if (!doc) {
      throw new AppError('SUBTITLE_DATA_CORRUPT', 'Subtitle document not found.');
    }
    const cues: VideoCueItem[] = doc.cues.map((cue) => ({
      index: cue.index,
      startMs: cue.startMs,
      endMs: cue.endMs,
      text: cue.text.slice(0, 2000),
    }));
    return { cues };
  }
}
