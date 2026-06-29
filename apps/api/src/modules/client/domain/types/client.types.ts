export enum ClientLifecycleState {
  Created = 'Created',
  Onboarding = 'Onboarding',
  Active = 'Active',
  Paused = 'Paused',
  Offboarding = 'Offboarding',
  Archived = 'Archived',
}

export interface ClientProps {
  organizationId: import('@age/shared').OrganizationId;
  lifecycle: ClientLifecycleState;
  name: string;
  slug: string;
}

export interface CreateClientProps {
  id: import('@age/shared').ClientId;
  organizationId: import('@age/shared').OrganizationId;
  name: string;
  slug: string;
}
