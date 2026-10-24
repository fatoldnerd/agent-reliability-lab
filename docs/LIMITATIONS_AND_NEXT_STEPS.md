# Known Limitations & Next Most Valuable Improvements

## Known Limitations of Version 1.0

1. **Static Repository Horizon (Epistemic Limit)**
   - A repository snapshot review can only observe static code, manifests, and committed configuration. It cannot verify live production latency, actual environment variable values, database connection pool saturation, customer adoption, or formal regulatory compliance (GDPR, FADP, HIPAA, ISO-27001).
2. **In-Memory Synthetic Fixtures**
   - Version 1.0 evaluates 8 curated synthetic repository snapshots (`src/data/snapshots.ts`) designed to isolate specific architectural and failure behaviours. It does not yet clone or ingest arbitrary external GitHub repositories at runtime.
3. **Single Live Provider Adapter**
   - Live Model Mode (`src/lib/agent/liveRunner.ts`) is wired to OpenAI via the Vercel AI SDK (`@ai-sdk/openai`). While the adapter is small and replaceable, multi-provider routing (Anthropic Claude, Google Gemini, Vercel AI Gateway) is not yet enabled in the UI.
4. **Browser `localStorage` Persistence**
   - Run history (bounded to 40 runs), policy edits, and human review decisions are persisted in browser `localStorage`. This is ideal for a zero-dependency local interview prototype, but does not provide an immutable, multi-user server-side audit trail.
5. **Deterministic Citation Matching Scope**
   - `validateEvidenceReference` proves that a cited file and line range exist, were read via `readFile` during the run, and match the quoted excerpt. It does not semantically prove that the agent's architectural recommendation is the best engineering trade-off—hence mandatory human SA review.

---

## Next Most Valuable Engineering Improvements

1. **Multi-Provider Live Evaluation via Vercel AI SDK Registry**
   - Add `@ai-sdk/anthropic` and `@ai-sdk/google` alongside `@ai-sdk/openai` so Solutions Architects can run the exact same 8-scenario contract suite across Claude, Gemini, and OpenAI models to compare cost, latency, and citation accuracy side by side.
2. **Server-Side Persistence with Neon / Vercel Postgres**
   - Replace browser `localStorage` with an append-only Postgres schema storing `agent_runs`, `tool_call_events`, and `human_review_decisions` with immutable audit timestamps for team-wide visibility.
3. **GitHub Tarball Snapshot Ingestor with Size & Secret Scrubbing**
   - Allow an SA to paste a pinned GitHub commit SHA (`owner/repo@sha`), fetch the read-only tree into an isolated server-side snapshot buffer (enforcing strict file-count and byte caps and pre-scrubbing `.env` files), and run the same constrained review workflow.
4. **Automated LLM-as-a-Judge Secondary Rubric (Clearly Separated from Deterministic Checks)**
   - Add an optional secondary rubric evaluator to score the *nuance* of SA discovery questions, while keeping those rubric scores strictly separate from the deterministic pass/fail contract checks.
