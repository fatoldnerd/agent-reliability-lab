'use client';

import React, { useEffect, useState } from 'react';
import {
  AgentRun,
  EvidenceReference,
  ExecutionMode,
  FindingReviewComment,
  HumanReviewVerdict,
  PromptVersionId,
  ReadinessPolicy,
  RuntimeBudgets,
} from '@/lib/types';
import { REPOSITORY_SNAPSHOTS, getSnapshotById } from '@/data/snapshots';
import { EVALUATION_CASES } from '@/data/evaluationCases';
import {
  DEFAULT_RUNTIME_BUDGETS,
  SCENARIO_8_TIGHT_BUDGETS,
} from '@/data/configurations';
import {
  appendAgentRun,
  loadLabStateFromStorage,
  PersistedLabState,
  recordHumanReviewDecision,
  resetLabStateInStorage,
  saveLabStateToStorage,
} from '@/lib/storage/persistence';
import { runSimulatedAgent } from '@/lib/agent/simulatedRunner';
import { ModeBadge } from '@/components/StatusBadges';
import { SourceInspectorModal } from '@/components/SourceInspectorModal';
import { ReviewWorkspaceView } from '@/components/ReviewWorkspaceView';
import { ExecutionTraceView } from '@/components/ExecutionTraceView';
import { EvaluationSuiteView } from '@/components/EvaluationSuiteView';
import { ComparisonReadinessView } from '@/components/ComparisonReadinessView';
import { HumanReviewBriefView } from '@/components/HumanReviewBriefView';

type ActiveTab = 'workspace' | 'trace' | 'evaluation' | 'comparison' | 'brief';

