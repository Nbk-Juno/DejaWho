import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ApiSearchResponse } from "@shared/schema";

// The one /api/search mutation, shared by the home Voice Button, the standalone Search page,
// and onboarding's "ask" step. The request lives here; each surface supplies its own onSuccess
// (home plays TTS + marks done, search just lists, onboarding plays + lets the user continue)
// and onError, so search behavior changes in one place.
export function useSearchEncounters(options: {
  onSuccess?: (data: ApiSearchResponse) => void;
  onError?: (error: Error) => void;
} = {}) {
  return useMutation<ApiSearchResponse, Error, string>({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/search", { query });
      return (await res.json()) as ApiSearchResponse;
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
}
