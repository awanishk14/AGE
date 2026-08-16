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
 * ⚠️ **THIS FILE USED TO SAY "THERE IS NO DOCKERFILE HERE, AND THERE MUST NOT
 * BE ONE". ADR-0076 D1/D2 CHANGED THAT, AND THE REASON IS RECORDED RATHER THAN
 * ERASED.** The refusal's actual argument was that "a published container port
 * in front of a loopback listener defeats the whole invariant" — and it still
 * is — so the container the Product Owner asked for publishes its port on
 * `127.0.0.1:3100` and nowhere else (D3 as amended by §0.4b). The boundary is
 * therefore the SAME host loopback OX-INV-1 has always required; what the
 * container changed is outbound reach, which is what the owner asked for.
 *
 * 🛑 So the Dockerfile is permitted, and `apps/studio` binds `0.0.0.0` only
 * inside that namespace, only via `start:container`, and only while that
 * publication stays loopback-confined. A guard in
 * `packages/studio-shell/src/studio-bind-configuration.spec.ts` asserts the
 * exact mapping, because `3100:3100` is public and looks almost identical.
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