export default function AgentReliabilityLabPage() {
  const [labState, setLabState] = useState<PersistedLabState>(() =>
    loadLabStateFromStorage()
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>(
    'snap-nordic-commerce'
  );
  const [selectedMode, setSelectedMode] = useState<ExecutionMode>('simulation');
  const [selectedPromptVersion, setSelectedPromptVersion] =
    useState<PromptVersionId>('candidate-v2');
  const [customBudgets, setCustomBudgets] = useState<RuntimeBudgets>(
    DEFAULT_RUNTIME_BUDGETS
  );
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [liveProviderStatus, setLiveProviderStatus] = useState<{
    configured: boolean;
    provider: string;
    model: string;
    missingEnvVar: string | null;
    explanation: string;
  } | null>(null);

  // Source Inspector Modal State
  const [inspectorState, setInspectorState] = useState<{
    open: boolean;
    filePath: string;
    highlightedRef: EvidenceReference | null;
  }>({
    open: false,
    filePath: 'package.json',
    highlightedRef: null,
  });

  // Check live provider status on mount
  useEffect(() => {
    fetch('/api/agent/status')
      .then((res) => res.json())
      .then((data) => setLiveProviderStatus(data))
      .catch(() => {
        // Ignore fetch error
      });
  }, []);

  const selectedSnapshot =
    getSnapshotById(selectedSnapshotId) ?? REPOSITORY_SNAPSHOTS[0];

  const activeRun =
    labState.runs.find((r) => r.id === activeRunId) ??
    labState.runs.find(
      (r) =>
        r.snapshotId === selectedSnapshot.id &&
        r.mode === selectedMode &&
        r.promptVersion === selectedPromptVersion
    ) ??
    labState.runs[0] ??
    null;

  const updateAndPersist = (nextState: PersistedLabState) => {
    setLabState(nextState);
    saveLabStateToStorage(nextState);
  };

  const handleSelectSnapshot = (snapshotId: string) => {
    setSelectedSnapshotId(snapshotId);
    const snap = getSnapshotById(snapshotId);
    if (snap?.scenarioCategory === 'limit_breach') {
      setCustomBudgets(SCENARIO_8_TIGHT_BUDGETS);
    } else {
      setCustomBudgets(DEFAULT_RUNTIME_BUDGETS);
    }
    const matchingRun = labState.runs.find(
      (r) =>
        r.snapshotId === snapshotId &&
        r.mode === selectedMode &&
        r.promptVersion === selectedPromptVersion
    );
    if (matchingRun) {
      setActiveRunId(matchingRun.id);
    }
  };

  const handleExecuteRun = async (overrideParams?: {
    snapshotId?: string;
    mode?: ExecutionMode;
    promptVersion?: PromptVersionId;
    budgets?: RuntimeBudgets;
    targetTab?: ActiveTab;
  }) => {
    const targetSnapshotId = overrideParams?.snapshotId ?? selectedSnapshot.id;
    const targetMode = overrideParams?.mode ?? selectedMode;
    const targetPromptVersion =
      overrideParams?.promptVersion ?? selectedPromptVersion;
    const snap = getSnapshotById(targetSnapshotId) ?? selectedSnapshot;
    const targetBudgets =
      overrideParams?.budgets ??
      (snap.scenarioCategory === 'limit_breach'
        ? SCENARIO_8_TIGHT_BUDGETS
        : customBudgets);

    setSelectedSnapshotId(targetSnapshotId);
    setSelectedMode(targetMode);
    setSelectedPromptVersion(targetPromptVersion);
    setCustomBudgets(targetBudgets);
    setIsRunning(true);

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotId: targetSnapshotId,
          mode: targetMode,
          promptVersion: targetPromptVersion,
          budgetsOverride: targetBudgets,
        }),
      });
      const data = await res.json();
      if (data.run) {
        const nextState = appendAgentRun(labState, data.run as AgentRun);
        updateAndPersist(nextState);
        setActiveRunId((data.run as AgentRun).id);
        if (overrideParams?.targetTab) {
          setActiveTab(overrideParams.targetTab);
        }
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunAllSimulatedScenarios = (promptVersion: PromptVersionId) => {
    setIsRunning(true);
    let nextState = { ...labState };
    for (const snap of REPOSITORY_SNAPSHOTS) {
      const simRun = runSimulatedAgent({
        snapshot: snap,
        promptVersion,
      });
      nextState = appendAgentRun(nextState, simRun);
    }
    updateAndPersist(nextState);
    const firstMatch = nextState.runs.find(
      (r) => r.promptVersion === promptVersion && r.mode === 'simulation'
    );
    if (firstMatch) {
      setActiveRunId(firstMatch.id);
    }
    setIsRunning(false);
  };

  const handleRunRepeatedVariabilityCheck = (promptVersion: PromptVersionId) => {
    let nextState = { ...labState };
    for (let pass = 1; pass <= 3; pass++) {
      for (const snap of REPOSITORY_SNAPSHOTS.slice(0, 4)) {
        const simRun = runSimulatedAgent({
          snapshot: snap,
          promptVersion,
        });
        nextState = appendAgentRun(nextState, simRun);
      }
    }
    updateAndPersist(nextState);
  };

  const handleUpdatePolicy = (updatedPolicy: ReadinessPolicy) => {
    updateAndPersist({
      ...labState,
      readinessPolicy: updatedPolicy,
    });
  };

  const handleRecordDecision = (input: {
    run: AgentRun;
    reviewerName: string;
    reviewerRole: string;
    verdict: HumanReviewVerdict;
    overallRationale: string;
    findingComments: FindingReviewComment[];
    recommendedNextValidationStep: string;
  }) => {
    const nextState = recordHumanReviewDecision(labState, input);
    updateAndPersist(nextState);
  };

  const handleExportStateJson = () => {
    const blob = new Blob([JSON.stringify(labState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-reliability-lab-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetState = () => {
    const fresh = resetLabStateInStorage();
    setLabState(fresh);
    setSelectedSnapshotId('snap-nordic-commerce');
    setSelectedMode('simulation');
    setSelectedPromptVersion('candidate-v2');
    setCustomBudgets(DEFAULT_RUNTIME_BUDGETS);
    const defaultRun =
      fresh.runs.find(
        (r) =>
          r.snapshotId === 'snap-nordic-commerce' &&
          r.promptVersion === 'candidate-v2'
      ) ?? fresh.runs[0];
    if (defaultRun) {
      setActiveRunId(defaultRun.id);
    }
  };

  const handleOpenSourceExcerpt = (filePath: string, ref?: EvidenceReference) => {
    setInspectorState({
      open: true,
      filePath,
      highlightedRef: ref ?? null,
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Global Enterprise Engineering Header */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-950">
                ARL // v1.0
              </span>
              <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                Agent Reliability Lab
              </h1>
              <span className="hidden text-xs text-slate-400 md:inline">
                | Application Architecture Review Agent Evaluation Workbench
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-300">
              Central Question:{' '}
              <strong className="text-amber-300">
                &ldquo;What evidence would justify trusting this agent with this task, under these conditions?&rdquo;
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ModeBadge mode={selectedMode} size="md" />
            <button
              type="button"
              onClick={handleExportStateJson}
              className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Export JSON ({labState.runs.length} runs)
            </button>
            <button
              type="button"
              onClick={handleResetState}
              className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Reset Lab State
            </button>
          </div>
        </div>

        {/* 5-Minute Interview Demonstration Journey Bar */}
        <div className="border-t border-slate-800/80 bg-slate-900/95 px-4 py-2 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
              5-Min Demo Flow:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleExecuteRun({
                    snapshotId: 'snap-nordic-commerce',
                    mode: 'simulation',
                    promptVersion: 'baseline-v1',
                    targetTab: 'workspace',
                  })
                }
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-amber-400 hover:text-white"
              >
                1. Run Baseline (NordicCraft)
              </button>
              <button
                type="button"
                onClick={() => {
                  const r = labState.runs.find(
                    (item) => item.snapshotId === 'snap-nordic-commerce'
                  );
                  if (r && r.assessment?.findings[0]?.evidence[0]) {
                    setSelectedSnapshotId('snap-nordic-commerce');
                    setActiveRunId(r.id);
                    setActiveTab('workspace');
                    handleOpenSourceExcerpt(
                      r.assessment.findings[0].evidence[0].filePath,
                      r.assessment.findings[0].evidence[0]
                    );
                  }
                }}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-amber-400 hover:text-white"
              >
                2. Inspect Source Evidence
              </button>
              <button
                type="button"
                onClick={() =>
                  handleExecuteRun({
                    snapshotId: 'snap-albion-ledger',
                    mode: 'simulation',
                    promptVersion: 'baseline-v1',
                    targetTab: 'workspace',
                  })
                }
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-amber-400 hover:text-white"
              >
                3. Conflicting Docs Failure (Baseline)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleExecuteRun({
                    snapshotId: 'snap-meridian-prompt-trap',
                    mode: 'simulation',
                    promptVersion: 'candidate-v2',
                    targetTab: 'workspace',
                  })
                }
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-amber-400 hover:text-white"
              >
                4. Candidate Prompt-Trap Containment
              </button>
              <button
                type="button"
                onClick={() =>
                  handleExecuteRun({
                    snapshotId: 'snap-celtic-grid-timeout',
                    mode: 'simulation',
                    promptVersion: 'candidate-v2',
                    targetTab: 'trace',
                  })
                }
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-amber-400 hover:text-white"
              >
                5. Trigger Tool Timeout & Trace
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('comparison')}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-amber-400 hover:text-white"
              >
                6–7. Compare & Readiness Gate
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('brief')}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-amber-400 hover:text-white"
              >
                8. Human Sign-Off & Print Brief
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          aria-label="Primary Workspace Views"
          className="border-t border-slate-800 bg-slate-950 px-4 sm:px-6"
        >
          <div className="mx-auto flex max-w-7xl overflow-x-auto">
            {(
              [
                { id: 'workspace', label: '1. Review Workspace' },
                {
                  id: 'trace',
                  label: `2. Execution Trace (${activeRun?.toolEvents.length ?? 0})`,
                },
                {
                  id: 'evaluation',
                  label: `3. Evaluation Suite (${EVALUATION_CASES.length})`,
                },
                { id: 'comparison', label: '4. Comparison & Readiness' },
                {
                  id: 'brief',
                  label: `5. Human Review & Brief (${labState.humanDecisions.length})`,
                },
              ] as const
            ).map((tab) => {
              const isCurrent = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-4 py-2.5 font-mono text-xs font-semibold whitespace-nowrap transition ${
                    isCurrent
                      ? 'border-amber-400 bg-slate-900 text-white'
                      : 'border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content Workspace */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {activeTab === 'workspace' && (
          <ReviewWorkspaceView
            snapshots={REPOSITORY_SNAPSHOTS}
            selectedSnapshot={selectedSnapshot}
            selectedMode={selectedMode}
            selectedPromptVersion={selectedPromptVersion}
            customBudgets={customBudgets}
            liveProviderStatus={liveProviderStatus}
            activeRun={activeRun}
            isRunning={isRunning}
            onSelectSnapshot={handleSelectSnapshot}
            onSelectMode={setSelectedMode}
            onSelectPromptVersion={(v) => {
              setSelectedPromptVersion(v);
              const match = labState.runs.find(
                (r) =>
                  r.snapshotId === selectedSnapshot.id &&
                  r.mode === selectedMode &&
                  r.promptVersion === v
              );
              if (match) {
                setActiveRunId(match.id);
              }
            }}
            onUpdateBudgets={setCustomBudgets}
            onExecuteRun={() => handleExecuteRun()}
            onOpenSourceExcerpt={handleOpenSourceExcerpt}
            onNavigateView={setActiveTab}
          />
        )}

        {activeTab === 'trace' && (
          <ExecutionTraceView
            runs={labState.runs}
            activeRun={activeRun}
            onSelectRun={(runId) => {
              const r = labState.runs.find((item) => item.id === runId);
              if (r) {
                setActiveRunId(r.id);
                setSelectedSnapshotId(r.snapshotId);
                setSelectedMode(r.mode);
                setSelectedPromptVersion(r.promptVersion);
              }
            }}
            onOpenSourceExcerpt={handleOpenSourceExcerpt}
          />
        )}

        {activeTab === 'evaluation' && (
          <EvaluationSuiteView
            cases={EVALUATION_CASES}
            runs={labState.runs}
            selectedMode={selectedMode}
            selectedPromptVersion={selectedPromptVersion}
            isRunningBatch={isRunning}
            onSelectMode={setSelectedMode}
            onSelectPromptVersion={setSelectedPromptVersion}
            onRunSingleScenario={(snapshotId) =>
              handleExecuteRun({
                snapshotId,
                mode: selectedMode,
                promptVersion: selectedPromptVersion,
              })
            }
            onRunAllSimulatedScenarios={handleRunAllSimulatedScenarios}
            onInspectRunInWorkspace={(run) => {
              setSelectedSnapshotId(run.snapshotId);
              setSelectedMode(run.mode);
              setSelectedPromptVersion(run.promptVersion);
              setActiveRunId(run.id);
              setActiveTab('workspace');
            }}
            onInspectRunInTrace={(run) => {
              setSelectedSnapshotId(run.snapshotId);
              setSelectedMode(run.mode);
              setSelectedPromptVersion(run.promptVersion);
              setActiveRunId(run.id);
              setActiveTab('trace');
            }}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonReadinessView
            cases={EVALUATION_CASES}
            runs={labState.runs}
            humanDecisions={labState.humanDecisions}
            policy={labState.readinessPolicy}
            comparisonMode={selectedMode}
            onChangeComparisonMode={setSelectedMode}
            onUpdatePolicy={handleUpdatePolicy}
            onRunRepeatedVariabilityCheck={handleRunRepeatedVariabilityCheck}
            onInspectRunInWorkspace={(run) => {
              setSelectedSnapshotId(run.snapshotId);
              setSelectedMode(run.mode);
              setSelectedPromptVersion(run.promptVersion);
              setActiveRunId(run.id);
              setActiveTab('workspace');
            }}
            onNavigateView={setActiveTab}
          />
        )}

        {activeTab === 'brief' && (
          <HumanReviewBriefView
            runs={labState.runs}
            activeRun={activeRun}
            cases={EVALUATION_CASES}
            humanDecisions={labState.humanDecisions}
            policy={labState.readinessPolicy}
            onSelectRun={(runId) => {
              const r = labState.runs.find((item) => item.id === runId);
              if (r) {
                setActiveRunId(r.id);
                setSelectedSnapshotId(r.snapshotId);
                setSelectedMode(r.mode);
                setSelectedPromptVersion(r.promptVersion);
              }
            }}
            onRecordDecision={handleRecordDecision}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div>
            <strong>Agent Reliability Lab</strong> · Built for Brad Towers (Head of Solutions Architecture, EMEA — Vercel Interview Demonstration)
          </div>
          <div className="font-mono text-[11px]">
            Storage: Bounded Browser localStorage (max 40 runs) · Credentials: Server-Only
          </div>
        </div>
      </footer>

      {/* Source File & Line-Range Inspector Modal */}
      {inspectorState.open && (
        <SourceInspectorModal
          snapshot={selectedSnapshot}
          selectedFilePath={inspectorState.filePath}
          highlightedRef={inspectorState.highlightedRef}
          inspectedFiles={activeRun?.inspectedFiles ?? []}
          onSelectFile={(path) =>
            setInspectorState((prev) => ({
              ...prev,
              filePath: path,
              highlightedRef:
                prev.highlightedRef?.filePath === path ? prev.highlightedRef : null,
            }))
          }
          onClose={() =>
            setInspectorState((prev) => ({
              ...prev,
              open: false,
            }))
          }
        />
      )}
    </div>
  );
}
