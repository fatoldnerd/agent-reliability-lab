import React from 'react';
import {
  AgentRun,
  EvaluationCase,
  ExecutionMode,
  PromptVersionId,
} from '@/lib/types';
import { ModeBadge, TerminalStatusBadge } from '@/components/StatusBadges';

interface EvaluationSuiteViewProps {
  cases: EvaluationCase[];
  runs: AgentRun[];
  selectedMode: ExecutionMode;
  selectedPromptVersion: PromptVersionId;
  isRunningBatch: boolean;
  onSelectMode: (mode: ExecutionMode) => void;
  onSelectPromptVersion: (version: PromptVersionId) => void;
  onRunSingleScenario: (snapshotId: string) => void;
  onRunAllSimulatedScenarios: (promptVersion: PromptVersionId) => void;
  onInspectRunInWorkspace: (run: AgentRun) => void;
  onInspectRunInTrace: (run: AgentRun) => void;
}

export function EvaluationSuiteView({
  cases,
  runs,
  selectedMode,
  selectedPromptVersion,
  isRunningBatch,
  onSelectMode,
  onSelectPromptVersion,
  onRunSingleScenario,
  onRunAllSimulatedScenarios,
  onInspectRunInWorkspace,
  onInspectRunInTrace,
}: EvaluationSuiteViewProps) {
  // Find latest run per snapshotId for selectedMode + selectedPromptVersion
  const getLatestRun = (snapshotId: string): AgentRun | undefined => {
    return runs.find(
      (r) =>
        r.snapshotId === snapshotId &&
        r.mode === selectedMode &&
        r.promptVersion === selectedPromptVersion
    );
  };

  const evaluatedCount = cases.filter((c) => Boolean(getLatestRun(c.snapshotId))).length;
  const passedCount = cases.filter(
    (c) => getLatestRun(c.snapshotId)?.evaluation.overallContractPassed
  ).length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold text-slate-900">
                3. Evaluation Suite (8 Architecture & Failure Scenarios)
              </h2>
              <ModeBadge mode={selectedMode} />
              <span className="rounded border border-slate-300 bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-800">
                {selectedPromptVersion}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Separates deterministic contract checks (schema, tool allowlist, reference validity, budget/timeout representation) from human SA review of recommendation quality.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter Evaluation Mode"
              value={selectedMode}
              onChange={(e) => onSelectMode(e.target.value as ExecutionMode)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-900"
            >
              <option value="simulation">SIMULATION MODE</option>
              <option value="live">LIVE MODEL MODE</option>
            </select>
            <select
              aria-label="Filter Prompt Version"
              value={selectedPromptVersion}
              onChange={(e) => onSelectPromptVersion(e.target.value as PromptVersionId)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-900"
            >
              <option value="baseline-v1">Baseline v1.0</option>
              <option value="candidate-v2">Candidate v2.0</option>
            </select>
            {selectedMode === 'simulation' && (
              <button
                type="button"
                onClick={() => onRunAllSimulatedScenarios(selectedPromptVersion)}
                disabled={isRunningBatch}
                className="rounded bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isRunningBatch
                  ? 'Executing Suite...'
                  : `Re-Run All 8 Scenarios (${selectedPromptVersion})`}
              </button>
            )}
          </div>
        </div>

        {/* Summary Metrics & Epistemic Notice */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="grid grid-cols-3 gap-3 lg:col-span-5 tabular-nums">
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Scenarios Evaluated</div>
              <div className="mt-0.5 font-mono text-base font-bold text-slate-900">
                {evaluatedCount} / {cases.length}
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Contract Checks Passing</div>
              <div className="mt-0.5 font-mono text-base font-bold text-emerald-800">
                {passedCount} / {cases.length}
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Failing Scenarios</div>
              <div className="mt-0.5 font-mono text-base font-bold text-rose-800">
                {evaluatedCount - passedCount}
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-300 bg-slate-50 p-3 text-xs text-slate-700 lg:col-span-7">
            <strong className="text-slate-900">
              What Automated Checks Do & Do Not Establish:
            </strong>{' '}
            Deterministic checks verify runtime schema conformance, tool allowlist boundaries, line-range citation existence, and explicit fault/limit states. They do <strong>not</strong> prove factual wisdom of open-ended architectural advice or universal immunity to prompt injection across unseen inputs.
          </div>
        </div>
      </section>

      {/* Scenario Cards */}
      <div className="space-y-4">
        {cases.map((evalCase) => {
          const run = getLatestRun(evalCase.snapshotId);
          const passed = run?.evaluation.overallContractPassed ?? false;

          return (
            <article
              key={evalCase.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                      Scenario #{evalCase.scenarioNumber}
                    </span>
                    <h3 className="text-base font-semibold text-slate-900">
                      {evalCase.title}
                    </h3>
                    <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                      {evalCase.snapshotId}
                    </code>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    <strong className="text-slate-800">Customer Task:</strong>{' '}
                    {evalCase.customerTask}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {run ? (
                    <>
                      <TerminalStatusBadge status={run.terminalStatus} />
                      <span
                        className={`rounded border px-2.5 py-0.5 font-mono text-xs font-bold ${
                          passed
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                            : 'border-rose-400 bg-rose-50 text-rose-900'
                        }`}
                      >
                        {passed ? 'PASS (ALL CHECKS)' : 'FAIL (VIOLATION)'}
                      </span>
                    </>
                  ) : (
                    <span className="rounded border border-slate-300 bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-600">
                      NOT RUN IN {selectedMode.toUpperCase()}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onRunSingleScenario(evalCase.snapshotId)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Run Scenario
                  </button>
                  {run && (
                    <>
                      <button
                        type="button"
                        onClick={() => onInspectRunInWorkspace(run)}
                        className="rounded border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        Workspace
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectRunInTrace(run)}
                        className="rounded border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        Trace ({run.toolEvents.length})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Fixture Contents, Expected vs Unacceptable Behaviour, and Human Review Aspects */}
              <div className="mt-3.5 grid grid-cols-1 gap-4 text-xs lg:grid-cols-4">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-900">Fixture Contents</div>
                  <p className="mt-1 leading-relaxed text-slate-700">
                    {evalCase.fixtureContentsSummary}
                  </p>
                </div>

                <div className="rounded border border-emerald-200 bg-emerald-50/30 p-3">
                  <div className="font-semibold text-emerald-950">Expected Behaviour</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                    {evalCase.expectedBehaviour.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded border border-rose-200 bg-rose-50/30 p-3">
                  <div className="font-semibold text-rose-950">Unacceptable Behaviour</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                    {evalCase.unacceptableBehaviour.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded border border-indigo-200 bg-indigo-50/30 p-3">
                  <div className="font-semibold text-indigo-950">
                    Requires Human SA Review
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                    {evalCase.humanReviewAspects.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Automated Contract Check Outcomes */}
              {run && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Executed Contract Checks ({run.id} · {run.durationMs}ms ·{' '}
                      {run.evaluation.validEvidenceCount}/{run.evaluation.totalEvidenceCount}{' '}
                      valid citations)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {run.evaluation.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className={`flex items-start justify-between gap-2 rounded border p-2.5 text-xs ${
                          chk.passed
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : 'border-rose-300 bg-rose-50/60'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{chk.name}</div>
                          <div className="mt-0.5 text-[11px] text-slate-700">
                            {chk.observedDetail}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            chk.passed
                              ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                              : 'border-rose-400 bg-rose-100 text-rose-900'
                          }`}
                        >
                          {chk.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
