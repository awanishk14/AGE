# ADR 0001: Record Architecture Decisions

- Status: Accepted
- Date: 2026-06-27

## Context

AGE is an enterprise platform expected to grow across multiple apps, services, and teams.
We need a lightweight, durable way to capture significant technical decisions.

## Decision

We will use Architecture Decision Records (ADRs), one Markdown file per decision in
`docs/adrs/`, numbered sequentially. Each ADR captures context, the decision, and consequences.

## Consequences

- Decisions are discoverable and version-controlled alongside the code.
- New contributors can understand _why_ the system is the way it is.
- Superseded decisions remain in history with a status of "Superseded".
