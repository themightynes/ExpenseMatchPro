// Feature flags configuration
export const features = {
  // Enable inline PDF viewer instead of "Open in new tab" only
  inlinePdfViewer: true,
} as const;

export type FeatureFlags = typeof features;