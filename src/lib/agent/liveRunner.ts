import { generateText, Output, stepCountIs, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  AgentRun,
  PromptVersionId,
  RepositorySnapshot,
  RuntimeBudgets,
  StructuredArchitectureAssessment,
  TokenUsageAndCost,
} from '@/lib/types';
import {
  buildReviewConfiguration,
  PROMPT_DEFINITIONS,
  SCENARIO_8_TIGHT_BUDGETS,
} from '@/data/configurations';
import { SnapshotToolSandbox } from '@/lib/tools/snapshotTools';
import {
  ListFilesInputSchema,
  ReadFileInputSchema,
  SearchFilesInputSchema,
  StructuredArchitectureAssessmentSchema,
} from '@/lib/schemas';
import {
  evaluateAgentRun,
  validateAssessmentEvidence,
} from '@/lib/evaluation/evaluator';

export function getLiveProviderStatus(): {
  configured: boolean;
  provider: 'openai';
  model: string;
  missingEnvVar: string | null;
  explanation: string;
} {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.ARL_LIVE_MODEL?.trim() || 'gpt-4o-mini';

  if (!apiKey) {
    return {
      configured: false,
      provider: 'openai',
      model,
      missingEnvVar: 'OPENAI_API_KEY',
      explanation:
        'Live Model Mode is currently unavailable because server environment variable OPENAI_API_KEY is not set. Configure OPENAI_API_KEY in .env.local (or Vercel Environment Variables) to run live OpenAI model evaluations. Simulation Mode remains available without credentials.',
    };
  }

  return {
    configured: true,
    provider: 'openai',
    model,
    missingEnvVar: null,
    explanation: `Live Model Mode is ready using provider "openai" (${model}). Credentials remain strictly server-side.`,
  };
}

/**
 * Runs a real model-driven architecture review using the Vercel AI SDK and the constrained
 * SnapshotToolSandbox. Never substitutes simulation if credentials are missing.
 */
