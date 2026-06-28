# Security Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, AGE's **security posture and principles** — how the
platform **enforces and protects** the access decisions made by the Permission Model (Doc 06), how it
**isolates** tenant and client data, how it handles **credentials**, and how it guarantees
**auditability**. Derived from the Permission Model (Doc 06), Workspace Model (Doc 02), Execution
Model (Doc 12), Integration Catalog (Doc 11), and the persistence foundation.

It defines security **principles and responsibilities**, not implementation. It does not define
cryptographic algorithms, authentication protocols, threat models, or specific compliance
certifications — those are security-architecture and implementation concerns.

> **Status:** In Progress — derived from Final Docs and the frozen architecture. Genuine security
> decisions not derivable from existing material are surfaced in [§8 Open Decisions](#8-open-decisions).

## Scope

- **In scope:** security principles, the Doc 06 boundary, authentication/identity posture,
  authorization enforcement, data protection & isolation, credential handling, auditing guarantees,
  and the compliance posture.
- **Out of scope:** cryptographic specifics, auth protocols (SSO/MFA details), enforcement mechanisms
  (e.g., RLS implementation), threat models, and compliance certifications — security design /
  implementation.

## Status

In Progress.

## Related Documents

- [Permission Model](./06_PERMISSION_MODEL.md) — **Final**; _who may access what_ (this document enforces it).
- [Workspace Model](./02_WORKSPACE_MODEL.md) · [Execution Model](./12_EXECUTION_MODEL.md) · [Integration Catalog](./11_INTEGRATION_CATALOG.md) — **Final**.
- [Configuration Model](./14_CONFIGURATION_MODEL.md) — secret storage/configuration.

## Table of Contents

- [1. Purpose & Boundary with the Permission Model](#1-purpose--boundary-with-the-permission-model)
- [2. Security Principles](#2-security-principles)
- [3. Authentication & Identity](#3-authentication--identity)
- [4. Authorization Enforcement](#4-authorization-enforcement)
- [5. Data Protection & Isolation](#5-data-protection--isolation)
- [6. Credentials & Secrets](#6-credentials--secrets)
- [7. Auditing](#7-auditing)
- [8. Open Decisions](#8-open-decisions)

---

## 1. Purpose & Boundary with the Permission Model

The split is canonical (Doc 06 §9.6):

- **Permission Model (Doc 06)** answers **"should this person be allowed?"** — subjects, scopes,
  roles, context, approval.
- **Security Model (this document)** answers **"how is that decision enforced and protected?"** —
  authentication, identity, enforcement, data protection, credentials, and audit.

The two are independent and must not be conflated.

## 2. Security Principles

1. **Isolation by default.** Tenant and client boundaries (Doc 02 §15–16) are **security guarantees**,
   not conveniences — never crossed.
2. **Least privilege.** Access follows responsibility (Doc 06); the platform grants the minimum needed.
3. **Auditability & traceability.** Every access, action, and side effect is attributable and
   traceable (Doc 12 chain; persistence AuditLog).
4. **Defense of the execution boundary.** Only the Execution Layer side-effects (Doc 12); this is a
   security invariant, not merely a design choice.
5. **Protect business truth.** Data and credentials are protected commensurate with their sensitivity.

## 3. Authentication & Identity

- Every human actor must be **authenticated**, and **identity established before access** is granted.
- **AI agents are not identities or permission subjects** (Doc 04, Doc 06) — they act within the
  initiating human's authenticated context.
- The **authentication mechanics** (protocols, SSO, MFA, sessions) are security design /
  implementation (§8).

## 4. Authorization Enforcement

- The Security Model **enforces** the Permission Model: the hybrid **role + context** decision
  (Doc 06) is applied at access time, and **scope isolation is enforced** so a subject only reaches
  what its responsibilities grant.
- Cross-client / cross-tenant access is **structurally prevented** (Doc 02 §15).
- The **enforcement mechanism** (e.g., row-level security, policy evaluation) is implementation (§8).

## 5. Data Protection & Isolation

- **Tenant/client isolation** is enforced as a security guarantee (Doc 02 §15–16); one client's data
  never reaches another, and no organization reaches another's data.
- **Data is protected in transit and at rest** as a principle; the specific cryptographic standards
  and key management are implementation (§8).
- **Soft delete & retention.** Data is retained (soft delete, version history) for audit and
  traceability; protection applies to retained data equally.

## 6. Credentials & Secrets

- **Integration connections** are **authorized, revocable, and scoped to a business context**
  (Doc 11). The Security Model owns how their **credentials are protected, rotated, and revoked**.
- **Credential and secret storage** (encryption, vaulting, rotation policy) is security/infrastructure
  design; secret **configuration** lives in the Configuration Model (Doc 14).
- Credentials are never exposed to pure layers or surfaced in reasoning; only the Execution Layer uses
  them to act (Doc 11, Doc 12).

## 7. Auditing

- **Comprehensive audit.** Every access, change, approval, integration action, and side effect is
  **auditable** (persistence AuditLog) — _no permission bypasses audit_ (Doc 06).
- **Traceability chains.** Security supports the canonical chains (Evidence → BIF → Decision →
  Capability Output → Execution, Doc 12) so any outcome is attributable to its origin and actor.
- **Audit integrity.** Audit records should be tamper-evident and retained; the **implementation** of
  audit storage/integrity is security design (§8).

## 8. Open Decisions

> Genuine security decisions not derivable from the frozen architecture — most belong to security
> design / implementation; surfaced here for the security architecture effort.

1. **Authentication mechanics.** Identity provider(s), SSO, MFA, session model.
2. **Authorization enforcement mechanism.** How isolation/scoping is enforced technically (e.g., RLS).
3. **Encryption & key management.** Standards for data at rest / in transit and key handling.
4. **Credential vaulting & rotation.** How integration credentials are stored, rotated, and revoked.
5. **Compliance frameworks.** Which compliance/regulatory regimes AGE targets (and resulting controls).
6. **Data retention & residency.** Retention periods and any region-pinning for enterprise tenants.
7. **Threat model & incident response.** The platform threat model and response posture.
