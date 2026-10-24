import React from 'react';
import {
  AgentRun,
  EvidenceReference,
  ExecutionMode,
  PromptVersionId,
  RepositorySnapshot,
  RuntimeBudgets,
} from '@/lib/types';
import { PROMPT_DEFINITIONS } from '@/data/configurations';
import {
  ClaimBasisBadge,
  ModeBadge,
  SeverityBadge,
  TerminalStatusBadge,
} from '@/components/StatusBadges';

interface ReviewWorkspaceViewProps {
  snapshots: RepositorySnapshot[];
  selectedSnapshot: RepositorySnapshot;
  selectedMode: ExecutionMode;
  selectedPromptVersion: PromptVersionId;
  customBudgets: RuntimeBudgets;
  liveProviderStatus: {
    configured: boolean;
    provider: string;
    model: string;
    missingEnvVar: string | null;
    explanation: string;
  } | null;
  activeRun: AgentRun | null;
  isRunning: boolean;
  onSelectSnapshot: (snapshotId: string) => void;
  onSelectMode: (mode: ExecutionMode) => void;
  onSelectPromptVersion: (version: PromptVersionId) => void;
  onUpdateBudgets: (budgets: RuntimeBudgets) => void;
  onExecuteRun: () => void;
  onOpenSourceExcerpt: (filePath: string, ref?: EvidenceReference) => void;
  onNavigateView: (
    view: 'workspace' | 'trace' | 'evaluation' | 'comparison' | 'brief'
  ) => void;
}

