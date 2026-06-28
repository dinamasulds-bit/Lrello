import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // cssnano-simple loads caniuse-lite (583 files) via synchronous require() during CSS
    // optimization. On iCloud-managed volumes, file provider intercepts cause ETIMEDOUT.
    // Tailwind 4 already purges/minifies CSS sufficiently; skip the CssMinimizerPlugin.
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        minimizer: (config.optimization.minimizer ?? []).filter(
          (plugin: { constructor?: { name?: string } }) =>
            !((plugin?.constructor?.name ?? "").includes("Css")),
        ),
      };
    }
    return config;
  },
};

export default nextConfig;
