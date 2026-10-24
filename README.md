# Agent Reliability Lab

**An Enterprise AI Agent Evaluation, Traceability & Governance Workbench**  
Built for **Brad Towers** — International Sales Engineering & Solutions Architecture Leader (Vercel Head of Solutions Architecture, EMEA Application).

---

## Central Architectural Question

> **What evidence would justify trusting this agent with this task, under these conditions?**

Enterprise customers rarely struggle to build a first AI agent prototype; they struggle to establish **verifiable trust boundaries** before putting an agent in front of engineers or customers. **Agent Reliability Lab** demonstrates how a Solutions Architecture leader scopes an agent narrowly, constrains its tool surface, separates deterministic contract checks from human oversight, and makes a defensible readiness decision.

---

## Quick Start

```bash
npm install
npm run dev          # Starts local dev server on http://localhost:3018
```

Open **[http://localhost:3018](http://localhost:3018)** in your browser.  
The application runs out of the box in **Simulation Mode** with zero API keys or external credentials.

### Verification Commands

```bash
npm test             # Run Vitest unit & contract verification suite (15 tests)
npm run typecheck    # Generate Next.js route types & run tsc --noEmit
npm run lint         # Run ESLint (zero errors, zero warnings)
npm run build        # Run production Next.js build
npm start            # Start production server on http://localhost:3018
```

---

## The Narrowly Scoped Agent Task

**Agent Role**: **Application Architecture Review Agent**  
The agent inspects a supplied repository snapshot through a constrained read-only tool interface and produces a preliminary architecture assessment containing:
- **Detected Application Technologies** (with file & line citations)
- **Main Browser, Server, and External-Service Boundaries**
- **Configuration and Deployment Evidence**
- **Material Architectural Concerns** (distinguishing `Observed in Repo`, `Assumption`, and `Recommendation`)
- **Missing Information & Unknowns**
- **Questions a Solutions Architect Should Ask the Customer**
- **Preliminary Recommendations & Supporting Evidence**
- **Mandatory Repository Review Scope Limitations** (explicitly surfacing that static source review cannot prove production latency, live deployment state, customer adoption, or regulatory compliance)

---

## Architectural Lineage from Conductor (`fatoldnerd/conductor-agent-ui`)

This project adapts core runtime governance concepts from [`fatoldnerd/conductor-agent-ui`](https://github.com/fatoldnerd/conductor-agent-ui) into a standalone Next.js web application ready for Vercel deployment:
1. **Strict Allowlisted Tool Contracts**: Instead of giving an agent arbitrary shell or network access, [`SnapshotToolSandbox`](src/lib/tools/snapshotTools.ts) only permits `listFiles`, `readFile`, and `searchFiles`. Any attempt to invoke an unallowlisted tool (such as `executeShell` in Scenario #4) is blocked and recorded in the audit trace as `blocked_unallowlisted`.
2. **Path & Input Validation**: Rejects directory traversal (`..`), absolute paths (`/etc/passwd`), null bytes, and external URLs before touching the snapshot.
3. **Hard Runtime Budgets**: Enforces `maxToolCalls`, `maxSteps`, `maxTotalInputBytes`, `maxFileBytes`, and `maxExecutionTimeMs`, surfacing any breach as an explicit terminal outcome (`halted_limit_breach` or `halted_tool_timeout`).
4. **Untrusted Output Validation**: Validates all structured agent outputs at runtime with Zod ([`StructuredArchitectureAssessmentSchema`](src/lib/schemas.ts)).
5. **Deterministic Evidence Grounding vs. Claim Quality**: [`validateAssessmentEvidence`](src/lib/evaluation/evaluator.ts) verifies that every cited file exists in the snapshot, was actually read via `readFile` during the run, has valid line numbers (`startLine`–`endLine`), and matches the file slice. The UI and evaluator keep **reference validity** separate from **architectural recommendation quality** (which requires human SA sign-off).

---

## Execution Modes: Simulation vs. Live Model

| Dimension | Simulation Mode (`simulation`) | Live Model Mode (`live`) |
| --- | --- | --- |
| **Purpose** | Reliable 5-minute interview demonstration and deterministic testing of the harness, sandbox, evaluator, and readiness policy. | Inspecting real LLM tool-calling and structured output behaviour via the Vercel AI SDK (`ai` + `@ai-sdk/openai`). |
| **Credentials Required** | None — works offline / locally out of the box. | Server-side `OPENAI_API_KEY` (optional `ARL_LIVE_MODEL`, defaults to `gpt-4o-mini`). |
| **Missing Credential Behaviour** | N/A | Fails explicitly with `blocked_missing_credentials` and explains what env var is missing. **Never silently substitutes simulation while labelling the result live.** |
| **UI Labelling & Comparability** | Persistently badged `SIMULATED MODE`. Passing simulation checks is never presented as evidence of live model reliability. | Persistently badged `LIVE MODEL MODE`. Mixed-mode comparisons (`simulation` vs `live`) are blocked. |

---

## Five Connected Views

1. **Review Workspace**: Select any of the 8 repository snapshots, choose Simulation or Live Mode, toggle between `Baseline v1.0` and `Candidate v2.0`, adjust runtime budgets, run the review, and inspect findings and line-highlighted source excerpts.
2. **Execution Trace**: Inspect every tool request/response, duration, byte count, transient retry (`Attempt 1 recoverable_error` → `Attempt 2 retried_ok`), unrecoverable timeout, budget check, token usage, and transparent cost formula without exposing hidden chain-of-thought.
3. **Evaluation Suite**: 8 scenarios with explicit expected behaviour, unacceptable behaviour, automated contract checks (`What this proves` vs `What this does NOT prove`), and human SA review criteria.
4. **Comparison and Readiness**: Like-for-like comparison between `Baseline v1.0` (passes 5/8, failing on Conflicting Docs, Prompt Redirection, and Insufficient Evidence) and `Candidate v2.0` (passes 8/8), paired with an editable **Demo Readiness Policy** (`"Meets this demo policy"` vs `"Does not meet this demo policy"`).
5. **Human Review and Decision Brief**: Record an SA oversight decision (`Accept`, `Request Revision`, `Reject`) with per-finding annotations while preserving failed technical checks intact, and print/export a clean **Architecture & Oversight Decision Brief**.

---

## Persistence & Storage Limitations

- **Browser Storage**: Run summaries, readiness policy edits, and human review decisions are persisted in browser `localStorage` under key `arl_lab_state_v1`.
- **Bounded History**: Stored history is capped at `MAX_STORED_RUNS = 40` runs and `MAX_STORED_DECISIONS = 25` human review decisions to prevent storage quota exhaustion.
- **Export & Reset**: Use the header buttons to export the full lab state as JSON or reset to the clean seeded state at any time.
- **Limitations**: Browser `localStorage` is per-device/per-browser and is not a shared multi-user audit log. For a multi-tenant enterprise deployment on Vercel, persisted runs and human review sign-offs should be moved to Vercel Postgres / Neon with append-only audit tables.

---

## Preparing for Vercel Deployment

1. Push this repository to GitHub/GitLab/Bitbucket and import it as a new project in Vercel.
2. Framework Preset: **Next.js** (detected automatically).
3. Optional Environment Variables (in Vercel Project Settings → Environment Variables):
   - `OPENAI_API_KEY`: Server-side OpenAI API key to enable **Live Model Mode**.
   - `ARL_LIVE_MODEL`: Optional model identifier (default: `gpt-4o-mini`).
4. If deployed without `OPENAI_API_KEY`, **Simulation Mode** works completely and **Live Model Mode** displays an explicit configuration diagnostic.

---

## Documentation Index

- [`AGENTS.md`](AGENTS.md) — Shared agent instructions, principles, and verification standards (`@AGENTS.md` imported in [`CLAUDE.md`](CLAUDE.md) and [`GEMINI.md`](GEMINI.md))
- [`docs/ADR-001-architecture-and-governance.md`](docs/ADR-001-architecture-and-governance.md) — Architecture Decision Record
- [`docs/EVALUATION_GUIDE.md`](docs/EVALUATION_GUIDE.md) — Evaluation Guide: What automated checks do and do not establish
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — Five-Minute Interview Demonstration Script for Brad Towers
- [`docs/LIMITATIONS_AND_NEXT_STEPS.md`](docs/LIMITATIONS_AND_NEXT_STEPS.md) — Known Limitations & Next Most Valuable Improvements
