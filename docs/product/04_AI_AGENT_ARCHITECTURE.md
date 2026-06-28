# AI Agent Architecture

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document describes, at the **product level**, how AI agents are **structured, orchestrated, and
supervised** across AGE. It defines the governance shape of the AI Workforce — roles, contract shape,
orchestration approach, guardrails, and human oversight — **not** how any agent behaves internally,
and not prompts, models, or implementation.

It is a **business-domain / governance model only**.

> **Status:** Final — approved by the Product Owner. Conforms to the authoritative Workspace Model
> (Doc 02) and the AI Workforce definitions (Doc 01).

## Scope

- **In scope:** how agents are organized, the contract every agent follows, how they are
  orchestrated and governed, and how humans supervise them — all at the product level.
- **Out of scope:** agent prompts and internal logic, model selection details, specific AI behavior,
  capability/execution implementation, permissions (Doc 06), automations (Doc 09), UI (Doc 07).

## Status

Final.

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
- [9. Resolved Decisions](#9-resolved-decisions)

---

## 1. Purpose

AGE operates an **AI Workforce** — a set of AI agents that work alongside the human personas (Doc 01)
to sense and reason about each client's business. This document defines how that workforce is
organized and governed, so every agent is consistent, scoped, and accountable.

**Defining principle — the AI Workforce is a shared reasoning layer for the entire platform.** This
separation is one of AGE's defining architectural characteristics:

- **Capabilities orchestrate reasoning.**
- **Projects provide context.**
- **Clients own knowledge.**
- **Execution performs actions.**

## 2. Position in the Platform

Agents operate **within** the frozen platform layers; they do not redefine them. From the System Map
and Workspace Model:

- **A platform reasoning layer, not a per-client asset.** The AI Workforce is a **platform
  capability** operated at the Organization level (Doc 02 §13). **Clients do not own agents and are
  never assigned agents** — they consume platform capabilities, and agents are enabled **implicitly
  through the capabilities available to a client** (licensing/packaging is a future concern, not an
  agent assignment).
- **Scope (Doc 02).** Agents **execute within a Project / Client scope**, read and write only within
  the Client they are invoked for, and **never cross client boundaries** in a single operation.
  Knowledge produced through agent work **accumulates at the Client** (Doc 02 §7, §13).
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

The relationship between AI Agents and Capabilities is **many-to-many** — deliberately **not** a
rigid one-to-one mapping. The architecture separates two concerns:

- **AI Workforce** — _who_ performs the reasoning.
- **Capabilities** — _what_ business capability is delivered.

An AI Agent may contribute to **multiple** capabilities; a Capability may orchestrate **multiple**
AI Agents. The **authoritative mapping belongs to implementation and orchestration, not the Product
Bible.** This document states the principle; it does not enumerate agent-to-capability assignments.

## 7. Guardrails

Guardrails are governed by each agent's contract (§4) plus the frozen execution boundary:

1. **Decision Authority + Constraints.** An agent may only do what its contract's _Decision
   Authority_ permits, and never what its _Constraints_ forbid (e.g., per Doc 01: agents must never
   modify BIF/RIE directly, override human approvals, or trigger external systems).
2. **All AI Agents are pure producers (absolute).** Every agent — including agents whose purpose
   appears execution-oriented (Content, SEO, Campaign, etc.) — only **produces outputs**:
   recommendations, plans, drafts, or structured artifacts. **Only the Execution Layer performs side
   effects** — publishing, API calls, integrations, or external system updates. This is a core,
   non-negotiable platform guardrail.
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
- **No hierarchical AI management exists.** No AI Agent supervises another; there is no "Chief AI"
  or "Manager Agent." **Human users are the only supervisory authority.** Where Doc 01 mentions "AI
  oversight," it means coordination through orchestration, workflows, and shared context — **not**
  authority. The orchestration engine determines sequencing and information flow, not an
  organizational hierarchy.
- Approvals, escalations, and the resulting audit trail are recorded per each agent's _Audit
  Requirements_.

The concrete mechanics of approval/escalation (gates, routing, notifications) are **out of scope**
here and belong to the Automation/Permission/Notification documents.

## 9. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **Agent ↔ Capability mapping is many-to-many** (§6). No rigid one-to-one mapping; the
   authoritative mapping belongs to implementation/orchestration, not the Product Bible.
2. **All AI Agents are pure producers** (§7.2) — absolute. Only the Execution Layer performs side
   effects.
3. **No AI supervision hierarchy** (§8) — no agent supervises another; humans are the only
   supervisory authority; coordination is via orchestration, workflows, and shared context.
4. **Clients are not assigned agents** (§2). The AI Workforce is a platform reasoning layer; agents
   are enabled implicitly through the capabilities available to a client (future
   licensing/packaging), never owned or assigned per client.
5. **Single authoritative definition per AI persona.** The individual AI Workforce contracts —
   including the eight still-skeleton agents — are governed **exclusively by Doc 01**. This document
   references the registry and must not duplicate or redefine any agent contract.
