import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const cuesKey = (candidateId: string) => ['clip-cues', candidateId] as const;

export const useClipCues = (candidateId: string | null) =>
  useQuery({
    queryKey: cuesKey(candidateId ?? ''),
    queryFn: () => window.sceneSift.ai.listClipCues(candidateId!),
    enabled: candidateId !== null,
  });

export const useGenerateClipCues = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: string) =>
      window.sceneSift.ai.generateClipCues(candidateId),
    onSuccess: async (_data, candidateId) => {
      await queryClient.invalidateQueries({ queryKey: cuesKey(candidateId) });
    },
  });
};

export const useUpdateClipCue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cueId,
      startMs,
      endMs,
      text,
    }: {
      cueId: string;
      candidateId: string;
      startMs: number;
      endMs: number;
      text: string;
    }) => window.sceneSift.ai.updateClipCue(cueId, startMs, endMs, text),
    onSuccess: async (_data, { candidateId }) => {
      await queryClient.invalidateQueries({ queryKey: cuesKey(candidateId) });
    },
  });
};

export const useDeleteClipCue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cueId }: { cueId: string; candidateId: string }) =>
      window.sceneSift.ai.deleteClipCue(cueId),
    onSuccess: async (_data, { candidateId }) => {
      await queryClient.invalidateQueries({ queryKey: cuesKey(candidateId) });
    },
  });
};

export const useAddClipCue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      candidateId,
      startMs,
      endMs,
      text,
    }: {
      candidateId: string;
      startMs: number;
      endMs: number;
      text: string;
    }) => window.sceneSift.ai.addClipCue(candidateId, startMs, endMs, text),
    onSuccess: async (_data, { candidateId }) => {
      await queryClient.invalidateQueries({ queryKey: cuesKey(candidateId) });
    },
  });
};
