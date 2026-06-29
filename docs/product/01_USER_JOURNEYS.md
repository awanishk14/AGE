# AGE Product Bible

# Document 01 – User Journeys

---

# Document Information

| Field               | Value              |
| ------------------- | ------------------ |
| Document            | 01 – User Journeys |
| Version             | 1.0                |
| Status              | Product Design     |
| Owner               | Product Team       |
| Architecture Status | Frozen             |
| Last Updated        | 2026-06-29         |

---

# Purpose

This document defines every human and AI persona that interacts with AGE.

It establishes:

- Who they are
- Why they use AGE
- Their responsibilities
- Their workflows
- Their decision authority
- Their KPIs
- Their dashboards
- Their AI assistance
- Their permissions
- Their reports
- Their notifications
- Their automation requirements

This document is the foundation for:

- Permission Model
- Navigation
- Dashboard Design
- Automation Engine
- Reporting Engine
- AI Agent Architecture
- Capability Design

---

# Core Design Principles

Every persona exists for one purpose:

> Make better business decisions faster.

AGE should never force users to search for information.

Instead, AGE should proactively provide:

- Opportunities
- Risks
- Recommendations
- Evidence
- Trends
- Business Impact
- Suggested Next Actions

Every dashboard must answer three questions immediately:

1. What needs my attention?
2. Why does it matter?
3. What should I do next?

---

# Persona Groups

The complete set of personas is organized into the following groups.

## Executive Leadership

- Founder / CEO
- COO
- Growth Director

## Strategy Team

- SEO Strategist
- Paid Media Strategist
- Content Strategist
- Brand Strategist

## Delivery Team

- Account Manager
- Project Manager
- QA Lead
- Developer
- Designer

## Revenue Team

- Sales Executive
- Proposal Specialist
- Customer Success Manager

## Client Team

- Business Owner
- Marketing Head
- Product Manager

## AI Workforce

- Executive Agent
- Research Agent
- Intelligence Agent
- Strategy Agent
- Market Discovery Agent
- SEO Agent
- AEO/GEO Agent
- Paid Media Agent
- Content Agent
- Reporting Agent
- Proposal Agent
- Project Coordinator Agent
- QA Agent

---

# Standard Persona Template

Every persona follows the exact structure below.

1. **Persona Overview** — Name, Department, Reports To, Primary Objective, Secondary Objectives, Business Value
2. **Responsibilities** — Daily, Weekly, Monthly, Quarterly
3. **Decision Authority** — decisions made independently; decisions requiring approval
4. **Daily Workflow** — Morning, Mid-Day, Afternoon, Evening
5. **Weekly Workflow** — Weekly planning, Reviews, Client interactions, Internal meetings, Learning, Optimization
6. **Monthly Workflow** — Performance review, Business review, Strategic planning, Budget review, Capability review
7. **Inputs Required** — information required before work begins
8. **Outputs Produced** — everything this persona creates
9. **Dashboards** — Purpose, Widgets, KPIs, Alerts, Drill-down capability
10. **Reports** — Reports received, Reports created, Report frequency
11. **Notifications** — Critical, Important, Informational, Digest, Escalation
12. **AI Agents** — Agent Name, Responsibility, Inputs, Outputs, Confidence Threshold, Escalation Rules, Human Approval Requirements
13. **Permissions** — Read, Create, Update, Delete, Approve, Export, Admin
14. **Integrations Used** — e.g. GSC, GA, Google Ads, Meta Ads, LinkedIn Ads, GitHub, SSH, CRM, Email, Slack, Teams
15. **KPIs** — Primary, Secondary, Leading Indicators, Lagging Indicators
16. **Pain Points** — current operational problems
17. **Success Criteria** — what success looks like
18. **Automation Opportunities** — repetitive work AGE should automate
19. **Collaboration Matrix** — Human collaborators, AI collaborators, Upstream dependencies, Downstream dependencies
20. **Audit Requirements** — Decision Maker, Timestamp, Evidence Used, AI Recommendation, Final Decision, Business Outcome

---

# Personas

> Canonical skeletons. Every subsection is intentionally a placeholder and will be filled
> persona-by-persona during Product Design. No content has been inferred.

## Executive Leadership

### Founder / CEO

#### 1. Identity

Founder / CEO is the final strategic decision maker, accountable for the overall success of the business.

#### 2. Role Type

Human Persona (Executive Leadership)

#### 3. Scope of Responsibility

Organization-wide strategic decisions and accountability across all Clients.

#### 4. Core Objective

Build a profitable, scalable, AI-first growth company that consistently delivers measurable business outcomes for clients.

#### 5. System Interaction Scope

- Reviews the Executive Command Center and AI executive brief
- Approves strategic decisions
- Monitors revenue and delivery health
- Does not directly execute system actions

#### 6. Decision Authority

Can independently approve business strategy, budgets, hiring, investments, partnerships, service offerings, pricing, and client escalations; board approval only where legally applicable.

#### 7. Constraints

- Cannot bypass audit logging
- Cannot bypass approval history
- Cannot bypass evidence tracking

#### 8. Key Inputs

- Business Intelligence Framework
- Strategy & Research Intelligence
- Financial metrics & client KPIs
- Sales pipeline & operations dashboards
- Market intelligence
- Executive reports

#### 9. Outputs

- Strategic decisions & budget approvals
- Company objectives & growth priorities
- Executive approvals
- Quarterly goals

#### 10. Success Metrics

- Revenue growth (MRR / ARR)
- Gross margin / EBITDA
- Client retention & Net Revenue Retention
- NPS / customer satisfaction

#### 11. Collaboration Model

Works closely with COO, Growth Director, Sales, Account Managers, Project Managers, and Finance.

#### 12. AI Augmentation

Executive, Strategy, Intelligence, Reporting, and Decision Support Agents — each recommendation includes evidence, confidence score, business impact, recommended action, and expected outcome.

#### 13. Lifecycle Position

Active across the Organization at all times.

#### 14. Security Context

Full platform access within Organization scope; cannot bypass audit, approval, or evidence controls (Doc 06 + Doc 13).

#### 15. Configuration Dependencies

Organization-level configuration and capability availability.

#### 16. Failure Mode

Disconnected data and slow, reactive decision-making that reduces visibility across clients.

#### 17. Auditability

Every executive decision records decision maker, timestamp, evidence used, AI recommendation, final decision, and business outcome.

#### 18. External Interaction

No direct external system interaction; integrations surface through dashboards.

#### 19. Notes

Primary strategic authority and accountability for overall business success.

### COO

#### 1. Identity

Chief Operating Officer owns operational excellence — aligning people, processes, AI agents, and delivery systems for predictable outcomes.

#### 2. Role Type

Human Persona (Executive Leadership)

#### 3. Scope of Responsibility

Organization-wide delivery operations across all Clients and Projects.

#### 4. Core Objective

Ensure every client engagement is delivered efficiently, profitably, and consistently at the highest standards of quality and operational excellence.

#### 5. System Interaction Scope

- Reviews the Operations Command Center
- Monitors delivery health and project risk
- Removes operational blockers; reviews SLA compliance
- Does not directly execute system actions

#### 6. Decision Authority

Can independently approve delivery priorities, resource allocation, project scheduling, operational improvements, process changes, and delivery escalations; escalates strategic investments and restructuring to the Founder / CEO.

#### 7. Constraints

- Cannot bypass audit logs
- Cannot bypass evidence tracking
- Cannot bypass executive approvals where required

#### 8. Key Inputs

- Business Intelligence Framework
- Project status & resource availability
- Delivery KPIs & client commitments
- Financial metrics & operational reports
- Risk assessments

#### 9. Outputs

- Operational plans & resource allocation decisions
- Delivery priorities & capacity plans
- Escalation resolutions
- Performance reports

#### 10. Success Metrics

- Project delivery & on-time rate
- Project profitability & resource utilization
- SLA compliance
- Delivery quality & client satisfaction

#### 11. Collaboration Model

Works closely with Founder / CEO, Growth Director, Project Managers, Account Managers, and the Strategy Team.

#### 12. AI Augmentation

Operations, Project Coordinator, Reporting, QA, and Decision Support Agents — each recommendation includes evidence, confidence, operational impact, recommended action, and expected outcome.

#### 13. Lifecycle Position

Active across the Organization at all times.

#### 14. Security Context

Full operational access within Organization scope; cannot bypass audit, evidence, or required executive approvals (Doc 06 + Doc 13).

#### 15. Configuration Dependencies

Organization-level configuration and capability availability.

#### 16. Failure Mode

Unbalanced workloads, project delays, and reactive issue management causing operational inefficiency.

#### 17. Auditability

Every operational decision records decision maker, timestamp, supporting evidence, AI recommendation, confidence, operational impact, affected projects, and approval history.

#### 18. External Interaction

No direct external system interaction.

#### 19. Notes

Owns operational excellence and predictable delivery across the agency.

### Growth Director

#### 1. Identity

Growth Director orchestrates all growth functions into one coordinated, measurable revenue growth engine.

#### 2. Role Type

Human Persona (Executive Leadership)

#### 3. Scope of Responsibility

Cross-channel growth across the client portfolio.

#### 4. Core Objective

Orchestrate all growth functions (SEO, Paid Media, Content, Brand, Product signals) into a unified, measurable revenue growth system.

#### 5. System Interaction Scope

