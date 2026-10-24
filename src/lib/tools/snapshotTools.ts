import {
  AllowedToolName,
  LimitCheckSnapshot,
  RepositorySnapshot,
  RuntimeBudgets,
  ToolCallEvent,
} from '@/lib/types';
import {
  ListFilesInputSchema,
  ReadFileInputSchema,
  SearchFilesInputSchema,
} from '@/lib/schemas';

export const ALLOWLISTED_AGENT_TOOLS: readonly AllowedToolName[] = [
  'listFiles',
  'readFile',
  'searchFiles',
] as const;

export function isAllowlistedTool(name: string): name is AllowedToolName {
  return (ALLOWLISTED_AGENT_TOOLS as readonly string[]).includes(name);
}

/**
 * Validates that a relative path stays strictly inside the repository snapshot.
 * Rejects path traversal (..), leading slashes, drive letters, null bytes, or URLs.
 */
export function validateSnapshotPath(rawPath: string): {
  valid: boolean;
  normalizedPath: string;
  reason?: string;
} {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return { valid: false, normalizedPath: '', reason: 'Path must not be empty.' };
  }
  if (trimmed.length > 200) {
    return {
      valid: false,
      normalizedPath: trimmed,
      reason: 'Path exceeds maximum length of 200 characters.',
    };
  }
  if (trimmed.includes('\0')) {
    return {
      valid: false,
      normalizedPath: trimmed,
      reason: 'Null bytes are prohibited in paths.',
    };
  }
  if (/^[a-zA-Z]+:\/\//.test(trimmed)) {
    return {
      valid: false,
      normalizedPath: trimmed,
      reason: 'External URLs are prohibited; tool operates only on local snapshot paths.',
    };
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:/.test(trimmed)) {
    return {
      valid: false,
      normalizedPath: trimmed,
      reason: 'Absolute paths are prohibited; path must be relative to the snapshot root.',
    };
  }

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = normalized.split('/');
  if (segments.some((seg) => seg === '..' || seg === '.')) {
    return {
      valid: false,
      normalizedPath: normalized,
      reason: 'Directory traversal segments (".." or ".") are prohibited.',
    };
  }

  return { valid: true, normalizedPath: normalized };
}

export interface ToolExecutionResult {
  ok: boolean;
  haltedRunReason?: 'limit_exceeded' | 'timeout' | 'blocked_unallowlisted';
  outputText: string;
  events: ToolCallEvent[];
}

export class SnapshotToolSandbox {
  private readonly snapshot: RepositorySnapshot;
  private readonly budgets: RuntimeBudgets;
  private readonly startTimeMs: number;
  private toolCallsUsed = 0;
  private stepsUsed = 0;
  private totalInputBytesRead = 0;
  private simulatedElapsedMs = 0;
  private readonly events: ToolCallEvent[] = [];
  private readonly inspectedFiles = new Set<string>();
  private readonly recoveredFaultPaths = new Set<string>();

  constructor(snapshot: RepositorySnapshot, budgets: RuntimeBudgets, startTimeMs = Date.now()) {
    this.snapshot = snapshot;
    this.budgets = budgets;
    this.startTimeMs = startTimeMs;
  }

  public getEvents(): ToolCallEvent[] {
    return [...this.events];
  }

  public getInspectedFiles(): string[] {
    return Array.from(this.inspectedFiles);
  }

  public incrementStep(): LimitCheckSnapshot {
    this.stepsUsed += 1;
    return this.buildLimitCheck();
  }

