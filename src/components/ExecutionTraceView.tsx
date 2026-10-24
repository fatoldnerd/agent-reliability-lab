import React from 'react';
import { AgentRun, EvidenceReference } from '@/lib/types';
import {
  ModeBadge,
  TerminalStatusBadge,
  ToolStatusBadge,
} from '@/components/StatusBadges';

interface ExecutionTraceViewProps {
  runs: AgentRun[];
  activeRun: AgentRun | null;
  onSelectRun: (runId: string) => void;
  onOpenSourceExcerpt: (filePath: string, ref?: EvidenceReference) => void;
}

export function ExecutionTraceView({
  runs,
  activeRun,
  onSelectRun,
  onOpenSourceExcerpt,
}: ExecutionTraceViewProps) {
  if (!activeRun) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          No active run selected. Execute or select a run to inspect its Execution Trace.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Run Selector & Metadata Audit Header */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold text-slate-900">
                2. Execution Trace & Telemetry Audit
              </h2>
              <ModeBadge mode={activeRun.mode} />
              <TerminalStatusBadge status={activeRun.terminalStatus} />
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Captures observable tool invocations, durations, retries, timeouts, budget limit checks, and concise decision summaries. Hidden model chain-of-thought is never requested or exposed; credentials are never logged.
            </p>
          </div>

          <div className="min-w-[280px]">
            <label
              htmlFor="trace-run-selector"
              className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
            >
              Switch Traced Run ({runs.length} stored)
            </label>
            <select
              id="trace-run-selector"
              value={activeRun.id}
              onChange={(e) => onSelectRun(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.mode.toUpperCase()}] {r.promptVersion} — {r.snapshotName} ({r.terminalStatus})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recorded Run Metadata Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:grid-cols-5 tabular-nums">
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Run Identifier</div>
            <div className="mt-0.5 truncate font-mono font-semibold text-slate-900" title={activeRun.id}>
              {activeRun.id}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Start Time & Duration</div>
            <div className="mt-0.5 font-mono font-semibold text-slate-900">
              {activeRun.durationMs} ms
            </div>
            <div className="truncate font-mono text-[10px] text-slate-500">
              {activeRun.startedAtIso}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Fixture & Prompt Version</div>
            <div className="mt-0.5 font-mono font-semibold text-slate-900">
              {activeRun.promptVersion}
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              {activeRun.snapshotId} (v{activeRun.snapshotVersion})
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Provider, Model & Settings</div>
            <div className="mt-0.5 font-mono font-semibold text-slate-900">
              {activeRun.configuration.provider} / {activeRun.configuration.model}
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              temp={activeRun.configuration.temperature} · maxOut={activeRun.configuration.maxOutputTokens}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Token Usage & Cost Estimate</div>
            <div className="mt-0.5 font-mono font-semibold text-slate-900">
              {activeRun.usageAndCost.totalTokens !== null
                ? `${activeRun.usageAndCost.totalTokens} tokens ($${activeRun.usageAndCost.estimatedCostUsd?.toFixed(6)})`
                : 'N/A (No provider execution)'}
            </div>
            <div className="truncate font-mono text-[10px] text-slate-500" title={activeRun.usageAndCost.calculationFormula}>
              {activeRun.usageAndCost.isSimulatedEstimate ? 'Simulated Rate' : 'Live Rate'}
            </div>
          </div>
        </div>

        {/* Transparent Cost Calculation Formula */}
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">Cost Calculation Inputs:</span>{' '}
          <code className="font-mono text-[11px]">{activeRun.usageAndCost.calculationFormula}</code> ·{' '}
          <span className="text-slate-500">{activeRun.configuration.pricingSourceNote}</span>
        </div>
      </section>

      {/* Step-by-Step Tool Request & Response Timeline */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h3 className="text-base font-semibold text-slate-900">
            Step-by-Step Tool Execution Timeline ({activeRun.toolEvents.length} Events)
          </h3>
          <div className="font-mono text-xs text-slate-600">
            Budgets: maxToolCalls={activeRun.configuration.budgets.maxToolCalls} · maxSteps=
            {activeRun.configuration.budgets.maxSteps} · maxBytes=
            {activeRun.configuration.budgets.maxTotalInputBytes}B
          </div>
        </div>

        {activeRun.toolEvents.length === 0 ? (
          <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            Zero tool calls recorded for this run ({activeRun.statusExplanation}).
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {activeRun.toolEvents.map((ev) => (
              <div
                key={ev.id}
                className={`rounded-md border p-4 text-xs ${
                  ev.status === 'ok'
                    ? 'border-slate-200 bg-slate-50/60'
                    : ev.status === 'retried_ok'
                      ? 'border-sky-300 bg-sky-50/40'
                      : ev.status === 'recoverable_error'
                        ? 'border-amber-300 bg-amber-50/60'
                        : 'border-rose-300 bg-rose-50/60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
                      Step #{ev.stepIndex}
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-900">
                      {ev.toolName}({JSON.stringify(ev.args)})
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                        ev.isAllowlisted
                          ? 'border-slate-300 bg-white text-slate-700'
                          : 'border-rose-500 bg-rose-950 text-white'
                      }`}
                    >
                      {ev.isAllowlisted ? 'ALLOWLISTED' : 'UNALLOWLISTED (BLOCKED)'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 tabular-nums">
                    <ToolStatusBadge status={ev.status} />
                    <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700">
                      {ev.durationMs} ms
                    </span>
                    <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700">
                      {ev.bytesReturned} B
                    </span>
                  </div>
                </div>

                {/* Concise Decision Summary (No Chain-of-Thought) */}
                <p className="mt-2 text-slate-800">
                  <span className="font-semibold text-slate-900">Observable Decision Summary:</span>{' '}
                  {ev.decisionSummary}
                </p>

                {/* Error / Fault / Retry Detail */}
                {ev.errorDetail && (
                  <div className="mt-2 rounded border border-rose-300 bg-white p-2.5 font-mono text-[11px] text-rose-900">
                    <strong>Fault / Policy Diagnostic:</strong> {ev.errorDetail}
                  </div>
                )}

                {/* Limit Check Telemetry Bar */}
                <div className="mt-2.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-600 tabular-nums">
                  <span>
                    Limit Check:{' '}
                    <strong
                      className={
                        ev.limitCheck.withinLimits ? 'text-emerald-800' : 'text-rose-800'
                      }
                    >
                      {ev.limitCheck.withinLimits
                        ? 'WITHIN BUDGETS'
                        : `BREACHED (${ev.limitCheck.breachedLimit})`}
                    </strong>
                  </span>
                  <span>
                    Calls: {ev.limitCheck.toolCallsUsed}/{ev.limitCheck.maxToolCalls}
                  </span>
                  <span>
                    Steps: {ev.limitCheck.stepsUsed}/{ev.limitCheck.maxSteps}
                  </span>
                  <span>
                    Cumulative Input: {ev.limitCheck.totalInputBytesRead}/
                    {ev.limitCheck.maxTotalInputBytes} B
                  </span>
                  <span>
                    Attempt: {ev.attemptNumber}/{ev.maxAttempts}
                  </span>
                </div>

                {/* Expandable Tool Response Payload */}
                <details className="mt-2.5 rounded border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-3 py-1.5 font-mono text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                    Inspect Tool Response Payload ({ev.bytesReturned} bytes)
                  </summary>
                  <pre className="max-h-56 overflow-auto border-t border-slate-200 bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
                    {ev.responsePreview}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Final Assessment & Deterministic Evaluation Checks for This Run */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
          <h3 className="text-base font-semibold text-slate-900">
            Automated Contract Evaluation Results ({activeRun.evaluation.checks.length} Checks)
          </h3>
          <div className="mt-3 space-y-2.5">
            {activeRun.evaluation.checks.map((chk) => (
              <div
                key={chk.id}
                className={`rounded border p-3 text-xs ${
                  chk.passed
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-rose-300 bg-rose-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{chk.name}</span>
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                      chk.passed
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                        : 'border-rose-400 bg-rose-100 text-rose-900'
                    }`}
                  >
                    {chk.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <p className="mt-1 text-slate-800">{chk.observedDetail}</p>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 pt-1 text-[11px] text-slate-600 sm:grid-cols-2">
                  <div>
                    <strong className="text-slate-800">What this proves:</strong> {chk.whatItProves}
                  </div>
                  <div>
                    <strong className="text-slate-800">What this does NOT prove:</strong>{' '}
                    {chk.whatItDoesNotProve}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
          <h3 className="text-base font-semibold text-slate-900">
            Traced Assessment & Inspected Files Summary
          </h3>
          <div className="mt-3 text-xs">
            <div className="font-semibold text-slate-700">
              Files Read via <code className="font-mono">readFile</code> ({activeRun.inspectedFiles.length}):
            </div>
            {activeRun.inspectedFiles.length === 0 ? (
              <p className="mt-1 text-slate-500">None read prior to termination.</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {activeRun.inspectedFiles.map((filePath) => (
                  <button
                    key={filePath}
                    type="button"
                    onClick={() => onOpenSourceExcerpt(filePath)}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-800 hover:bg-slate-100"
                  >
                    {filePath}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="font-semibold text-slate-700">Final Assessment Outcome:</div>
              {activeRun.assessment ? (
                <div className="mt-1.5 space-y-2 text-slate-700">
                  <p>{activeRun.assessment.executiveSummary}</p>
                  <div className="font-mono text-[11px] text-slate-600">
                    Findings: {activeRun.assessment.findings.length} · Unknowns:{' '}
                    {activeRun.assessment.missingInformation.length} · SA Questions:{' '}
                    {activeRun.assessment.saQuestions.length} · Recommendations:{' '}
                    {activeRun.assessment.recommendations.length}
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-amber-900">
                  No structured assessment produced ({activeRun.statusExplanation}).
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