export async function runLiveAgent(params: {
  snapshot: RepositorySnapshot;
  promptVersion: PromptVersionId;
  budgetsOverride?: RuntimeBudgets;
}): Promise<AgentRun> {
  const { snapshot, promptVersion, budgetsOverride } = params;
  const effectiveBudgets =
    budgetsOverride ??
    (snapshot.scenarioCategory === 'limit_breach'
      ? SCENARIO_8_TIGHT_BUDGETS
      : undefined);

  const liveStatus = getLiveProviderStatus();
  const config = buildReviewConfiguration(
    'live',
    promptVersion,
    effectiveBudgets,
    liveStatus.model
  );
  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();
  const runId = `run-live-${promptVersion}-${snapshot.id}-${Math.random().toString(36).slice(2, 8)}`;

  if (!liveStatus.configured) {
    const emptyEvaluation = evaluateAgentRun({
      runId,
      snapshot,
      mode: 'live',
      promptVersion,
      terminalStatus: 'blocked_missing_credentials',
      rawOutputValidated: false,
      schemaValidationErrors: [liveStatus.explanation],
      toolEvents: [],
      inspectedFiles: [],
      assessment: null,
      validEvidenceCount: 0,
      totalEvidenceCount: 0,
      invalidEvidenceDetails: [],
    });

    return {
      id: runId,
      snapshotId: snapshot.id,
      snapshotVersion: snapshot.version,
      snapshotName: snapshot.name,
      configuration: config,
      mode: 'live',
      promptVersion,
      startedAtIso,
      completedAtIso: new Date().toISOString(),
      durationMs: 0,
      terminalStatus: 'blocked_missing_credentials',
      statusExplanation: liveStatus.explanation,
      toolEvents: [],
      inspectedFiles: [],
      assessment: null,
      rawOutputValidated: false,
      schemaValidationErrors: [liveStatus.explanation],
      usageAndCost: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        calculationFormula: 'Live run did not execute: OPENAI_API_KEY is not configured.',
        isSimulatedEstimate: false,
      },
      evaluation: emptyEvaluation,
    };
  }

  const sandbox = new SnapshotToolSandbox(snapshot, config.budgets, startedAtMs);
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let haltedReason: 'limit_exceeded' | 'timeout' | 'blocked_unallowlisted' | undefined;

  const tools = {
    listFiles: tool({
      description:
        'List files in the repository snapshot with their byte sizes and languages.',
      inputSchema: ListFilesInputSchema,
      execute: async (input) => {
        const t0 = Date.now();
        const res = sandbox.executeTool(
          'listFiles',
          input,
          'Live model invoked listFiles on snapshot.',
          Math.max(1, Date.now() - t0)
        );
        if (!res.ok && res.haltedRunReason) {
          haltedReason = res.haltedRunReason;
        }
        return res.outputText;
      },
    }),
    readFile: tool({
      description:
        'Read numbered lines from a relative file path inside the repository snapshot.',
      inputSchema: ReadFileInputSchema,
      execute: async (input) => {
        const t0 = Date.now();
        const res = sandbox.executeTool(
          'readFile',
          input,
          `Live model invoked readFile("${input.path}").`,
          Math.max(1, Date.now() - t0)
        );
        if (!res.ok && res.haltedRunReason) {
          haltedReason = res.haltedRunReason;
        }
        return res.outputText;
      },
    }),
    searchFiles: tool({
      description:
        'Search for a case-insensitive substring across all files in the repository snapshot.',
      inputSchema: SearchFilesInputSchema,
      execute: async (input) => {
        const t0 = Date.now();
        const res = sandbox.executeTool(
          'searchFiles',
          input,
          `Live model invoked searchFiles("${input.query}").`,
          Math.max(1, Date.now() - t0)
        );
        if (!res.ok && res.haltedRunReason) {
          haltedReason = res.haltedRunReason;
        }
        return res.outputText;
      },
    }),
  };

  let terminalStatus: AgentRun['terminalStatus'] = 'completed';
  let statusExplanation = 'Live model run completed and returned a structured assessment.';
  let rawAssessment: StructuredArchitectureAssessment | null = null;
  let usageAndCost: TokenUsageAndCost = {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    estimatedCostUsd: null,
    calculationFormula: 'Provider did not return token usage metadata.',
    isSimulatedEstimate: false,
  };
  const schemaValidationErrors: string[] = [];
  let rawOutputValidated = false;

  try {
    const promptDef = PROMPT_DEFINITIONS[promptVersion];
    const result = await generateText({
      model: openai(config.model),
      system: promptDef.systemPrompt,
      prompt: `Repository under review: "${snapshot.name}" (${snapshot.fictionalCompany} — ${snapshot.industry})
Customer Task: ${snapshot.customerTask}
Review Objective: ${snapshot.reviewObjective}

Start by listing files with listFiles, inspect key files with readFile, and produce the structured architecture assessment.`,
      tools,
      stopWhen: stepCountIs(config.budgets.maxSteps),
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      abortSignal: AbortSignal.timeout(config.budgets.maxExecutionTimeMs),
      output: Output.object({
        schema: StructuredArchitectureAssessmentSchema,
      }),
    });

    const inTok = result.totalUsage?.inputTokens ?? null;
    const outTok = result.totalUsage?.outputTokens ?? null;
    const totalTok =
      inTok !== null && outTok !== null ? inTok + outTok : (result.totalUsage?.totalTokens ?? null);

    if (inTok !== null && outTok !== null) {
      const cost =
        (inTok / 1_000_000) * config.pricingInputPer1MTokensUsd +
        (outTok / 1_000_000) * config.pricingOutputPer1MTokensUsd;
      usageAndCost = {
        inputTokens: inTok,
        outputTokens: outTok,
        totalTokens: totalTok,
        estimatedCostUsd: Number(cost.toFixed(6)),
        calculationFormula: `(${inTok} in × $${config.pricingInputPer1MTokensUsd}/1M) + (${outTok} out × $${config.pricingOutputPer1MTokensUsd}/1M) = $${cost.toFixed(6)} [LIVE PROVIDER USAGE]`,
        isSimulatedEstimate: false,
      };
    }

    if (haltedReason === 'timeout') {
      terminalStatus = 'halted_tool_timeout';
      statusExplanation = 'Live run halted because a tool invocation timed out.';
      rawAssessment = null;
    } else if (haltedReason === 'limit_exceeded') {
      terminalStatus = 'halted_limit_breach';
      statusExplanation = 'Live run halted because a configured runtime budget was exceeded.';
      rawAssessment = null;
    } else if (result.output) {
      const parsed = StructuredArchitectureAssessmentSchema.safeParse(result.output);
      if (parsed.success) {
        rawOutputValidated = true;
        rawAssessment = parsed.data;
      } else {
        rawOutputValidated = false;
        terminalStatus = 'halted_schema_invalid';
        schemaValidationErrors.push(
          ...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        );
        statusExplanation = `Live model output failed runtime Zod validation: ${schemaValidationErrors.join('; ')}`;
      }
    } else {
      terminalStatus = 'halted_schema_invalid';
      schemaValidationErrors.push('Live model finished without producing a structured output object.');
      statusExplanation = 'Live model did not produce a structured output within step limits.';
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (haltedReason === 'timeout' || /timeout|aborted/i.test(message)) {
      terminalStatus = 'halted_tool_timeout';
      statusExplanation = `Live execution timed out: ${message}`;
    } else if (haltedReason === 'limit_exceeded') {
      terminalStatus = 'halted_limit_breach';
      statusExplanation = `Live execution halted on budget breach: ${message}`;
    } else {
      terminalStatus = 'failed_provider_error';
      statusExplanation = `Live provider error: ${message}`;
      schemaValidationErrors.push(message);
    }
  }

  const completedAtMs = Date.now();
  const toolEvents = sandbox.getEvents();
  const inspectedFiles = sandbox.getInspectedFiles();

  let validatedAssessment: StructuredArchitectureAssessment | null = null;
  let validEvidenceCount = 0;
  let totalEvidenceCount = 0;
  let invalidEvidenceDetails: string[] = [];

  if (rawAssessment !== null && rawOutputValidated) {
    const evidenceCheck = validateAssessmentEvidence(
      rawAssessment,
      snapshot,
      inspectedFiles
    );
    validatedAssessment = evidenceCheck.validatedAssessment;
    validEvidenceCount = evidenceCheck.validEvidenceCount;
    totalEvidenceCount = evidenceCheck.totalEvidenceCount;
    invalidEvidenceDetails = evidenceCheck.invalidDetails;
  }

  const evaluation = evaluateAgentRun({
    runId,
    snapshot,
    mode: 'live',
    promptVersion,
    terminalStatus,
    rawOutputValidated,
    schemaValidationErrors,
    toolEvents,
    inspectedFiles,
    assessment: validatedAssessment,
    validEvidenceCount,
    totalEvidenceCount,
    invalidEvidenceDetails,
  });

  return {
    id: runId,
    snapshotId: snapshot.id,
    snapshotVersion: snapshot.version,
    snapshotName: snapshot.name,
    configuration: config,
    mode: 'live',
    promptVersion,
    startedAtIso,
    completedAtIso: new Date(completedAtMs).toISOString(),
    durationMs: Math.max(1, completedAtMs - startedAtMs),
    terminalStatus,
    statusExplanation,
    toolEvents,
    inspectedFiles,
    assessment: validatedAssessment,
    rawOutputValidated,
    schemaValidationErrors,
    usageAndCost,
    evaluation,
  };
}