export function ReviewWorkspaceView({
  snapshots,
  selectedSnapshot,
  selectedMode,
  selectedPromptVersion,
  customBudgets,
  liveProviderStatus,
  activeRun,
  isRunning,
  onSelectSnapshot,
  onSelectMode,
  onSelectPromptVersion,
  onUpdateBudgets,
  onExecuteRun,
  onOpenSourceExcerpt,
  onNavigateView,
}: ReviewWorkspaceViewProps) {
  const promptDef = PROMPT_DEFINITIONS[selectedPromptVersion];
  const assessment = activeRun?.assessment ?? null;

  return (
    <div className="space-y-6">
      {/* Configuration & Execution Control Panel */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-slate-900">
                1. Architecture Review Workspace
              </h2>
              <ModeBadge mode={selectedMode} />
              <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-800">
                {promptDef.shortBadge}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Select a synthetic repository snapshot, configure execution mode and runtime budgets, and run the narrowly scoped{' '}
              <strong>Application Architecture Review Agent</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenSourceExcerpt(selectedSnapshot.files[0]?.path ?? 'package.json')}
              className="rounded border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Browse Snapshot Files ({selectedSnapshot.files.length})
            </button>
            <button
              type="button"
              onClick={onExecuteRun}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <span className="h-2.5 w-2.5 animate-ping rounded-full bg-amber-400" />
                  Running Architecture Review...
                </>
              ) : (
                <>
                  Run Architecture Review ({selectedMode === 'simulation' ? 'Simulated' : 'Live Model'})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Mode Diagnostic Banner when selectedMode === 'live' */}
        {selectedMode === 'live' && liveProviderStatus && !liveProviderStatus.configured && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
            <div className="font-semibold">
              Live Model Mode Configuration Notice (Missing Server Credential:{' '}
              <code className="font-mono">{liveProviderStatus.missingEnvVar}</code>)
            </div>
            <p className="mt-1">{liveProviderStatus.explanation}</p>
            <p className="mt-1 font-medium">
              Non-Substitution Guarantee: Running in Live Mode without credentials will record an explicit{' '}
              <code className="font-mono">blocked_missing_credentials</code> outcome and will never silently substitute simulated output.
            </p>
          </div>
        )}

        {/* Controls Grid */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Repository Fixture Selector */}
          <div className="lg:col-span-5">
            <label
              htmlFor="snapshot-select"
              className="block text-xs font-semibold tracking-wider text-slate-600 uppercase"
            >
              Repository Snapshot Fixture (8 Evaluation Scenarios)
            </label>
            <select
              id="snapshot-select"
              value={selectedSnapshot.id}
              onChange={(e) => onSelectSnapshot(e.target.value)}
              className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              {snapshots.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  Scenario {idx + 1}: {s.name} [{s.scenarioCategory}]
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{selectedSnapshot.fictionalCompany}</span> ({selectedSnapshot.industry}) —{' '}
              {selectedSnapshot.summary}
            </p>
          </div>

          {/* Execution Mode Selector */}
          <div className="lg:col-span-3">
            <span className="block text-xs font-semibold tracking-wider text-slate-600 uppercase">
              Execution Mode
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSelectMode('simulation')}
                className={`rounded border px-3 py-2 text-left text-xs transition ${
                  selectedMode === 'simulation'
                    ? 'border-amber-500 bg-amber-50 font-semibold text-amber-950 ring-1 ring-amber-500'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="font-mono">SIMULATION</div>
                <div className="mt-0.5 text-[11px] font-normal text-slate-600">
                  Deterministic harness
                </div>
              </button>
              <button
                type="button"
                onClick={() => onSelectMode('live')}
                className={`rounded border px-3 py-2 text-left text-xs transition ${
                  selectedMode === 'live'
                    ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-950 ring-1 ring-emerald-600'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="font-mono">LIVE MODEL</div>
                <div className="mt-0.5 text-[11px] font-normal text-slate-600">
                  Vercel AI SDK (OpenAI)
                </div>
              </button>
            </div>
          </div>

          {/* Prompt / Configuration Version Selector */}
          <div className="lg:col-span-4">
            <label
              htmlFor="prompt-version-select"
              className="block text-xs font-semibold tracking-wider text-slate-600 uppercase"
            >
              Agent Prompt & Guardrail Configuration
            </label>
            <select
              id="prompt-version-select"
              value={selectedPromptVersion}
              onChange={(e) => onSelectPromptVersion(e.target.value as PromptVersionId)}
              className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="baseline-v1">
                Baseline v1.0 — Standard Architecture Reviewer
              </option>
              <option value="candidate-v2">
                Candidate v2.0 — Evidence-Gated & Boundary-Hardened
              </option>
            </select>
            <p className="mt-1.5 text-xs text-slate-600">{promptDef.description}</p>
          </div>
        </div>

        {/* Review Objective, Available Repo Information & Runtime Budgets */}
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 lg:grid-cols-3">
          <div className="rounded border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Review Objective & Customer Task
            </div>
            <p className="mt-1 text-xs font-medium text-slate-900">
              {selectedSnapshot.customerTask}
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              <span className="font-semibold">Objective:</span> {selectedSnapshot.reviewObjective}
            </p>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Snapshot Files & Constrained Tools
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                v{selectedSnapshot.version}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {selectedSnapshot.files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => onOpenSourceExcerpt(f.path)}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-800 hover:border-slate-900"
                >
                  <span>{f.path}</span>
                  <span className="text-slate-400">({f.sizeBytes}B)</span>
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-slate-600">
              Permitted Read-Only Tools:{' '}
              <code className="rounded bg-slate-200 px-1 font-mono">listFiles</code>,{' '}
              <code className="rounded bg-slate-200 px-1 font-mono">readFile</code>,{' '}
              <code className="rounded bg-slate-200 px-1 font-mono">searchFiles</code>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Configured Runtime Budgets
              </span>
              <span className="font-mono text-[11px] text-slate-600">Hard Enforced</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs tabular-nums">
              <div>
                <label htmlFor="budget-tools" className="block text-[10px] text-slate-500">
                  Max Tool Calls
                </label>
                <input
                  id="budget-tools"
                  type="number"
                  min={1}
                  max={25}
                  value={customBudgets.maxToolCalls}
                  onChange={(e) =>
                    onUpdateBudgets({
                      ...customBudgets,
                      maxToolCalls: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="budget-steps" className="block text-[10px] text-slate-500">
                  Max Steps
                </label>
                <input
                  id="budget-steps"
                  type="number"
                  min={1}
                  max={25}
                  value={customBudgets.maxSteps}
                  onChange={(e) =>
                    onUpdateBudgets({
                      ...customBudgets,
                      maxSteps: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="budget-bytes" className="block text-[10px] text-slate-500">
                  Max Input Bytes
                </label>
                <input
                  id="budget-bytes"
                  type="number"
                  min={512}
                  max={200000}
                  step={1024}
                  value={customBudgets.maxTotalInputBytes}
                  onChange={(e) =>
                    onUpdateBudgets({
                      ...customBudgets,
                      maxTotalInputBytes: Math.max(512, Number(e.target.value) || 512),
                    })
                  }
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                />
              </div>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              Max File Size: <span className="font-mono">{customBudgets.maxFileBytes} B</span> · Timeout:{' '}
              <span className="font-mono">{customBudgets.maxExecutionTimeMs} ms</span>
            </div>
          </div>
        </div>
      </section>

      {/* Run Outcome Banner */}
      {activeRun ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-slate-500">
                ACTIVE RUN: {activeRun.id}
              </span>
              <ModeBadge mode={activeRun.mode} />
              <TerminalStatusBadge status={activeRun.terminalStatus} />
              <span
                className={`inline-flex items-center rounded border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                  activeRun.evaluation.overallContractPassed
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-rose-300 bg-rose-50 text-rose-900'
                }`}
              >
                {activeRun.evaluation.overallContractPassed
                  ? 'CONTRACT CHECKS: PASS'
                  : 'CONTRACT CHECKS: FAIL'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateView('trace')}
                className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                Inspect Execution Trace ({activeRun.toolEvents.length} tool events) →
              </button>
              <button
                type="button"
                onClick={() => onNavigateView('brief')}
                className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Record Human Review & Print Brief →
              </button>
            </div>
          </div>

          {/* Progress & Telemetry Summary Bar */}
          <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5 tabular-nums">
            <div className="rounded bg-slate-50 p-2.5">
              <div className="text-[11px] text-slate-500">Prompt & Model</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900">
                {activeRun.promptVersion} ({activeRun.configuration.model})
              </div>
            </div>
            <div className="rounded bg-slate-50 p-2.5">
              <div className="text-[11px] text-slate-500">Tool Calls & Files Read</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900">
                {activeRun.toolEvents.length} calls / {activeRun.inspectedFiles.length} files read
              </div>
            </div>
            <div className="rounded bg-slate-50 p-2.5">
              <div className="text-[11px] text-slate-500">Evidence Reference Validity</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900">
                {activeRun.evaluation.validEvidenceCount} / {activeRun.evaluation.totalEvidenceCount} verified
              </div>
            </div>
            <div className="rounded bg-slate-50 p-2.5">
              <div className="text-[11px] text-slate-500">Run Duration</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900">
                {activeRun.durationMs} ms
              </div>
            </div>
            <div className="rounded bg-slate-50 p-2.5">
              <div className="text-[11px] text-slate-500">Token & Cost Estimate</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900">
                {activeRun.usageAndCost.totalTokens !== null
                  ? `${activeRun.usageAndCost.totalTokens} tok ($${activeRun.usageAndCost.estimatedCostUsd?.toFixed(5)})`
                  : 'Not measured'}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-700">
            <span className="font-semibold">Run Status Summary:</span> {activeRun.statusExplanation}
          </p>

          {/* Critical Policy Violation Alert if any */}
          {activeRun.evaluation.criticalPolicyViolation && (
            <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950">
              <div className="font-semibold uppercase">
                Observed Contract / Policy Violation(s) in This Run:
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {activeRun.evaluation.criticalViolationReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No run selected for this snapshot. Click <strong>Run Architecture Review</strong> above to inspect the repository.
          </p>
        </section>
      )}

      {/* Halted or Blocked State Explanation when assessment is null */}
      {activeRun && !assessment && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-950 uppercase">
              Assessment Withheld Due to Terminal Run Condition ({activeRun.terminalStatus})
            </h3>
            <button
              type="button"
              onClick={() => onNavigateView('trace')}
              className="rounded border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              View Fault / Limit Event in Execution Trace →
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-900">{activeRun.statusExplanation}</p>
          <p className="mt-2 text-xs text-amber-800">
            <strong>Why this matters for enterprise reliability:</strong> Rather than fabricating architectural claims from unread files after a timeout or budget cutoff, the runner halts explicitly and surfaces the partial trace to the Solutions Architect.
          </p>
        </section>
      )}

      {/* Full Structured Assessment Output */}
      {activeRun && assessment && (
        <div className="space-y-6">
          {/* Executive Summary & Confidence Level */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Preliminary Architecture Assessment Summary
              </h3>
              <span
                className={`rounded border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase ${
                  assessment.confidenceLevel === 'moderate_preliminary'
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-amber-400 bg-amber-50 text-amber-950'
                }`}
              >
                Confidence: {assessment.confidenceLevel.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-800">
              {assessment.executiveSummary}
            </p>
            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">
                Configuration & Deployment Evidence Summary:
              </span>{' '}
              {assessment.configurationAndDeploymentSummary}
            </div>
          </section>

          {/* Detected Application Technologies & Main Boundaries */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Detected Technologies */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
              <h3 className="text-sm font-semibold tracking-wider text-slate-900 uppercase">
                Detected Application Technologies ({assessment.detectedTechnologies.length})
              </h3>
              <div className="mt-3 space-y-3">
                {assessment.detectedTechnologies.map((tech, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-slate-200 bg-slate-50/70 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{tech.name}</span>
                      <ClaimBasisBadge basis={tech.basis} />
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-600">
                      Category: {tech.category} · {tech.versionOrDetail}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tech.evidence.map((ev, evIdx) => (
                        <EvidenceCitationPill
                          key={evIdx}
                          ev={ev}
                          onOpenSourceExcerpt={onOpenSourceExcerpt}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Browser, Server, and External-Service Boundaries */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
              <h3 className="text-sm font-semibold tracking-wider text-slate-900 uppercase">
                Browser, Server & External-Service Boundaries
              </h3>
              <div className="mt-3 space-y-3">
                {(
                  [
                    {
                      label: 'Browser / Client Boundary',
                      data: assessment.boundaries.browserBoundary,
                    },
                    {
                      label: 'Server / Compute Boundary',
                      data: assessment.boundaries.serverBoundary,
                    },
                    {
                      label: 'External Services & Data Boundary',
                      data: assessment.boundaries.externalServicesBoundary,
                    },
                  ] as const
                ).map((b) => (
                  <div
                    key={b.label}
                    className="rounded border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{b.label}</span>
                      <ClaimBasisBadge basis={b.data.basis} />
                    </div>
                    <p className="mt-1.5 leading-relaxed text-slate-700">{b.data.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {b.data.evidence.map((ev, i) => (
                        <EvidenceCitationPill
                          key={i}
                          ev={ev}
                          onOpenSourceExcerpt={onOpenSourceExcerpt}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Architectural Findings & Supporting Evidence */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Material Findings & Supporting Source Evidence ({assessment.findings.length})
                </h3>
                <p className="text-xs text-slate-600">
                  Every finding distinguishes <strong>Evidence Reference Validity</strong> (deterministic check that file & lines exist and were read) from <strong>Claim Quality</strong> (requires human SA review).
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {assessment.findings.map((finding) => (
                <article
                  key={finding.id}
                  className="rounded-md border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {finding.id}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {finding.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClaimBasisBadge basis={finding.basis} />
                      <SeverityBadge severity={finding.severity} />
                    </div>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-800">
                    {finding.statement}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Architectural Impact:</span>{' '}
                    {finding.architecturalImpact}
                  </p>

                  {/* Supporting Evidence Excerpts */}
                  <div className="mt-3 space-y-2">
                    {finding.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-slate-200 bg-white p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-900">
                              {ev.filePath}:L{ev.startLine}–L{ev.endLine}
                            </span>
                            <span
                              className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                ev.validation?.isValid
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : 'border-rose-300 bg-rose-50 text-rose-900'
                              }`}
                            >
                              {ev.validation?.isValid
                                ? 'REFERENCE VALID (INSPECTED)'
                                : `REFERENCE INVALID: ${ev.validation?.validationNote ?? 'Unverified'}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenSourceExcerpt(ev.filePath, ev)}
                            className="rounded border border-slate-300 bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-800 hover:bg-slate-200"
                          >
                            Open Excerpt in Source Inspector →
                          </button>
                        </div>
                        <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2.5 font-mono text-[11px] text-slate-100">
                          {ev.excerpt}
                        </pre>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Unknowns / Missing Information & SA Customer Questions */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Missing Information */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold tracking-wider text-slate-900 uppercase">
                Missing Information & Unobserved Context ({assessment.missingInformation.length})
              </h3>
              <ul className="mt-3 space-y-2.5">
                {assessment.missingInformation.map((mi) => (
                  <li
                    key={mi.id}
                    className="rounded border border-amber-200 bg-amber-50/50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{mi.topic}</span>
                      {mi.cannotBeEstablishedFromRepo && (
                        <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-900">
                          External to Repo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-slate-700">{mi.whyItMatters}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Questions an SA Should Ask the Customer */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold tracking-wider text-slate-900 uppercase">
                Questions the SA Should Ask the Customer ({assessment.saQuestions.length})
              </h3>
              <ul className="mt-3 space-y-2.5">
                {assessment.saQuestions.map((q) => (
                  <li
                    key={q.id}
                    className="rounded border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <div className="font-mono text-[11px] font-semibold text-indigo-900">
                      Stakeholder: {q.targetStakeholder}
                    </div>
                    <p className="mt-1 font-medium text-slate-900">&ldquo;{q.question}&rdquo;</p>
                    <p className="mt-1 text-slate-600">
                      <span className="font-semibold">Decision Unlocked:</span>{' '}
                      {q.architecturalDecisionUnlocked}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Preliminary Recommendations & Repository Review Scope Limits */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
              <h3 className="text-sm font-semibold tracking-wider text-slate-900 uppercase">
                Preliminary Recommendations ({assessment.recommendations.length})
              </h3>
              {assessment.recommendations.length === 0 ? (
                <p className="mt-3 text-xs text-slate-600">
                  No recommendations emitted for this run.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {assessment.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded border border-indigo-200 bg-indigo-50/30 p-3.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {rec.id}: {rec.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <ClaimBasisBadge basis={rec.basis} />
                          <span className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-800 uppercase">
                            Priority: {rec.priority.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-slate-800">{rec.recommendation}</p>
                      <p className="mt-1 text-slate-600">
                        <span className="font-semibold">Rationale & Tradeoffs:</span>{' '}
                        {rec.rationaleAndTradeoffs}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {rec.supportingEvidence.map((ev, i) => (
                          <EvidenceCitationPill
                            key={i}
                            ev={ev}
                            onOpenSourceExcerpt={onOpenSourceExcerpt}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Visible Repository Review Scope Limitations */}
            <section className="rounded-lg border border-slate-300 bg-slate-900 p-5 text-slate-100 shadow-xs lg:col-span-5">
              <h3 className="font-mono text-xs font-semibold tracking-wider text-amber-300 uppercase">
                Mandatory Repository Review Limitations (Epistemic Boundary)
              </h3>
              <p className="mt-2 text-xs text-slate-300">
                A static repository snapshot review cannot establish live runtime state. The following boundaries apply to all findings above:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-xs text-slate-200">
                {assessment.repositoryScopeLimitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
              <div className="mt-4 rounded border border-slate-700 bg-slate-800 p-3 text-[11px] text-slate-300">
                <span className="font-semibold text-white">Fixture Specific Note:</span>{' '}
                {selectedSnapshot.knownLimitationsNote}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceCitationPill({
  ev,
  onOpenSourceExcerpt,
}: {
  ev: EvidenceReference;
  onOpenSourceExcerpt: (filePath: string, ref?: EvidenceReference) => void;
}) {
  const valid = ev.validation?.isValid ?? true;
  return (
    <button
      type="button"
      onClick={() => onOpenSourceExcerpt(ev.filePath, ev)}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-medium transition ${
        valid
          ? 'border-slate-300 bg-white text-slate-800 hover:border-slate-900 hover:bg-slate-100'
          : 'border-rose-400 bg-rose-50 text-rose-900 hover:bg-rose-100'
      }`}
      title={ev.validation?.validationNote ?? 'Click to inspect source lines'}
    >
      <span>
        {ev.filePath}:L{ev.startLine}–L{ev.endLine}
      </span>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          valid ? 'bg-emerald-600' : 'bg-rose-600'
        }`}
      />
    </button>
  );
}
