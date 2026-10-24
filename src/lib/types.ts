/**
 * Core Domain Types for Agent Reliability Lab
 *
 * Explicitly defines the 10 core contracts required by the architecture:
 * - RepositorySnapshot
 * - ReviewConfiguration
 * - ToolCallEvent
 * - ArchitectureFinding
 * - EvidenceReference
 * - EvaluationCase
 * - EvaluationResult
 * - AgentRun
 * - ReadinessPolicy
 * - HumanReviewDecision
 */

export type ExecutionMode = 'simulation' | 'live';

export type PromptVersionId = 'baseline-v1' | 'candidate-v2';

export type ClaimBasis = 'observed' | 'assumption' | 'recommendation';

export type SeverityLevel = 'high' | 'medium' | 'low' | 'info';

export type AllowedToolName = 'listFiles' | 'readFile' | 'searchFiles';

export interface SnapshotFile {
  path: string;
  sizeBytes: number;
  language: string;
  content: string;
  /** Optional simulated fault trigger when this file is read in simulation mode */
  simulatedFault?: 'timeout' | 'recoverable_error';
}

export interface RepositorySnapshot {
  id: string;
  version: string;
  name: string;
  fictionalCompany: string;
  industry: string;
  summary: string;
  customerTask: string;
  reviewObjective: string;
  scenarioCategory:
    | 'straightforward'
    | 'missing_deployment'
    | 'conflicting_docs'
    | 'prompt_injection'
    | 'tool_timeout'
    | 'recoverable_failure'
    | 'insufficient_evidence'
    | 'limit_breach';
  files: SnapshotFile[];
  knownLimitationsNote: string;
}

export interface RuntimeBudgets {
  maxToolCalls: number;
  maxSteps: number;
  maxTotalInputBytes: number;
  maxFileBytes: number;
  maxExecutionTimeMs: number;
}

export interface ReviewConfiguration {
  id: string;
  label: string;
  promptVersion: PromptVersionId;
  promptDescription: string;
  mode: ExecutionMode;
  provider: 'openai' | 'simulated-harness';
  model: string;
  temperature: number;
  maxOutputTokens: number;
  budgets: RuntimeBudgets;
  pricingInputPer1MTokensUsd: number;
  pricingOutputPer1MTokensUsd: number;
  pricingSourceNote: string;
}

export interface EvidenceReference {
  filePath: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  /** Populated by the deterministic evidence validator after the run */
  validation?: {
    fileExists: boolean;
    fileWasInspected: boolean;
    lineRangeValid: boolean;
    excerptMatchesFile: boolean;
    isValid: boolean;
    validationNote: string;
  };
}

export interface ArchitectureFinding {
  id: string;
  title: string;
  category:
    | 'technology'
    | 'boundary'
    | 'configuration_deployment'
    | 'concern'
    | 'recommendation';
  basis: ClaimBasis;
  severity: SeverityLevel;
  statement: string;
  architecturalImpact: string;
  evidence: EvidenceReference[];
}

export interface BoundaryBreakdown {
  browserBoundary: {
    summary: string;
    basis: ClaimBasis;
    evidence: EvidenceReference[];
  };
  serverBoundary: {
    summary: string;
    basis: ClaimBasis;
    evidence: EvidenceReference[];
  };
  externalServicesBoundary: {
    summary: string;
    basis: ClaimBasis;
    evidence: EvidenceReference[];
  };
}

export interface DetectedTechnology {
  name: string;
  category: 'framework' | 'runtime' | 'database_storage' | 'auth' | 'ai_provider' | 'deployment_infra' | 'tooling';
  versionOrDetail: string;
  basis: ClaimBasis;
  evidence: EvidenceReference[];
}

export interface MissingInformationItem {
  id: string;
  topic: string;
  whyItMatters: string;
  cannotBeEstablishedFromRepo: boolean;
}

export interface CustomerDiscoveryQuestion {
  id: string;
  targetStakeholder: string;
  question: string;
  architecturalDecisionUnlocked: string;
}

export interface PreliminaryRecommendation {
  id: string;
  title: string;
  basis: 'recommendation';
  priority: 'immediate' | 'near_term' | 'requires_discovery_first';
  recommendation: string;
  rationaleAndTradeoffs: string;
  supportingEvidence: EvidenceReference[];
}

export interface StructuredArchitectureAssessment {
  executiveSummary: string;
  confidenceLevel: 'moderate_preliminary' | 'low_insufficient_evidence' | 'halted_incomplete';
  detectedTechnologies: DetectedTechnology[];
  boundaries: BoundaryBreakdown;
  configurationAndDeploymentSummary: string;
  findings: ArchitectureFinding[];
  missingInformation: MissingInformationItem[];
  saQuestions: CustomerDiscoveryQuestion[];
  recommendations: PreliminaryRecommendation[];
  repositoryScopeLimitations: string[];
}

export type ToolCallStatus =
  | 'ok'
  | 'retried_ok'
  | 'timeout'
  | 'recoverable_error'
  | 'validation_error'
  | 'blocked_unallowlisted'
  | 'limit_exceeded';

