import { QueryClient } from "@tanstack/react-query";

/** One client for the renderer; failures are surfaced, never retried into silence. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
