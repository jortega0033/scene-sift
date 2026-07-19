import type { SceneSiftApi } from '@shared/api/sceneSiftApi';

declare global {
  interface Window {
    sceneSift: SceneSiftApi;
  }
}

export {};