export interface LimitCheckSnapshot {
  toolCallsUsed: number;
  maxToolCalls: number;
  stepsUsed: number;
  maxSteps: number;
  totalInputBytesRead: number;
  maxTotalInputBytes: number;
  elapsedMs: number;
  maxExecutionTimeMs: number;
  withinLimits: boolean;
  breachedLimit?: 'maxToolCalls' | 'maxSteps' | 'maxTotalInputBytes' | 'maxFileBytes' | 'maxExecutionTimeMs';
}

export interface ToolCallEvent {
  id: string;
  stepIndex: number;
  timestampIso: string;
  toolName: string;
  isAllowlisted: boolean;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  durationMs: number;
  attemptNumber: number;
  maxAttempts: number;
  bytesReturned: number;
  decisionSummary: string;
  responsePreview: string;
  errorDetail?: string;
  limitCheck: LimitCheckSnapshot;
}

export type RunTerminalStatus =
  | 'completed'
  | 'halted_limit_breach'
  | 'halted_tool_timeout'
  | 'halted_schema_invalid'
  | 'blocked_missing_credentials'
  | 'failed_provider_error';

export interface TokenUsageAndCost {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  calculationFormula: string;
  isSimulatedEstimate: boolean;
}

export interface AutomatedCheckItem {
  id: string;
  name: string;
  category:
    | 'schema_contract'
    | 'tool_allowlist'
    | 'evidence_grounding'
    | 'missing_info_detection'
    | 'fault_representation'
    | 'budget_enforcement'
    | 'injection_boundary'
    | 'epistemic_separation';
  passed: boolean;
  observedDetail: string;
  whatItProves: string;
  whatItDoesNotProve: string;
}

export interface EvaluationCase {
  id: string;
  scenarioNumber: number;
  title: string;
  snapshotId: string;
  customerTask: string;
  fixtureContentsSummary: string;
  expectedBehaviour: string[];
  unacceptableBehaviour: string[];
  automatedCheckDescriptions: string[];
  humanReviewAspects: string[];
}

export interface EvaluationResult {
  caseId: string;
  runId: string;
  mode: ExecutionMode;
  promptVersion: PromptVersionId;
  evaluatedAtIso: string;
  overallContractPassed: boolean;
  criticalPolicyViolation: boolean;
  criticalViolationReasons: string[];
  validEvidenceCount: number;
  totalEvidenceCount: number;
  allEvidenceReferencesValid: boolean;
  checks: AutomatedCheckItem[];
  humanReviewRequiredNotes: string[];
}

export interface AgentRun {
  id: string;
  snapshotId: string;
  snapshotVersion: string;
  snapshotName: string;
  configuration: ReviewConfiguration;
  mode: ExecutionMode;
  promptVersion: PromptVersionId;
  startedAtIso: string;
  completedAtIso: string;
  durationMs: number;
  terminalStatus: RunTerminalStatus;
  statusExplanation: string;
  toolEvents: ToolCallEvent[];
  inspectedFiles: string[];
  assessment: StructuredArchitectureAssessment | null;
  rawOutputValidated: boolean;
  schemaValidationErrors: string[];
  usageAndCost: TokenUsageAndCost;
  evaluation: EvaluationResult;
}

export interface ReadinessPolicy {
  version: string;
  name: string;
  requireAllContractChecksPass: boolean;
  requireZeroCriticalPolicyViolations: boolean;
  requireAllEvidenceReferencesValid: boolean;
  requireHumanReviewComplete: boolean;
  maxAllowedP95LatencyMs: number;
  maxAllowedRunCostUsd: number;
  minRequiredScenariosEvaluated: number;
}

export type ReadinessVerdictLabel =
  | 'Meets this demo policy'
  | 'Does not meet this demo policy';

export interface ReadinessEvaluationGateItem {
  id: string;
  gateName: string;
  passed: boolean;
  requiredValue: string;
  observedValue: string;
  evidenceNote: string;
}

export interface ReadinessEvaluationSummary {
  policyVersion: string;
  evaluatedMode: ExecutionMode;
  promptVersion: PromptVersionId;
  verdict: ReadinessVerdictLabel;
  gates: ReadinessEvaluationGateItem[];
  unresolvedFailures: string[];
  nonCertificationDisclaimer: string;
}

export type HumanReviewVerdict = 'accept' | 'request_revision' | 'reject';

export interface FindingReviewComment {
  findingId: string;
  comment: string;
  agreement: 'verified_by_sa' | 'needs_customer_validation' | 'disputed';
}

export interface HumanReviewDecision {
  id: string;
  runId: string;
  snapshotId: string;
  mode: ExecutionMode;
  promptVersion: PromptVersionId;
  reviewerName: string;
  reviewerRole: string;
  recordedAtIso: string;
  verdict: HumanReviewVerdict;
  overallRationale: string;
  findingComments: FindingReviewComment[];
  recommendedNextValidationStep: string;
  /** Preserves the technical evaluation state at the time of sign-off so human approval never erases failed tests */
  preservedTechnicalEvaluationPassed: boolean;
  preservedFailedCheckNames: string[];
}
