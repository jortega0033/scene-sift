import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CompositionSettings,
  CompositionSettingsPatch,
} from '@shared/schemas/composition';
import {
  ALLOWED_RESOLUTIONS,
  ALLOWED_BACKGROUND_STYLES,
  ALLOWED_SUBTITLE_POSITIONS,
  ALLOWED_FONT_FAMILIES,
} from '@shared/schemas/composition';

type Props = {
  projectId: string;
};

type PanelState = {
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  settings: CompositionSettings | null;
  draft: CompositionSettingsPatch;
};

const initialState: PanelState = {
  loading: true,
  loadError: null,
  saving: false,
  saveError: null,
  saveSuccess: false,
  settings: null,
  draft: {},
};

export const CompositionSettingsPanel = ({ projectId }: Props) => {
  const [state, setState] = useState<PanelState>(initialState);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, loadError: null }));
    window.sceneSift.composition
      .getForProject(projectId)
      .then(({ settings }) => {
        setState((s) => ({ ...s, loading: false, settings, draft: {} }));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setState((s) => ({ ...s, loading: false, loadError: msg }));
      });
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = Object.keys(state.draft).length > 0;

  const handleChange = (field: keyof CompositionSettingsPatch, value: unknown) => {
    setState((s) => ({ ...s, draft: { ...s.draft, [field]: value }, saveError: null }));
  };

  const handleSave = () => {
    if (!dirty) return;
    setState((s) => ({ ...s, saving: true, saveError: null }));
    window.sceneSift.composition
      .updateForProject(projectId, state.draft as Record<string, unknown>)
      .then(({ settings }) => {
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        setState((s) => ({
          ...s,
          saving: false,
          settings,
          draft: {},
          saveError: null,
          saveSuccess: true,
        }));
        successTimerRef.current = setTimeout(() => {
          setState((s) => ({ ...s, saveSuccess: false }));
        }, 2000);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to save settings.';
        setState((s) => ({ ...s, saving: false, saveError: msg }));
      });
  };

  const current = state.settings;
  const getValue = <K extends keyof CompositionSettings>(field: K): CompositionSettings[K] | undefined => {
    if (field in state.draft) return (state.draft as Record<string, unknown>)[field] as CompositionSettings[K];
    return current?.[field];
  };

  return (
    <details className="border border-border rounded-md">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium select-none">
        Composition Settings
      </summary>
      <div className="px-4 pb-4 pt-2">
        {state.loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {state.loadError && (
          <div role="alert" className="text-sm text-destructive">
            <p>Failed to load composition settings.</p>
            <button
              type="button"
              onClick={load}
              className="underline mt-1"
            >
              Retry
            </button>
          </div>
        )}

        {!state.loading && !state.loadError && current && (
          <fieldset disabled={state.saving} className="space-y-3">
            <legend className="sr-only">Composition Settings</legend>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cs-resolution" className="block text-xs font-medium mb-1">
                  Resolution
                </label>
                <select
                  id="cs-resolution"
                  value={getValue('resolution')}
                  onChange={(e) => handleChange('resolution', e.target.value)}
                  className="w-full text-sm border border-input rounded px-2 py-1 bg-background"
                >
                  {ALLOWED_RESOLUTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cs-background" className="block text-xs font-medium mb-1">
                  Background style
                </label>
                <select
                  id="cs-background"
                  value={getValue('backgroundStyle')}
                  onChange={(e) => handleChange('backgroundStyle', e.target.value)}
                  className="w-full text-sm border border-input rounded px-2 py-1 bg-background"
                >
                  {ALLOWED_BACKGROUND_STYLES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cs-position" className="block text-xs font-medium mb-1">
                  Subtitle position
                </label>
                <select
                  id="cs-position"
                  value={getValue('subtitlePosition')}
                  onChange={(e) => handleChange('subtitlePosition', e.target.value)}
                  className="w-full text-sm border border-input rounded px-2 py-1 bg-background"
                >
                  {ALLOWED_SUBTITLE_POSITIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cs-font-family" className="block text-xs font-medium mb-1">
                  Font family
                </label>
                <select
                  id="cs-font-family"
                  value={getValue('fontFamily')}
                  onChange={(e) => handleChange('fontFamily', e.target.value)}
                  className="w-full text-sm border border-input rounded px-2 py-1 bg-background"
                >
                  {ALLOWED_FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cs-font-size" className="block text-xs font-medium mb-1">
                  Font size (px)
                </label>
                <input
                  id="cs-font-size"
                  type="number"
                  min={16}
                  max={72}
                  step={1}
                  value={getValue('fontSize') ?? 32}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) handleChange('fontSize', v);
                  }}
                  className="w-full text-sm border border-input rounded px-2 py-1 bg-background"
                />
              </div>

              <div>
                <label htmlFor="cs-font-color" className="block text-xs font-medium mb-1">
                  Font color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="cs-font-color"
                    type="text"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    value={getValue('fontColor') ?? '#FFFFFF'}
                    onChange={(e) => handleChange('fontColor', e.target.value)}
                    className="w-full text-sm border border-input rounded px-2 py-1 bg-background font-mono"
                    maxLength={7}
                  />
                  <span
                    className="w-6 h-6 rounded border border-border flex-shrink-0"
                    style={{ backgroundColor: getValue('fontColor') ?? '#FFFFFF' }}
                  />
                </div>
              </div>
            </div>

            {state.saveError && (
              <div role="alert" className="text-sm text-destructive">
                Failed to save settings. Please try again.
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || state.saving}
                aria-busy={state.saving}
                className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
              >
                {state.saving ? 'Saving…' : 'Save'}
              </button>
              {state.saveSuccess && (
                <span
                  role="status"
                  aria-live="polite"
                  className="text-sm text-green-600"
                >
                  Settings saved.
                </span>
              )}
            </div>
          </fieldset>
        )}
      </div>
    </details>
  );
};
