// The capture CLI's bundle, and why a bundle is the only thing that can work.
//
// `bin` points at a file Node has to execute directly, and `tsc` alone can
// never produce one: the `@age/*` workspace packages are published as
// TypeScript *source* (`main` -> `src/index.ts`, `type: module`,
// bundler-style extensionless imports), which Node's native ESM resolver
// cannot resolve at all. `node dist/main.js` failed with ERR_MODULE_NOT_FOUND
// from the CLI's very first commit — it was not merely uninvoked, it was
// unrunnable (ADR-0046 D3 gap G3).
//
// This is the same problem `apps/api/webpack.config.js` solves and says so in
// its own header; this config deliberately copies that precedent rather than
// introducing a second toolchain. The webpack Node API is driven from
// `scripts/bundle.mjs`, so no `webpack-cli` dependency is needed.
//
// WHAT STAYS EXTERNAL. Everything in `node_modules` except `@age/*` — the
// standard shape for a Node program, and it is what keeps `@prisma/client`
// out of the bundle. That matters beyond size: `@prisma/client` throws unless
// `prisma generate` has been run, and bundling it would make `--mode
// produceOnly` depend on a generated client it never uses.
//
// WHY CommonJS OUTPUT. The package is `type: module`, so a `.js` file here
// would be treated as ESM. Emitting `.cjs` lets webpack's lazy chunk loading
// work through plain `require`, which is what keeps the dynamic
// `import('./capture-composition')` genuinely lazy — `produceOnly` must not
// load the composition root, and therefore must not construct a
// `PrismaClient` (ADR-0043 D6, ADR-0046 D7).
//
// OUTPUT LIVES IN `dist/bin/`, not `dist/`, so it cannot collide with the
// `tsc` emit that `build` still produces for type consumers.
//
// NOT TYPE-CHECKED HERE. `ts-loader` runs `transpileOnly`; types are the
// dedicated `typecheck` script's job and CI's, exactly as in the API. Whole-
// program checking would fail on `@age/*` sources that sit outside this app's
// `rootDir`.
const { join } = require('node:path');

const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

const here = __dirname;

module.exports = {
  // `none`, not `production`: this is a CLI whose unexpected-throw path prints
  // `error.stack`, and a minified stack is not a diagnostic.
  mode: 'none',
  target: 'node',
  entry: join(here, 'src', 'main.ts'),
  devtool: 'source-map',
  externals: [
    // Both module directories: pnpm keeps this app's dependencies in its own
    // `node_modules` and hoists the rest to the workspace root.
    nodeExternals({ allowlist: [/^@age\//] }),
    nodeExternals({
      modulesDir: join(here, '..', '..', 'node_modules'),
      allowlist: [/^@age\//],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            onlyCompileBundledFiles: true,
            configFile: join(here, 'tsconfig.json'),
            compilerOptions: { rootDir: undefined, module: 'esnext', noEmit: false },
          },
        },
      },
    ],
    // `@prisma/client` is external, but the dynamic import that reaches it must
    // still be understood as a split point rather than inlined.
    parser: { javascript: { dynamicImportMode: 'lazy' } },
  },
  resolve: { extensions: ['.ts', '.js'] },
  output: {
    path: join(here, 'dist', 'bin'),
    filename: 'age-capture.cjs',
    chunkFilename: '[name].chunk.cjs',
    chunkFormat: 'commonjs',
    chunkLoading: 'require',
  },
  plugins: [
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true, entryOnly: true }),
  ],
};
