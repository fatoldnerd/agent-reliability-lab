import React, { useState } from 'react';
import {
  AgentRun,
  EvaluationCase,
  FindingReviewComment,
  HumanReviewDecision,
  HumanReviewVerdict,
  ReadinessPolicy,
} from '@/lib/types';
import { evaluateReadinessPolicy } from '@/lib/evaluation/evaluator';
import {
  ClaimBasisBadge,
  ModeBadge,
  SeverityBadge,
  TerminalStatusBadge,
} from '@/components/StatusBadges';

interface HumanReviewBriefViewProps {
  runs: AgentRun[];
  activeRun: AgentRun | null;
  cases: EvaluationCase[];
  humanDecisions: HumanReviewDecision[];
  policy: ReadinessPolicy;
  onSelectRun: (runId: string) => void;
  onRecordDecision: (input: {
    run: AgentRun;
    reviewerName: string;
    reviewerRole: string;
    verdict: HumanReviewVerdict;
    overallRationale: string;
    findingComments: FindingReviewComment[];
    recommendedNextValidationStep: string;
  }) => void;
}

export function HumanReviewBriefView({
  runs,
  activeRun,
  cases,
  humanDecisions,
  policy,
  onSelectRun,
  onRecordDecision,
}: HumanReviewBriefViewProps) {
  const [reviewerName, setReviewerName] = useState('Brad Towers');
  const [reviewerRole, setReviewerRole] = useState(
    'Head of Solutions Architecture, EMEA (Applicant)'
  );
  const [verdict, setVerdict] = useState<HumanReviewVerdict>('accept');
  const [overallRationale, setOverallRationale] = useState(
    'Candidate v2.0 grounds every architectural claim in inspected files and line ranges, flags the unauthenticated inventory cron route, resists the embedded prompt redirection fixture, and withholds sizing guesses on thin stub repositories.'
  );
  const [recommendedNextStep, setRecommendedNextStep] = useState(
    'Proceed to supervised pilot with customer SA team on staging repositories; configure server-side OPENAI_API_KEY and compare live model variance across 10 runs per fixture before customer-facing rollout.'
  );
  const [commentMap, setCommentMap] = useState<
    Record<
      string,
      {
        comment: string;
        agreement: FindingReviewComment['agreement'];
      }
    >
  >({});
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  if (!activeRun) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          Select an active run to record a Human Review Decision and generate the Decision Brief.
        </p>
      </section>
    );
  }

  const readinessSummary = evaluateReadinessPolicy({
    policy,
    runs,
    humanDecisions,
    mode: activeRun.mode,
    promptVersion: activeRun.promptVersion,
  });

  const modeRunsForConfig = runs.filter(
    (r) => r.mode === activeRun.mode && r.promptVersion === activeRun.promptVersion
  );

  const significantFailures = runs
    .filter((r) => r.mode === activeRun.mode && !r.evaluation.overallContractPassed)
    .slice(0, 6);

  const handleSaveDecision = (e: React.FormEvent) => {
    e.preventDefault();
    const findingComments: FindingReviewComment[] = (
      activeRun.assessment?.findings ?? []
    ).map((f) => {
      const entry = commentMap[f.id];
      return {
        findingId: f.id,
        comment:
          entry?.comment?.trim() ||
          'Reviewed source excerpt and confirmed architectural framing.',
        agreement: entry?.agreement ?? 'verified_by_sa',
      };
    });

    onRecordDecision({
      run: activeRun,
      reviewerName,
      reviewerRole,
      verdict,
      overallRationale,
      findingComments,
      recommendedNextValidationStep: recommendedNextStep,
    });

    setSubmittedNotice(
      `Recorded "${verdict.toUpperCase()}" decision for ${activeRun.id} (${activeRun.promptVersion}). Original assessment and technical evaluation checks remain preserved.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Interactive Human Review Controls (Hidden when printing) */}
      <section className="no-print rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold text-slate-900">
                5. Human SA Review & Printable Decision Brief
              </h2>
              <ModeBadge mode={activeRun.mode} />
              <TerminalStatusBadge status={activeRun.terminalStatus} />
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Record a Solutions Architect oversight decision while preserving the original agent assessment and technical check results verbatim.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select Run to Review"
              value={activeRun.id}
              onChange={(e) => {
                setSubmittedNotice(null);
                onSelectRun(e.target.value);
              }}
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.mode.toUpperCase()}] {r.promptVersion} — {r.snapshotName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Print / Save PDF Decision Brief
            </button>
          </div>
        </div>

        {/* Non-Erasure Guarantee Notice */}
        <div className="mt-4 rounded border border-slate-300 bg-slate-50 p-3 text-xs text-slate-700">
          <strong className="text-slate-900">
            Separation of Technical Evaluation and Human Review:
          </strong>{' '}
          Accepting an assessment records human SA sign-off for the readiness gate, but <strong>never erases failed automated contract checks</strong> or alters the underlying agent output. Currently selected run contract status:{' '}
          <span
            className={`font-mono font-bold ${
              activeRun.evaluation.overallContractPassed
                ? 'text-emerald-800'
                : 'text-rose-800'
            }`}
          >
            {activeRun.evaluation.overallContractPassed ? 'PASS' : 'FAIL'}
          </span>
          .
        </div>

        {submittedNotice && (
          <div className="mt-3 rounded border border-emerald-400 bg-emerald-50 p-3 text-xs font-medium text-emerald-950">
            {submittedNotice}
          </div>
        )}

        {/* Review Form */}
        <form onSubmit={handleSaveDecision} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="reviewer-name"
                className="block text-xs font-semibold text-slate-700"
              >
                Reviewer Name
              </label>
              <input
                id="reviewer-name"
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="reviewer-role"
                className="block text-xs font-semibold text-slate-700"
              >
                Reviewer Role
              </label>
              <input
                id="reviewer-role"
                type="text"
                value={reviewerRole}
                onChange={(e) => setReviewerRole(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="review-verdict"
                className="block text-xs font-semibold text-slate-700"
              >
                Human Review Decision
              </label>
              <select
                id="review-verdict"
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as HumanReviewVerdict)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-semibold"
              >
                <option value="accept">ACCEPT ASSESSMENT (Verified for SA Discovery Use)</option>
                <option value="request_revision">
                  REQUEST REVISION (Requires Prompt / Evidence Update)
                </option>
                <option value="reject">
                  REJECT ASSESSMENT (Unsafe or Unfounded Claims)
                </option>
              </select>
            </div>
          </div>

          {/* Per-Finding Annotations */}
          {activeRun.assessment && activeRun.assessment.findings.length > 0 && (
            <div className="space-y-2.5 rounded border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs font-semibold text-slate-800">
                Inspect & Annotate Individual Findings (Original Finding Preserved Below)
              </div>
              {activeRun.assessment.findings.map((finding) => {
                const current = commentMap[finding.id] ?? {
                  comment: '',
                  agreement: 'verified_by_sa' as const,
                };
                return (
                  <div
                    key={finding.id}
                    className="rounded border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900">
                        {finding.id}: {finding.title}
                      </div>
                      <div className="flex items-center gap-2">
                        <ClaimBasisBadge basis={finding.basis} />
                        <SeverityBadge severity={finding.severity} />
                      </div>
                    </div>
                    <p className="mt-1 text-slate-600">{finding.statement}</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <select
                        aria-label={`Reviewer disposition for ${finding.id}`}
                        value={current.agreement}
                        onChange={(e) =>
                          setCommentMap({
                            ...commentMap,
                            [finding.id]: {
                              ...current,
                              agreement: e.target
                                .value as FindingReviewComment['agreement'],
                            },
                          })
                        }
                        className="rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                      >
                        <option value="verified_by_sa">Verified by SA</option>
                        <option value="needs_customer_validation">
                          Needs Customer Validation
                        </option>
                        <option value="disputed">Disputed by SA</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Add SA review note for this finding..."
                        value={current.comment}
                        onChange={(e) =>
                          setCommentMap({
                            ...commentMap,
                            [finding.id]: {
                              ...current,
                              comment: e.target.value,
                            },
                          })
                        }
                        className=" rounded border border-slate-300 px-2.5 py-1 text-xs sm:col-span-3"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="overall-rationale"
                className="block text-xs font-semibold text-slate-700"
              >
                Overall Human Review Rationale
              </label>
              <textarea
                id="overall-rationale"
                rows={3}
                value={overallRationale}
                onChange={(e) => setOverallRationale(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 p-2.5 text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="next-validation-step"
                className="block text-xs font-semibold text-slate-700"
              >
                Recommended Next Validation Step
              </label>
              <textarea
                id="next-validation-step"
                rows={3}
                value={recommendedNextStep}
                onChange={(e) => setRecommendedNextStep(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 p-2.5 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Record Human Review Decision ({verdict.toUpperCase()})
            </button>
          </div>
        </form>
      </section>

      {/* Printable Executive & SA Decision Brief */}
      <article className="print-container rounded-lg border-2 border-slate-800 bg-white p-6 shadow-sm">
        <header className="border-b-2 border-slate-900 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-xs font-bold tracking-widest text-slate-500 uppercase">
                AGENT RELIABILITY LAB — ARCHITECTURE & OVERSIGHT DECISION BRIEF
              </div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Application Architecture Review Agent — Reliability & Readiness Assessment
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Prepared by <strong>{reviewerName}</strong> ({reviewerRole}) · Central Question:{' '}
                <em>
                  &ldquo;What evidence would justify trusting this agent with this task, under these conditions?&rdquo;
                </em>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <ModeBadge mode={activeRun.mode} size="md" />
              <span
                className={`rounded border px-3 py-1 font-mono text-xs font-bold ${
                  readinessSummary.verdict === 'Meets this demo policy'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                    : 'border-rose-500 bg-rose-50 text-rose-950'
                }`}
              >
                {readinessSummary.verdict} ({policy.version})
              </span>
            </div>
          </div>
        </header>

        {/* Section 1 & 2: Agent Task/Scope and Tested Configuration */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 print-break-inside-avoid">
          <div className="rounded border border-slate-200 bg-slate-50 p-4 text-xs">
            <h3 className="font-mono text-xs font-bold tracking-wider text-slate-800 uppercase">
              1. Agent Task & Bounded Scope
            </h3>
            <p className="mt-1.5 leading-relaxed text-slate-700">
              <strong>Task:</strong> Inspect a supplied repository snapshot through a strictly allowlisted read-only tool interface (<code className="font-mono">listFiles</code>, <code className="font-mono">readFile</code>, <code className="font-mono">searchFiles</code>) and produce an evidence-backed preliminary architecture assessment for a Solutions Architect.
            </p>
            <p className="mt-1.5 leading-relaxed text-slate-700">
              <strong>Out of Scope:</strong> Arbitrary shell execution, unrestricted network requests, repository mutations, and automated production certification.
            </p>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-4 text-xs">
            <h3 className="font-mono text-xs font-bold tracking-wider text-slate-800 uppercase">
              2. Tested Configuration & Runtime Budgets
            </h3>
            <ul className="mt-1.5 space-y-1 font-mono text-[11px] text-slate-700">
              <li>
                <strong>Configuration:</strong> {activeRun.configuration.label}
              </li>
              <li>
                <strong>Provider / Model:</strong> {activeRun.configuration.provider} /{' '}
                {activeRun.configuration.model} (temp={activeRun.configuration.temperature})
              </li>
              <li>
                <strong>Hard Budgets:</strong> maxToolCalls=
                {activeRun.configuration.budgets.maxToolCalls}, maxSteps=
                {activeRun.configuration.budgets.maxSteps}, maxTotalInputBytes=
                {activeRun.configuration.budgets.maxTotalInputBytes}B, maxExecutionTimeMs=
                {activeRun.configuration.budgets.maxExecutionTimeMs}ms
              </li>
              <li>
                <strong>Primary Inspected Fixture:</strong> {activeRun.snapshotName} (v
                {activeRun.snapshotVersion})
              </li>
            </ul>
          </div>
        </div>

        {/* Section 3 & 4: Evaluation Coverage & Per-Scenario Results */}
        <div className="mt-5 print-break-inside-avoid">
          <h3 className="font-mono text-xs font-bold tracking-wider text-slate-800 uppercase">
            3. Fixtures & Evaluation Coverage ({modeRunsForConfig.length} Runs in {activeRun.mode.toUpperCase()} Mode for {activeRun.promptVersion})
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-left text-xs">
              <thead>
                <tr className="bg-slate-100 font-mono text-[11px] text-slate-700">
                  <th className="border border-slate-200 p-2">#</th>
                  <th className="border border-slate-200 p-2">Scenario</th>
                  <th className="border border-slate-200 p-2">Terminal Outcome</th>
                  <th className="border border-slate-200 p-2">Evidence Refs</th>
                  <th className="border border-slate-200 p-2">Contract Checks</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {cases.map((c) => {
                  const r = modeRunsForConfig.find((item) => item.snapshotId === c.snapshotId);
                  return (
                    <tr key={c.id}>
                      <td className="border border-slate-200 p-2 font-mono">
                        {c.scenarioNumber}
                      </td>
                      <td className="border border-slate-200 p-2 font-medium text-slate-900">
                        {c.title}
                      </td>
                      <td className="border border-slate-200 p-2 font-mono text-[11px]">
                        {r ? r.terminalStatus : 'Not run'}
                      </td>
                      <td className="border border-slate-200 p-2 font-mono text-[11px]">
                        {r
                          ? `${r.evaluation.validEvidenceCount}/${r.evaluation.totalEvidenceCount} valid`
                          : '—'}
                      </td>
                      <td className="border border-slate-200 p-2 font-mono text-[11px] font-bold">
                        {r ? (
                          <span
                            className={
                              r.evaluation.overallContractPassed
                                ? 'text-emerald-800'
                                : 'text-rose-800'
                            }
                          >
                            {r.evaluation.overallContractPassed ? 'PASS' : 'FAIL'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Significant Observed Failures Across Baseline / Candidate */}
        <div className="mt-5 print-break-inside-avoid">
          <h3 className="font-mono text-xs font-bold tracking-wider text-slate-800 uppercase">
            4. Significant Failures & Policy Violations Observed in Lab
          </h3>
          {significantFailures.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-600">
              No failing contract runs recorded in current mode.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {significantFailures.map((failRun) => (
                <li
                  key={failRun.id}
                  className="rounded border border-rose-200 bg-rose-50/50 p-2.5 text-rose-950"
                >
                  <span className="font-mono font-bold">
                    [{failRun.promptVersion} · {failRun.snapshotName}]
                  </span>{' '}
                  {failRun.evaluation.criticalViolationReasons.join(' | ') ||
                    failRun.statusExplanation}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Section 6: Human Review Findings & Recorded Sign-Off History */}
        <div className="mt-5 print-break-inside-avoid">
          <h3 className="font-mono text-xs font-bold tracking-wider text-slate-800 uppercase">
            5. Human Review Findings & Recorded Decisions ({humanDecisions.length})
          </h3>
          {humanDecisions.length === 0 ? (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
              No Human Review Decision has been recorded yet. Use the form above to record an{' '}
              <code>Accept</code>, <code>Request Revision</code>, or <code>Reject</code> decision.
            </div>
          ) : (
            <div className="mt-2 space-y-2.5">
              {humanDecisions.slice(0, 4).map((dec) => (
                <div
                  key={dec.id}
                  className="rounded border border-slate-300 bg-slate-50 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      Reviewer: {dec.reviewerName} ({dec.reviewerRole}) · Target:{' '}
                      <code className="font-mono">
                        {dec.promptVersion} ({dec.mode.toUpperCase()})
                      </code>
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${
                        dec.verdict === 'accept'
                          ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                          : dec.verdict === 'request_revision'
                            ? 'border-amber-400 bg-amber-100 text-amber-900'
                            : 'border-rose-400 bg-rose-100 text-rose-900'
                      }`}
                    >
                      HUMAN VERDICT: {dec.verdict.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-slate-800">
                    <strong>Rationale:</strong> {dec.overallRationale}
                  </p>
                  <p className="mt-1 text-slate-700">
                    <strong>Next Validation Step:</strong> {dec.recommendedNextValidationStep}
                  </p>
                  <div className="mt-1.5 font-mono text-[11px] text-slate-600">
                    Preserved Technical Evaluation at Sign-Off:{' '}
                    <strong
                      className={
                        dec.preservedTechnicalEvaluationPassed
                          ? 'text-emerald-800'
                          : 'text-rose-800'
                      }
                    >
                      {dec.preservedTechnicalEvaluationPassed
                        ? 'PASSED ALL CHECKS'
                        : `FAILED CHECKS PRESERVED (${dec.preservedFailedCheckNames.join(', ')})`}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 7 & 8: Known Limitations & Recommended Next Validation Step */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 print-break-inside-avoid">
          <div className="rounded border border-slate-300 bg-slate-50 p-4 text-xs">
            <h3 className="font-mono text-xs font-bold tracking-wider text-slate-800 uppercase">
              6. Known Limitations & Epistemic Boundaries
            </h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-slate-700">
              <li>
                <strong>Simulation vs. Live Model Separation:</strong> Passing deterministic simulation tests proves harness, sandbox, and evaluator contracts; it does NOT prove live LLM reliability.
              </li>
              <li>
                <strong>Static Repository Horizon:</strong> Source snapshots cannot establish live production latency, traffic volume, customer adoption, or formal regulatory compliance.
              </li>
              <li>
                <strong>Adversarial Scope:</strong> Passing Scenario #4 proves containment of one redirection fixture, not universal immunity to indirect prompt injection.
              </li>
            </ul>
          </div>

          <div className="rounded border border-slate-300 bg-slate-50 p-4 text-xs">
            <h3 className="font-mono text-xs font-bold tracking-wider text-slate-800 uppercase">
              7. Recommendation for Next Validation Step
            </h3>
            <p className="mt-1.5 leading-relaxed text-slate-800">
              {humanDecisions[0]?.recommendedNextValidationStep || recommendedNextStep}
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
