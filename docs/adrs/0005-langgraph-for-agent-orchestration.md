# ADR 0005: Use LangGraph for agent orchestration

- Status: Accepted
- Date: 2026-06-27

## Context

AGE's adaptive intelligence requires orchestrating multi-step, stateful AI agents (research,
analysis, decision support) over the Business Knowledge Graph. We need an orchestration approach
that is model-agnostic, observable, and supports branching/looping control flow with durable state.

## Decision

We will use **LangGraph** for agent orchestration, with the **OpenAI SDK (model-agnostic)** as the
LLM access layer.

Rationale:

- **Graph-shaped control flow** — explicit nodes/edges fit multi-step agent workflows better than
  linear chains; supports branches, loops and human-in-the-loop.
- **Durable state** — checkpointing enables long-running, resumable agent runs.
- **Model-agnostic** — pairs with an OpenAI-compatible client so the underlying model can change.
- **Maps to the BKG** — agent state and steps align with the canonical graph model.

## Consequences

- Agent logic is authored as LangGraph graphs (added in a later task; none exists yet).
- The LLM client is abstracted so models/providers can be swapped without touching agent graphs.
- Orchestration concerns stay in the knowledge/agent layer, not in domain modules.
