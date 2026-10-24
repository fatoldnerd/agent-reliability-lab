import {
  AgentRun,
  HumanReviewDecision,
  ReadinessPolicy,
} from '@/lib/types';
import { DEFAULT_READINESS_POLICY } from '@/data/configurations';
import { REPOSITORY_SNAPSHOTS } from '@/data/snapshots';
import { runSimulatedAgent } from '@/lib/agent/simulatedRunner';

export const STORAGE_KEY = 'arl_lab_state_v1';
export const MAX_STORED_RUNS = 40;
export const MAX_STORED_DECISIONS = 25;

export interface PersistedLabState {
  schemaVersion: '1.0';
  runs: AgentRun[];
  humanDecisions: HumanReviewDecision[];
  readinessPolicy: ReadinessPolicy;
}

/**
 * Generates the initial pre-seeded simulation runs across all 8 evaluation scenarios
 * for both Baseline v1.0 and Candidate v2.0 so that Evaluation Suite and Comparison & Readiness
 * have complete, deterministic simulated data ready out of the box, while Review Workspace
 * allows re-running any scenario live or simulated at any time.
 */
export function buildDefaultSeededState(): PersistedLabState {
  const seededRuns: AgentRun[] = [];

  for (const snapshot of REPOSITORY_SNAPSHOTS) {
    const baselineRun = runSimulatedAgent({
      snapshot,
      promptVersion: 'baseline-v1',
      runIdOverride: `seed-sim-baseline-v1-${snapshot.id}`,
    });
    const candidateRun = runSimulatedAgent({
      snapshot,
      promptVersion: 'candidate-v2',
      runIdOverride: `seed-sim-candidate-v2-${snapshot.id}`,
    });
    seededRuns.push(baselineRun, candidateRun);
  }

  return {
    schemaVersion: '1.0',
    runs: seededRuns.slice(0, MAX_STORED_RUNS),
    humanDecisions: [],
    readinessPolicy: { ...DEFAULT_READINESS_POLICY },
  };
}

export function clampRunsHistory(runs: AgentRun[]): AgentRun[] {
  return runs.slice(0, MAX_STORED_RUNS);
}

export function clampDecisionsHistory(
  decisions: HumanReviewDecision[]
): HumanReviewDecision[] {
  return decisions.slice(0, MAX_STORED_DECISIONS);
}

export function appendAgentRun(
  state: PersistedLabState,
  newRun: AgentRun
): PersistedLabState {
  const updated = [newRun, ...state.runs.filter((r) => r.id !== newRun.id)];
  return {
    ...state,
    runs: clampRunsHistory(updated),
  };
}

/**
 * Records a HumanReviewDecision while preserving the original AgentRun and its technical
 * evaluation results unchanged. Accepting a report never erases failed automated checks.
 */
export function recordHumanReviewDecision(
  state: PersistedLabState,
  input: {
    run: AgentRun;
    reviewerName: string;
    reviewerRole: string;
    verdict: HumanReviewDecision['verdict'];
    overallRationale: string;
    findingComments: HumanReviewDecision['findingComments'];
    recommendedNextValidationStep: string;
  }
): PersistedLabState {
  const failedChecks = input.run.evaluation.checks
    .filter((c) => !c.passed)
    .map((c) => c.name);

  const decision: HumanReviewDecision = {
    id: `hrd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    runId: input.run.id,
    snapshotId: input.run.snapshotId,
    mode: input.run.mode,
    promptVersion: input.run.promptVersion,
    reviewerName: input.reviewerName.trim() || 'Brad Towers',
    reviewerRole:
      input.reviewerRole.trim() || 'Head of Solutions Architecture, EMEA (Candidate)',
    recordedAtIso: new Date().toISOString(),
    verdict: input.verdict,
    overallRationale: input.overallRationale.trim(),
    findingComments: input.findingComments,
    recommendedNextValidationStep: input.recommendedNextValidationStep.trim(),
    preservedTechnicalEvaluationPassed: input.run.evaluation.overallContractPassed,
    preservedFailedCheckNames: failedChecks,
  };

  return {
    ...state,
    // Notice `state.runs` is preserved verbatim — failed checks on `input.run` are never mutated or erased!
    runs: state.runs,
    humanDecisions: clampDecisionsHistory([decision, ...state.humanDecisions]),
  };
}

export function loadLabStateFromStorage(): PersistedLabState {
  if (typeof window === 'undefined') {
    return buildDefaultSeededState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = buildDefaultSeededState();
      saveLabStateToStorage(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedLabState>;
    if (
      parsed &&
      parsed.schemaVersion === '1.0' &&
      Array.isArray(parsed.runs) &&
      Array.isArray(parsed.humanDecisions) &&
      parsed.readinessPolicy
    ) {
      return {
        schemaVersion: '1.0',
        runs: clampRunsHistory(parsed.runs),
        humanDecisions: clampDecisionsHistory(parsed.humanDecisions),
        readinessPolicy: parsed.readinessPolicy,
      };
    }
  } catch {
    // Ignore storage read errors and fall back to deterministic seeded state
  }
  return buildDefaultSeededState();
}

export function saveLabStateToStorage(state: PersistedLabState): void {
  if (typeof window === 'undefined') return;
  try {
    const bounded: PersistedLabState = {
      schemaVersion: '1.0',
      runs: clampRunsHistory(state.runs),
      humanDecisions: clampDecisionsHistory(state.humanDecisions),
      readinessPolicy: state.readinessPolicy,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore quota or private-browsing errors
  }
}

export function resetLabStateInStorage(): PersistedLabState {
  const fresh = buildDefaultSeededState();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Ignore storage errors
    }
  }
  return fresh;
}
