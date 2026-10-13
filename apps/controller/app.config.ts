import type { ConfigContext, ExpoConfig } from "expo/config";

// The web export is served from a subpath on GitHub Pages. Only the export sets EXPO_BASE_URL, so native builds
// and `expo start --web` stay at the root.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Acemate Drive",
  slug: config.slug ?? "acemate-controller",
  web: { ...config.web, output: "single", bundler: "metro" },
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL },
});
