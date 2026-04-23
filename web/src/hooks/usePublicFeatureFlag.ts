import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/api';

type UsePublicFeatureFlagResult = {
  enabled: boolean;
  loading: boolean;
  error: string | null;
};

type UsePublicFeatureFlagOptions = {
  /**
   * Value returned when the flag is still loading, not in the public allowlist
   * (403), or doesn't exist (404). Defaults to false.
   */
  defaultValue?: boolean;
};

/**
 * Hook for fetching public feature flags (no authentication required)
 * Use this on unauthenticated pages like Login and /boutique.
 */
export function usePublicFeatureFlag(
  name: string,
  options: UsePublicFeatureFlagOptions = {}
): UsePublicFeatureFlagResult {
  const { defaultValue = false } = options;

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicFeatureFlag', name],
    queryFn: async () => {
      const res = await fetch(`${API_ENDPOINTS.SYSTEM.PUBLIC_FEATURE_FLAGS}/${encodeURIComponent(name)}`);
      if (res.status === 403 || res.status === 404) {
        // Flag not in the public allowlist or not yet seeded — fall back to default.
        return defaultValue;
      }
      if (!res.ok) {
        throw new Error(`Failed to load flag ${name}: ${res.status}`);
      }
      const json = await res.json();
      return Boolean(json?.flag?.enabled);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    enabled: data ?? defaultValue,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
  };
}
