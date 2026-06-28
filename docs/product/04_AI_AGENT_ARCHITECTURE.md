# AI Agent Architecture

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document describes, at the **product level**, how AI agents are **structured, orchestrated, and
supervised** across AGE. It defines the governance shape of the AI Workforce — roles, contract shape,
orchestration approach, guardrails, and human oversight — **not** how any agent behaves internally,
and not prompts, models, or implementation.

It is a **business-domain / governance model only**.

> **Status:** In Progress — derived from the frozen architecture, the AI Workforce personas (Doc 01),
> the Workspace Model (Doc 02, Final), the Persona Schema Registry, and ADR-0005. Genuine decisions
> not derivable from existing material are surfaced in [§9 Open Decisions](#9-open-decisions) rather
> than invented.

## Scope

- **In scope:** how agents are organized, the contract every agent follows, how they are
  orchestrated and governed, and how humans supervise them — all at the product level.
- **Out of scope:** agent prompts and internal logic, model selection details, specific AI behavior,
  capability/execution implementation, permissions (Doc 06), automations (Doc 09), UI (Doc 07).

## Status

In Progress.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — the AI Workforce personas and their per-agent contracts.
- [Workspace Model](./02_WORKSPACE_MODEL.md) — **Final**; agent ownership and scope.
- [Automation Model](./09_AUTOMATION_MODEL.md) · [Execution Model](./12_EXECUTION_MODEL.md).
- [PERSONA_SCHEMA_REGISTRY](./PERSONA_SCHEMA_REGISTRY.md) — the AI Agent schema (19 sections).

**Architecture references (do not modify):**

- [ADR-0005 LangGraph for agent orchestration](../adrs/0005-langgraph-for-agent-orchestration.md)
- [CAPABILITY_ARCHITECTURE](../architecture/CAPABILITY_ARCHITECTURE.md)
- [AGE_SYSTEM_MAP](../architecture/AGE_SYSTEM_MAP.md)

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Position in the Platform](#2-position-in-the-platform)
- [3. The AI Workforce](#3-the-ai-workforce)
- [4. Agent Contract Shape](#4-agent-contract-shape)
- [5. Orchestration](#5-orchestration)
- [6. Agent ↔ Capability Mapping](#6-agent--capability-mapping)
- [7. Guardrails](#7-guardrails)
- [8. Human-in-the-Loop](#8-human-in-the-loop)
- [9. Open Decisions](#9-open-decisions)

---

## 1. Purpose

AGE operates an **AI Workforce** — a set of AI agents that work alongside the human personas (Doc 01)
to sense, reason about, and act on each client's business. This document defines how that workforce
is organized and governed, so every agent is consistent, scoped, and accountable.

## 2. Position in the Platform

Agents operate **within** the frozen platform layers; they do not redefine them. From the System Map
and Workspace Model:

- **Ownership & scope (Doc 02).** The AI Workforce is **owned by the Organization**. Agents
  **execute within a Project / Client scope**, read and write only within the Client they are invoked
  for, and **never cross client boundaries** in a single operation. Knowledge produced through agent
  work **accumulates at the Client** (Doc 02 §7, §13).
- **Capabilities belong to the platform** (Doc 02 §13); agents operate inside capabilities, they do
  not own them.
- **The reasoning pipeline** the agents serve is the frozen flow:
  `External Sources → RIE → Intelligence → BIF → SIE → Capabilities → Execution`.

## 3. The AI Workforce

The AI Workforce is the set of agents defined canonically in **Doc 01 (AI Workforce)**. This document
does not re-define their individual behavior; it references them:

`Executive Agent` · `Research Agent` · `Intelligence Agent` · `Strategy Agent` ·
`Market Discovery Agent` · `SEO Agent` · `AEO/GEO Agent` · `Paid Media Agent` · `Content Agent` ·
`Reporting Agent` · `Proposal Agent` · `Project Coordinator Agent` · `QA Agent`.

> Five agents have detailed canonical contracts in Doc 01 (Strategy, Content, SEO, Research,
> Reporting); the remaining eight are skeletons pending completion in Doc 01. Their individual
> definitions are owned by Doc 01, not this document.

## 4. Agent Contract Shape

Every agent conforms to the **AI Agent Schema (19 sections)** defined in the Persona Schema Registry
(frozen). The governance-relevant sections are:

- **Decision Authority** — what an agent may do independently and what it may not.
- **Processing Workflow / Input → Processing → Output Layer** — the agent as a pure pipeline.
- **Operational Modes** — when the agent acts (continuous vs. on-demand) and its alerts.
- **Collaboration Matrix** — which agents/humans/systems it works with.
- **Constraints** — hard prohibitions ("must never …").
- **Audit Requirements** — what every agent action must record.

These sections are the contract this document governs by; their per-agent contents live in Doc 01.

## 5. Orchestration

- **Engine.** Agent orchestration uses **LangGraph** with a **model-agnostic** LLM access layer
  (ADR-0005). Agent runs are graph-shaped, stateful, and resumable.
- **Pipeline alignment.** Orchestration follows the frozen reasoning pipeline (§2); agents are
  invoked at the layer they serve (e.g., Research/Intelligence agents around RIE → Intelligence →
  BIF; Strategy Agent around SIE; capability agents within their capability).
- **Scope binding.** Every agent run is bound to a single Client/Project scope (Doc 02); an
  orchestration never spans two clients.
- **Statefulness.** Agent state and steps align with the canonical models (BIF/BKG/Evidence), so a
  run is explainable and traceable end-to-end.

This document defines the orchestration **approach**, not the concrete graphs (implementation).

## 6. Agent ↔ Capability Mapping

Capabilities belong to the platform (Doc 02 §13); agents operate inside them. A precise,
authoritative mapping of **which agents serve which capabilities** is **not yet defined** in the
frozen material and is a genuine business/architecture decision — see [§9.1](#9-open-decisions).

Anchors that _are_ derivable (stated as orientation, not as a final mapping):

- Research / Intelligence agents serve the **Intelligence** capability (truth quality, RIE → BIF).
- Strategy / Executive agents serve the **platform decision layer** (SIE), not a single capability.
- Reporting / Project Coordinator / QA agents align with **Operations**.

The complete mapping (including Market Discovery, Growth, Authority, Revenue) is deferred to §9.

## 7. Guardrails

Guardrails are governed by each agent's contract (§4) plus the frozen execution boundary:

1. **Decision Authority + Constraints.** An agent may only do what its contract's _Decision
   Authority_ permits, and never what its _Constraints_ forbid (e.g., per Doc 01: agents must never
   modify BIF/RIE directly, override human approvals, or trigger external systems).
2. **Execution boundary (frozen).** Only the **Execution Layer** performs external side effects
   (publish, deploy, send, push). Reasoning/agent layers are **pure** — they produce artifacts and
   proposals, not side effects.
3. **Scope isolation.** Agents never cross client boundaries (Doc 02).
4. **Auditability.** Every agent action records its contract's _Audit Requirements_ (inputs used,
   confidence, timestamp, outputs) — no agent action is untraceable.
5. **Evidence-grounded.** Agents act on evidence; they do not invent unsupported facts (per agent
   Constraints).

## 8. Human-in-the-Loop

Agents are **assistive and proposal-generating; humans remain accountable.** Derived from the agent
contracts (Doc 01) and the platform's data-trust principles:

- Agents **propose**; humans (the Doc 01 human personas) **approve** decisions that have business
  impact. Each agent's _Decision Authority_ states exactly what it may decide independently versus
  what requires human approval.
- Agents reporting lines in Doc 01 pair a **human owner** with **AI oversight** (e.g., a capability
  agent reports to its human strategist plus the Strategy Agent).
- Approvals, escalations, and the resulting audit trail are recorded per each agent's _Audit
  Requirements_.

The concrete mechanics of approval/escalation (gates, routing, notifications) are **out of scope**
here and belong to the Automation/Permission/Notification documents.

## 9. Open Decisions

> Genuine decisions not derivable from the frozen architecture. Surfaced, not assumed.

1. **Authoritative Agent ↔ Capability mapping.** The complete mapping of each agent to a capability
   (Intelligence, Market Discovery, Growth, Authority, Operations, Revenue) — and whether an agent
   may serve more than one capability — needs an explicit decision (see §6).
2. **"Execution Layer" agents vs the side-effect boundary.** Doc 01 labels some agents as "AI
   Execution Layer" (e.g., Content, SEO). Confirm that such agents remain **pure producers**
   (drafts/optimizations) while the actual side effect (publishing/deploying) is performed by the
   Execution Layer — i.e., agents never directly publish.
3. **AI supervision hierarchy.** Doc 01 implies "AI oversight" by the Strategy Agent over others. Is
   there a canonical agent-supervision relationship (e.g., Strategy/Executive Agent supervising
   capability agents), or is supervision purely human?
4. **Agent lifecycle & enablement.** Whether agents can be enabled/disabled per Client, and whether
   all agents exist for every Client by default.
5. **Completion of the eight skeleton agents.** Executive, Intelligence, Market Discovery, AEO/GEO,
   Paid Media, Proposal, Project Coordinator, QA still need full Doc 01 contracts before their
   governance here is complete (owned by Doc 01).
