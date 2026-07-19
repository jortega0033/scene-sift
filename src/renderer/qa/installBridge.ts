import type { SceneSiftApi } from '@shared/api/sceneSiftApi';
import { createMockSceneSiftApi } from './mockSceneSiftApi';

const qaModeEnabled = (): boolean => import.meta.env.VITE_SCENESIFT_BROWSER_QA === '1';

export const ensureSceneSiftBridge = (): SceneSiftApi => {
  if (window.sceneSift) {
    return window.sceneSift;
  }

  if (qaModeEnabled()) {
    const mock = createMockSceneSiftApi();
    window.sceneSift = mock;
    return mock;
  }

  throw new Error(
    'SceneSift preload API is unavailable. Start in Electron or enable explicit browser QA mode.',
  );
};
