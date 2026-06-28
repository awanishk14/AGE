# AGE Product Bible

## Purpose

The **Product Bible** is the **functional specification** for AGE.

- The **architecture documents** explain **HOW** AGE is built (layers, packages, dependencies, data flow).
- The **Product Bible** explains **WHAT** AGE does (journeys, models, behavior).

It is the single document every contributor reads before building a feature, so product intent stays
consistent and is never re-invented per task.

## Ownership

This documentation is the single source of truth for:

- Product
- UX
- AI
- Business Logic
- Workflows
- Permissions
- Reporting
- Automation

## Editing Rules

- **Architecture documents** define system design.
- **The Product Bible** defines product behavior.
- **Implementation must follow both.**
- **Changes must not contradict the ADRs** (`docs/adrs/`). If a product need conflicts with the
  frozen architecture, raise an ADR first — do not change architecture here.
- Record decisions, not speculation. Leave unresolved items as `TODO: To be completed during Product Design.`

## Versioning

| Field        | Value    |
| ------------ | -------- |
| Version      | _TODO_   |
| Author       | _TODO_   |
| Reviewer     | _TODO_   |
| Status       | 🟡 Draft |
| Last Updated | _TODO_   |

Each document carries its own **Status** (🟡 Draft → 🔵 In Review → 🟢 Approved). Only **Approved**
content is binding for implementation.

## Cross References

These are referenced for context and **must not be changed** by Product Bible edits:

- [System Map](../architecture/AGE_SYSTEM_MAP.md)
- [Capability Architecture](../architecture/CAPABILITY_ARCHITECTURE.md)
- [Architecture docs](../architecture/)
- [ADRs](../adrs/)

## Documents

| #   | Document                                               | Purpose                                                                                                             |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 01  | [User Journeys](./01_USER_JOURNEYS.md)                 | Describes how users move through AGE to accomplish their goals (personas and their end-to-end journeys).            |
| 02  | [Workspace Model](./02_WORKSPACE_MODEL.md)             | Defines how workspaces (the multi-tenant container) are structured, organized and administered.                     |
| 03  | [Client Lifecycle](./03_CLIENT_LIFECYCLE.md)           | Describes the stages a client moves through, from onboarding to offboarding, and the states in between.             |
| 04  | [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) | Describes, at the product level, how AI agents are structured, orchestrated and supervised across AGE.              |
| 05  | [Data Dictionary](./05_DATA_DICTIONARY.md)             | Will define the canonical product-level data terms and how they map to the BKG and BIF.                             |
| 06  | [Permission Model](./06_PERMISSION_MODEL.md)           | Defines roles, permissions and access rules that govern what users can see and do.                                  |
| 07  | [UI & Navigation](./07_UI_NAVIGATION.md)               | Describes the application information architecture, navigation structure and screen inventory.                      |
| 08  | [Notification Model](./08_NOTIFICATION_MODEL.md)       | Defines notification types, channels, triggers and user preferences.                                                |
| 09  | [Automation Model](./09_AUTOMATION_MODEL.md)           | Describes product-level automations: how triggers, conditions, actions and schedules combine.                       |
| 10  | [Reporting Model](./10_REPORTING_MODEL.md)             | Defines report types, metrics, dashboards and delivery for clients and internal teams.                              |
| 11  | [Integration Catalog](./11_INTEGRATION_CATALOG.md)     | Catalogues the third-party integrations AGE supports, mapping to the integration provider contracts.                |
| 12  | [Execution Model](./12_EXECUTION_MODEL.md)             | Describes, at the product level, how the Execution Layer carries out plans — the only layer permitted side effects. |
| 13  | [Security Model](./13_SECURITY_MODEL.md)               | Defines product-level security and compliance posture: authentication, authorization, data protection and auditing. |
| 14  | [Configuration Model](./14_CONFIGURATION_MODEL.md)     | Defines configuration scopes, defaults, overrides and secret handling across the platform.                          |
| 15  | [Product Roadmap](./15_PRODUCT_ROADMAP.md)             | The product-facing roadmap, aligned to the architecture phases and implementation epics.                            |
| 16  | [Glossary](./16_GLOSSARY.md)                           | Canonical definitions of terms used throughout the Product Bible and architecture.                                  |
