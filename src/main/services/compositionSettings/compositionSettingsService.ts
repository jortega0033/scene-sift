import type { CompositionSettings, CompositionSettingsPatch } from '@shared/schemas/composition';
import type { DatabaseService } from '@main/services/database/databaseService';

export class CompositionSettingsService {
  constructor(private readonly db: DatabaseService) {}

  public getForProject(projectId: string): CompositionSettings {
    return this.db.getProjectCompositionSettings(projectId);
  }

  public updateForProject(projectId: string, patch: CompositionSettingsPatch): CompositionSettings {
    return this.db.upsertProjectCompositionSettings(projectId, patch);
  }
}
