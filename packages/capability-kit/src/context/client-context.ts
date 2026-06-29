/**
 * ClientContext — the scoping context passed to every capability invocation.
 *
 * Capabilities never load the Client aggregate (ADR-0009). They receive a
 * ClientContext with the clientId and organizationId needed for RLS and
 * data scoping. This is the only Client-related concept capabilities need.
 */
export class ClientContext {
  constructor(
    readonly clientId: string,
    readonly organizationId: string,
  ) {}
}
