import { create } from 'zustand';

export type AppRoute = 'projects' | 'queue' | 'settings' | 'preview' | 'transcript';

type UiState = {
  route: AppRoute;
  selectedProjectId: string | null;
  setRoute: (route: AppRoute) => void;
  setSelectedProjectId: (projectId: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  route: 'projects',
  selectedProjectId: null,
  setRoute: (route) => set({ route }),
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
}));