- Reviews the Growth Command Center
- Monitors revenue, CAC/LTV, and pipeline health
- Resolves strategic conflicts across teams
- Does not directly execute system actions

#### 6. Decision Authority

Can independently approve cross-channel budget allocation, strategic growth initiatives, funnel optimization, channel scaling, and experiments; escalates major financial commitments, market entry, and restructuring to the Founder / CEO.

#### 7. Constraints

- Cannot bypass financial approval limits
- Cannot bypass audit logs
- Cannot bypass executive-level strategic approvals

#### 8. Key Inputs

- Business Intelligence Framework
- Strategy Intelligence Engine
- SEO / Paid Media / Content / Brand strategist outputs
- Market research data

#### 9. Outputs

- Growth strategies & revenue optimization plans
- Cross-channel allocation models
- Funnel improvement strategies & experiment roadmaps
- Strategic prioritization frameworks

#### 10. Success Metrics

- Revenue growth rate
- CAC / LTV / ROAS
- Conversion rate & pipeline growth
- Retention impact

#### 11. Collaboration Model

Works closely with the Founder / CEO, COO, and the full Strategy Team.

#### 12. AI Augmentation

Growth, Strategy, Reporting, Optimization, and Research Agents — each recommendation includes evidence, confidence, expected revenue impact, recommended action, and risk/reward balance.

#### 13. Lifecycle Position

Active across the Organization at all times.

#### 14. Security Context

Cross-functional override authority for growth decisions within Organization scope; cannot bypass financial limits, audit, or executive approvals (Doc 06 + Doc 13).

#### 15. Configuration Dependencies

Organization-level configuration and capability availability.

#### 16. Failure Mode

Channel silos, misaligned budgets, and unclear attribution slowing growth decisions.

#### 17. Auditability

Every growth decision records decision maker, timestamp, supporting evidence, AI recommendation, confidence, expected revenue impact, business outcome, budget impact, and approval history.

#### 18. External Interaction

No direct external system interaction; channel platforms surface through dashboards.

#### 19. Notes

Owns the full growth system as one coordinated engine.

## Strategy Team

### SEO Strategist

#### 1. Identity

SEO Strategist owns organic growth as a system — aligning content, technical SEO, and search intent with market demand.

#### 2. Role Type

Human Persona (Strategy Team)

#### 3. Scope of Responsibility

Organic growth strategy across assigned Client properties.

#### 4. Core Objective

Drive sustainable organic growth by aligning content, technical SEO, and search intent with market demand.

#### 5. System Interaction Scope

- Reviews the SEO Intelligence Command Center
- Monitors keyword/ranking movement and search trends
- Coordinates content SEO alignment
- Does not directly execute publishing or deployment

#### 6. Decision Authority

Can independently approve keyword targeting, content SEO optimization, on-page changes, internal linking, and metadata; escalates major site-structure changes, domain-level shifts, and large technical migrations.

#### 7. Constraints

- Cannot bypass technical deployment approvals
- Cannot bypass audit logs
- Cannot make structural site changes without approval

#### 8. Key Inputs

- Research Intelligence Engine
- Business Intelligence Framework
- Content Strategist outputs
- Competitor & Search Console / Analytics data

#### 9. Outputs

- Keyword strategies & content SEO briefs
- Internal linking & technical SEO recommendations
- Search intent mappings
- Ranking improvement plans

#### 10. Success Metrics

- Organic traffic & keyword rankings
- CTR & impressions
- Domain authority & indexed pages
- Conversion from organic

#### 11. Collaboration Model

Works closely with Growth Director, Content Strategist, and Brand/Paid Media Strategists.

#### 12. AI Augmentation

SEO, Content, Research, Strategy, and Reporting Agents — each recommendation includes evidence, confidence, expected SEO impact, recommended action, and ranking impact.

#### 13. Lifecycle Position

Active while assigned to Clients with active organic-growth work.

#### 14. Security Context

Client/Organization-scoped access; cannot bypass deployment approvals or audit (Doc 06 + Doc 13).

#### 15. Configuration Dependencies

Client-level configuration and capability availability.

#### 16. Failure Mode

Ranking volatility, keyword cannibalization, and weak content/technical alignment.

#### 17. Auditability

Every SEO decision records decision maker, timestamp, supporting evidence, AI recommendation, confidence, expected SEO impact, business outcome, and ranking impact.

#### 18. External Interaction

No direct external system interaction; SEO actions are performed by the Execution Layer.

#### 19. Notes

Owns organic growth as a system tied to revenue, not keywords.

### Paid Media Strategist

#### 1. Identity

Paid Media Strategist owns all paid acquisition systems, ensuring ad spend ties directly to measurable business results.

#### 2. Role Type

Human Persona (Strategy Team)

#### 3. Scope of Responsibility

Paid acquisition strategy across assigned Client advertising platforms.

#### 4. Core Objective

Design, optimize, and scale paid acquisition systems that generate predictable, high-ROI growth.

#### 5. System Interaction Scope

- Reviews the Paid Media Command Center
- Monitors campaign performance and spend efficiency
- Plans optimization and audience strategy
- Does not directly execute campaign changes

#### 6. Decision Authority

Can independently approve campaign optimizations, in-limit budget reallocations, audience targeting, creative testing, and bid adjustments; escalates large budget increases, new channel launches, and strategic spend changes.

#### 7. Constraints

- Cannot bypass budget approval limits
- Cannot bypass audit logs
- Cannot bypass executive approvals for large spend

#### 8. Key Inputs

- Business Intelligence Framework
- Strategy & Research Intelligence Engines
- Conversion & campaign performance data
- Audience & competitor ad intelligence

#### 9. Outputs

- Paid media strategies & campaign structures
- Budget allocation & audience targeting plans
- Creative testing frameworks
- Optimization & scaling plans

#### 10. Success Metrics

- ROAS & CAC
- Cost per conversion & conversion rate
- Revenue per campaign
- Budget efficiency

#### 11. Collaboration Model

Works closely with Growth Director, SEO Strategist, and Content Strategist.

#### 12. AI Augmentation

Paid Media, Strategy, Research, Conversion Optimization, and Reporting Agents — each recommendation includes evidence, confidence, expected ROI, recommended action, and impact on CAC/ROAS.

#### 13. Lifecycle Position

Active while assigned to Clients with active paid-media work.

#### 14. Security Context

Client/Organization-scoped access; cannot bypass budget limits or audit (Doc 06 + Doc 13).

#### 15. Configuration Dependencies

Client-level configuration and capability availability.

#### 16. Failure Mode

Rising acquisition costs, creative fatigue, and attribution gaps.

#### 17. Auditability

Every paid-media decision records decision maker, timestamp, supporting evidence, AI recommendation, confidence, expected ROI, budget impact, and business outcome.

#### 18. External Interaction

No direct external system interaction; ad actions are performed by the Execution Layer.

#### 19. Notes

Owns paid acquisition tied directly to measurable business results.

### Content Strategist

#### 1. Identity

Content Strategist owns narrative-driven growth — converting intelligence into scalable content systems that drive awareness, trust, and conversions.

#### 2. Role Type

Human Persona (Strategy Team)

#### 3. Scope of Responsibility

Content strategy across assigned Client properties and channels.

#### 4. Core Objective

Design content systems that attract, educate, and convert high-intent audiences by aligning messaging with business goals and market demand.

#### 5. System Interaction Scope

- Reviews the Content Intelligence Command Center
- Analyzes trends, gaps, and competitor content
- Plans editorial and SEO alignment
- Does not directly execute publishing

#### 6. Decision Authority

Can independently approve content topics, messaging direction, editorial calendar, formats, and optimization strategies; escalates brand-positioning changes, large content investments, and cross-channel messaging shifts.

#### 7. Constraints

- Cannot bypass brand guidelines
- Cannot bypass audit logs
- Cannot bypass executive approvals for major shifts

#### 8. Key Inputs

- Research & Strategy Intelligence Engines
- BIF framework
- Competitor content & SEO insights
- Campaign performance & audience insights

#### 9. Outputs

- Content strategies & editorial calendars
- Messaging frameworks & content briefs
- Narrative systems
- Content optimization & distribution strategies

#### 10. Success Metrics

- Content engagement & conversion rate
- Organic traffic contribution
- Content ROI
- Lead generation from content

#### 11. Collaboration Model

Works closely with Growth Director, SEO Strategist, and Paid Media Strategist.

#### 12. AI Augmentation

Content, Research, SEO, Strategy, and Reporting Agents — each recommendation includes evidence, confidence, expected impact, recommended action, and engagement/conversion impact.

#### 13. Lifecycle Position

Active while assigned to Clients with active content work.

#### 14. Security Context

Client-scoped access; cannot bypass brand guidelines or audit (Doc 06 + Doc 13).

#### 15. Configuration Dependencies

Client-level configuration and capability availability.

#### 16. Failure Mode

Low-engagement content, weak SEO alignment, and disconnected messaging.

#### 17. Auditability

Every content decision records decision maker, timestamp, supporting evidence, AI recommendation, confidence, expected impact, business outcome, and content performance impact.

#### 18. External Interaction

No direct external system interaction; content is published by the Execution Layer.

#### 19. Notes

Owns narrative-driven growth as scalable content systems.

### Brand Strategist

#### 1. Identity

Brand Strategist owns how the company is perceived in the market, ensuring every output reinforces a consistent, differentiated identity.

#### 2. Role Type

Human Persona (Strategy Team)

#### 3. Scope of Responsibility

