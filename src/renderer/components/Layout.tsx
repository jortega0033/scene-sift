import { Film, ListChecks, PlayCircle, Settings2, FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCapabilities } from '@renderer/hooks/useCapabilities';
import { useUiStore, type AppRoute } from '@renderer/stores/uiStore';
import { StatusPill } from './StatusPill';
import { cn } from '@renderer/lib/cn';

type LayoutProps = {
  children: ReactNode;
};

const navItems: Array<{
  route: AppRoute;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { route: 'projects', label: 'Projects', icon: Film },
  { route: 'queue', label: 'Queue', icon: ListChecks },
  { route: 'preview', label: 'Preview', icon: PlayCircle },
  { route: 'transcript', label: 'Transcript', icon: FileText },
  { route: 'settings', label: 'Settings', icon: Settings2 },
];

export const Layout = ({ children }: LayoutProps) => {
  const { route, setRoute } = useUiStore();
  const { data } = useCapabilities();

  return (
    <div
      data-testid="app-shell"
      className="grid min-h-screen [grid-template-columns:var(--sidebar-width)_minmax(0,1fr)] bg-background text-foreground"
    >
      <aside className="border-r border-border bg-card px-4 py-5">
        <div className="mb-6">
          <h1 className="text-lg font-semibold uppercase tracking-brand">SceneSift</h1>
          <p className="mt-1 text-xs text-muted-foreground">Desktop clip workflow foundation</p>
        </div>
        <nav data-testid="primary-navigation" aria-label="Primary navigation" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.route === route;
            return (
              <button
                key={item.route}
                type="button"
                className={cn(
                  'flex h-[var(--control-height)] w-full items-center gap-3 rounded-[var(--radius-sm)] border px-3 text-left text-sm',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
                onClick={() => setRoute(item.route)}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div
          data-testid="system-status"
          className="mt-6 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground"
        >
          <p className="mb-2 text-label uppercase tracking-heading">System status</p>
          <div className="flex items-center justify-between gap-2">
            <span>FFmpeg</span>
            <StatusPill
              label={data?.ffmpeg.ffmpegAvailable ? 'Available' : 'Missing'}
              status={data?.ffmpeg.ffmpegAvailable ? 'ok' : 'warning'}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>FFprobe</span>
            <StatusPill
              label={data?.ffmpeg.ffprobeAvailable ? 'Available' : 'Missing'}
              status={data?.ffmpeg.ffprobeAvailable ? 'ok' : 'warning'}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>DB</span>
            <StatusPill
              label={data?.database.ok ? 'Healthy' : 'Unavailable'}
              status={data?.database.ok ? 'ok' : 'warning'}
            />
          </div>
        </div>
      </aside>

      <main className="min-w-0 p-5 md:p-6">
        <div className="mx-auto w-full max-w-[var(--layout-content-max)]">{children}</div>
      </main>
    </div>
  );
};
