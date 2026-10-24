import { z } from 'zod';

export const ClaimBasisSchema = z.enum(['observed', 'assumption', 'recommendation']);

export const SeverityLevelSchema = z.enum(['high', 'medium', 'low', 'info']);

export const EvidenceReferenceSchema = z.object({
  filePath: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  excerpt: z.string().min(1),
});

export const DetectedTechnologySchema = z.object({
  name: z.string().min(1),
  category: z.enum([
    'framework',
    'runtime',
    'database_storage',
    'auth',
    'ai_provider',
    'deployment_infra',
    'tooling',
  ]),
  versionOrDetail: z.string().min(1),
  basis: ClaimBasisSchema,
  evidence: z.array(EvidenceReferenceSchema).min(1),
});

export const BoundarySectionSchema = z.object({
  summary: z.string().min(1),
  basis: ClaimBasisSchema,
  evidence: z.array(EvidenceReferenceSchema).min(1),
});

export const BoundaryBreakdownSchema = z.object({
  browserBoundary: BoundarySectionSchema,
  serverBoundary: BoundarySectionSchema,
  externalServicesBoundary: BoundarySectionSchema,
});

export const ArchitectureFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    'technology',
    'boundary',
    'configuration_deployment',
    'concern',
    'recommendation',
  ]),
  basis: ClaimBasisSchema,
  severity: SeverityLevelSchema,
  statement: z.string().min(1),
  architecturalImpact: z.string().min(1),
  evidence: z.array(EvidenceReferenceSchema).min(1),
});

export const MissingInformationItemSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  whyItMatters: z.string().min(1),
  cannotBeEstablishedFromRepo: z.boolean(),
});

export const CustomerDiscoveryQuestionSchema = z.object({
  id: z.string().min(1),
  targetStakeholder: z.string().min(1),
  question: z.string().min(1),
  architecturalDecisionUnlocked: z.string().min(1),
});

export const PreliminaryRecommendationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  basis: z.literal('recommendation'),
  priority: z.enum(['immediate', 'near_term', 'requires_discovery_first']),
  recommendation: z.string().min(1),
  rationaleAndTradeoffs: z.string().min(1),
  supportingEvidence: z.array(EvidenceReferenceSchema).min(1),
});

export const StructuredArchitectureAssessmentSchema = z.object({
  executiveSummary: z.string().min(10),
  confidenceLevel: z.enum([
    'moderate_preliminary',
    'low_insufficient_evidence',
    'halted_incomplete',
  ]),
  detectedTechnologies: z.array(DetectedTechnologySchema),
  boundaries: BoundaryBreakdownSchema,
  configurationAndDeploymentSummary: z.string().min(1),
  findings: z.array(ArchitectureFindingSchema).min(1),
  missingInformation: z.array(MissingInformationItemSchema).min(1),
  saQuestions: z.array(CustomerDiscoveryQuestionSchema).min(1),
  recommendations: z.array(PreliminaryRecommendationSchema),
  repositoryScopeLimitations: z.array(z.string().min(1)).min(2),
});

export const ListFilesInputSchema = z.object({
  directoryPrefix: z
    .string()
    .max(120)
    .optional()
    .describe('Optional relative directory prefix within the repository snapshot, e.g. "src" or "" for root.'),
});

export const ReadFileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(200)
    .describe('Relative file path inside the repository snapshot, e.g. "package.json" or "src/app/api/checkout/route.ts".'),
  startLine: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Optional 1-based start line.'),
  endLine: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Optional 1-based inclusive end line.'),
});

export const SearchFilesInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(80)
    .describe('Case-insensitive substring or identifier to search across files in the repository snapshot.'),
});

export const RuntimeBudgetsSchema = z.object({
  maxToolCalls: z.number().int().min(1).max(30),
  maxSteps: z.number().int().min(1).max(30),
  maxTotalInputBytes: z.number().int().min(512).max(500_000),
  maxFileBytes: z.number().int().min(256).max(200_000),
  maxExecutionTimeMs: z.number().int().min(100).max(120_000),
});

export const RunAgentRequestSchema = z.object({
  snapshotId: z.string().min(1),
  mode: z.enum(['simulation', 'live']),
  promptVersion: z.enum(['baseline-v1', 'candidate-v2']),
  budgetsOverride: RuntimeBudgetsSchema.optional(),
});
