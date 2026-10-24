import React, { useState } from 'react';
import {
  AgentRun,
  EvaluationCase,
  ExecutionMode,
  HumanReviewDecision,
  PromptVersionId,
  ReadinessPolicy,
} from '@/lib/types';
import { evaluateReadinessPolicy } from '@/lib/evaluation/evaluator';
import { ModeBadge } from '@/components/StatusBadges';

interface ComparisonReadinessViewProps {
  cases: EvaluationCase[];
  runs: AgentRun[];
  humanDecisions: HumanReviewDecision[];
  policy: ReadinessPolicy;
  comparisonMode: ExecutionMode;
  onChangeComparisonMode: (mode: ExecutionMode) => void;
  onUpdatePolicy: (updated: ReadinessPolicy) => void;
  onRunRepeatedVariabilityCheck: (promptVersion: PromptVersionId) => void;
  onInspectRunInWorkspace: (run: AgentRun) => void;
  onNavigateView: (
    view: 'workspace' | 'trace' | 'evaluation' | 'comparison' | 'brief'
  ) => void;
}

export function ComparisonReadinessView({
  cases,
  runs,
  humanDecisions,
  policy,
  comparisonMode,
  onChangeComparisonMode,
  onUpdatePolicy,
  onRunRepeatedVariabilityCheck,
  onInspectRunInWorkspace,
  onNavigateView,
}: ComparisonReadinessViewProps) {
  const [targetReadinessConfig, setTargetReadinessConfig] =
    useState<PromptVersionId>('candidate-v2');
  const [attemptedMixedModeCheck, setAttemptedMixedModeCheck] = useState(false);

  // Latest run per snapshot for Baseline v1 and Candidate v2 in the selected like-for-like mode
  const getRunsForSnapshot = (snapshotId: string, promptVersion: PromptVersionId) =>
    runs.filter(
      (r) =>
        r.snapshotId === snapshotId &&
        r.mode === comparisonMode &&
        r.promptVersion === promptVersion
    );

  const baselineReadiness = evaluateReadinessPolicy({
    policy,
    runs,
    humanDecisions,
    mode: comparisonMode,
    promptVersion: 'baseline-v1',
  });

  const candidateReadiness = evaluateReadinessPolicy({
    policy,
    runs,
    humanDecisions,
    mode: comparisonMode,
    promptVersion: 'candidate-v2',
  });

  const activeReadiness =
    targetReadinessConfig === 'candidate-v2' ? candidateReadiness : baselineReadiness;

  const rowComparisons = cases.map((c) => {
    const baseRuns = getRunsForSnapshot(c.snapshotId, 'baseline-v1');
    const candRuns = getRunsForSnapshot(c.snapshotId, 'candidate-v2');
    const latestBase = baseRuns[0] ?? null;
    const latestCand = candRuns[0] ?? null;

    const basePassed = latestBase?.evaluation.overallContractPassed ?? null;
    const candPassed = latestCand?.evaluation.overallContractPassed ?? null;

    let deltaLabel: 'IMPROVED' | 'REGRESSED' | 'STABLE_PASS' | 'STABLE_FAIL' | 'INCOMPLETE' =
      'INCOMPLETE';

    if (basePassed !== null && candPassed !== null) {
      if (!basePassed && candPassed) {
        deltaLabel = 'IMPROVED';
      } else if (basePassed && !candPassed) {
        deltaLabel = 'REGRESSED';
      } else if (basePassed && candPassed) {
        deltaLabel = 'STABLE_PASS';
      } else {
        deltaLabel = 'STABLE_FAIL';
      }
    }

    // Repeated-run variability across stored runs for this snapshot & promptVersion
    const candStatuses = new Set(
      candRuns.map((r) => `${r.terminalStatus}:${r.evaluation.overallContractPassed}`)
    );
    const variabilityNote =
      candRuns.length > 1
        ? candStatuses.size === 1
          ? `Consistent across ${candRuns.length} runs (0% flip rate)`
          : `Variable across ${candRuns.length} runs (${candStatuses.size} distinct outcomes)`
        : '1 run recorded (click Run 3× Stability Check to measure repeated-run variance)';

    return {
      evalCase: c,
      latestBase,
      latestCand,
      baseRunsCount: baseRuns.length,
      candRunsCount: candRuns.length,
      deltaLabel,
      variabilityNote,
    };
  });

  const improvementsCount = rowComparisons.filter(
    (r) => r.deltaLabel === 'IMPROVED'
  ).length;
  const regressionsCount = rowComparisons.filter(
    (r) => r.deltaLabel === 'REGRESSED'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header & Like-for-Like Mode Guardrail */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold text-slate-900">
                4. Baseline vs. Candidate Comparison & Readiness Gate
              </h2>
              <ModeBadge mode={comparisonMode} />
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Compares <strong>Baseline v1.0</strong> against <strong>Candidate v2.0</strong> across like-for-like fixtures and execution modes, and evaluates the editable Demo Readiness Policy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Like-for-Like Execution Mode"
              value={comparisonMode}
              onChange={(e) => {
                setAttemptedMixedModeCheck(false);
                onChangeComparisonMode(e.target.value as ExecutionMode);
              }}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-900"
            >
              <option value="simulation">Compare Like-for-Like: SIMULATION vs SIMULATION</option>
              <option value="live">Compare Like-for-Like: LIVE vs LIVE</option>
            </select>
            <button
              type="button"
              onClick={() => setAttemptedMixedModeCheck((v) => !v)}
              className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Why Can&apos;t I Compare Sim vs. Live?
            </button>
            {comparisonMode === 'simulation' && (
              <button
                type="button"
                onClick={() => onRunRepeatedVariabilityCheck('candidate-v2')}
                className="rounded bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Run 3× Repeated-Run Variability Check (Candidate v2.0)
              </button>
            )}
          </div>
        </div>

        {/* Non-Comparable Mixed-Mode Guardrail Explanation */}
        {attemptedMixedModeCheck && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
            <div className="font-semibold uppercase">
              Comparability Guardrail: Mixed-Mode Comparisons (Simulated vs. Live) Are Blocked
            </div>
            <p className="mt-1">
              Simulation Mode uses deterministic scripted responses and synthetic token rates to test application harness logic, whereas Live Model Mode reflects stochastic LLM tool selection, network latency, and real provider token usage. Comparing a simulated Baseline against a live Candidate (or vice versa) invalidates latency, cost, and accuracy deltas. Always compare <strong>SIMULATION vs. SIMULATION</strong> or <strong>LIVE vs. LIVE</strong> on identical snapshot versions.
            </p>
          </div>
        )}

        {/* High-Level Comparison Summary Cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Baseline v1.0 Contract Pass Rate</div>
            <div className="mt-0.5 font-mono text-base font-bold text-slate-900">
              {
                rowComparisons.filter(
                  (r) => r.latestBase?.evaluation.overallContractPassed
                ).length
              }{' '}
              / {cases.length} scenarios
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-rose-700">
              {baselineReadiness.verdict}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Candidate v2.0 Contract Pass Rate</div>
            <div className="mt-0.5 font-mono text-base font-bold text-emerald-800">
              {
                rowComparisons.filter(
                  (r) => r.latestCand?.evaluation.overallContractPassed
                ).length
              }{' '}
              / {cases.length} scenarios
            </div>
            <div
              className={`mt-0.5 font-mono text-[11px] font-semibold ${
                candidateReadiness.verdict === 'Meets this demo policy'
                  ? 'text-emerald-700'
                  : 'text-amber-800'
              }`}
            >
              {candidateReadiness.verdict}
            </div>
          </div>

          <div className="rounded border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="text-[11px] text-emerald-900">Candidate Improvements Over Baseline</div>
            <div className="mt-0.5 font-mono text-base font-bold text-emerald-900">
              +{improvementsCount} scenarios fixed
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-800">
              Conflicting docs, prompt trap, thin repo
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Candidate Regressions</div>
            <div className="mt-0.5 font-mono text-base font-bold text-slate-900">
              {regressionsCount} regressions
            </div>
            <div className="mt-0.5 text-[11px] text-slate-600">
              Like-for-like {comparisonMode.toUpperCase()} comparison
            </div>
          </div>
        </div>
      </section>

      {/* Per-Scenario Like-for-Like Comparison Table */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-base font-semibold text-slate-900">
          Per-Scenario Comparison Matrix ({comparisonMode.toUpperCase()} Mode)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-600 uppercase">
                <th className="p-2.5">Scenario & Snapshot</th>
                <th className="p-2.5">Baseline v1.0</th>
                <th className="p-2.5">Candidate v2.0</th>
                <th className="p-2.5">Delta</th>
                <th className="p-2.5">Latency & Cost (Cand v2)</th>
                <th className="p-2.5">Repeated-Run Variability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 tabular-nums">
              {rowComparisons.map((row) => (
                <tr key={row.evalCase.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-900">
                      #{row.evalCase.scenarioNumber}. {row.evalCase.title}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {row.evalCase.snapshotId}
                    </div>
                  </td>

                  <td className="p-2.5">
                    {row.latestBase ? (
                      <div>
                        <span
                          className={`inline-block rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                            row.latestBase.evaluation.overallContractPassed
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                              : 'border-rose-300 bg-rose-50 text-rose-900'
                          }`}
                        >
                          {row.latestBase.evaluation.overallContractPassed
                            ? 'PASS'
                            : 'FAIL'}
                        </span>
                        <div className="mt-1 text-[11px] text-slate-600">
                          Refs: {row.latestBase.evaluation.validEvidenceCount}/
                          {row.latestBase.evaluation.totalEvidenceCount} valid
                        </div>
                        <button
                          type="button"
                          onClick={() => onInspectRunInWorkspace(row.latestBase!)}
                          className="mt-1 font-mono text-[11px] text-indigo-700 underline hover:text-indigo-900"
                        >
                          Inspect Baseline
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">Not run</span>
                    )}
                  </td>

                  <td className="p-2.5">
                    {row.latestCand ? (
                      <div>
                        <span
                          className={`inline-block rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                            row.latestCand.evaluation.overallContractPassed
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                              : 'border-rose-300 bg-rose-50 text-rose-900'
                          }`}
                        >
                          {row.latestCand.evaluation.overallContractPassed
                            ? 'PASS'
                            : 'FAIL'}
                        </span>
                        <div className="mt-1 text-[11px] text-slate-600">
                          Refs: {row.latestCand.evaluation.validEvidenceCount}/
                          {row.latestCand.evaluation.totalEvidenceCount} valid
                        </div>
                        <button
                          type="button"
                          onClick={() => onInspectRunInWorkspace(row.latestCand!)}
                          className="mt-1 font-mono text-[11px] text-indigo-700 underline hover:text-indigo-900"
                        >
                          Inspect Candidate
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">Not run</span>
                    )}
                  </td>

                  <td className="p-2.5">
                    {row.deltaLabel === 'IMPROVED' && (
                      <span className="rounded border border-emerald-400 bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-950">
                        + IMPROVED (FAIL → PASS)
                      </span>
                    )}
                    {row.deltaLabel === 'REGRESSED' && (
                      <span className="rounded border border-rose-400 bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-950">
                        - REGRESSED (PASS → FAIL)
                      </span>
                    )}
                    {row.deltaLabel === 'STABLE_PASS' && (
                      <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-800">
                        STABLE PASS
                      </span>
                    )}
                    {row.deltaLabel === 'STABLE_FAIL' && (
                      <span className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 font-mono text-[10px] text-rose-900">
                        UNRESOLVED FAIL
                      </span>
                    )}
                    {row.deltaLabel === 'INCOMPLETE' && (
                      <span className="text-slate-400">Awaiting both runs</span>
                    )}
                  </td>

                  <td className="p-2.5 font-mono text-[11px] text-slate-700">
                    {row.latestCand ? (
                      <>
                        <div>{row.latestCand.durationMs} ms</div>
                        <div className="text-slate-500">
                          {row.latestCand.usageAndCost.totalTokens ?? 0} tok · $
                          {row.latestCand.usageAndCost.estimatedCostUsd?.toFixed(5) ?? '0'}
                        </div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td className="p-2.5 text-[11px] text-slate-600">
                    {row.variabilityNote}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Editable Demo Readiness Policy & Verdict Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Editable Readiness Policy Controls */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Editable Demo Readiness Policy
              </h3>
              <p className="font-mono text-[11px] text-slate-500">
                Policy Version: {policy.version}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <label className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 p-2.5">
              <span className="font-medium text-slate-800">
                Require 100% Automated Contract Checks Pass
              </span>
              <input
                type="checkbox"
                checked={policy.requireAllContractChecksPass}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    requireAllContractChecksPass: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-slate-900"
              />
            </label>

            <label className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 p-2.5">
              <span className="font-medium text-slate-800">
                Require Zero Unresolved Critical Policy Violations
              </span>
              <input
                type="checkbox"
                checked={policy.requireZeroCriticalPolicyViolations}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    requireZeroCriticalPolicyViolations: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-slate-900"
              />
            </label>

            <label className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 p-2.5">
              <span className="font-medium text-slate-800">
                Require All Evidence References Valid & Inspected
              </span>
              <input
                type="checkbox"
                checked={policy.requireAllEvidenceReferencesValid}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    requireAllEvidenceReferencesValid: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-slate-900"
              />
            </label>

            <label className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 p-2.5">
              <span className="font-medium text-slate-800">
                Require Completed Human SA Review Sign-Off (Accept)
              </span>
              <input
                type="checkbox"
                checked={policy.requireHumanReviewComplete}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    requireHumanReviewComplete: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-slate-900"
              />
            </label>

            <div className="grid grid-cols-3 gap-2 pt-1 tabular-nums">
              <div>
                <label
                  htmlFor="policy-min-scenarios"
                  className="block text-[11px] text-slate-600"
                >
                  Min Scenarios (1–8)
                </label>
                <input
                  id="policy-min-scenarios"
                  type="number"
                  min={1}
                  max={8}
                  value={policy.minRequiredScenariosEvaluated}
                  onChange={(e) =>
                    onUpdatePolicy({
                      ...policy,
                      minRequiredScenariosEvaluated: Math.max(
                        1,
                        Math.min(8, Number(e.target.value) || 1)
                      ),
                    })
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>

              <div>
                <label htmlFor="policy-p95" className="block text-[11px] text-slate-600">
                  Max p95 Latency (ms)
                </label>
                <input
                  id="policy-p95"
                  type="number"
                  min={50}
                  max={60000}
                  step={100}
                  value={policy.maxAllowedP95LatencyMs}
                  onChange={(e) =>
                    onUpdatePolicy({
                      ...policy,
                      maxAllowedP95LatencyMs: Math.max(50, Number(e.target.value) || 50),
                    })
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>

              <div>
                <label htmlFor="policy-cost" className="block text-[11px] text-slate-600">
                  Max Cost / Run ($)
                </label>
                <input
                  id="policy-cost"
                  type="number"
                  min={0.0001}
                  max={5}
                  step={0.005}
                  value={policy.maxAllowedRunCostUsd}
                  onChange={(e) =>
                    onUpdatePolicy({
                      ...policy,
                      maxAllowedRunCostUsd: Math.max(
                        0.0001,
                        Number(e.target.value) || 0.0001
                      ),
                    })
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Evaluated Readiness Decision Panel */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div>
              <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Evaluated Policy Decision ({policy.version})
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetReadinessConfig('candidate-v2')}
                  className={`rounded px-2.5 py-1 font-mono text-xs font-semibold ${
                    targetReadinessConfig === 'candidate-v2'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Inspect Candidate v2.0 Gate
                </button>
                <button
                  type="button"
                  onClick={() => setTargetReadinessConfig('baseline-v1')}
                  className={`rounded px-2.5 py-1 font-mono text-xs font-semibold ${
                    targetReadinessConfig === 'baseline-v1'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Inspect Baseline v1.0 Gate
                </button>
              </div>
            </div>

            <div
              className={`rounded-md border-2 px-4 py-2 font-mono text-sm font-bold ${
                activeReadiness.verdict === 'Meets this demo policy'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                  : 'border-rose-500 bg-rose-50 text-rose-950'
              }`}
            >
              {activeReadiness.verdict}
            </div>
          </div>

          {/* Gate-by-Gate Evidence Breakdown */}
          <div className="mt-4 space-y-2">
            {activeReadiness.gates.map((gate) => (
              <div
                key={gate.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded border p-2.5 text-xs ${
                  gate.passed
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-rose-300 bg-rose-50/60'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-900">{gate.gateName}</div>
                  <div className="text-[11px] text-slate-600">{gate.evidenceNote}</div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                  <span className="text-slate-600">
                    Req: {gate.requiredValue} | Obs: <strong>{gate.observedValue}</strong>
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
                      gate.passed
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                        : 'border-rose-400 bg-rose-100 text-rose-900'
                    }`}
                  >
                    {gate.passed ? 'MET' : 'UNMET'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Unresolved Failures List */}
          {activeReadiness.unresolvedFailures.length > 0 && (
            <div className="mt-4 rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase">
                  Unresolved Policy Blockers ({activeReadiness.unresolvedFailures.length}):
                </span>
                {activeReadiness.unresolvedFailures.some((f) =>
                  f.includes('Human SA Review')
                ) && (
                  <button
                    type="button"
                    onClick={() => onNavigateView('brief')}
                    className="rounded border border-rose-400 bg-white px-2.5 py-1 font-semibold text-rose-900 hover:bg-rose-100"
                  >
                    Go to Human Review & Decision Brief →
                  </button>
                )}
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {activeReadiness.unresolvedFailures.map((fail, idx) => (
                  <li key={idx}>{fail}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Mandatory Non-Certification Disclaimer */}
          <div className="mt-4 rounded border border-slate-300 bg-slate-900 p-3 text-[11px] text-slate-200">
            {activeReadiness.nonCertificationDisclaimer}
          </div>
        </section>
      </div>
    </div>
  );
}
