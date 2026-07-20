# M11 IPC Surface

## New Channel Constants

Add to `src/shared/ipc/channels.ts`:

```ts
COMPOSITION_GET_FOR_PROJECT: 'composition:getForProject',
COMPOSITION_UPDATE_FOR_PROJECT: 'composition:updateForProject',
```

Total channel count after M11: **46** (was 44).

---

## Shared Schemas — `src/shared/schemas/composition.ts`

```ts
import { z } from 'zod';

// ── Allowed enum values ──────────────────────────────────────────────────────

export const ALLOWED_RESOLUTIONS = ['1080x1920', '720x1280'] as const;
export const ALLOWED_BACKGROUND_STYLES = ['blur', 'crop'] as const;
export const ALLOWED_SUBTITLE_POSITIONS = ['bottom', 'center'] as const;
export const ALLOWED_FONT_FAMILIES = [
  'Arial',
  'Helvetica Neue',
  'Georgia',
  'Verdana',
  'Courier New',
] as const;

export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// ── Core settings schema ─────────────────────────────────────────────────────

export const compositionSettingsSchema = z.object({
  projectId: z.string().uuid(),
  resolution: z.enum(ALLOWED_RESOLUTIONS),
  backgroundStyle: z.enum(ALLOWED_BACKGROUND_STYLES),
  subtitlePosition: z.enum(ALLOWED_SUBTITLE_POSITIONS),
  fontFamily: z.enum(ALLOWED_FONT_FAMILIES),
  fontSize: z.number().int().min(16).max(72),
  fontColor: z.string().regex(HEX_COLOR_RE),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

// ── getForProject ────────────────────────────────────────────────────────────

export const getCompositionSettingsInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const getCompositionSettingsOutputSchema = z.object({
  settings: compositionSettingsSchema,
});

// ── updateForProject ─────────────────────────────────────────────────────────

export const updateCompositionSettingsInputSchema = z
  .object({
    projectId: z.string().uuid(),
    resolution: z.enum(ALLOWED_RESOLUTIONS).optional(),
    backgroundStyle: z.enum(ALLOWED_BACKGROUND_STYLES).optional(),
    subtitlePosition: z.enum(ALLOWED_SUBTITLE_POSITIONS).optional(),
    fontFamily: z.enum(ALLOWED_FONT_FAMILIES).optional(),
    fontSize: z.number().int().min(16).max(72).optional(),
    fontColor: z.string().regex(HEX_COLOR_RE).optional(),
  })
  .refine(
    ({ projectId: _p, ...patch }) => Object.keys(patch).length > 0,
    { message: 'At least one settings field must be provided.' }
  );

export const updateCompositionSettingsOutputSchema = z.object({
  settings: compositionSettingsSchema,
});

// ── Types ────────────────────────────────────────────────────────────────────

export type CompositionSettings = z.infer<typeof compositionSettingsSchema>;
export type CompositionSettingsPatch = Omit<
  z.infer<typeof updateCompositionSettingsInputSchema>,
  'projectId'
>;
```

---

## IPC Handler File: `src/main/ipc/compositionHandlers.ts`

```ts
import { IPC_CHANNELS } from '@shared/ipc/channels';
import {
  getCompositionSettingsInputSchema,
  getCompositionSettingsOutputSchema,
  updateCompositionSettingsInputSchema,
  updateCompositionSettingsOutputSchema,
} from '@shared/schemas/composition';
import { registerValidatedHandler } from './createIpcHandler';
import { CompositionSettingsService } from '../services/compositionSettings/compositionSettingsService';
import type { DatabaseService } from '../services/database/databaseService';

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
```

Call `registerCompositionHandlers(db)` from `src/main/ipc/registerIpcHandlers.ts`.

---

## Preload Bridge Methods

Add to `src/preload/index.ts` in the `sceneSiftApi` object:

```ts
composition: {
  getForProject: (projectId: string) => {
    if (!UUID_RE.test(projectId))
      return Promise.reject(new TypeError('projectId must be a UUID'));
    return ipcRenderer.invoke(
      IPC_CHANNELS.COMPOSITION_GET_FOR_PROJECT,
      { projectId }
    );
  },

  updateForProject: (projectId: string, patch: Record<string, unknown>) => {
    if (!UUID_RE.test(projectId))
      return Promise.reject(new TypeError('projectId must be a UUID'));
    if (
      patch.resolution !== undefined &&
      !(ALLOWED_RESOLUTIONS as readonly string[]).includes(patch.resolution as string)
    )
      return Promise.reject(new TypeError('resolution must be 1080x1920 or 720x1280'));
    if (
      patch.backgroundStyle !== undefined &&
      !(ALLOWED_BACKGROUND_STYLES as readonly string[]).includes(patch.backgroundStyle as string)
    )
      return Promise.reject(new TypeError('backgroundStyle must be blur or crop'));
    if (
      patch.subtitlePosition !== undefined &&
      !(ALLOWED_SUBTITLE_POSITIONS as readonly string[]).includes(patch.subtitlePosition as string)
    )
      return Promise.reject(new TypeError('subtitlePosition must be bottom or center'));
    if (
      patch.fontFamily !== undefined &&
      !(ALLOWED_FONT_FAMILIES as readonly string[]).includes(patch.fontFamily as string)
    )
      return Promise.reject(new TypeError('fontFamily must be one of the allowed values'));
    if (
      patch.fontSize !== undefined &&
      (!Number.isInteger(patch.fontSize) || (patch.fontSize as number) < 16 || (patch.fontSize as number) > 72)
    )
      return Promise.reject(new TypeError('fontSize must be an integer in [16, 72]'));
    if (patch.fontColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(patch.fontColor as string))
      return Promise.reject(new TypeError('fontColor must be #RRGGBB'));
    const patchKeys = Object.keys(patch).filter(
      k => patch[k] !== undefined
    );
    if (patchKeys.length === 0)
      return Promise.reject(new TypeError('at least one settings field must be provided'));
    return ipcRenderer.invoke(
      IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT,
      { projectId, ...patch }
    );
  },
},
```

Import `ALLOWED_RESOLUTIONS`, `ALLOWED_BACKGROUND_STYLES`, `ALLOWED_SUBTITLE_POSITIONS`,
`ALLOWED_FONT_FAMILIES` from `@shared/schemas/composition` at the top of the preload file.

---

## SceneSiftApi Type Extension

In `src/shared/api/sceneSiftApi.ts`, add:

```ts
import type { CompositionSettings, CompositionSettingsPatch } from '@shared/schemas/composition';

// Inside SceneSiftApi:
composition: {
  getForProject: (projectId: string) => Promise<{ settings: CompositionSettings }>;
  updateForProject: (
    projectId: string,
    patch: CompositionSettingsPatch
  ) => Promise<{ settings: CompositionSettings }>;
};
```
