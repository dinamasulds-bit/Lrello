import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { nextRuntime, isServer }) => {
    // cssnano-simple loads caniuse-lite (583 files) via synchronous require() during CSS
    // optimization. On iCloud-managed volumes, file provider intercepts cause ETIMEDOUT.
    // Tailwind 4 already purges/minifies CSS sufficiently; skip the CssMinimizerPlugin.
    if (!isServer && !nextRuntime) {
      config.optimization = {
        ...config.optimization,
        minimizer: (config.optimization.minimizer ?? []).filter(
          (plugin: { constructor?: { name?: string } }) =>
            !((plugin?.constructor?.name ?? "").includes("Css")),
        ),
      };
    }

    if (nextRuntime === "edge") {
      // Use Cloudflare Workers build of postgres.js (uses cloudflare:sockets)
      config.resolve.conditionNames = [
        "workerd",
        ...(config.resolve.conditionNames ?? []).filter((c: string) => c !== "node"),
      ];

      // Mark cloudflare: and node: modules as external ESM imports.
      // next build won't try to bundle them; @cloudflare/next-on-pages esbuild
      // transformation handles them correctly at build time, and CF Workers
      // (with nodejs_compat) provides node:* at runtime.
      const prevExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];

      config.externals = [
        ...prevExternals,
        (
          { request }: { request: string },
          callback: (err?: null, result?: unknown) => void,
        ) => {
          if (request.startsWith("cloudflare:") || request.startsWith("node:")) {
            return callback(null, { type: "module", value: request });
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
