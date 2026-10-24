# ADR-001: Architecture, Tool Sandbox Isolation & Evidence Governance

- **Status**: Accepted
- **Date**: 2026-10-24
- **Author**: Brad Towers (Solutions Architecture Leader)

## Context

Enterprise customers evaluating AI agents for engineering or architecture workflows need an answer to a concrete governance question: *"What evidence would justify trusting this agent with this task, under these conditions?"*

Generic chat interfaces and unconstrained coding agents fail enterprise governance reviews because:
1. Their task scope is unbounded.
2. Their tool access permits side effects or arbitrary command execution.
3. Unverified claims, assumptions, and code-grounded facts are blended together in prose.
4. Passing a handful of keyword tests is frequently misrepresented as "AI safety certification."

We needed a standalone web application suitable for local demonstration and Vercel deployment that reuses proven runtime-governance concepts from `fatoldnerd/conductor-agent-ui` without importing its desktop Electron IPC layer.

## Decisions

### 1. Narrow Task Scope & Read-Only Snapshot Sandbox
We scoped the agent strictly to an **Application Architecture Review Agent** operating over immutable `RepositorySnapshot` fixtures via `SnapshotToolSandbox` (`src/lib/tools/snapshotTools.ts`). Only three tools (`listFiles`, `readFile`, `searchFiles`) are allowlisted. Path validation rejects traversal (`..`), absolute paths, URLs, and null bytes. Hard runtime budgets (`maxToolCalls`, `maxSteps`, `maxTotalInputBytes`, `maxFileBytes`, `maxExecutionTimeMs`) are enforced before and during every tool call.

### 2. Strict Separation of Simulation Mode and Live Model Mode
To support both zero-credential local demonstrations and real LLM testing:
- **Simulation Mode (`simulation`)** executes deterministic scripted agent runs through the exact same `SnapshotToolSandbox`, Zod schema validator, and contract evaluator. All outputs are badged `SIMULATED MODE`.
- **Live Model Mode (`live`)** executes server-side via `/api/agent/run` using the Vercel AI SDK (`generateText` + `Output.object` + `stepCountIs`). If `OPENAI_API_KEY` is absent, it fails fast with `blocked_missing_credentials` and never silently falls back to simulation.
- The Comparison view enforces like-for-like mode comparisons and blocks mixed `simulation` vs. `live` comparisons.

### 3. Runtime Schema Validation + Deterministic Evidence Grounding
Model output is treated as untrusted data and validated against `StructuredArchitectureAssessmentSchema`. Every `EvidenceReference` (`filePath`, `startLine`, `endLine`, `excerpt`) is then checked by `validateEvidenceReference` (`src/lib/evaluation/evaluator.ts`) to verify:
1. The file exists in the snapshot.
2. The file was actually read via `readFile` during the run's execution trace.
3. The line numbers are within bounds and match the file's content.

### 4. Separation of Technical Checks, Readiness Policy, and Human Sign-Off
- Automated checks verify deterministic contracts (schema, tool allowlist, reference validity, fault/limit representation, and scenario rules).
- Human SA review (`HumanReviewDecision`) evaluates whether recommendations and discovery questions are architecturally sound.
- Recording a human `accept` verdict satisfies the human review gate in `ReadinessPolicy`, but **never mutates or erases failed technical checks** on the underlying run.
- Readiness verdicts are strictly labelled `"Meets this demo policy"` or `"Does not meet this demo policy"`.

## Consequences

- **Positive**: Solutions Architects can demonstrate end-to-end agent observability, failure containment (timeouts, retries, budget caps, prompt-redirection attempts), and version-to-version prompt improvements (`Baseline v1.0` → `Candidate v2.0`) in under five minutes.
- **Trade-offs**: In-memory/fixture repository snapshots and browser `localStorage` keep the prototype self-contained and zero-dependency, at the cost of requiring a server database and GitHub tarball fetcher for multi-user production usage.