Brand positioning and perception across assigned Client channels.

#### 4. Core Objective

Define, maintain, and evolve brand positioning across all channels to ensure consistent perception, trust, and authority.

#### 5. System Interaction Scope

- Reviews the Brand Intelligence Command Center
- Monitors sentiment and competitor positioning
- Audits messaging consistency
- Does not directly execute publishing

#### 6. Decision Authority

Can independently approve messaging guidelines, brand tone, conceptual visual direction, narrative frameworks, and positioning refinements; escalates full rebranding, market repositioning, and major identity changes.

#### 7. Constraints

- Cannot bypass executive approval for repositioning
- Cannot bypass audit logs
- Cannot bypass brand governance rules

#### 8. Key Inputs

- Research Intelligence Engine
- Business Intelligence Framework
- Competitor intelligence & content outputs
- Audience sentiment & market trend analysis

#### 9. Outputs

- Brand positioning & messaging frameworks
- Narrative systems & tone-of-voice standards
- Brand consistency recommendations
- Differentiation strategies

#### 10. Success Metrics

- Brand awareness & sentiment score
- Share of voice
- Message consistency score
- Audience perception index

#### 11. Collaboration Model

Works closely with Growth Director, Content Strategist, SEO Strategist, and Paid Media Strategist.

#### 12. AI Augmentation

Brand, Research, Strategy, Content, and Reporting Agents — each recommendation includes evidence, confidence, expected brand impact, recommended action, and perception outcome.

#### 13. Lifecycle Position

Active while assigned to Clients with active brand work.

#### 14. Security Context

Client-scoped access; cannot bypass brand governance, repositioning approval, or audit (Doc 06 + Doc 13).

#### 15. Configuration Dependencies

Client-level configuration and capability availability.

#### 16. Failure Mode

Inconsistent messaging, weak differentiation, and brand dilution across channels.

#### 17. Auditability

Every brand decision records decision maker, timestamp, supporting evidence, AI recommendation, confidence, expected brand impact, business outcome, and messaging impact.

#### 18. External Interaction

No direct external system interaction; brand assets are published by the Execution Layer.

#### 19. Notes

Owns market perception and consistent, differentiated brand identity.

## Delivery Team

### Account Manager

#### 1. Identity

Account Manager is the primary relationship owner between AGE and a Client's business, responsible for ensuring alignment between Client expectations and delivered outcomes.

#### 2. Role Type

Human Persona (Delivery Team)

#### 3. Scope of Responsibility

Client-level relationship oversight across all Projects within assigned Clients.

#### 4. Core Objective

Ensure sustained Client success through alignment, expectation management, and structured delivery coordination.

#### 5. System Interaction Scope

- Reads Client-level data and project-level summaries
- Coordinates across Delivery Team personas
- Interfaces with Execution outcomes via reports and dashboards
- Cannot directly execute system actions

#### 6. Decision Authority

- Can recommend prioritization changes across Projects
- Can escalate risks and delivery concerns
- Cannot approve or modify execution actions directly

#### 7. Constraints

- No access outside assigned Clients
- Cannot bypass Permission or Security layers
- Cannot trigger Execution Layer actions

#### 8. Key Inputs

- Client Reports (Doc 10)
- Project progress summaries
- Notification signals (Doc 08)
- Risk and escalation signals (Doc 09)

#### 9. Outputs

- Client alignment recommendations
- Escalation signals
- Delivery health assessments

#### 10. Success Metrics

- Client retention stability
- Delivery satisfaction consistency
- Reduced escalation frequency over time

#### 11. Collaboration Model

Works closely with Project Manager and Customer Success Manager (Revenue Team)

#### 12. AI Augmentation

May be assisted by AI Intelligence Agents for summarization and insight generation

#### 13. Lifecycle Position

Active only when assigned to Clients (Doc 03 lifecycle governs context validity)

#### 14. Security Context

Operates strictly within Client-scoped permissions (Doc 06 + Doc 13)

#### 15. Configuration Dependencies

Client-level configuration defines reporting visibility and communication preferences

#### 16. Failure Mode

Misalignment between Client expectations and delivery execution flow

#### 17. Auditability

All recommendations and escalations are traceable via reporting and execution chains

#### 18. External Interaction

No direct external system interaction

#### 19. Notes

Serves as the primary business continuity persona for Client relationships

### Project Manager

#### 1. Identity

Project Manager is responsible for coordinating execution of Client Projects within AGE, ensuring structured delivery across capabilities and Execution Layer outputs.

#### 2. Role Type

Human Persona (Delivery Team)

#### 3. Scope of Responsibility

Project-level execution coordination within assigned Client contexts.

#### 4. Core Objective

Ensure Projects are executed in alignment with approved plans, capability outputs, and Client expectations.

#### 5. System Interaction Scope

- Reads Project-level data (Workspace Model Doc 02)
- Coordinates Execution Layer outputs via approved workflows
- Interfaces with AI-generated capability plans
- Does not directly perform execution actions

#### 6. Decision Authority

- Can prioritize tasks within Project scope
- Can request re-evaluation of execution plans
- Cannot approve or bypass Execution Layer

#### 7. Constraints

- Restricted to assigned Projects
- Cannot override Client-level governance
- Cannot execute side effects directly (Doc 12 enforcement)

#### 8. Key Inputs

- Capability outputs (Doc 04)
- Execution plans (Doc 12)
- Automation signals (Doc 09)
- Integration signals (Doc 11)

#### 9. Outputs

- Project coordination decisions
- Execution prioritization requests
- Delivery alignment feedback

#### 10. Success Metrics

- On-time project execution alignment
- Reduced execution rework cycles
- Stable throughput of capability delivery

#### 11. Collaboration Model

Works closely with Account Manager, QA Lead, Developer personas

#### 12. AI Augmentation

AI Agents assist in planning, summarization, and dependency tracking

#### 13. Lifecycle Position

Active only during Project lifecycle (Doc 03)

#### 14. Security Context

Scoped to Project-level permissions only

#### 15. Configuration Dependencies

Project-level configuration defines workflow enablement and capability exposure

#### 16. Failure Mode

Execution misalignment or coordination breakdown between capabilities and delivery teams

#### 17. Auditability

All coordination decisions are traceable through execution chain logs

#### 18. External Interaction

No direct external system interaction

#### 19. Notes

Acts as the operational bridge between AI Capability output and Execution Layer

### QA Lead

#### 1. Identity

QA Lead is responsible for ensuring delivery correctness, validation of outputs, and quality alignment across Projects within Client contexts.

#### 2. Role Type

Human Persona (Delivery Team)

#### 3. Scope of Responsibility

Quality assurance across Project-level deliverables and capability outputs.

#### 4. Core Objective

Ensure that all delivered outputs meet defined business expectations, are consistent with Client requirements, and align with Execution Layer results.

#### 5. System Interaction Scope

- Reviews Project outputs and Execution results
- Validates AI-generated and human-executed outputs
- Coordinates with Project Manager for corrective actions
- Does not execute system changes directly

#### 6. Decision Authority

- Can flag issues in delivered outputs
- Can request re-validation or re-execution via proper workflows
- Cannot approve Execution Layer actions independently

#### 7. Constraints

- No direct execution privileges
- Cannot bypass approval or security layers
- Restricted to assigned Client and Project scope

#### 8. Key Inputs

- Execution outputs (Doc 12)
- Reports (Doc 10)
- Automation signals (Doc 09)
- Integration data (Doc 11)

#### 9. Outputs

- Quality validation reports
- Defect/issue identification
- Improvement recommendations

#### 10. Success Metrics

- Defect reduction rate
- First-pass quality success rate
- Stability of delivered outputs across cycles

#### 11. Collaboration Model

Works closely with Project Manager, Developer, and AI QA Agents

#### 12. AI Augmentation

May leverage AI QA Agents for automated validation and anomaly detection

#### 13. Lifecycle Position

Active during Project execution lifecycle (Doc 03)

#### 14. Security Context

Scoped strictly to Project-level access controls (Doc 06 + Doc 13)

#### 15. Configuration Dependencies

Project-level quality thresholds and validation rules (conceptual, not system-defined)

#### 16. Failure Mode

Undetected defects or misalignment between expected and delivered outputs

#### 17. Auditability

All validation actions and flags are traceable through system audit chain

#### 18. External Interaction

No direct external system interaction

#### 19. Notes

Acts as the final quality gate before business acceptance of outputs

### Developer

#### 1. Identity

Developer is responsible for implementing execution-ready outputs based on approved capability plans and structured delivery requirements.

#### 2. Role Type

Human Persona (Delivery Team)

#### 3. Scope of Responsibility

Execution of technical implementation within Project scope.

#### 4. Core Objective

Translate approved capability outputs and project requirements into working system behavior through the Execution Layer.

#### 5. System Interaction Scope

- Works with Execution Layer outputs
- Implements approved changes via controlled execution workflows
- Does not define business logic independently
- Does not bypass Execution Layer

#### 6. Decision Authority

- Can choose implementation approach within constraints
- Can suggest improvements to execution plans
- Cannot approve or trigger execution independently

#### 7. Constraints

- Must operate within Execution Model boundaries (Doc 12)
- Cannot modify system behavior outside approved workflows
- No cross-client access

#### 8. Key Inputs

- Capability outputs (Doc 04)
- Execution plans (Doc 12)
- Project specifications (Doc 02 workspace context)
- Integration definitions (Doc 11)

