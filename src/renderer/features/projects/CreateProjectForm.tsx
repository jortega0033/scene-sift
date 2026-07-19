import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  selectedDirectorySchema,
  selectedSubtitleSchema,
  selectedVideoSchema,
} from '@shared/schemas/project';
import { useCreateProject } from '@renderer/hooks/useProjects';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.'),
  video: selectedVideoSchema,
  subtitle: selectedSubtitleSchema.optional(),
  outputDirectory: selectedDirectorySchema.optional(),
});

type FormValues = z.infer<typeof formSchema>;

type CreateProjectFormProps = {
  onCreated?: () => void;
  onCancel?: () => void;
};

export const CreateProjectForm = ({ onCreated, onCancel }: CreateProjectFormProps) => {
  const createProject = useCreateProject();
  const {
    register,
    setValue,
    watch,
    clearErrors,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      subtitle: undefined,
      outputDirectory: undefined,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await createProject.mutateAsync({
      name: values.name.trim(),
      video: values.video,
      subtitle: values.subtitle,
      outputDirectory: values.outputDirectory,
    });
    onCreated?.();
  });

  const pickVideo = async () => {
    const result = await window.sceneSift.dialog.selectVideoFile();
    if (result) {
      setValue('video', result, { shouldValidate: true });
      clearErrors('video');
    }
  };

  const pickSubtitle = async () => {
    const result = await window.sceneSift.dialog.selectSubtitleFile();
    if (result) {
      setValue('subtitle', result, { shouldValidate: true });
      clearErrors('subtitle');
    }
  };

  const pickOutputDirectory = async () => {
    const result = await window.sceneSift.dialog.selectOutputDirectory();
    if (result) {
      setValue('outputDirectory', result, { shouldValidate: true });
      clearErrors('outputDirectory');
    }
  };

  const watchedVideo = watch('video');
  const watchedSubtitle = watch('subtitle');
  const watchedOutputDirectory = watch('outputDirectory');

  return (
    <form
      data-testid="project-editor-dialog"
      data-mono-surface="panel"
      className="space-y-4 p-4"
      onSubmit={onSubmit}
    >
      <div className="space-y-1 border-b border-border pb-3">
        <h3 className="text-base font-semibold text-foreground">Create project</h3>
        <p className="text-xs text-muted-foreground">
          Provide source media and optional subtitle/output paths. SceneSift stores references
          locally.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-label uppercase tracking-label text-muted-foreground">
          Project name <span className="text-foreground">*</span>
        </span>
        <input
          {...register('name')}
          aria-required="true"
          className="h-[var(--control-height)] w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm"
          placeholder="e.g. Season 2, Episode 4"
        />
      </label>
      {errors.name && (
        <p role="alert" className="text-xs text-foreground">
          {errors.name.message}
        </p>
      )}

      <div>
        <button
          type="button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm hover:bg-muted"
          onClick={() => void pickVideo()}
        >
          Select video file
        </button>
        <p className="mt-1 break-all font-mono text-label text-muted-foreground">
          {watchedVideo?.path ?? 'No file selected.'}
        </p>
        {errors.video && (
          <p role="alert" className="text-xs text-foreground">
            {errors.video.message as string}
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm hover:bg-muted"
          onClick={() => void pickSubtitle()}
        >
          Select subtitle file (optional)
        </button>
        <p className="mt-1 break-all font-mono text-label text-muted-foreground">
          {watchedSubtitle?.path ?? 'No subtitle selected.'}
        </p>
        {errors.subtitle && (
          <p role="alert" className="text-xs text-foreground">
            {errors.subtitle.message as string}
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm hover:bg-muted"
          onClick={() => void pickOutputDirectory()}
        >
          Select output directory (optional)
        </button>
        <p className="mt-1 break-all font-mono text-label text-muted-foreground">
          {watchedOutputDirectory?.path ?? 'No output directory selected.'}
        </p>
        {errors.outputDirectory && (
          <p role="alert" className="text-xs text-foreground">
            {errors.outputDirectory.message as string}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="submit"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50"
          disabled={createProject.isPending}
        >
          {createProject.isPending ? 'Saving…' : 'Save project'}
        </button>
        <button
          type="button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      {createProject.error && (
        <p role="alert" className="text-xs text-foreground">
          {createProject.error instanceof Error
            ? createProject.error.message
            : 'Unable to create project. Check selected files and try again.'}
        </p>
      )}
    </form>
  );
};
