import { describe, it, expect } from 'vitest';
import {
  compositionSettingsSchema,
  getCompositionSettingsInputSchema,
  updateCompositionSettingsInputSchema,
} from '@shared/schemas/composition';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const NOW = 1_000_000;

const validSettings = {
  projectId: VALID_UUID,
  resolution: '1080x1920' as const,
  backgroundStyle: 'blur' as const,
  subtitlePosition: 'bottom' as const,
  fontFamily: 'Arial' as const,
  fontSize: 32,
  fontColor: '#FFFFFF',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('compositionSettingsSchema', () => {
  it('accepts valid settings', () => {
    expect(compositionSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it('rejects invalid resolution', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, resolution: '4K' }).success,
    ).toBe(false);
  });

  it('rejects invalid backgroundStyle', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, backgroundStyle: 'solid' }).success,
    ).toBe(false);
  });

  it('rejects invalid subtitlePosition', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, subtitlePosition: 'top' }).success,
    ).toBe(false);
  });

  it('rejects invalid fontFamily', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, fontFamily: 'Comic Sans' }).success,
    ).toBe(false);
  });

  it('rejects fontSize below 16', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, fontSize: 15 }).success,
    ).toBe(false);
  });

  it('rejects fontSize above 72', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, fontSize: 73 }).success,
    ).toBe(false);
  });

  it('accepts boundary fontSize values 16 and 72', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, fontSize: 16 }).success,
    ).toBe(true);
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, fontSize: 72 }).success,
    ).toBe(true);
  });

  it('rejects fontColor without # prefix', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, fontColor: 'FFFFFF' }).success,
    ).toBe(false);
  });

  it('rejects fontColor with 3-digit shorthand', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, fontColor: '#FFF' }).success,
    ).toBe(false);
  });

  it('accepts lowercase hex in fontColor', () => {
    expect(
      compositionSettingsSchema.safeParse({ ...validSettings, fontColor: '#aabbcc' }).success,
    ).toBe(true);
  });
});

describe('getCompositionSettingsInputSchema', () => {
  it('accepts valid uuid', () => {
    expect(getCompositionSettingsInputSchema.safeParse({ projectId: VALID_UUID }).success).toBe(true);
  });

  it('rejects non-uuid', () => {
    expect(getCompositionSettingsInputSchema.safeParse({ projectId: 'bad' }).success).toBe(false);
  });
});

describe('updateCompositionSettingsInputSchema', () => {
  it('accepts partial patch with single field', () => {
    expect(
      updateCompositionSettingsInputSchema.safeParse({ projectId: VALID_UUID, fontSize: 48 }).success,
    ).toBe(true);
  });

  it('rejects patch with only projectId (no settings fields)', () => {
    expect(
      updateCompositionSettingsInputSchema.safeParse({ projectId: VALID_UUID }).success,
    ).toBe(false);
  });

  it('rejects invalid resolution in patch', () => {
    expect(
      updateCompositionSettingsInputSchema.safeParse({
        projectId: VALID_UUID,
        resolution: 'bad',
      }).success,
    ).toBe(false);
  });

  it('accepts all valid fields together', () => {
    expect(
      updateCompositionSettingsInputSchema.safeParse({
        projectId: VALID_UUID,
        resolution: '720x1280',
        backgroundStyle: 'crop',
        subtitlePosition: 'center',
        fontFamily: 'Georgia',
        fontSize: 24,
        fontColor: '#000000',
      }).success,
    ).toBe(true);
  });

  it('rejects non-uuid projectId', () => {
    expect(
      updateCompositionSettingsInputSchema.safeParse({ projectId: 'not-uuid', fontSize: 32 }).success,
    ).toBe(false);
  });
});