#### 9. Outputs

- Implemented system changes (via Execution Layer)
- Technical implementation feedback
- Optimization suggestions

#### 10. Success Metrics

- Execution correctness
- Deployment stability
- Reduction in rework cycles

#### 11. Collaboration Model

Works closely with Project Manager and QA Lead

#### 12. AI Augmentation

May be assisted by AI coding/implementation agents within approved workflows

#### 13. Lifecycle Position

Active during Project execution lifecycle

#### 14. Security Context

Strictly scoped to Project-level permissions

#### 15. Configuration Dependencies

Depends on capability enablement and project configuration constraints

#### 16. Failure Mode

Incorrect or incomplete implementation of approved execution plans

#### 17. Auditability

All implementation actions are traceable through Execution Layer logs

#### 18. External Interaction

No direct external system interaction

#### 19. Notes

Acts as execution implementer of approved business intent

### Designer

#### 1. Identity

Designer is responsible for shaping the user-facing and experience layer representation of AGE outputs within defined business and product constraints.

#### 2. Role Type

Human Persona (Delivery Team)

#### 3. Scope of Responsibility

Design of experience representations across Client and Project outputs.

#### 4. Core Objective

Ensure that outputs are presented in a clear, usable, and consistent manner aligned with business intent and system constraints.

#### 5. System Interaction Scope

- Works with structured outputs from Execution Layer
- Translates outputs into presentation-ready formats
- Does not define system behavior or logic
- Does not influence execution decisions

#### 6. Decision Authority

- Can define presentation structure within constraints
- Can recommend UX improvements
- Cannot alter underlying system logic or data behavior

#### 7. Constraints

- Must operate within UI & Navigation rules (Doc 07)
- Cannot bypass Permissions or Execution constraints
- No influence over backend logic

#### 8. Key Inputs

- Execution outputs (Doc 12)
- Reports (Doc 10)
- System context (Doc 02 workspace model)

#### 9. Outputs

- Design representations of system outputs
- Experience structuring recommendations
- Presentation consistency guidelines

#### 10. Success Metrics

- Clarity of output representation
- User comprehension effectiveness
- Consistency across surfaces

#### 11. Collaboration Model

Works closely with Account Manager and Project Manager

#### 12. AI Augmentation

May use AI design assistance tools for layout and structuring support

#### 13. Lifecycle Position

Active during Project delivery lifecycle

#### 14. Security Context

Scoped to Project-level access boundaries

#### 15. Configuration Dependencies

Client and Project configuration defines presentation constraints

#### 16. Failure Mode

Misrepresentation of system outputs or misaligned user experience

#### 17. Auditability

Design decisions tied to output traceability chain

#### 18. External Interaction

No direct external system interaction

#### 19. Notes

Acts as the experience translation layer between system output and user perception

## Revenue Team

### Sales Executive

#### 1. Identity

Sales Executive is responsible for acquiring new Clients and initiating structured engagement within the AGE platform.

#### 2. Role Type

Human Persona (Revenue Team)

#### 3. Scope of Responsibility

New Client acquisition and transition into Client Lifecycle (Doc 03).

#### 4. Core Objective

Convert qualified business opportunities into onboarded Clients within AGE.

#### 5. System Interaction Scope

- Works with Client creation workflows
- Uses system insights and reports for positioning
- Interfaces with capability outputs for value demonstration
- Does not modify system behavior or execution logic

#### 6. Decision Authority

- Can initiate Client onboarding workflows
- Can position capability offerings
- Cannot alter pricing, system rules, or execution flows

#### 7. Constraints

- Must operate within approved business boundaries
- Cannot bypass Permissions (Doc 06) or Security (Doc 13)
- No direct Execution Layer access

#### 8. Key Inputs

- Market insights (Doc 11 integrations)
- Capability catalog (Doc 15 roadmap context)
- Reporting outputs (Doc 10)
- Intelligence outputs (Doc 04 ecosystem)

#### 9. Outputs

- Client acquisition proposals
- Engagement summaries
- Onboarding initiation signals

#### 10. Success Metrics

- Client conversion rate
- Qualified pipeline quality
- Onboarding success rate

#### 11. Collaboration Model

Works closely with Proposal Specialist and Account Manager

#### 12. AI Augmentation

May use AI Intelligence Agents for lead analysis and proposal framing

#### 13. Lifecycle Position

Active only in pre-Client to Client transition phase (Doc 03 boundary respected)

#### 14. Security Context

Scoped to Organization-level access only

#### 15. Configuration Dependencies

Organization-level configuration defines sales constraints and capability positioning

#### 16. Failure Mode

Misalignment between Client expectations and platform capability value

#### 17. Auditability

All acquisition actions are traceable through onboarding and Client creation logs

#### 18. External Interaction

Primary persona interacting with external systems and prospects

#### 19. Notes

Represents the formal entry point of Clients into the AGE ecosystem

### Proposal Specialist

#### 1. Identity

Proposal Specialist is responsible for creating structured business proposals based on AGE capabilities and Client requirements.

#### 2. Role Type

Human Persona (Revenue Team)

#### 3. Scope of Responsibility

Proposal creation and alignment with Client needs and platform capabilities.

#### 4. Core Objective

Translate capability value into structured proposals that support Client acquisition and engagement.

#### 5. System Interaction Scope

- Uses capability catalog (Doc 15)
- Uses intelligence outputs (Doc 04)
- Uses reporting insights (Doc 10)
- Does not execute system changes or workflows

#### 6. Decision Authority

- Can structure proposal content
- Can recommend capability combinations
- Cannot commit system resources or execution actions

#### 7. Constraints

- Must align with frozen architecture
- Cannot override capability definitions
- No access to Execution Layer

#### 8. Key Inputs

- Capability outputs (Doc 04)
- Market insights (Doc 11)
- Client context from Sales Executive
- Business intelligence signals

#### 9. Outputs

- Structured proposals
- Capability mappings for Client needs
- Value articulation documents

#### 10. Success Metrics

- Proposal acceptance rate
- Conversion support effectiveness
- Alignment accuracy with Client needs

#### 11. Collaboration Model

Works closely with Sales Executive and Customer Success Manager

#### 12. AI Augmentation

May use AI for proposal drafting and structuring support

#### 13. Lifecycle Position

Active during pre-onboarding phase

#### 14. Security Context

Scoped to Organization-level access only

#### 15. Configuration Dependencies

Organization-level constraints define proposal boundaries and capability exposure

#### 16. Failure Mode

Misalignment between proposal and actual platform capability

#### 17. Auditability

All proposal generation actions are traceable through system logs

#### 18. External Interaction

Interfaces with external prospects and Client stakeholders

#### 19. Notes

Acts as the structured translation layer between capability value and commercial articulation

### Customer Success Manager

#### 1. Identity

Customer Success Manager is responsible for ensuring long-term Client satisfaction and sustained value realization from the AGE platform.

#### 2. Role Type

Human Persona (Revenue Team)

#### 3. Scope of Responsibility

Post-onboarding Client success and retention across lifecycle.

#### 4. Core Objective

Ensure Clients continuously realize value from AGE capabilities and remain aligned with platform outcomes.

#### 5. System Interaction Scope

- Monitors Client reports and system outputs
- Coordinates with Account Manager for relationship continuity
- Uses insights from AI and reporting layers
- Does not modify execution or system behavior

#### 6. Decision Authority

- Can recommend retention strategies
- Can escalate Client risks
- Cannot modify system operations or execution flows

#### 7. Constraints

- No execution privileges
- Restricted to Client-scoped access
- Cannot override security or permission rules

#### 8. Key Inputs

- Reports (Doc 10)
- Notifications (Doc 08)
- Client lifecycle state (Doc 03)
- Capability performance data

#### 9. Outputs

- Retention strategies
- Client health assessments
- Expansion recommendations

#### 10. Success Metrics

- Client retention rate
- Expansion revenue influence
- Client satisfaction stability

#### 11. Collaboration Model

Works closely with Account Manager and Project Manager

#### 12. AI Augmentation

Uses AI insights for churn prediction and value tracking

#### 13. Lifecycle Position

Active during Active and Paused Client states

#### 14. Security Context

Scoped strictly to assigned Clients

#### 15. Configuration Dependencies

Client-level configuration defines communication and reporting access

#### 16. Failure Mode

Failure to detect declining Client value or satisfaction

#### 17. Auditability

All recommendations and Client interactions are traceable

#### 18. External Interaction

May interact with Client stakeholders for success alignment

#### 19. Notes

Acts as the long-term value assurance layer for Client relationships

## Client Team

### Business Owner

#### 1. Identity

Business Owner represents the primary decision-making authority within a Client's business using AGE.

#### 2. Role Type

Human Persona (Client Team)

#### 3. Scope of Responsibility

Client-level strategic decisions and approval authority across Projects and outcomes.

#### 4. Core Objective

Ensure that AGE outputs align with business goals, strategic direction, and expected value realization.

#### 5. System Interaction Scope

- Reviews reports and high-level outputs (Doc 10)
- Approves or rejects strategic recommendations
- Engages with Account Manager for alignment
- Does not interact directly with Execution Layer

#### 6. Decision Authority

- Final approval authority for Client-side strategic decisions
- Can accept or reject proposed directions
- Cannot modify system architecture or execution behavior

#### 7. Constraints

- Bound to Client-scoped access (Doc 06)
- Cannot access other Clients or Organization-wide data
- Cannot bypass Security or Execution constraints