  public buildLimitCheck(
    proposedAdditionalBytes = 0,
    explicitBreach?: LimitCheckSnapshot['breachedLimit']
  ): LimitCheckSnapshot {
    const wallElapsed = Math.max(0, Date.now() - this.startTimeMs) + this.simulatedElapsedMs;
    let breachedLimit: LimitCheckSnapshot['breachedLimit'] = explicitBreach;

    if (!breachedLimit) {
      if (this.toolCallsUsed > this.budgets.maxToolCalls) {
        breachedLimit = 'maxToolCalls';
      } else if (this.stepsUsed > this.budgets.maxSteps) {
        breachedLimit = 'maxSteps';
      } else if (this.totalInputBytesRead + proposedAdditionalBytes > this.budgets.maxTotalInputBytes) {
        breachedLimit = 'maxTotalInputBytes';
      } else if (wallElapsed > this.budgets.maxExecutionTimeMs) {
        breachedLimit = 'maxExecutionTimeMs';
      }
    }

    return {
      toolCallsUsed: this.toolCallsUsed,
      maxToolCalls: this.budgets.maxToolCalls,
      stepsUsed: this.stepsUsed,
      maxSteps: this.budgets.maxSteps,
      totalInputBytesRead: this.totalInputBytesRead,
      maxTotalInputBytes: this.budgets.maxTotalInputBytes,
      elapsedMs: wallElapsed,
      maxExecutionTimeMs: this.budgets.maxExecutionTimeMs,
      withinLimits: !breachedLimit,
      ...(breachedLimit ? { breachedLimit } : {}),
    };
  }

  /**
   * Executes a tool call inside the constrained snapshot sandbox.
   * Any unallowlisted tool, path violation, or budget breach is captured as an auditable ToolCallEvent.
   */
  public executeTool(
    toolName: string,
    rawArgs: Record<string, unknown>,
    decisionSummary: string,
    simulatedDurationMs = 18
  ): ToolExecutionResult {
    this.stepsUsed += 1;
    this.toolCallsUsed += 1;
    this.simulatedElapsedMs += simulatedDurationMs;

    const stepIndex = this.events.length + 1;
    const timestampIso = new Date().toISOString();

    // 1. Check allowlist first
    if (!isAllowlistedTool(toolName)) {
      const limitCheck = this.buildLimitCheck();
      const blockedEvent: ToolCallEvent = {
        id: `evt-${stepIndex}-${toolName}`,
        stepIndex,
        timestampIso,
        toolName,
        isAllowlisted: false,
        args: rawArgs,
        status: 'blocked_unallowlisted',
        durationMs: 2,
        attemptNumber: 1,
        maxAttempts: 1,
        bytesReturned: 0,
        decisionSummary,
        responsePreview: `BLOCKED: Tool "${toolName}" is not in the allowlisted interface [listFiles, readFile, searchFiles].`,
        errorDetail: `Security policy violation: unallowlisted tool "${toolName}" rejected by SnapshotToolSandbox.`,
        limitCheck,
      };
      this.events.push(blockedEvent);
      return {
        ok: false,
        haltedRunReason: 'blocked_unallowlisted',
        outputText: blockedEvent.responsePreview,
        events: [blockedEvent],
      };
    }

    // 2. Check tool call count, step count, and execution time budgets
    const preCheck = this.buildLimitCheck();
    if (!preCheck.withinLimits) {
      const limitEvent: ToolCallEvent = {
        id: `evt-${stepIndex}-${toolName}`,
        stepIndex,
        timestampIso,
        toolName,
        isAllowlisted: true,
        args: rawArgs,
        status: 'limit_exceeded',
        durationMs: simulatedDurationMs,
        attemptNumber: 1,
        maxAttempts: 1,
        bytesReturned: 0,
        decisionSummary,
        responsePreview: `HALTED: Runtime budget "${preCheck.breachedLimit}" exceeded.`,
        errorDetail: `Run breached configured ${preCheck.breachedLimit} limit (${JSON.stringify(preCheck)}).`,
        limitCheck: preCheck,
      };
      this.events.push(limitEvent);
      return {
        ok: false,
        haltedRunReason: 'limit_exceeded',
        outputText: limitEvent.responsePreview,
        events: [limitEvent],
      };
    }

    // 3. Dispatch to specific allowlisted tool
    if (toolName === 'listFiles') {
      return this.handleListFiles(stepIndex, timestampIso, rawArgs, decisionSummary, simulatedDurationMs);
    }
    if (toolName === 'readFile') {
      return this.handleReadFile(stepIndex, timestampIso, rawArgs, decisionSummary, simulatedDurationMs);
    }
    return this.handleSearchFiles(stepIndex, timestampIso, rawArgs, decisionSummary, simulatedDurationMs);
  }

