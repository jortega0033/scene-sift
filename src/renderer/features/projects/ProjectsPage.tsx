import { useMemo, useRef, useState } from 'react';
import { useDeleteProject, useProjects } from '@renderer/hooks/useProjects';
import { useUiStore } from '@renderer/stores/uiStore';
import { useFocusTrap } from '@renderer/hooks/useFocusTrap';
import { CreateProjectForm } from './CreateProjectForm';
import { StatusPill } from '@renderer/components/StatusPill';

export const ProjectsPage = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const createDialogRef = useRef<HTMLDivElement | null>(null);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  const { selectedProjectId, setSelectedProjectId } = useUiStore();
  const projects = useProjects();
  const deleteProject = useDeleteProject();

  const selectedProject = useMemo(
    () => projects.data?.find((item) => item.id === selectedProjectId) ?? null,
    [projects.data, selectedProjectId],
  );

  useFocusTrap(showCreateForm, createDialogRef, createTriggerRef, () => setShowCreateForm(false));
  useFocusTrap(deleteTarget !== null, deleteDialogRef, deleteTriggerRef, () =>
    setDeleteTarget(null),
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteProject.mutateAsync(deleteTarget);
    if (selectedProjectId === deleteTarget) {
      setSelectedProjectId(null);
    }
    setDeleteTarget(null);
  };

  return (
    <section data-testid="projects-page" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage local review projects for episode source files and subtitle tracks.
          </p>
        </div>
        <button
          ref={createTriggerRef}
          type="button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-3 text-sm font-medium text-background"
          onClick={() => setShowCreateForm((value) => !value)}
        >
          {showCreateForm ? 'Hide form' : 'Create project'}
        </button>
      </header>

      {showCreateForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create project dialog"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
        >
          <div ref={createDialogRef} className="w-full max-w-2xl">
            <CreateProjectForm
              onCreated={() => setShowCreateForm(false)}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div data-mono-surface="panel" className="min-w-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-label">Project list</h3>
          </div>
          {projects.isLoading && (
            <p className="p-4 text-sm text-muted-foreground">Loading projects…</p>
          )}
          {!projects.isLoading && (projects.data?.length ?? 0) === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No projects yet.</p>
              <p className="mt-1">
                Create your first project to start preparing clip review inputs.
              </p>
            </div>
          )}
          <ul>
            {projects.data?.map((project) => (
              <li key={project.id} data-mono-row="true">
                <button
                  type="button"
                  data-testid="project-row"
                  className={`w-full px-4 py-3 text-left text-sm ${
                    selectedProjectId === project.id ? 'bg-muted' : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.name}</p>
                      <p className="mt-1 truncate font-mono text-label text-muted-foreground">
                        {project.videoPath}
                      </p>
                    </div>
                    <StatusPill
                      label={project.status}
                      status={project.status === 'active' ? 'ok' : 'neutral'}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div data-mono-surface="panel" className="min-w-0 p-4">
          {!selectedProject && (
            <div>
              <h3 className="text-base font-semibold">Project summary</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Select a project to inspect media paths, subtitle coverage, and output readiness.
              </p>
            </div>
          )}

          {selectedProject && (
            <div className="space-y-4 text-sm">
              <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border pb-3">
                <h3 className="break-words text-lg font-semibold">{selectedProject.name}</h3>
                <StatusPill
                  label={selectedProject.status}
                  status={selectedProject.status === 'active' ? 'ok' : 'neutral'}
                />
              </div>

              <dl className="space-y-3">
                <div>
                  <dt className="text-label uppercase tracking-label text-muted-foreground">
                    Video file
                  </dt>
                  <dd className="mt-1 break-all font-mono text-mono-path">
                    {selectedProject.videoPath}
                  </dd>
                </div>
                <div>
                  <dt className="text-label uppercase tracking-label text-muted-foreground">
                    Subtitle file
                  </dt>
                  <dd className="mt-1 break-all font-mono text-mono-path">
                    {selectedProject.subtitlePath ?? 'Missing (optional for now)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-label uppercase tracking-label text-muted-foreground">
                    Output directory
                  </dt>
                  <dd className="mt-1 break-all font-mono text-mono-path">
                    {selectedProject.outputDirectory ?? 'Not set'}
                  </dd>
                </div>
              </dl>

              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Candidate generation, timeline editing, and rendering are not yet available.
              </p>

              <button
                ref={deleteTriggerRef}
                type="button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground px-3 text-sm hover:bg-muted"
                onClick={() => setDeleteTarget(selectedProject.id)}
              >
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete project confirmation"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
        >
          <div
            ref={deleteDialogRef}
            data-mono-surface="panel"
            className="w-full max-w-md p-4 text-sm"
          >
            <p className="text-base font-semibold">Delete project?</p>
            <p className="mt-2 text-muted-foreground">
              This removes the project record from local storage. Source files are not deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-3 text-background"
                onClick={() => void confirmDelete()}
              >
                Confirm delete
              </button>
              <button
                type="button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