#### 8. Key Inputs

- Reports (Doc 10)
- Strategic insights (Doc 04 + BIF outputs)
- Account Manager summaries
- Client lifecycle context (Doc 03)

#### 9. Outputs

- Strategic approvals or rejections
- Business direction feedback
- Priority alignment decisions

#### 10. Success Metrics

- Business outcome alignment
- ROI realization from platform usage
- Strategic satisfaction stability

#### 11. Collaboration Model

Works closely with Account Manager and Customer Success Manager

#### 12. AI Augmentation

Receives AI-generated insights and summaries but does not interact with AI systems directly

#### 13. Lifecycle Position

Active during Active Client state (Doc 03)

#### 14. Security Context

Strict Client-level scoped access only

#### 15. Configuration Dependencies

Client-level configuration defines reporting depth and visibility

#### 16. Failure Mode

Misalignment between platform outputs and business expectations

#### 17. Auditability

All decisions and approvals are recorded in traceable system logs

#### 18. External Interaction

Primary executive stakeholder interacting with AGE outputs

#### 19. Notes

Represents final authority on Client-side strategic acceptance

### Marketing Head

#### 1. Identity

Marketing Head is responsible for leveraging AGE outputs to drive marketing strategy, campaigns, and growth initiatives within the Client's business.

#### 2. Role Type

Human Persona (Client Team)

#### 3. Scope of Responsibility

Marketing strategy execution using insights and outputs generated by AGE.

#### 4. Core Objective

Translate AGE intelligence and reports into actionable marketing strategies and campaigns.

#### 5. System Interaction Scope

- Uses Reports (Doc 10) and insights from Intelligence Layer
- Interacts with capability outputs for growth strategies
- Coordinates with Project Manager for execution alignment
- Does not modify system logic or Execution Layer

#### 6. Decision Authority

- Can define marketing priorities
- Can request insights and reporting adjustments
- Cannot approve Execution Layer actions

#### 7. Constraints

- Limited to Client-scoped data access
- Cannot override platform-level capabilities
- Must operate within configured constraints

#### 8. Key Inputs

- Intelligence outputs (Doc 04)
- Reports (Doc 10)
- Integration data (Doc 11)
- Campaign performance signals

#### 9. Outputs

- Marketing strategies
- Campaign direction inputs
- Growth recommendations

#### 10. Success Metrics

- Campaign performance improvement
- Lead generation quality
- Marketing ROI improvement

#### 11. Collaboration Model

Works closely with Sales Executive (Revenue Team) and Project Manager

#### 12. AI Augmentation

Uses AI insights for market analysis, segmentation, and performance optimization

#### 13. Lifecycle Position

Active during Active Client state

#### 14. Security Context

Strict Client-level scoped access

#### 15. Configuration Dependencies

Client-level configuration defines reporting granularity and insight access

#### 16. Failure Mode

Misalignment between marketing execution and platform insights

#### 17. Auditability

All decisions and insights usage are traceable

#### 18. External Interaction

May interact with external marketing channels indirectly via Execution Layer outputs

#### 19. Notes

Acts as the strategic growth translation layer within Client businesses

### Product Manager

#### 1. Identity

Product Manager represents the Client-side product ownership function, aligning AGE outputs with product strategy and user needs.

#### 2. Role Type

Human Persona (Client Team)

#### 3. Scope of Responsibility

Product strategy alignment and requirement definition within Client context.

#### 4. Core Objective

Ensure AGE outputs contribute effectively to product direction, feature prioritization, and user experience improvement.

#### 5. System Interaction Scope

- Uses reports and insights (Doc 10)
- Engages with AI-generated capability outputs
- Coordinates with Project Manager for implementation alignment
- Does not influence system architecture or Execution Layer

#### 6. Decision Authority

- Can define product priorities
- Can request analysis or insights
- Cannot approve or trigger execution directly

#### 7. Constraints

- Restricted to Client-level data and permissions
- Cannot alter platform capabilities
- Cannot bypass Execution or Security layers

#### 8. Key Inputs

- Reports (Doc 10)
- Intelligence outputs (Doc 04)
- User and market insights via integrations (Doc 11)
- Project-level execution summaries

#### 9. Outputs

- Product requirements
- Priority adjustments
- Feature direction inputs

#### 10. Success Metrics

- Product improvement alignment
- Feature impact effectiveness
- User satisfaction improvement

#### 11. Collaboration Model

Works closely with Marketing Head and Project Manager

#### 12. AI Augmentation

Uses AI insights for product analytics and prioritization support

#### 13. Lifecycle Position

Active during Active Client state

#### 14. Security Context

Strict Client-level scoped access

#### 15. Configuration Dependencies

Client-level configuration defines insight depth and reporting access

#### 16. Failure Mode

Misalignment between product direction and system outputs

#### 17. Auditability

All product decisions and insights are fully traceable

#### 18. External Interaction

Indirect interaction via Client-facing outputs and reports

#### 19. Notes

Represents Client-side product governance and interpretation layer

## AI Workforce

### Executive Agent

#### 1. Identity

AI Executive Agent is a high-level reasoning agent responsible for synthesizing business context and guiding strategic interpretation across the AGE platform.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Cross-domain synthesis of business intelligence across Clients and Projects.

#### 4. Core Objective

Provide structured, high-level reasoning outputs that support decision-making across business layers.

#### 5. System Interaction Scope

- Consumes BIF outputs and Reports (Doc 10)
- Operates on aggregated intelligence context
- Provides reasoning outputs to human personas
- Does not execute actions or trigger workflows

#### 6. Decision Authority

- Can propose strategic interpretations
- Cannot approve execution or modify system behavior

#### 7. Constraints

- Must remain a pure producer (Doc 04 + Doc 12 alignment)
- No side-effect capability
- No cross-client memory persistence beyond scoped context

#### 8. Key Inputs

- Business Intelligence Framework (BIF)
- Reports (Doc 10)
- Integration signals (Doc 11)

#### 9. Outputs

- Strategic reasoning summaries
- Cross-client pattern insights (contextual only)
- Decision support narratives

#### 10. Success Metrics

- Accuracy of synthesized insights
- Decision usefulness to human stakeholders
- Context relevance

#### 11. Collaboration Model

Works with Account Managers, Business Owners, and Strategy-oriented AI agents

#### 12. AI Augmentation

N/A (self-referential agent role within AI workforce)

#### 13. Lifecycle Position

Active across all Client lifecycle states where data exists

#### 14. Security Context

Strictly scoped to permitted Client/Organization context

#### 15. Configuration Dependencies

Depends on configured capability access and data visibility scope

#### 16. Failure Mode

Misinterpretation of cross-domain signals or context drift

#### 17. Auditability

All outputs are traceable to input intelligence sources

#### 18. External Interaction

None

#### 19. Notes

Serves as top-level reasoning layer within AI Workforce hierarchy

### Research Agent

#### 1. Identity

AI Research Agent is the foundation of truth — converting raw data into structured evidence for downstream systems.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Evidence collection and signal extraction across sources.

#### 4. Core Objective

Collect, normalize, and structure internal/external information into actionable evidence signals.

#### 5. System Interaction Scope

- Monitors configured sources and RIE triggers
- Extracts, normalizes, and tags evidence
- Provides structured signals to Strategy/Intelligence agents
- Does not execute actions

#### 6. Decision Authority

- Can collect from approved sources, structure/normalize information, generate evidence objects, and tag signals
- Cannot interpret strategy, make decisions, generate recommendations, or modify BIF/RIE logic

#### 7. Constraints

- Pure analytical role; no side effects
- No recommendations without evidence tagging

#### 8. Key Inputs

- Approved data sources & RIE pipeline triggers
- Strategy Agent requests
- SEO/Content research requests
- Market intelligence feeds

#### 9. Outputs

- Evidence objects & structured signals
- Research summaries & trend reports
- Normalized datasets

#### 10. Success Metrics

- Signal accuracy & source reliability
- Data coverage %
- Extraction precision
- Noise ratio

#### 11. Collaboration Model

Works with Strategy, SEO, Content, and Paid Media Agents and the RIE system layer.

#### 12. AI Augmentation

N/A internal role.

#### 13. Lifecycle Position

Always active within available data scope.

#### 14. Security Context

Scoped access enforced via Doc 13.

#### 15. Configuration Dependencies

Data visibility and integration enablement.

#### 16. Failure Mode

Noisy sources, conflicting signals, or incomplete coverage.

#### 17. Auditability

Every research output records source used, extraction method, confidence, timestamp, signal classification, and data freshness — no evidence untraceable.

#### 18. External Interaction

None (indirect via integrations only).

#### 19. Notes

Core evidence/truth layer of the AI Workforce.

### Intelligence Agent

#### 1. Identity

AI Intelligence Agent processes structured and unstructured data to generate actionable business insights.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Analysis of business signals across integrations, reports, and system outputs.

#### 4. Core Objective

Transform raw and structured data into actionable intelligence signals.

#### 5. System Interaction Scope

- Reads integrations (Doc 11)
- Consumes reports (Doc 10)
- Feeds outputs into Executive and Strategy agents
- Does not execute actions

#### 6. Decision Authority

- Can generate insights and recommendations
- Cannot trigger execution or workflows

#### 7. Constraints

- Pure analytical role only
- No side effects
- No direct system modification

#### 8. Key Inputs

- Integration data
- Reports
- BIF signals

