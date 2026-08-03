/**
 * ⚠️ `apps/studio` is deliberately NOT `apps/web`.
 *
 * `apps/web` is the Doc 07 product surface: it has a Dockerfile, serves `/demo`
 * and binds `0.0.0.0`. Console routes inside it would either be reachable
 * wherever web deploys — violating OX-INV-1 (ADR-0057 D2) — or would make the
 * demo undeployable. D2 admits no flag and no degraded mode, so the console is
 * its own app that binds `127.0.0.1`. `OX_02` §6's "reuse `apps/web`" meant the
 * stack, not the app.
 *
 * 🚫 There is no Dockerfile here, and there must not be one: a published
 * container port in front of a loopback listener defeats the whole invariant.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@age/studio-shell'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
