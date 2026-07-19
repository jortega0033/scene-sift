import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppSettings } from '@shared/schemas/settings';

export const useSettings = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: () => window.sceneSift.settings.get(),
  });

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AppSettings>) => window.sceneSift.settings.update(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
  });
};