#### 9. Outputs

- Insight generation
- Trend detection
- Anomaly identification

#### 10. Success Metrics

- Insight accuracy
- Signal relevance
- Reduction in human analysis overhead

#### 11. Collaboration Model

Feeds into Executive, Strategy, and Capability agents

#### 12. AI Augmentation

N/A internal role

#### 13. Lifecycle Position

Always active within available data scope

#### 14. Security Context

Scoped access enforced via Doc 13

#### 15. Configuration Dependencies

Data visibility and integration enablement

#### 16. Failure Mode

False positives or misinterpreted signals

#### 17. Auditability

All insights traceable to source data

#### 18. External Interaction

None

#### 19. Notes

Core analytical layer of AI Workforce

### Strategy Agent

#### 1. Identity

AI Strategy Agent is the central reasoning engine that converts fragmented intelligence into coherent strategic direction.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Cross-system reasoning and decision support across Clients and Projects.

#### 4. Core Objective

Generate strategic recommendations by synthesizing BIF, RIE, SIE, and capability outputs into actionable decision intelligence.

#### 5. System Interaction Scope

- Ingests outputs from all intelligence layers (BIF, RIE, SIE, capabilities)
- Detects contradictions and clusters opportunities
- Provides ranked recommendations and scenario comparisons
- Does not execute actions or trigger workflows

#### 6. Decision Authority

- Can generate recommendations, rank opportunities, and propose strategic adjustments
- Cannot execute actions, modify BIF/RIE, override human approvals, or trigger external systems

#### 7. Constraints

- Must remain a pure producer (Doc 04 + Doc 12)
- No side-effect capability
- No cross-client memory persistence beyond scoped context

#### 8. Key Inputs

- Business Intelligence Framework
- Research & Strategy Intelligence Engines
- Capability outputs
- Performance dashboards & historical decision logs

#### 9. Outputs

- Strategic recommendation sets & opportunity rankings
- Risk assessments
- Scenario simulations
- Decision packages & priority matrices

#### 10. Success Metrics

- Decision quality score
- Recommendation adoption rate
- Opportunity & risk detection accuracy
- Time-to-insight

#### 11. Collaboration Model

Works with Research, SEO, Content, Paid Media, and Growth Agents, and with Growth Director and Business Owners.

#### 12. AI Augmentation

N/A (self-referential agent role within AI Workforce).

#### 13. Lifecycle Position

Active across Client lifecycle states where data exists.

#### 14. Security Context

Strictly scoped to permitted Client/Organization context (Doc 13).

#### 15. Configuration Dependencies

Configured capability access and data visibility scope.

#### 16. Failure Mode

Misinterpretation of cross-domain signals or context drift.

#### 17. Auditability

Every recommendation records input signals used, decision-logic path, confidence, alternatives considered, expected impact, risk assessment, and timestamp — never untraceable or unexplainable.

#### 18. External Interaction

None.

#### 19. Notes

Top-level reasoning layer of the AI Workforce.

### Market Discovery Agent

#### 1. Identity

AI Market Discovery Agent identifies market opportunities, trends, and competitive signals.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Market scanning and opportunity identification.

#### 4. Core Objective

Detect and surface emerging market opportunities relevant to Clients and capabilities.

#### 5. System Interaction Scope

- Uses integrations (Doc 11)
- Uses external market signals and datasets
- Provides structured opportunity signals
- Does not execute actions

#### 6. Decision Authority

- Can surface opportunities
- Cannot validate or execute decisions

#### 7. Constraints

- No execution rights
- No autonomous action triggering

#### 8. Key Inputs

- Market data integrations
- External signals (reviews, platforms, trends)

#### 9. Outputs

- Opportunity identification
- Market trend mapping
- Competitive landscape signals

#### 10. Success Metrics

- Opportunity accuracy
- Signal relevance
- Early detection capability

#### 11. Collaboration Model

Works with Strategy and Intelligence agents

#### 12. AI Augmentation

N/A internal role

#### 13. Lifecycle Position

Active continuously

#### 14. Security Context

Scoped to allowed integrations and Client contexts

#### 15. Configuration Dependencies

Integration enablement and data access scopes

#### 16. Failure Mode

False opportunity identification or noise amplification

#### 17. Auditability

All outputs traceable to source signals

#### 18. External Interaction

None (indirect via integrations only)

#### 19. Notes

Primary external signal detection layer

### SEO Agent

#### 1. Identity

AI SEO Agent is the execution-layer producer that applies SEO strategy into optimized content and on-page improvements.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Search-optimization production within approved SEO strategy.

#### 4. Core Objective

Execute SEO optimizations across content and outputs to improve visibility, ranking, and intent alignment.

#### 5. System Interaction Scope

- Consumes SEO keyword strategy and content drafts
- Applies keyword mapping, metadata, and internal linking
- Produces SEO-optimized content and recommendations
- Does not perform side effects (publishing is Execution Layer)

#### 6. Decision Authority

- Can apply keyword optimization, metadata, internal-link suggestions, and structure adjustments
- Cannot decide keyword strategy, change SEO priorities, or override the SEO Strategist

#### 7. Constraints

- Pure producer; no side effects
- No strategic or brand changes

#### 8. Key Inputs

- SEO Strategist outputs & content drafts
- Research Intelligence Engine & Strategy Agent recommendations
- Search Console data

#### 9. Outputs

- SEO-optimized content & meta tags
- Keyword mappings
- Internal linking suggestions
- On-page SEO improvements

#### 10. Success Metrics

- SEO accuracy & keyword coverage
- Ranking improvement & CTR improvement
- Content optimization speed
- Internal linking coverage

#### 11. Collaboration Model

Works with SEO Strategist, Content Agent, and Strategy/Research Agents.

#### 12. AI Augmentation

N/A internal role.

#### 13. Lifecycle Position

Active during content lifecycle stages.

#### 14. Security Context

Scoped to Client context (Doc 13).

#### 15. Configuration Dependencies

Client content and capability configuration.

#### 16. Failure Mode

Poor keyword mapping, conflicting SEO signals, or SERP volatility.

#### 17. Auditability

Every SEO action records input content, keyword strategy applied, optimization changes, timestamp, confidence, and expected ranking impact — never untraceable.

#### 18. External Interaction

None (publishing performed by the Execution Layer).

#### 19. Notes

Execution-layer producer of SEO optimizations (still a pure producer).

### AEO/GEO Agent

#### 1. Identity

AI AEO/GEO Agent optimizes content and signals for discoverability across AI-driven and generative search ecosystems.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Search visibility and generative engine optimization strategy support.

#### 4. Core Objective

Improve discoverability of Client content across AI and search ecosystems.

#### 5. System Interaction Scope

- Uses content and reporting outputs
- Analyzes search ecosystems via integrations
- Provides optimization recommendations
- Does not execute publishing

#### 6. Decision Authority

- Can recommend optimization strategies
- Cannot implement changes

#### 7. Constraints

- Pure advisory role
- No execution capability

#### 8. Key Inputs

- Content outputs
- Search and platform signals
- Performance reports

#### 9. Outputs

- Optimization strategies
- Content structuring recommendations
- Visibility improvement insights

#### 10. Success Metrics

- Visibility improvement
- Ranking performance signals
- Engagement improvement

#### 11. Collaboration Model

Works with Marketing Head and Content workflows (Execution Layer)

#### 12. AI Augmentation

N/A internal role

#### 13. Lifecycle Position

Active during content lifecycle stages

#### 14. Security Context

Scoped access only

#### 15. Configuration Dependencies

Client content and integration access

#### 16. Failure Mode

Misaligned optimization strategies or noise overfitting

#### 17. Auditability

All recommendations traceable

#### 18. External Interaction

Indirect via integrations

#### 19. Notes

Visibility optimization intelligence layer

### Paid Media Agent

#### 1. Identity

AI Paid Media Agent manages analysis and optimization of paid media performance.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Paid media insight generation and optimization recommendations.

#### 4. Core Objective

Maximize efficiency and effectiveness of paid media investments.

#### 5. System Interaction Scope

- Reads ad platform integrations (Doc 11)
- Consumes performance reports (Doc 10)
- Provides optimization signals
- Does not execute campaign changes

#### 6. Decision Authority

- Suggests optimization strategies
- Cannot execute changes

#### 7. Constraints

- No execution authority
- Advisory-only role

#### 8. Key Inputs

- Ads platform data
- Campaign performance reports
- Market signals

#### 9. Outputs

- Optimization recommendations
- Budget allocation insights
- Performance diagnostics

#### 10. Success Metrics

- ROI improvement signals
- Cost efficiency insights
- Conversion improvement trends

#### 11. Collaboration Model

Works with Marketing Head and Project Manager

#### 12. AI Augmentation

N/A internal role

#### 13. Lifecycle Position

Active during campaign lifecycle

#### 14. Security Context

Scoped integration access only

#### 15. Configuration Dependencies

Ad platform access configuration

#### 16. Failure Mode

Misinterpretation of performance signals

#### 17. Auditability

All recommendations traceable

#### 18. External Interaction

Indirect via integrations only

#### 19. Notes

Performance optimization intelligence layer

### Content Agent

#### 1. Identity

AI Content Agent is the execution-layer producer for content generation and optimization, turning strategic intent into scalable assets.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Content production support within approved strategy.

#### 4. Core Objective

Generate, structure, and optimize content outputs based on approved strategy, aligned to SEO, brand, and conversion goals.