  private handleListFiles(
    stepIndex: number,
    timestampIso: string,
    rawArgs: Record<string, unknown>,
    decisionSummary: string,
    durationMs: number
  ): ToolExecutionResult {
    const parsed = ListFilesInputSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const ev = this.recordValidationError(
        stepIndex,
        timestampIso,
        'listFiles',
        rawArgs,
        decisionSummary,
        parsed.error.message
      );
      return { ok: false, outputText: ev.responsePreview, events: [ev] };
    }

    const prefix = parsed.data.directoryPrefix?.trim() ?? '';
    if (prefix) {
      const pathCheck = validateSnapshotPath(prefix);
      if (!pathCheck.valid) {
        const ev = this.recordValidationError(
          stepIndex,
          timestampIso,
          'listFiles',
          rawArgs,
          decisionSummary,
          pathCheck.reason ?? 'Invalid directoryPrefix'
        );
        return { ok: false, outputText: ev.responsePreview, events: [ev] };
      }
    }

    const matching = this.snapshot.files
      .filter((f) => !prefix || f.path.startsWith(prefix.replace(/^\.\//, '')))
      .map((f) => `${f.path} (${f.sizeBytes} B, ${f.language})`);

    const outputText =
      matching.length > 0
        ? `Snapshot files (${matching.length}):\n${matching.join('\n')}`
        : `No files found matching prefix "${prefix}".`;

    const bytes = Buffer.byteLength(outputText, 'utf8');
    const byteCheck = this.buildLimitCheck(bytes);
    if (!byteCheck.withinLimits) {
      return this.recordLimitBreachOnBytes(
        stepIndex,
        timestampIso,
        'listFiles',
        rawArgs,
        decisionSummary,
        byteCheck
      );
    }

    this.totalInputBytesRead += bytes;
    const ev: ToolCallEvent = {
      id: `evt-${stepIndex}-listFiles`,
      stepIndex,
      timestampIso,
      toolName: 'listFiles',
      isAllowlisted: true,
      args: rawArgs,
      status: 'ok',
      durationMs,
      attemptNumber: 1,
      maxAttempts: 1,
      bytesReturned: bytes,
      decisionSummary,
      responsePreview: outputText,
      limitCheck: this.buildLimitCheck(),
    };
    this.events.push(ev);
    return { ok: true, outputText, events: [ev] };
  }

  private handleReadFile(
    stepIndex: number,
    timestampIso: string,
    rawArgs: Record<string, unknown>,
    decisionSummary: string,
    durationMs: number
  ): ToolExecutionResult {
    const parsed = ReadFileInputSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const ev = this.recordValidationError(
        stepIndex,
        timestampIso,
        'readFile',
        rawArgs,
        decisionSummary,
        parsed.error.message
      );
      return { ok: false, outputText: ev.responsePreview, events: [ev] };
    }

    const pathValidation = validateSnapshotPath(parsed.data.path);
    if (!pathValidation.valid) {
      const ev = this.recordValidationError(
        stepIndex,
        timestampIso,
        'readFile',
        rawArgs,
        decisionSummary,
        pathValidation.reason ?? 'Invalid path'
      );
      return { ok: false, outputText: ev.responsePreview, events: [ev] };
    }

    const file = this.snapshot.files.find((f) => f.path === pathValidation.normalizedPath);
    if (!file) {
      const ev = this.recordValidationError(
        stepIndex,
        timestampIso,
        'readFile',
        rawArgs,
        decisionSummary,
        `File "${pathValidation.normalizedPath}" does not exist in snapshot "${this.snapshot.id}".`
      );
      return { ok: false, outputText: ev.responsePreview, events: [ev] };
    }

    // Check individual file size budget
    if (file.sizeBytes > this.budgets.maxFileBytes) {
      const limitCheck = this.buildLimitCheck(0, 'maxFileBytes');
      const ev: ToolCallEvent = {
        id: `evt-${stepIndex}-readFile`,
        stepIndex,
        timestampIso,
        toolName: 'readFile',
        isAllowlisted: true,
        args: rawArgs,
        status: 'limit_exceeded',
        durationMs,
        attemptNumber: 1,
        maxAttempts: 1,
        bytesReturned: 0,
        decisionSummary,
        responsePreview: `HALTED: File "${file.path}" (${file.sizeBytes} B) exceeds maxFileBytes (${this.budgets.maxFileBytes} B).`,
        errorDetail: `File size ${file.sizeBytes} B exceeds maxFileBytes limit ${this.budgets.maxFileBytes} B.`,
        limitCheck,
      };
      this.events.push(ev);
      return {
        ok: false,
        haltedRunReason: 'limit_exceeded',
        outputText: ev.responsePreview,
        events: [ev],
      };
    }

    // Check deterministic simulated fault: timeout
    if (file.simulatedFault === 'timeout') {
      const timeoutDuration = Math.min(this.budgets.maxExecutionTimeMs, 1500);
      this.simulatedElapsedMs += timeoutDuration;
      const ev: ToolCallEvent = {
        id: `evt-${stepIndex}-readFile-timeout`,
        stepIndex,
        timestampIso,
        toolName: 'readFile',
        isAllowlisted: true,
        args: rawArgs,
        status: 'timeout',
        durationMs: timeoutDuration,
        attemptNumber: 1,
        maxAttempts: 1,
        bytesReturned: 0,
        decisionSummary,
        responsePreview: `TIMEOUT: Reading "${file.path}" timed out after ${timeoutDuration}ms. No content returned.`,
        errorDetail: `Tool readFile("${file.path}") exceeded per-call timeout threshold (${timeoutDuration}ms).`,
        limitCheck: this.buildLimitCheck(),
      };
      this.events.push(ev);
      return {
        ok: false,
        haltedRunReason: 'timeout',
        outputText: ev.responsePreview,
        events: [ev],
      };
    }

    const createdEvents: ToolCallEvent[] = [];

    // Check deterministic simulated fault: recoverable_error (fails on Attempt 1, retries on Attempt 2)
    if (file.simulatedFault === 'recoverable_error' && !this.recoveredFaultPaths.has(file.path)) {
      this.recoveredFaultPaths.add(file.path);
      const failEvent: ToolCallEvent = {
        id: `evt-${stepIndex}-readFile-attempt1`,
        stepIndex,
        timestampIso,
        toolName: 'readFile',
        isAllowlisted: true,
        args: rawArgs,
        status: 'recoverable_error',
        durationMs: 42,
        attemptNumber: 1,
        maxAttempts: 2,
        bytesReturned: 0,
        decisionSummary: `${decisionSummary} (Attempt 1 encountered transient stream lock)`,
        responsePreview: `TRANSIENT_ERROR: Snapshot chunk stream interrupted for "${file.path}". Scheduling bounded retry (Attempt 2 of 2).`,
        errorDetail: 'EAGAIN: Transient snapshot reader stream lock; eligible for single automatic retry.',
        limitCheck: this.buildLimitCheck(),
      };
      this.events.push(failEvent);
      createdEvents.push(failEvent);
    }

    const lines = file.content.split('\n');
    const startLine = parsed.data.startLine ? Math.max(1, parsed.data.startLine) : 1;
    const endLine = parsed.data.endLine
      ? Math.min(lines.length, parsed.data.endLine)
      : lines.length;

    const numberedExcerpt = lines
      .slice(startLine - 1, endLine)
      .map((line, idx) => `${startLine + idx}: ${line}`)
      .join('\n');

    const bytes = Buffer.byteLength(numberedExcerpt, 'utf8');
    const byteCheck = this.buildLimitCheck(bytes);
    if (!byteCheck.withinLimits) {
      return this.recordLimitBreachOnBytes(
        this.events.length + 1,
        timestampIso,
        'readFile',
        rawArgs,
        decisionSummary,
        byteCheck
      );
    }

    this.totalInputBytesRead += bytes;
    this.inspectedFiles.add(file.path);

    const wasRetried = createdEvents.length > 0;
    const nextStepIndex = this.events.length + 1;
    const okEvent: ToolCallEvent = {
      id: `evt-${nextStepIndex}-readFile`,
      stepIndex: nextStepIndex,
      timestampIso: new Date().toISOString(),
      toolName: 'readFile',
      isAllowlisted: true,
      args: rawArgs,
      status: wasRetried ? 'retried_ok' : 'ok',
      durationMs: wasRetried ? durationMs + 25 : durationMs,
      attemptNumber: wasRetried ? 2 : 1,
      maxAttempts: wasRetried ? 2 : 1,
      bytesReturned: bytes,
      decisionSummary: wasRetried
        ? `${decisionSummary} (Succeeded on bounded retry Attempt 2 of 2)`
        : decisionSummary,
      responsePreview: numberedExcerpt,
      limitCheck: this.buildLimitCheck(),
    };
    this.events.push(okEvent);
    createdEvents.push(okEvent);

    return {
      ok: true,
      outputText: numberedExcerpt,
      events: createdEvents,
    };
  }

  private handleSearchFiles(
    stepIndex: number,
    timestampIso: string,
    rawArgs: Record<string, unknown>,
    decisionSummary: string,
    durationMs: number
  ): ToolExecutionResult {
    const parsed = SearchFilesInputSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const ev = this.recordValidationError(
        stepIndex,
        timestampIso,
        'searchFiles',
        rawArgs,
        decisionSummary,
        parsed.error.message
      );
      return { ok: false, outputText: ev.responsePreview, events: [ev] };
    }

    const needle = parsed.data.query.toLowerCase();
    const matches: string[] = [];

    for (const file of this.snapshot.files) {
      const lines = file.content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(needle)) {
          matches.push(`${file.path}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    const outputText =
      matches.length > 0
        ? `Found ${matches.length} match(es) for "${parsed.data.query}":\n${matches.slice(0, 25).join('\n')}`
        : `No matches found for "${parsed.data.query}".`;

    const bytes = Buffer.byteLength(outputText, 'utf8');
    const byteCheck = this.buildLimitCheck(bytes);
    if (!byteCheck.withinLimits) {
      return this.recordLimitBreachOnBytes(
        stepIndex,
        timestampIso,
        'searchFiles',
        rawArgs,
        decisionSummary,
        byteCheck
      );
    }

    this.totalInputBytesRead += bytes;
    const ev: ToolCallEvent = {
      id: `evt-${stepIndex}-searchFiles`,
      stepIndex,
      timestampIso,
      toolName: 'searchFiles',
      isAllowlisted: true,
      args: rawArgs,
      status: 'ok',
      durationMs,
      attemptNumber: 1,
      maxAttempts: 1,
      bytesReturned: bytes,
      decisionSummary,
      responsePreview: outputText,
      limitCheck: this.buildLimitCheck(),
    };
    this.events.push(ev);
    return { ok: true, outputText, events: [ev] };
  }

  private recordValidationError(
    stepIndex: number,
    timestampIso: string,
    toolName: string,
    rawArgs: Record<string, unknown>,
    decisionSummary: string,
    errorDetail: string
  ): ToolCallEvent {
    const ev: ToolCallEvent = {
      id: `evt-${stepIndex}-${toolName}-invalid`,
      stepIndex,
      timestampIso,
      toolName,
      isAllowlisted: true,
      args: rawArgs,
      status: 'validation_error',
      durationMs: 3,
      attemptNumber: 1,
      maxAttempts: 1,
      bytesReturned: 0,
      decisionSummary,
      responsePreview: `VALIDATION_ERROR: ${errorDetail}`,
      errorDetail,
      limitCheck: this.buildLimitCheck(),
    };
    this.events.push(ev);
    return ev;
  }

  private recordLimitBreachOnBytes(
    stepIndex: number,
    timestampIso: string,
    toolName: string,
    rawArgs: Record<string, unknown>,
    decisionSummary: string,
    limitCheck: LimitCheckSnapshot
  ): ToolExecutionResult {
    const ev: ToolCallEvent = {
      id: `evt-${stepIndex}-${toolName}-bytes-limit`,
      stepIndex,
      timestampIso,
      toolName,
      isAllowlisted: true,
      args: rawArgs,
      status: 'limit_exceeded',
      durationMs: 4,
      attemptNumber: 1,
      maxAttempts: 1,
      bytesReturned: 0,
      decisionSummary,
      responsePreview: `HALTED: Cumulative input byte budget (${this.budgets.maxTotalInputBytes} B) exceeded.`,
      errorDetail: `Reading output would exceed maxTotalInputBytes (${this.budgets.maxTotalInputBytes} B).`,
      limitCheck,
    };
    this.events.push(ev);
    return {
      ok: false,
      haltedRunReason: 'limit_exceeded',
      outputText: ev.responsePreview,
      events: [ev],
    };
  }
}
