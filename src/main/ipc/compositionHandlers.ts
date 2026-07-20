import { IPC_CHANNELS } from '@shared/ipc/channels';
import {
  getCompositionSettingsInputSchema,
  getCompositionSettingsOutputSchema,
  updateCompositionSettingsInputSchema,
  updateCompositionSettingsOutputSchema,
} from '@shared/schemas/composition';
import { registerValidatedHandler } from './createIpcHandler';
import { CompositionSettingsService } from '@main/services/compositionSettings/compositionSettingsService';
import type { DatabaseService } from '@main/services/database/databaseService';

export function registerCompositionHandlers(db: DatabaseService): void {
  const svc = new CompositionSettingsService(db);

  registerValidatedHandler(
    IPC_CHANNELS.COMPOSITION_GET_FOR_PROJECT,
    getCompositionSettingsInputSchema,
    getCompositionSettingsOutputSchema,
    ({ projectId }) => {
      const settings = svc.getForProject(projectId);
      return { settings };
    }
  );

  registerValidatedHandler(
    IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT,
    updateCompositionSettingsInputSchema,
    updateCompositionSettingsOutputSchema,
    ({ projectId, ...patch }) => {
      const settings = svc.updateForProject(projectId, patch);
      return { settings };
    }
  );
}
