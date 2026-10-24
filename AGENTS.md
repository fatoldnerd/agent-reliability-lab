# Agent Reliability Lab — Project Instructions (AGENTS.md)

## Purpose

**Agent Reliability Lab** is an interview demonstration and technical evaluation workbench built for **Brad Towers** (Solutions Architecture & Sales Engineering Leader, applying for Vercel’s Head of Solutions Architecture, EMEA).

It answers one central enterprise engineering question:

> **What evidence would justify trusting this agent with this task, under these conditions?**

It supports a dependable five-minute live demonstration and a deep architectural discussion on agent boundaries, tool governance, evaluation contracts, failure handling, readiness policies, and human oversight.

## Scope (v1)

- **Narrow Agent Task**: **Application Architecture Review Agent** — inspects a supplied repository snapshot through a read-only tool interface and produces a preliminary architecture assessment (detected technologies, browser/server/external-service boundaries, configuration/deployment evidence, architectural concerns, missing information, SA discovery questions, and preliminary recommendations).
- **Two Strictly Separated Execution Modes**:
  - **Simulation Mode (`simulation`)**: Deterministic scripted agent behaviour and controlled tool responses for reliable local demonstrations and harness evaluation. Always labelled `SIMULATED`. Never presented as evidence of live model reliability.
  - **Live Model Mode (`live`)**: Real model-driven execution via the Vercel AI SDK (`ai` + `@ai-sdk/openai`) using server-side `OPENAI_API_KEY`. Fails explicitly with configuration guidance if credentials are absent; never falls back silently to simulation.
- **Constrained Read-Only Tool Interface**: Only `listFiles`, `readFile`, and `searchFiles` against synthetic in-memory/fixture repository snapshots. Path traversal, unallowlisted tools, shell execution, URL fetching, and external mutations are blocked and audited.
- **Explicit Runtime Budgets**: Enforces hard caps on `maxToolCalls`, `maxSteps`, `maxTotalInputBytes`, `maxFileBytes`, and `maxExecutionTimeMs`, surfacing any breach as an explicit terminal outcome.
- **Five Connected Views**:
  1. Review Workspace
  2. Execution Trace
  3. Evaluation Suite (8 scenarios)
  4. Comparison and Readiness (`Baseline v1.0` vs `Candidate v2.0` + editable Demo Readiness Policy)
  5. Human Review and Decision Brief (with print stylesheet)

## Architectural Principles (Adapted from Conductor)

1. **Allowlisted Tool Contracts Only**: Inspired by `fatoldnerd/conductor-agent-ui`, the agent cannot invoke arbitrary commands. All tool calls pass through an allowlist and boundary validator before touching a snapshot.
2. **Untrusted Model Output**: All structured agent output is validated at runtime with Zod schemas before rendering or scoring.
3. **Evidence Validity vs. Claim Quality**: Every material finding must reference an inspected file path and line range (`startLine`–`endLine`). A deterministic validator confirms the file and line range exist in the snapshot and were read during the run. Passing reference validation proves *grounding mechanics*, not that the architectural recommendation itself is wise—human SA review remains mandatory.
4. **Epistemic Discipline**:
   - Distinguish **Observed** facts (directly supported by inspected code/config) from **Assumptions** and **Recommendations**.
   - Make repository review limits visible: static repo snapshots cannot prove production performance, live deployment state, customer adoption, or regulatory compliance.
   - Do not expose or request hidden model chain-of-thought; record observable tool events and concise decision summaries.
   - Keep technical evaluation failures permanent even if a human reviewer records an `accept` decision.
   - Label the readiness gate output strictly as `"Meets this demo policy"` or `"Does not meet this demo policy"`—never as general safety or production certification.
5. **Independent Workspace**: Runs on port `3018` with its own repository, dependencies, and bounded `localStorage` persistence (`arl_lab_state_v1`).

## Established Implementation Decisions

- **Framework & AI SDK**: Next.js 16.4.2 (App Router, Turbopack), React 19.3, TypeScript 5, Tailwind CSS v4, Zod v4, and Vercel AI SDK v6 (`ai` + `@ai-sdk/openai` using `generateText`, `Output.object`, `stepCountIs`, and `tool({ inputSchema, execute })`).
- **Directory Structure**:
  - `src/lib/types.ts` & `src/lib/schemas.ts`: Explicit TypeScript domain contracts and Zod runtime schemas.
  - `src/lib/tools/snapshotTools.ts`: `SnapshotToolSandbox` enforcing the allowlist (`listFiles`, `readFile`, `searchFiles`), relative path validation, runtime budgets, transient retry recovery, and timeout faults.
  - `src/lib/evaluation/evaluator.ts`: `validateEvidenceReference`, `validateAssessmentEvidence`, `evaluateAgentRun`, and `evaluateReadinessPolicy`.
  - `src/lib/agent/simulatedRunner.ts` & `src/lib/agent/liveRunner.ts`: Strictly separated Simulation and Live Model agent runners.
  - `src/lib/storage/persistence.ts`: Bounded `localStorage` persistence (`MAX_STORED_RUNS = 40`, `MAX_STORED_DECISIONS = 25`), seeded 8-scenario Baseline/Candidate state, JSON export, and reset.
  - `src/data/`: 8 synthetic repository snapshots (`snapshots.ts`), 8 evaluation cases (`evaluationCases.ts`), and `baseline-v1` / `candidate-v2` prompt configurations (`configurations.ts`).

## Development Commands

```bash
npm install
npm run dev          # Starts Next.js development server on http://localhost:3018
npm test             # Runs Vitest unit & integration test suite
npm run typecheck    # Runs Next.js typegen + tsc --noEmit
npm run lint         # Runs ESLint
npm run build        # Production build check
npm start            # Starts production server on http://localhost:3018
```

## Verification Expectations

Before claiming completion:
1. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
2. Verify that input/path validation, tool-call limits, timeout handling, runtime schema validation, evidence-reference validation, mode separation, readiness-policy evaluation, persistence/reset, and non-erasure of failed checks after human review are covered by automated tests.
3. Verify the five-minute demonstration journey in a real browser if available.
4. Report what was verified vs. unverified honestly; never fabricate live model runs or provider usage.
