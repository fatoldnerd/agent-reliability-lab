import React from 'react';
import { EvidenceReference, RepositorySnapshot } from '@/lib/types';

interface SourceInspectorModalProps {
  snapshot: RepositorySnapshot;
  selectedFilePath: string;
  highlightedRef: EvidenceReference | null;
  inspectedFiles: string[];
  onSelectFile: (filePath: string) => void;
  onClose: () => void;
}

export function SourceInspectorModal({
  snapshot,
  selectedFilePath,
  highlightedRef,
  inspectedFiles,
  onSelectFile,
  onClose,
}: SourceInspectorModalProps) {
  const file =
    snapshot.files.find((f) => f.path === selectedFilePath) ?? snapshot.files[0];
  const lines = file ? file.content.split('\n') : [];
  const wasReadByAgent = file ? inspectedFiles.includes(file.path) : false;

  const isHighlightedFile =
    highlightedRef && file && highlightedRef.filePath === file.path;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-inspector-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-3.5 text-white">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 id="source-inspector-title" className="font-mono text-sm font-semibold">
                Repository Snapshot Source Inspector — {snapshot.name}
              </h2>
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
                v{snapshot.version}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-300">
              Verify cited file existence, line-range boundaries, and whether the agent actually read the file via{' '}
              <code className="font-mono text-amber-300">readFile</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Close Inspector (Esc)
          </button>
        </div>

        {/* Highlighted Evidence Validation Banner */}
        {highlightedRef && (
          <div
            className={`border-b px-5 py-3 text-xs ${
              highlightedRef.validation?.isValid
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-rose-200 bg-rose-50 text-rose-950'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">
                Cited Evidence Target:{' '}
                <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono">
                  {highlightedRef.filePath}:L{highlightedRef.startLine}–L{highlightedRef.endLine}
                </code>
              </div>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                  highlightedRef.validation?.isValid
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                    : 'border-rose-400 bg-rose-100 text-rose-900'
                }`}
              >
                {highlightedRef.validation?.isValid
                  ? 'EVIDENCE REFERENCE VALID'
                  : 'EVIDENCE REFERENCE INVALID'}
              </span>
            </div>
            <p className="mt-1">
              {highlightedRef.validation?.validationNote ??
                'Reference checked against snapshot file and execution trace.'}
            </p>
            <p className="mt-1 text-[11px] text-slate-600 italic">
              Epistemic Boundary Note: Reference validity confirms the cited file and line range exist and were inspected; it does not prove that the agent&apos;s architectural interpretation is correct.
            </p>
          </div>
        )}

        {/* Body: File list sidebar + Line-numbered code viewer */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-4">
          {/* File list */}
          <aside className="border-r border-slate-200 bg-slate-50 p-3 overflow-y-auto">
            <div className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Snapshot Files ({snapshot.files.length})
            </div>
            <ul className="space-y-1">
              {snapshot.files.map((f) => {
                const active = file?.path === f.path;
                const inspected = inspectedFiles.includes(f.path);
                return (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => onSelectFile(f.path)}
                      className={`w-full rounded px-2.5 py-2 text-left text-xs transition ${
                        active
                          ? 'bg-slate-900 font-semibold text-white'
                          : 'text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      <div className="truncate font-mono">{f.path}</div>
                      <div className="mt-1 flex items-center justify-between text-[10px]">
                        <span className={active ? 'text-slate-300' : 'text-slate-500'}>
                          {f.sizeBytes} B
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.2 font-mono ${
                            inspected
                              ? active
                                ? 'bg-emerald-800 text-emerald-100'
                                : 'bg-emerald-100 text-emerald-800'
                              : active
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {inspected ? 'Read by Agent' : 'Not Read'}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Code Viewer */}
          <div className="col-span-3 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
            {file ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-white">{file.path}</span>
                    <span className="text-slate-400">({file.sizeBytes} bytes)</span>
                    {file.simulatedFault && (
                      <span className="rounded border border-rose-500/40 bg-rose-950 px-2 py-0.5 font-mono text-[11px] text-rose-200">
                        Fault Trigger: {file.simulatedFault}
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[11px] ${
                      wasReadByAgent
                        ? 'bg-emerald-900/70 text-emerald-200'
                        : 'bg-amber-900/70 text-amber-200'
                    }`}
                  >
                    {wasReadByAgent
                      ? 'Verified in Execution Trace (readFile)'
                      : 'Not Read in Current Run Trace'}
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
                  {lines.map((lineText, idx) => {
                    const lineNumber = idx + 1;
                    const inHighlightRange =
                      isHighlightedFile &&
                      highlightedRef &&
                      lineNumber >= highlightedRef.startLine &&
                      lineNumber <= highlightedRef.endLine;

                    return (
                      <div
                        key={lineNumber}
                        className={`flex px-2 py-0.5 ${
                          inHighlightRange
                            ? 'border-l-4 border-amber-400 bg-amber-500/20 text-amber-100'
                            : 'hover:bg-slate-900'
                        }`}
                      >
                        <span className="w-10 shrink-0 select-none text-right pr-4 text-slate-500 tabular-nums">
                          {lineNumber}
                        </span>
                        <span className="whitespace-pre-wrap break-all">{lineText || ' '}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-6 text-sm text-slate-400">
                File not found in repository snapshot.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
