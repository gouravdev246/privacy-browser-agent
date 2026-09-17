import React, { useState, useEffect, useMemo } from 'react';
import {
  privacyFlowStore,
  type PrivacyFlowStepRecord,
  type PrivacyFlowState,
  DEFAULT_PRIVACY_FLOW_STATE,
} from '@extension/storage';
import {
  FiShield,
  FiX,
  FiLock,
  FiSend,
  FiServer,
  FiCheckCircle,
  FiArrowRight,
  FiCpu,
  FiEye,
  FiTerminal,
  FiRefreshCw,
} from 'react-icons/fi';

interface PrivacyFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  focusedStepNumber?: number | null;
}

export const PrivacyFlowModal: React.FC<PrivacyFlowModalProps> = ({
  isOpen,
  onClose,
  isDarkMode = false,
  focusedStepNumber = null,
}) => {
  const [flowState, setFlowState] = useState<PrivacyFlowState>(DEFAULT_PRIVACY_FLOW_STATE);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'all' | 'sanitization' | 'outgoing' | 'incoming' | 'local'>('all');

  useEffect(() => {
    if (!isOpen) return;

    // Fetch initial state
    privacyFlowStore.get().then(state => {
      if (state && state.steps) {
        setFlowState(state);
      }
    });

    // Subscribe to live storage updates
    const unsubscribe = privacyFlowStore.subscribe(() => {
      const snapshot = privacyFlowStore.getSnapshot();
      if (snapshot && snapshot.steps) {
        setFlowState(snapshot);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const steps = useMemo(() => flowState.steps || [], [flowState.steps]);

  // Handle focused step from props or auto-select latest step
  useEffect(() => {
    if (steps.length === 0) {
      setSelectedStepIndex(0);
      return;
    }

    if (focusedStepNumber !== null && focusedStepNumber !== undefined) {
      const idx = steps.findIndex(s => s.stepNumber === focusedStepNumber);
      if (idx !== -1) {
        setSelectedStepIndex(idx);
        return;
      }
    }

    // Default to the latest step
    setSelectedStepIndex(steps.length - 1);
  }, [steps, focusedStepNumber]);

  if (!isOpen) return null;

  const currentStep: PrivacyFlowStepRecord | undefined = steps[selectedStepIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm animate-fade-in"
      onClick={onClose}>
      <div
        className={`relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border shadow-2xl transition-all ${
          isDarkMode ? 'border-slate-700 bg-slate-900 text-gray-100' : 'border-slate-200 bg-white text-gray-800'
        }`}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-5 py-3.5 ${
            isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'
          }`}>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <FiShield size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Privacy & Data Flow Inspector</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Protection
                </span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Audit what data leaves your browser and how local values are resolved
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-1.5 transition-colors ${
              isDarkMode
                ? 'text-gray-400 hover:bg-slate-800 hover:text-gray-200'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}>
            <FiX size={18} />
          </button>
        </div>

        {/* Step Selector & Global Stats */}
        {steps.length > 0 && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 border-b px-5 py-2.5 text-xs ${
              isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/40'
            }`}>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Step:</span>
              {steps.map((step, idx) => (
                <button
                  key={step.stepId}
                  type="button"
                  onClick={() => setSelectedStepIndex(idx)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    selectedStepIndex === idx
                      ? 'bg-sky-600 text-white shadow-sm'
                      : isDarkMode
                        ? 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  Step {step.stepNumber}
                  {step.sanitization.redactionsCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-emerald-400/20 px-1 py-0.2 text-[9px] text-emerald-300">
                      {step.sanitization.redactionsCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-500 font-medium">🛡️ {flowState.totalRedactionsCount} total redactions</span>
              <button
                type="button"
                onClick={() => privacyFlowStore.clear()}
                title="Clear inspection history"
                className={`flex items-center gap-1 text-[11px] underline opacity-70 hover:opacity-100 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                <FiRefreshCw size={11} />
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!currentStep ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 mb-3">
                <FiShield size={28} />
              </div>
              <h3 className="text-sm font-semibold">No Privacy Events Recorded Yet</h3>
              <p className={`mt-1 max-w-xs text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Run an agent task in the side panel. The inspector will display what sensitive page data gets redacted,
                what payload goes to the server, and what resolves locally.
              </p>
            </div>
          ) : (
            <>
              {/* 4-Stage Pipeline Flow Overview */}
              <div
                className={`rounded-xl border p-4 shadow-sm ${
                  isDarkMode ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50'
                }`}>
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-sky-500">Pipeline Flow</span>
                  <span
                    className={`truncate max-w-[280px] font-mono text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {currentStep.url || 'browser tab'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  {/* Stage 1 */}
                  <div
                    onClick={() => setActiveTab('sanitization')}
                    className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                      activeTab === 'sanitization' || activeTab === 'all'
                        ? isDarkMode
                          ? 'border-emerald-500/50 bg-emerald-950/20'
                          : 'border-emerald-300 bg-emerald-50/70'
                        : isDarkMode
                          ? 'border-slate-800 bg-slate-900/50'
                          : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <FiLock size={12} />
                      1. Sanitization
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      {currentStep.sanitization.redactionsCount > 0 ? (
                        <span className="text-emerald-500 font-semibold">
                          {currentStep.sanitization.redactionsCount} item(s) redacted
                        </span>
                      ) : (
                        'No PII detected'
                      )}
                    </div>
                  </div>

                  {/* Stage 2 */}
                  <div
                    onClick={() => setActiveTab('outgoing')}
                    className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                      activeTab === 'outgoing' || activeTab === 'all'
                        ? isDarkMode
                          ? 'border-sky-500/50 bg-sky-950/20'
                          : 'border-sky-300 bg-sky-50/70'
                        : isDarkMode
                          ? 'border-slate-800 bg-slate-900/50'
                          : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                      <FiSend size={12} />
                      2. Sent to Server
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      Sanitized context only
                    </div>
                  </div>

                  {/* Stage 3 */}
                  <div
                    onClick={() => setActiveTab('incoming')}
                    className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                      activeTab === 'incoming' || activeTab === 'all'
                        ? isDarkMode
                          ? 'border-indigo-500/50 bg-indigo-950/20'
                          : 'border-indigo-300 bg-indigo-50/70'
                        : isDarkMode
                          ? 'border-slate-800 bg-slate-900/50'
                          : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <FiServer size={12} />
                      3. Return from Server
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      {currentStep.incoming ? 'Abstract plan received' : 'Waiting / thinking'}
                    </div>
                  </div>

                  {/* Stage 4 */}
                  <div
                    onClick={() => setActiveTab('local')}
                    className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                      activeTab === 'local' || activeTab === 'all'
                        ? isDarkMode
                          ? 'border-purple-500/50 bg-purple-950/20'
                          : 'border-purple-300 bg-purple-50/70'
                        : isDarkMode
                          ? 'border-slate-800 bg-slate-900/50'
                          : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                      <FiCpu size={12} />
                      4. Local Resolve
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      {currentStep.localResolution ? (
                        <span className="text-purple-500 font-semibold">Resolved locally 🔒</span>
                      ) : (
                        'Standard action'
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage Detail Cards */}
              <div className="space-y-4">
                {/* 1. Sanitization Card */}
                {(activeTab === 'all' || activeTab === 'sanitization') && (
                  <div
                    className={`rounded-xl border p-4 shadow-sm ${
                      isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 text-xs">
                          1
                        </span>
                        <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          Stage 1: Page Sanitization & Redaction
                        </h4>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        Local Browser Engine
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                        {currentStep.sanitization.summary}
                      </p>

                      {currentStep.sanitization.types.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-gray-500">Detected Categories:</span>
                          {currentStep.sanitization.types.map(type => (
                            <span
                              key={type}
                              className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                              {type}
                            </span>
                          ))}
                        </div>
                      )}

                      {currentStep.sanitization.sampleRedactions &&
                        currentStep.sanitization.sampleRedactions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-gray-500">Redaction Tokens:</span>
                            {currentStep.sanitization.sampleRedactions.map(token => (
                              <code
                                key={token}
                                className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                                {token}
                              </code>
                            ))}
                          </div>
                        )}

                      {currentStep.sanitization.screenshotRedacted && (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 pt-1">
                          <FiEye size={12} />
                          <span>Vision Redactor blacked out sensitive image regions before upload</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Outgoing to Server Card */}
                {(activeTab === 'all' || activeTab === 'outgoing') && (
                  <div
                    className={`rounded-xl border p-4 shadow-sm ${
                      isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-sky-500/10 text-sky-500 text-xs">
                          2
                        </span>
                        <h4 className="text-sm font-semibold text-sky-600 dark:text-sky-400">
                          Stage 2: Outgoing to Remote AI Server
                        </h4>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                        <FiCheckCircle size={10} />
                        Zero Raw PII Transmitted
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                        The remote LLM received sanitized interactive elements text with PII tokens redacted. Abstract
                        keys (like <code className="text-sky-500 font-mono">profile.email</code>) are transmitted so the
                        model knows your intent, but your actual data never leaves your device.
                      </p>

                      <div
                        className={`rounded-lg border p-2.5 font-mono text-[11px] ${
                          isDarkMode
                            ? 'border-slate-800 bg-slate-950 text-gray-300'
                            : 'border-slate-200 bg-gray-50 text-gray-700'
                        }`}>
                        <div className="mb-1 text-[10px] text-gray-500 font-sans">Outgoing Text Snippet:</div>
                        <div className="whitespace-pre-wrap break-words">
                          {currentStep.outgoing.sanitizedTextPreview}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Return from Server Card */}
                {(activeTab === 'all' || activeTab === 'incoming') && (
                  <div
                    className={`rounded-xl border p-4 shadow-sm ${
                      isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 text-xs">
                          3
                        </span>
                        <h4 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                          Stage 3: Return from Server (Action Plan)
                        </h4>
                      </div>
                      <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                        Abstract Plan Only
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      {currentStep.incoming ? (
                        <>
                          <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                            The remote model returned an abstract action. Notice that it does not return real values; it
                            returns data keys:
                          </p>
                          <div
                            className={`rounded-lg border p-2.5 font-mono text-[11px] ${
                              isDarkMode
                                ? 'border-slate-800 bg-slate-950 text-indigo-300'
                                : 'border-slate-200 bg-indigo-50/50 text-indigo-900'
                            }`}>
                            <pre className="whitespace-pre-wrap break-words">
                              {currentStep.incoming.abstractPlanPreview}
                            </pre>
                          </div>
                        </>
                      ) : (
                        <p className="italic text-gray-500">Awaiting server response for this step...</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Local Resolution Card */}
                {(activeTab === 'all' || activeTab === 'local') && (
                  <div
                    className={`rounded-xl border p-4 shadow-sm ${
                      isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
                    }`}>
                    <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 text-xs">
                          4
                        </span>
                        <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                          Stage 4: Local Action Resolution
                        </h4>
                      </div>
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                        100% On-Device
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      {currentStep.localResolution ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                            <FiCheckCircle size={14} />
                            <span>Successfully filled field with local data</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Key Resolved:</span>
                            {currentStep.localResolution.resolvedKeys.map(k => (
                              <code
                                key={k}
                                className="rounded bg-purple-500/15 px-1.5 py-0.5 font-mono text-[11px] text-purple-600 dark:text-purple-400">
                                {k}
                              </code>
                            ))}
                          </div>
                          <p className={`text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Feedback sent back to AI:{' '}
                            <em className="text-gray-300 dark:text-gray-400">
                              &quot;{currentStep.localResolution.sanitizedMessage}&quot;
                            </em>{' '}
                            (value was kept strictly local).
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-500">
                          This step performed a standard browser action (e.g. click, scroll, navigation). No private
                          form fields were filled in this step.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between border-t px-5 py-3 ${
            isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/60'
          }`}>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <FiLock size={12} className="text-emerald-500" />
            <span>End-to-End Privacy Boundary Enforced</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-sky-700 transition-colors">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
