import React from 'react';
import {
  ClaimBasis,
  ExecutionMode,
  RunTerminalStatus,
  SeverityLevel,
  ToolCallStatus,
} from '@/lib/types';

export function ModeBadge({
  mode,
  size = 'sm',
}: {
  mode: ExecutionMode;
  size?: 'sm' | 'md';
}) {
  const padding = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  if (mode === 'simulation') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 font-mono font-semibold tracking-wide text-amber-900 uppercase ${padding}`}
        title="Deterministic scripted agent behaviour and controlled tool responses. Not evidence of live model reliability."
      >
        <span className="h-2 w-2 rounded-full bg-amber-600" aria-hidden="true" />
        SIMULATED MODE
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border border-emerald-400 bg-emerald-50 font-mono font-semibold tracking-wide text-emerald-900 uppercase ${padding}`}
      title="Real server-side model execution via Vercel AI SDK."
    >
      <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
      LIVE MODEL MODE
    </span>
  );
}

export function ClaimBasisBadge({ basis }: { basis: ClaimBasis }) {
  if (basis === 'observed') {
    return (
      <span className="inline-flex items-center rounded border border-sky-300 bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-900 uppercase">
        Observed in Repo
      </span>
    );
  }
  if (basis === 'assumption') {
    return (
      <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900 uppercase">
        Assumption
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-900 uppercase">
      Recommendation
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const styles: Record<SeverityLevel, string> = {
    high: 'border-rose-300 bg-rose-50 text-rose-900',
    medium: 'border-amber-300 bg-amber-50 text-amber-900',
    low: 'border-slate-300 bg-slate-100 text-slate-800',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  const labels: Record<SeverityLevel, string> = {
    high: 'HIGH CONCERN',
    medium: 'MEDIUM CONCERN',
    low: 'LOW CONCERN',
    info: 'OBSERVATION',
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${styles[severity]}`}
    >
      {labels[severity]}
    </span>
  );
}

export function TerminalStatusBadge({ status }: { status: RunTerminalStatus }) {
  const map: Record<RunTerminalStatus, { label: string; style: string }> = {
    completed: {
      label: 'COMPLETED',
      style: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    },
    halted_limit_breach: {
      label: 'HALTED: BUDGET LIMIT BREACH',
      style: 'border-amber-400 bg-amber-50 text-amber-950',
    },
    halted_tool_timeout: {
      label: 'HALTED: TOOL TIMEOUT',
      style: 'border-rose-300 bg-rose-50 text-rose-900',
    },
    halted_schema_invalid: {
      label: 'HALTED: SCHEMA INVALID',
      style: 'border-rose-300 bg-rose-50 text-rose-900',
    },
    blocked_missing_credentials: {
      label: 'BLOCKED: MISSING LIVE CREDENTIALS',
      style: 'border-slate-400 bg-slate-100 text-slate-900',
    },
    failed_provider_error: {
      label: 'FAILED: PROVIDER ERROR',
      style: 'border-rose-400 bg-rose-50 text-rose-950',
    },
  };
  const info = map[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${info.style}`}
    >
      {info.label}
    </span>
  );
}

export function ToolStatusBadge({ status }: { status: ToolCallStatus }) {
  const map: Record<ToolCallStatus, { label: string; style: string }> = {
    ok: {
      label: 'OK (200)',
      style: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    },
    retried_ok: {
      label: 'RETRIED OK (Attempt 2/2)',
      style: 'border-sky-300 bg-sky-50 text-sky-900',
    },
    recoverable_error: {
      label: 'TRANSIENT ERROR (Attempt 1/2)',
      style: 'border-amber-300 bg-amber-50 text-amber-900',
    },
    timeout: {
      label: 'TIMEOUT HALT',
      style: 'border-rose-300 bg-rose-50 text-rose-900',
    },
    validation_error: {
      label: 'INPUT VALIDATION ERROR',
      style: 'border-rose-300 bg-rose-50 text-rose-900',
    },
    blocked_unallowlisted: {
      label: 'BLOCKED: UNALLOWLISTED TOOL',
      style: 'border-rose-500 bg-rose-100 text-rose-950',
    },
    limit_exceeded: {
      label: 'HALTED: BUDGET LIMIT EXCEEDED',
      style: 'border-amber-400 bg-amber-100 text-amber-950',
    },
  };
  const item = map[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${item.style}`}
    >
      {item.label}
    </span>
  );
}
