// Custom webpack config for the Nest CLI builder.
//
// The `@age/*` workspace packages are published as TypeScript *source*
// (`main` -> `src/index.ts`, `type: module`, bundler-style extensionless
// imports). They are designed to be consumed by a bundler, not by Node's
// native ESM resolver — which cannot resolve extensionless / directory imports
// and would fail at runtime (ERR_MODULE_NOT_FOUND).
//
// The API is the first real Node runtime consumer of these packages, so it
// consumes them the way they were designed for: bundled. We keep every other
// dependency external (standard for a Node server) and only allow the `@age/*`
// sources to be pulled into the bundle, where ts-loader transpiles them with
// the API's compiler options (decorators + emitDecoratorMetadata intact).
//
// Type-checking is intentionally NOT done here — it is covered by
// `pnpm --filter @age/api typecheck` and CI. The bundler only transpiles, so
// `@age/*` sources (which live outside the API's `rootDir`) don't trip the
// project's rootDir/program checks.
const nodeExternals = require('webpack-node-externals');

module.exports = (options) => ({
  ...options,
  externals: [
    nodeExternals({
      // Bundle @age/* source packages; keep everything else external.
      allowlist: [/^@age\//],
    }),
  ],
  module: {
    ...options.module,
    rules: options.module.rules.map((rule) => {
      // Reconfigure the default ts-loader rule to transpile-only so bundled
      // `@age/*` files (outside the API rootDir) are compiled per-file without
      // whole-program rootDir enforcement.
      if (rule && String(rule.test) === String(/.tsx?$/)) {
        return {
          test: rule.test,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                onlyCompileBundledFiles: true,
                configFile: 'tsconfig.json',
                compilerOptions: { rootDir: undefined },
              },
            },
          ],
          exclude: /node_modules(?![\\/]@age[\\/])/,
        };
      }
      return rule;
    }),
  },
  // Drop ForkTsCheckerWebpackPlugin: type-checking is handled by the dedicated
  // `typecheck` script / CI, and it would otherwise fail on bundled `@age/*`
  // files that sit outside the API's rootDir.
  plugins: (options.plugins ?? []).filter(
    (plugin) =>
      plugin && plugin.constructor && plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin',
  ),
});
