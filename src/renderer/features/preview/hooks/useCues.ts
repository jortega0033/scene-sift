import { useQuery } from '@tanstack/react-query';

export const useCues = (projectId: string | null) =>
  useQuery({
    queryKey: ['cues', projectId],
    queryFn: () => window.sceneSift.video.getCues(projectId!),
    enabled: projectId !== null,
  });
