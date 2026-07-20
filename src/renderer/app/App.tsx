import { useEffect } from 'react';
import { Layout } from '@renderer/components/Layout';
import { ProjectsPage } from '@renderer/features/projects/ProjectsPage';
import { QueuePage } from '@renderer/features/queue/QueuePage';
import { SettingsPage } from '@renderer/features/settings/SettingsPage';
import { PreviewPage } from '@renderer/features/preview/PreviewPage';
import { useSettings } from '@renderer/hooks/useSettings';
import { useUiStore, type AppRoute } from '@renderer/stores/uiStore';

const renderRoute = (route: AppRoute) => {
  switch (route) {
    case 'projects':
      return <ProjectsPage />;
    case 'queue':
      return <QueuePage />;
    case 'settings':
      return <SettingsPage />;
    case 'preview':
      return <PreviewPage />;
    default:
      return <ProjectsPage />;
  }
};

export const App = () => {
  const route = useUiStore((state) => state.route);
  const settings = useSettings();

  useEffect(() => {
    const theme = settings.data?.preferredTheme ?? 'system';
    const shouldUseDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', shouldUseDark);
  }, [settings.data?.preferredTheme]);

  return <Layout>{renderRoute(route)}</Layout>;
};
