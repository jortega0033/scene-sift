import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useQueue = () =>
  useQuery({
    queryKey: ['queue'],
    queryFn: () => window.sceneSift.queue.list(),
  });

export const useCreateDemoJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => window.sceneSift.queue.createDemoJob(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
};
