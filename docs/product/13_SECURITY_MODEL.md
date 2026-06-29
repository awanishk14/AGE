# Security Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines AGE's **security posture and principles** — _how_ the platform enforces and
protects the access decisions of the Permission Model (Doc 06), isolates data, governs credentials,
and guarantees auditability. Derived from the Permission Model (Doc 06), Workspace Model (Doc 02),
Execution Model (Doc 12), and Integration Catalog (Doc 11).

**Security in AGE is not a layer — it is a constraint system applied across all layers.** It enforces
_who_ can access, _what_ can be done, _where_ it can be done, and _how_ it is traceable. It **never**
defines _how_ those controls are technically implemented.

> **Status:** Final — approved by the Product Owner. A foundational, system-wide invariant for all
> remaining modules.

## Scope

- **In scope:** security **posture and principles only** — the Doc 06 boundary, the canonical
  principles, identity model, authorization alignment, execution integrity, data protection,
  credential boundary, and auditing as an invariant.
- **Out of scope (implementation / infrastructure):** authentication mechanisms, encryption
  algorithms, storage strategies, infrastructure design, compliance implementation, identity
  providers, and session handling (§9).

## Status

Final.

## Related Documents

- [Permission Model](./06_PERMISSION_MODEL.md) — **Final**; _who may access what_ (this document enforces it).
- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) · [Workspace Model](./02_WORKSPACE_MODEL.md) · [Integration Catalog](./11_INTEGRATION_CATALOG.md) · [Execution Model](./12_EXECUTION_MODEL.md) — **Final**.
- [Configuration Model](./14_CONFIGURATION_MODEL.md) — secret configuration.

## Table of Contents

- [1. Boundary with the Permission Model](#1-boundary-with-the-permission-model)
- [2. Core Security Principles](#2-core-security-principles)
- [3. Identity Model](#3-identity-model)
- [4. Authorization Alignment](#4-authorization-alignment)
- [5. Execution Integrity as a Security Boundary](#5-execution-integrity-as-a-security-boundary)
- [6. Data Protection Principles](#6-data-protection-principles)
- [7. Credential Handling Boundary](#7-credential-handling-boundary)
- [8. Auditing](#8-auditing)
- [9. Resolved Decisions & Out of Scope](#9-resolved-decisions--out-of-scope)

---

## 1. Boundary with the Permission Model

The split is canonical (Doc 06 §9.6):

- **Permission Model (Doc 06)** answers **"should this person be allowed?"** — subjects, scopes,
  roles, context, approval.
- **Security Model (this document)** answers **"how is that decision enforced and protected?"**

Security **does not redefine permissions — it enforces them.** The two are independent.

## 2. Core Security Principles

The following principles are **canonical and non-negotiable**, and apply across **all** modules of AGE:

1. **Isolation by default.**
2. **Least privilege access.**
3. **Full auditability and traceability.**
4. **Protection of execution integrity.**
5. **Protection of business data integrity.**

## 3. Identity Model

Identity is strictly **human-centric**:

- **Humans are authenticated identities.**
- **AI Agents are not identities.** They operate strictly within the context of an **authenticated
  human or an approved workflow** (Doc 04, Doc 12).
- **No standalone AI identity layer exists** in the product model.

## 4. Authorization Alignment

Security enforcement aligns with the Permission Model (Doc 06):

- **Enforce context-scoped access** (Organization / Client / Project).
- **Prevent cross-client data leakage by design.**
- **Apply permissions consistently across all layers.**

Security enforces; it does not redefine.

## 5. Execution Integrity as a Security Boundary

The **Execution Layer is a security-critical boundary**, not merely an architectural one (Doc 12).
Security must ensure:

- **Only approved execution flows are executed.**
- **No bypass of the Execution Layer is possible.**
- **All side effects remain governed and traceable.**
- **Execution cannot be triggered outside authorized contexts.**

## 6. Data Protection Principles

- **Data remains isolated by business context.**
- **Sensitive business information must not leak across Clients or Organizations.**
- **Access is always scoped and contextual.**
- **Traceability is preserved for all data-access events.**

Implementation details (encryption, key management, storage systems) are intentionally excluded (§9).

## 7. Credential Handling Boundary

Credentials, secrets, and sensitive configuration:

- **Are not part of the product model.**
- Are governed entirely by the **Security + Infrastructure** layers.
- Must be **scoped, revocable, and protected**.
- **Must never be accessible to AI Agents or pure reasoning layers** (Doc 11, Doc 12).

Secret **configuration** is referenced by the Configuration Model (Doc 14); storage/rotation is
security/infrastructure.

## 8. Auditing

Auditability is a **system-wide invariant, not a feature**:

- **All meaningful actions must be traceable.**
- **No system layer may bypass auditability** (Doc 06: no permission bypasses audit).
- **Audit exists across the reasoning, decision, and execution layers** — supporting the canonical
  chains (Evidence → BIF → Decision → Capability Output → Execution, Doc 12).

How auditing is implemented (storage, integrity, retention) is outside product scope (§9).

## 9. Resolved Decisions & Out of Scope

**Resolved (canonical):**

1. **Posture & principles only** — the Security Model defines posture and the five canonical
   principles; nothing technical.
2. **Identity is human-centric** — AI agents are never identities; no standalone AI identity layer.
3. **Security enforces, never redefines, permissions** (Doc 06 alignment; cross-client leakage
   prevented by design).
4. **Execution integrity is a security boundary** — only approved flows, no bypass, all side effects
   governed and traceable.
5. **Data protection is a principle set** — isolation by context, no cross-Client/Org leakage, scoped
   access, preserved traceability.
6. **Credentials are out of the product model** — Security + Infrastructure own them; never reachable
   by AI agents or pure layers.
7. **Auditing is a system-wide invariant** — all meaningful actions traceable; no layer bypasses it.

**Out of scope (implementation / security-design — not product decisions):** authentication
mechanisms (identity providers, SSO, MFA, session handling) · encryption algorithms & key management
· storage strategies · enforcement mechanisms (e.g., row-level security) · compliance implementation
& certifications · data retention/residency mechanics · threat model & incident response.

**Canonical principle:** security is **not a layer — it is a constraint system applied across all
layers**: who can access, what can be done, where, and how it is traceable — never _how_ it is
technically implemented.
