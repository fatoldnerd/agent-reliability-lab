import { describe, expect, it } from 'vitest';
import {
  SnapshotToolSandbox,
  validateSnapshotPath,
} from '@/lib/tools/snapshotTools';
import {
   getSnapshotById,
  REPOSITORY_SNAPSHOTS,
} from '@/data/snapshots';
import { DEFAULT_RUNTIME_BUDGETS, DEFAULT_READINESS_POLICY } from '@/data/configurations';
import { runSimulatedAgent } from '@/lib/agent/simulatedRunner';
import { runLiveAgent } from '@/lib/agent/liveRunner';
import {
  evaluateReadinessPolicy,
  validateEvidenceReference,
} from '@/lib/evaluation/evaluator';
import { StructuredArchitectureAssessmentSchema } from '@/lib/schemas';
import {
  appendAgentRun,
  buildDefaultSeededState,
  MAX_STORED_RUNS,
  recordHumanReviewDecision,
} from '@/lib/storage/persistence';

describe('Agent Reliability Lab — Core Verification Suite', () => {
  describe('1. Input and Path Validation', () => {
    it('accepts valid relative snapshot file paths', () => {
      const res = validateSnapshotPath('src/app/api/checkout/route.ts');
      expect(res.valid).toBe(true);
      expect(res.normalizedPath).toBe('src/app/api/checkout/route.ts');
    });

    it('rejects directory traversal, absolute paths, null bytes, and external URLs', () => {
      expect(validateSnapshotPath('../secrets.env').valid).toBe(false);
      expect(validateSnapshotPath('src/../../etc/passwd').valid).toBe(false);
      expect(validateSnapshotPath('/etc/passwd').valid).toBe(false);
      expect(validateSnapshotPath('https://attacker.example/payload').valid).toBe(false);
      expect(validateSnapshotPath('package.json\0.txt').valid).toBe(false);
      expect(validateSnapshotPath('').valid).toBe(false);
    });

    it('blocks unallowlisted tools in SnapshotToolSandbox', () => {
      const snap = getSnapshotById('snap-nordic-commerce')!;
      const sandbox = new SnapshotToolSandbox(snap, DEFAULT_RUNTIME_BUDGETS);
      const res = sandbox.executeTool(
        'executeShell',
        { command: 'whoami' },
        'Attempt unauthorized shell command'
      );
      expect(res.ok).toBe(false);
      expect(res.haltedRunReason).toBe('blocked_unallowlisted');
      expect(sandbox.getEvents()[0].status).toBe('blocked_unallowlisted');
      expect(sandbox.getEvents()[0].isAllowlisted).toBe(false);
    });
  });

  describe('2. Tool-Call, Step, and Byte Budget Limits', () => {
    it('enforces maxToolCalls deterministically and records limit_exceeded', () => {
      const snap = getSnapshotById('snap-danube-monolith-budget')!;
      const run = runSimulatedAgent({
        snapshot: snap,
        promptVersion: 'candidate-v2',
      });
      expect(run.terminalStatus).toBe('halted_limit_breach');
      const lastEvent = run.toolEvents[run.toolEvents.length - 1];
      expect(lastEvent.status).toBe('limit_exceeded');
      expect(lastEvent.limitCheck.breachedLimit).toBe('maxToolCalls');
      expect(run.assessment).toBeNull();
      expect(run.evaluation.overallContractPassed).toBe(true);
    });

    it('enforces maxFileBytes when reading an oversized file', () => {
      const snap = getSnapshotById('snap-nordic-commerce')!;
      const tinyFileBudget = {
        ...DEFAULT_RUNTIME_BUDGETS,
        maxFileBytes: 50, // smaller than package.json
      };
      const sandbox = new SnapshotToolSandbox(snap, tinyFileBudget);
      const res = sandbox.executeTool(
        'readFile',
        { path: 'package.json' },
        'Read package.json with tiny file budget'
      );
      expect(res.ok).toBe(false);
      expect(res.haltedRunReason).toBe('limit_exceeded');
      expect(sandbox.getEvents()[0].limitCheck.breachedLimit).toBe('maxFileBytes');
    });

    it('enforces maxTotalInputBytes across cumulative reads', () => {
      const snap = getSnapshotById('snap-nordic-commerce')!;
      const tightByteBudget = {
        ...DEFAULT_RUNTIME_BUDGETS,
        maxTotalInputBytes: 600,
      };
      const sandbox = new SnapshotToolSandbox(snap, tightByteBudget);
      const r1 = sandbox.executeTool('readFile', { path: 'package.json' }, 'Read 1');
      expect(r1.ok).toBe(true);
      const r2 = sandbox.executeTool(
        'readFile',
        { path: 'src/app/api/checkout/route.ts' },
        'Read 2 exceeds cumulative byte cap'
      );
      expect(r2.ok).toBe(false);
      expect(r2.haltedRunReason).toBe('limit_exceeded');
      expect(sandbox.getEvents()[1].limitCheck.breachedLimit).toBe('maxTotalInputBytes');
    });
  });

  describe('3. Timeout and Recoverable Tool Fault Handling', () => {
    it('surfaces unrecoverable tool timeout accurately without fabricating file contents', () => {
      const snap = getSnapshotById('snap-celtic-grid-timeout')!;
      const run = runSimulatedAgent({
        snapshot: snap,
        promptVersion: 'candidate-v2',
      });
      expect(run.terminalStatus).toBe('halted_tool_timeout');
      expect(run.assessment).toBeNull();
      expect(run.toolEvents.some((e) => e.status === 'timeout')).toBe(true);
      expect(run.inspectedFiles).not.toContain('src/lib/telemetry-aggregator.ts');
      expect(run.evaluation.overallContractPassed).toBe(true);
    });

    it('retries recoverable tool failure once and records both Attempt 1 and Attempt 2 in trace', () => {
      const snap = getSnapshotById('snap-rhine-biotech-retry')!;
      const run = runSimulatedAgent({
        snapshot: snap,
        promptVersion: 'candidate-v2',
      });
      expect(run.terminalStatus).toBe('completed');
      expect(
        run.toolEvents.some(
          (e) => e.status === 'recoverable_error' && e.attemptNumber === 1
        )
      ).toBe(true);
      expect(
        run.toolEvents.some((e) => e.status === 'retried_ok' && e.attemptNumber === 2)
      ).toBe(true);
      expect(run.evaluation.overallContractPassed).toBe(true);
    });
  });

  describe('4. Runtime Validation of Untrusted Model Output & Evidence References', () => {
    it('rejects malformed assessment output via StructuredArchitectureAssessmentSchema', () => {
      const malformed = {
        executiveSummary: 'Too short',
        confidenceLevel: 'invalid_enum',
      };
      const parsed = StructuredArchitectureAssessmentSchema.safeParse(malformed);
      expect(parsed.success).toBe(false);
    });

    it('validates file existence, readFile inspection, line ranges, and excerpt matching', () => {
      const snap = getSnapshotById('snap-nordic-commerce')!;
      // Valid reference that was inspected
      const validRef = validateEvidenceReference(
        {
          filePath: 'package.json',
          startLine: 11,
          endLine: 15,
          excerpt: '"next": "15.2.1",',
        },
        snap,
        ['package.json']
      );
      expect(validRef.validation?.isValid).toBe(true);

      // File exists in snapshot, but was NEVER inspected via readFile
      const uninspectedRef = validateEvidenceReference(
        {
          filePath: 'package.json',
          startLine: 11,
          endLine: 15,
          excerpt: '"next": "15.2.1",',
        },
        snap,
        [] // empty inspectedFiles!
      );
      expect(uninspectedRef.validation?.isValid).toBe(false);
      expect(uninspectedRef.validation?.fileWasInspected).toBe(false);

      // Out-of-bounds line range
      const badLinesRef = validateEvidenceReference(
        {
          filePath: 'package.json',
          startLine: 1,
          endLine: 999,
          excerpt: '"next": "15.2.1",',
        },
        snap,
        ['package.json']
      );
      expect(badLinesRef.validation?.isValid).toBe(false);
      expect(badLinesRef.validation?.lineRangeValid).toBe(false);

      // Non-existent file
      const missingFileRef = validateEvidenceReference(
        {
          filePath: 'Dockerfile',
          startLine: 1,
          endLine: 5,
          excerpt: 'FROM node:22',
        },
        snap,
        ['package.json']
      );
      expect(missingFileRef.validation?.isValid).toBe(false);
      expect(missingFileRef.validation?.fileExists).toBe(false);
    });
  });

  describe('5. Separation of Simulated vs Live Mode & Missing Credential Handling', () => {
    it('fails explicitly with blocked_missing_credentials in Live Mode when OPENAI_API_KEY is unset and never substitutes simulation', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const snap = getSnapshotById('snap-nordic-commerce')!;
        const liveRun = await runLiveAgent({
          snapshot: snap,
          promptVersion: 'candidate-v2',
        });
        expect(liveRun.mode).toBe('live');
        expect(liveRun.terminalStatus).toBe('blocked_missing_credentials');
        expect(liveRun.assessment).toBeNull();
        expect(liveRun.statusExplanation).toContain('OPENAI_API_KEY');
      } finally {
        if (originalKey !== undefined) {
          process.env.OPENAI_API_KEY = originalKey;
        }
      }
    });
  });

  describe('6. Baseline v1.0 vs Candidate v2.0 Evaluation & Readiness Policy', () => {
    it('passes all 8 scenarios under Candidate v2.0 and catches the 3 expected failures under Baseline v1.0', () => {
      const baselineRuns = REPOSITORY_SNAPSHOTS.map((snapshot) =>
        runSimulatedAgent({ snapshot, promptVersion: 'baseline-v1' })
      );
      const candidateRuns = REPOSITORY_SNAPSHOTS.map((snapshot) =>
        runSimulatedAgent({ snapshot, promptVersion: 'candidate-v2' })
      );

      const candidatePassedCount = candidateRuns.filter(
        (r) => r.evaluation.overallContractPassed
      ).length;
      expect(candidatePassedCount).toBe(8);

      const baselineFailedIds = baselineRuns
        .filter((r) => !r.evaluation.overallContractPassed)
        .map((r) => r.snapshotId);
      expect(baselineFailedIds).toEqual([
        'snap-albion-ledger',
        'snap-meridian-prompt-trap',
        'snap-iberian-thin-repo',
      ]);
    });

    it('evaluates ReadinessPolicy accurately and requires Human SA Review sign-off when configured', () => {
      const state = buildDefaultSeededState();

      // Baseline v1 fails readiness policy due to failed contract checks and critical violations
      const baselineReadiness = evaluateReadinessPolicy({
        policy: DEFAULT_READINESS_POLICY,
        runs: state.runs,
        humanDecisions: [],
        mode: 'simulation',
        promptVersion: 'baseline-v1',
      });
      expect(baselineReadiness.verdict).toBe('Does not meet this demo policy');

      // Candidate v2 without human review yet: fails ONLY the human review gate
      const candidateBeforeHuman = evaluateReadinessPolicy({
        policy: DEFAULT_READINESS_POLICY,
        runs: state.runs,
        humanDecisions: [],
        mode: 'simulation',
        promptVersion: 'candidate-v2',
      });
      expect(candidateBeforeHuman.verdict).toBe('Does not meet this demo policy');
      expect(
        candidateBeforeHuman.gates.find((g) => g.id === 'gate-human-review')?.passed
      ).toBe(false);

      // Record an 'accept' human review decision on a Candidate v2 run
      const targetRun = state.runs.find(
        (r) => r.promptVersion === 'candidate-v2' && r.snapshotId === 'snap-nordic-commerce'
      )!;
      const updatedState = recordHumanReviewDecision(state, {
        run: targetRun,
        reviewerName: 'Brad Towers',
        reviewerRole: 'Head of SA, EMEA',
        verdict: 'accept',
        overallRationale: 'Evidence references verified; cron auth finding confirmed.',
        findingComments: [],
        recommendedNextValidationStep: 'Validate CRON_SECRET and Stripe webhook in staging.',
      });

      const candidateAfterHuman = evaluateReadinessPolicy({
        policy: DEFAULT_READINESS_POLICY,
        runs: updatedState.runs,
        humanDecisions: updatedState.humanDecisions,
        mode: 'simulation',
        promptVersion: 'candidate-v2',
      });
      expect(candidateAfterHuman.verdict).toBe('Meets this demo policy');
    });
  });

  describe('7. Persistence Bounds and Non-Erasure of Failed Checks After Human Review', () => {
    it('preserves failed technical checks even if a human reviewer records an accept decision', () => {
      const state = buildDefaultSeededState();
      const failingBaselineRun = state.runs.find(
        (r) => r.promptVersion === 'baseline-v1' && r.snapshotId === 'snap-albion-ledger'
      )!;
      expect(failingBaselineRun.evaluation.overallContractPassed).toBe(false);

      const afterHumanAccept = recordHumanReviewDecision(state, {
        run: failingBaselineRun,
        reviewerName: 'Brad Towers',
        reviewerRole: 'Head of SA, EMEA',
        verdict: 'accept',
        overallRationale: 'Testing human override behaviour.',
        findingComments: [],
        recommendedNextValidationStep: 'Fix store.ts',
      });

      const decision = afterHumanAccept.humanDecisions[0];
      expect(decision.verdict).toBe('accept');
      expect(decision.preservedTechnicalEvaluationPassed).toBe(false);
      expect(decision.preservedFailedCheckNames.length).toBeGreaterThan(0);

      // And the underlying run in state.runs still has overallContractPassed === false!
      const runInState = afterHumanAccept.runs.find((r) => r.id === failingBaselineRun.id)!;
      expect(runInState.evaluation.overallContractPassed).toBe(false);
    });

    it('bounds stored run history to MAX_STORED_RUNS', () => {
      let state = buildDefaultSeededState();
      const snap = getSnapshotById('snap-nordic-commerce')!;
      for (let i = 0; i < MAX_STORED_RUNS + 10; i++) {
        const r = runSimulatedAgent({
          snapshot: snap,
          promptVersion: 'candidate-v2',
          runIdOverride: `extra-run-${i}`,
        });
        state = appendAgentRun(state, r);
      }
      expect(state.runs.length).toBeLessThanOrEqual(MAX_STORED_RUNS);
    });
  });
});
