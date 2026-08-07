// The MCP server's bundle, and why a bundle is the only thing that can work.
//
// `bin` points at a file an MCP client has to execute directly, and `tsc` alone
// can never produce one: the `@age/*` workspace packages are published as
// TypeScript *source* (`main` -> `src/index.ts`, `type: module`, bundler-style
// extensionless imports), which Node's native ESM resolver cannot resolve at
// all. This config deliberately copies `apps/capture/webpack.config.cjs` — which
// itself copies `apps/api` — rather than introducing a third toolchain.
//
// ⚠️ WHAT THIS BUNDLE DOES *NOT* CONTAIN, AND WHY THE BUILD ASSERTS IT.
// `apps/capture` bundles a lazily loaded Prisma chunk on purpose. This app has
// no database at all: `@prisma/client` is not a dependency, no MCP exemption to
// ADR-0055 D6 exists, and a Prisma construction appearing here would mean the
// MCP surface had quietly grown a persistence path. `scripts/bundle.mjs` fails
// the build on it, and on any listener API, because a server that binds a port
// is a different product from the one ADR-0060 D8 authorized.
//
// WHY CommonJS OUTPUT. The package is `type: module`, so a `.js` file here
// would be treated as ESM.
//
// NOT TYPE-CHECKED HERE. `ts-loader` runs `transpileOnly`; types are the
// dedicated `typecheck` script's job and CI's, exactly as in the capture CLI.
const { join } = require('node:path');

const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

const here = __dirname;

module.exports = {
  // `none`, not `production`: a minified stack is not a diagnostic, and stderr
  // is the only channel this server has for one.
  mode: 'none',
  target: 'node',
  entry: join(here, 'src', 'main.ts'),
  devtool: 'source-map',
  externals: [
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
  },
  resolve: { extensions: ['.ts', '.js'] },
  output: {
    path: join(here, 'dist', 'bin'),
    filename: 'age-mcp.cjs',
    chunkFilename: '[name].chunk.cjs',
    chunkFormat: 'commonjs',
    chunkLoading: 'require',
  },
  plugins: [
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true, entryOnly: true }),
  ],
};
