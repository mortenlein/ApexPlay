import { QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

// Use cache() to ensure the same QueryClient is reused within a single request
export const getQueryClient = cache(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
}));
