export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api';

export const API_ENDPOINTS = {
  SYSTEM: {
    PUBLIC_FEATURE_FLAGS: `${API_BASE_URL}/system/public-feature-flags`,
  },
} as const;