#### 5. System Interaction Scope

- Consumes content briefs, SEO requirements, and brand guidelines
- Generates drafts, copy, and variants
- Optimizes for SEO and brand consistency
- Does not perform side effects (publishing is Execution Layer)

#### 6. Decision Authority

- Can structure drafts, optimize readability, suggest headlines, and generate SEO metadata
- Cannot change strategy, modify brand positioning, decide topics, or override strategic intent

#### 7. Constraints

- Pure producer; no side effects
- Must not invent unsupported facts
- No strategy or brand-rule changes

#### 8. Key Inputs

- Content Strategist briefs
- SEO Strategist requirements
- Brand Strategist guidelines
- Research Intelligence Engine outputs & Strategy Agent recommendations

#### 9. Outputs

- Blog/landing/ad/social content
- SEO metadata
- Content variants
- Repurposed content formats

#### 10. Success Metrics

- Content quality & SEO alignment scores
- Engagement rate & conversion contribution
- Content production speed
- Revision rate

#### 11. Collaboration Model

Works with Content Strategist, SEO Strategist, Brand Strategist, and Strategy/Reporting Agents.

#### 12. AI Augmentation

N/A internal role.

#### 13. Lifecycle Position

Active during content lifecycle stages.

#### 14. Security Context

Scoped to Client context (Doc 13).

#### 15. Configuration Dependencies

Client content and capability configuration.

#### 16. Failure Mode

Ambiguous briefs, conflicting SEO signals, or tone misalignment.

#### 17. Auditability

Every output records input brief, SEO constraints, brand rules applied, timestamp, variants created, and confidence — no content without traceable inputs.

#### 18. External Interaction

None (publishing performed by the Execution Layer).

#### 19. Notes

Execution-layer producer of content assets (still a pure producer).

### Reporting Agent

#### 1. Identity

AI Reporting Agent is the system-wide truth-reporting layer ensuring every action, decision, and outcome is measurable and traceable.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

System accountability and performance reporting across all layers.

#### 4. Core Objective

Generate accurate, structured, and traceable reports across all system layers for transparency and visibility.

#### 5. System Interaction Scope

- Aggregates outputs from all agents, BIF, RIE, and capability systems
- Maintains reporting pipelines and validates data integrity
- Produces reports, dashboards, and audit logs
- Does not perform side effects

#### 6. Decision Authority

- Can generate reports, aggregate metrics, structure dashboards, and compile audit logs
- Cannot modify underlying data, change decisions, interpret strategic meaning, or override outputs

#### 7. Constraints

- Pure producer; no side effects
- No data alteration or decision-making

#### 8. Key Inputs

- All AI agent outputs
- BIF & RIE logs
- Strategy and execution outputs
- Capability system metrics

#### 9. Outputs

- Executive reports & KPI dashboards
- System audit logs
- Performance & cross-system reconciliation reports

#### 10. Success Metrics

- Reporting accuracy & data completeness
- Audit coverage & KPI consistency
- Reporting latency
- System traceability index

#### 11. Collaboration Model

Works with all AI Workforce agents and the Growth Director.

#### 12. AI Augmentation

N/A internal role.

#### 13. Lifecycle Position

Always active across reporting pipelines.

#### 14. Security Context

Scoped strictly via Doc 13.

#### 15. Configuration Dependencies

Data visibility and integration enablement.

#### 16. Failure Mode

Data fragmentation, inconsistent metrics, or missing inputs.

#### 17. Auditability

Every report records data sources used, aggregation logic, timestamp, KPI definitions, coverage completeness, and confidence — no report non-traceable or partially sourced.

#### 18. External Interaction

None.

#### 19. Notes

System-wide reporting and accountability layer.

### Proposal Agent

#### 1. Identity

AI Proposal Agent generates structured commercial and capability proposals.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Proposal generation support for Revenue Team.

#### 4. Core Objective

Translate capabilities and insights into structured proposal artifacts.

#### 5. System Interaction Scope

- Uses Capability Catalog (Doc 15)
- Uses intelligence outputs (Doc 04)
- Uses reports (Doc 10)
- Does not execute or send proposals

#### 6. Decision Authority

- Can generate proposals
- Cannot finalize or send externally

#### 7. Constraints

- No execution rights
- No external communication authority

#### 8. Key Inputs

- Capability definitions
- Market insights
- Client requirements

#### 9. Outputs

- Proposal drafts
- Capability mappings
- Value articulation structures

#### 10. Success Metrics

- Proposal quality
- Conversion support effectiveness
- Accuracy of capability alignment

#### 11. Collaboration Model

Works with Sales Executive and Proposal Specialist

#### 12. AI Augmentation

N/A internal role

#### 13. Lifecycle Position

Active during pre-client and onboarding phases

#### 14. Security Context

Scoped strictly to Organization/Client context

#### 15. Configuration Dependencies

Capability enablement and Client configuration

#### 16. Failure Mode

Misalignment between proposals and actual capabilities

#### 17. Auditability

All outputs traceable

#### 18. External Interaction

None

#### 19. Notes

Structured commercial intelligence layer

### Project Coordinator Agent

#### 1. Identity

AI Project Coordinator Agent assists in organizing and coordinating project execution structures.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Project-level coordination support.

#### 4. Core Objective

Improve clarity, sequencing, and alignment of Project execution plans.

#### 5. System Interaction Scope

- Reads Project data (Doc 02 workspace model)
- Uses execution plans (Doc 12)
- Coordinates task-level structuring
- Does not execute actions

#### 6. Decision Authority

- Can propose coordination structures
- Cannot modify execution state

#### 7. Constraints

- No execution authority
- Advisory-only role

#### 8. Key Inputs

- Project context
- Capability outputs
- Execution plans

#### 9. Outputs

- Coordination plans
- Dependency structures
- Execution clarity improvements

#### 10. Success Metrics

- Reduced execution friction
- Improved project clarity
- Alignment accuracy

#### 11. Collaboration Model

Works with Project Manager and Developer personas

#### 12. AI Augmentation

N/A internal role

#### 13. Lifecycle Position

Active during Project lifecycle

#### 14. Security Context

Scoped to Project access only

#### 15. Configuration Dependencies

Project-level configuration and capability access

#### 16. Failure Mode

Incorrect coordination assumptions

#### 17. Auditability

All outputs traceable

#### 18. External Interaction

None

#### 19. Notes

Execution structure optimization layer

### QA Agent

#### 1. Identity

AI QA Agent performs automated quality analysis and validation support across system outputs.

#### 2. Role Type

AI Persona (AI Workforce)

#### 3. Scope of Responsibility

Quality analysis and anomaly detection across outputs.

#### 4. Core Objective

Improve correctness, consistency, and reliability of system outputs.

#### 5. System Interaction Scope

- Reads execution outputs (Doc 12)
- Uses reports (Doc 10)
- Analyzes system outputs for correctness signals
- Does not approve or execute changes

#### 6. Decision Authority

- Can flag quality issues
- Cannot approve or block execution

#### 7. Constraints

- Pure analytical validation role
- No execution authority

#### 8. Key Inputs

- Execution outputs
- Reports
- Project data

#### 9. Outputs

- QA signals
- Defect detection
- Quality scoring insights

#### 10. Success Metrics

- Defect detection accuracy
- False positive reduction
- Quality coverage

#### 11. Collaboration Model

Works with QA Lead and Project Manager

#### 12. AI Augmentation

N/A internal role

#### 13. Lifecycle Position

Active during all execution phases

#### 14. Security Context

Scoped strictly via Doc 13

#### 15. Configuration Dependencies

Project-level quality configuration

#### 16. Failure Mode

Incorrect defect classification

#### 17. Auditability

All QA outputs fully traceable

#### 18. External Interaction

None

#### 19. Notes

Automated quality assurance intelligence layer

---

# Cross-Persona Collaboration Matrix

Derived from each persona's **Collaboration Model**, **AI Augmentation**, **Outputs**, and **Success
Metrics** sections (above). No relationships are invented.

> **Capabilities Used** is intentionally left **undefined (—)**: per Doc 04, the AI Workforce ↔
> Capability relationship is **many-to-many and not enumerated** in the Product Bible, so a
> per-persona capability mapping cannot be derived without guessing.

