import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useCandidates = (projectId: string | null) =>
  useQuery({
    queryKey: ['candidates', projectId],
    queryFn: () => window.sceneSift.ai.listCandidates(projectId!),
    enabled: projectId !== null,
  });

export const useGenerateCandidates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => window.sceneSift.ai.generateCandidates(projectId),
    onSuccess: async (_data, projectId) => {
      await queryClient.invalidateQueries({ queryKey: ['candidates', projectId] });
    },
  });
};

export const useCancelGeneration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => window.sceneSift.ai.cancelGeneration(projectId),
    onSuccess: async (_data, projectId) => {
      await queryClient.invalidateQueries({ queryKey: ['candidates', projectId] });
    },
  });
};

export const useUpdateCandidateStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, status }: { candidateId: string; projectId: string; status: 'approved' | 'rejected' }) =>
      window.sceneSift.ai.updateCandidateStatus(candidateId, status),
    onSuccess: async (_data, { projectId }) => {
      await queryClient.invalidateQueries({ queryKey: ['candidates', projectId] });
    },
  });
};
