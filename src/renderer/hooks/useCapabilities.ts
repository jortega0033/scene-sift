import { useQuery } from '@tanstack/react-query';

export const useCapabilities = () =>
  useQuery({
    queryKey: ['capabilities'],
    queryFn: () => window.sceneSift.system.getCapabilities(),
    staleTime: 15_000,
  });