| Persona                       | Collaborates With                                                                          | AI Agents Used                                                                             | Capabilities Used | Primary Outputs                                                                           | Primary KPIs                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Founder / CEO**             | Works closely with COO, Growth Director, Sales, Account Managers, Project Managers, and F… | Executive, Strategy, Intelligence, Reporting, and Decision Support Agents — each recommen… | —                 | Strategic decisions & budget approvals; Company objectives & growth priorities            | Revenue growth (MRR / ARR); Gross margin / EBITDA                                 |
| **COO**                       | Works closely with Founder / CEO, Growth Director, Project Managers, Account Managers, an… | Operations, Project Coordinator, Reporting, QA, and Decision Support Agents — each recomm… | —                 | Operational plans & resource allocation decisions; Delivery priorities & capacity plans   | Project delivery & on-time rate; Project profitability & resource utilization     |
| **Growth Director**           | Works closely with the Founder / CEO, COO, and the full Strategy Team.                     | Growth, Strategy, Reporting, Optimization, and Research Agents — each recommendation incl… | —                 | Growth strategies & revenue optimization plans; Cross-channel allocation models           | Revenue growth rate; CAC / LTV / ROAS                                             |
| **SEO Strategist**            | Works closely with Growth Director, Content Strategist, and Brand/Paid Media Strategists.  | SEO, Content, Research, Strategy, and Reporting Agents — each recommendation includes evi… | —                 | Keyword strategies & content SEO briefs; Internal linking & technical SEO recommendations | Organic traffic & keyword rankings; CTR & impressions                             |
| **Paid Media Strategist**     | Works closely with Growth Director, SEO Strategist, and Content Strategist.                | Paid Media, Strategy, Research, Conversion Optimization, and Reporting Agents — each reco… | —                 | Paid media strategies & campaign structures; Budget allocation & audience targeting plans | ROAS & CAC; Cost per conversion & conversion rate                                 |
| **Content Strategist**        | Works closely with Growth Director, SEO Strategist, and Paid Media Strategist.             | Content, Research, SEO, Strategy, and Reporting Agents — each recommendation includes evi… | —                 | Content strategies & editorial calendars; Messaging frameworks & content briefs           | Content engagement & conversion rate; Organic traffic contribution                |
| **Brand Strategist**          | Works closely with Growth Director, Content Strategist, SEO Strategist, and Paid Media St… | Brand, Research, Strategy, Content, and Reporting Agents — each recommendation includes e… | —                 | Brand positioning & messaging frameworks; Narrative systems & tone-of-voice standards     | Brand awareness & sentiment score; Share of voice                                 |
| **Account Manager**           | Works closely with Project Manager and Customer Success Manager (Revenue Team)             | May be assisted by AI Intelligence Agents for summarization and insight generation         | —                 | Client alignment recommendations; Escalation signals                                      | Client retention stability; Delivery satisfaction consistency                     |
| **Project Manager**           | Works closely with Account Manager, QA Lead, Developer personas                            | AI Agents assist in planning, summarization, and dependency tracking                       | —                 | Project coordination decisions; Execution prioritization requests                         | On-time project execution alignment; Reduced execution rework cycles              |
| **QA Lead**                   | Works closely with Project Manager, Developer, and AI QA Agents                            | May leverage AI QA Agents for automated validation and anomaly detection                   | —                 | Quality validation reports; Defect/issue identification                                   | Defect reduction rate; First-pass quality success rate                            |
| **Developer**                 | Works closely with Project Manager and QA Lead                                             | May be assisted by AI coding/implementation agents within approved workflows               | —                 | Implemented system changes (via Execution Layer); Technical implementation feedback       | Execution correctness; Deployment stability                                       |
| **Designer**                  | Works closely with Account Manager and Project Manager                                     | May use AI design assistance tools for layout and structuring support                      | —                 | Design representations of system outputs; Experience structuring recommendations          | Clarity of output representation; User comprehension effectiveness                |
| **Sales Executive**           | Works closely with Proposal Specialist and Account Manager                                 | May use AI Intelligence Agents for lead analysis and proposal framing                      | —                 | Client acquisition proposals; Engagement summaries                                        | Client conversion rate; Qualified pipeline quality                                |
| **Proposal Specialist**       | Works closely with Sales Executive and Customer Success Manager                            | May use AI for proposal drafting and structuring support                                   | —                 | Structured proposals; Capability mappings for Client needs                                | Proposal acceptance rate; Conversion support effectiveness                        |
| **Customer Success Manager**  | Works closely with Account Manager and Project Manager                                     | Uses AI insights for churn prediction and value tracking                                   | —                 | Retention strategies; Client health assessments                                           | Client retention rate; Expansion revenue influence                                |
| **Business Owner**            | Works closely with Account Manager and Customer Success Manager                            | Receives AI-generated insights and summaries but does not interact with AI systems direct… | —                 | Strategic approvals or rejections; Business direction feedback                            | Business outcome alignment; ROI realization from platform usage                   |
| **Marketing Head**            | Works closely with Sales Executive (Revenue Team) and Project Manager                      | Uses AI insights for market analysis, segmentation, and performance optimization           | —                 | Marketing strategies; Campaign direction inputs                                           | Campaign performance improvement; Lead generation quality                         |
| **Product Manager**           | Works closely with Marketing Head and Project Manager                                      | Uses AI insights for product analytics and prioritization support                          | —                 | Product requirements; Priority adjustments                                                | Product improvement alignment; Feature impact effectiveness                       |
| **Executive Agent**           | Works with Account Managers, Business Owners, and Strategy-oriented AI agents              | N/A (self-referential agent role within AI workforce)                                      | —                 | Strategic reasoning summaries; Cross-client pattern insights (contextual only)            | Accuracy of synthesized insights; Decision usefulness to human stakeholders       |
| **Research Agent**            | Works with Strategy, SEO, Content, and Paid Media Agents and the RIE system layer.         | N/A internal role.                                                                         | —                 | Evidence objects & structured signals; Research summaries & trend reports                 | Signal accuracy & source reliability; Data coverage %                             |
| **Intelligence Agent**        | Feeds into Executive, Strategy, and Capability agents                                      | N/A internal role                                                                          | —                 | Insight generation; Trend detection                                                       | Insight accuracy; Signal relevance                                                |
| **Strategy Agent**            | Works with Research, SEO, Content, Paid Media, and Growth Agents, and with Growth Directo… | N/A (self-referential agent role within AI Workforce).                                     | —                 | Strategic recommendation sets & opportunity rankings; Risk assessments                    | Decision quality score; Recommendation adoption rate                              |
| **Market Discovery Agent**    | Works with Strategy and Intelligence agents                                                | N/A internal role                                                                          | —                 | Opportunity identification; Market trend mapping                                          | Opportunity accuracy; Signal relevance                                            |
| **SEO Agent**                 | Works with SEO Strategist, Content Agent, and Strategy/Research Agents.                    | N/A internal role.                                                                         | —                 | SEO-optimized content & meta tags; Keyword mappings                                       | SEO accuracy & keyword coverage; Ranking improvement & CTR improvement            |
| **AEO/GEO Agent**             | Works with Marketing Head and Content workflows (Execution Layer)                          | N/A internal role                                                                          | —                 | Optimization strategies; Content structuring recommendations                              | Visibility improvement; Ranking performance signals                               |
| **Paid Media Agent**          | Works with Marketing Head and Project Manager                                              | N/A internal role                                                                          | —                 | Optimization recommendations; Budget allocation insights                                  | ROI improvement signals; Cost efficiency insights                                 |
| **Content Agent**             | Works with Content Strategist, SEO Strategist, Brand Strategist, and Strategy/Reporting A… | N/A internal role.                                                                         | —                 | Blog/landing/ad/social content; SEO metadata                                              | Content quality & SEO alignment scores; Engagement rate & conversion contribution |
| **Reporting Agent**           | Works with all AI Workforce agents and the Growth Director.                                | N/A internal role.                                                                         | —                 | Executive reports & KPI dashboards; System audit logs                                     | Reporting accuracy & data completeness; Audit coverage & KPI consistency          |
| **Proposal Agent**            | Works with Sales Executive and Proposal Specialist                                         | N/A internal role                                                                          | —                 | Proposal drafts; Capability mappings                                                      | Proposal quality; Conversion support effectiveness                                |
| **Project Coordinator Agent** | Works with Project Manager and Developer personas                                          | N/A internal role                                                                          | —                 | Coordination plans; Dependency structures                                                 | Reduced execution friction; Improved project clarity                              |
| **QA Agent**                  | Works with QA Lead and Project Manager                                                     | N/A internal role                                                                          | —                 | QA signals; Defect detection                                                              | Defect detection accuracy; False positive reduction                               |

# Deliverables

By completion of this document every persona in AGE must have:

- Complete operating model
- Workflow definition
- Decision authority
- KPI framework
- AI collaboration model
- Dashboard requirements
- Reporting requirements
- Notification model
- Automation opportunities
- Security permissions

This document becomes the master specification for all user-facing functionality within AGE.

---

# Table of Contents — Personas

### Executive Leadership

- [Founder / CEO](#founder--ceo)
- [COO](#coo)
- [Growth Director](#growth-director)

### Strategy Team

- [SEO Strategist](#seo-strategist)
- [Paid Media Strategist](#paid-media-strategist)
- [Content Strategist](#content-strategist)
- [Brand Strategist](#brand-strategist)

### Delivery Team

- [Account Manager](#account-manager)
- [Project Manager](#project-manager)
- [QA Lead](#qa-lead)
- [Developer](#developer)
- [Designer](#designer)

### Revenue Team

- [Sales Executive](#sales-executive)
- [Proposal Specialist](#proposal-specialist)
- [Customer Success Manager](#customer-success-manager)

### Client Team

- [Business Owner](#business-owner)
- [Marketing Head](#marketing-head)
- [Product Manager](#product-manager)

### AI Workforce

- [Executive Agent](#executive-agent)
- [Research Agent](#research-agent)
- [Intelligence Agent](#intelligence-agent)
- [Strategy Agent](#strategy-agent)
- [Market Discovery Agent](#market-discovery-agent)
- [SEO Agent](#seo-agent)
- [AEO/GEO Agent](#aeogeo-agent)
- [Paid Media Agent](#paid-media-agent)
- [Content Agent](#content-agent)
- [Reporting Agent](#reporting-agent)
- [Proposal Agent](#proposal-agent)
- [Project Coordinator Agent](#project-coordinator-agent)
- [QA Agent](#qa-agent)

---

END OF DOCUMENT
