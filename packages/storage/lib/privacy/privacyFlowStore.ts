import { createStorage } from '../base/base';
import { StorageEnum } from '../base/enums';
import type { BaseStorage } from '../base/types';

export interface PrivacyStageSanitization {
  sensitiveCount: number;
  types: string[]; // e.g. ['EMAIL', 'PASSWORD', 'PHONE']
  sources: string[]; // e.g. ['dom', 'regex', 'vision']
  redactionsCount: number;
  summary: string;
  sampleRedactions?: string[];
  screenshotRedacted?: boolean;
}

export interface PrivacyStageOutgoing {
  modelName: string;
  provider: string;
  charCount: number;
  sanitizedTextPreview: string;
  hasScreenshot: boolean;
  dataKeysIncluded: string[];
}

export interface PrivacyStageIncoming {
  actionName?: string;
  abstractPlanPreview: string;
  dataKeysUsed?: string[];
}

export interface PrivacyStageLocalResolution {
  resolvedKeys: string[];
  elementIndex?: number;
  sanitizedMessage: string;
  timestamp: number;
}

export interface PrivacyFlowStepRecord {
  stepId: string;
  stepNumber: number;
  taskId: string;
  timestamp: number;
  url: string;
  title: string;
  sanitization: PrivacyStageSanitization;
  outgoing: PrivacyStageOutgoing;
  incoming?: PrivacyStageIncoming;
  localResolution?: PrivacyStageLocalResolution;
}

export interface PrivacyFlowState {
  steps: PrivacyFlowStepRecord[];
  totalRedactionsCount: number;
  activeStepId: string | null;
  lastUpdated: number;
}

export const DEFAULT_PRIVACY_FLOW_STATE: PrivacyFlowState = {
  steps: [],
  totalRedactionsCount: 0,
  activeStepId: null,
  lastUpdated: Date.now(),
};

const MAX_RECORDS = 50;

const storage = createStorage<PrivacyFlowState>('privacy-flow-state', DEFAULT_PRIVACY_FLOW_STATE, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export type PrivacyFlowStore = BaseStorage<PrivacyFlowState> & {
  addStep: (stepData: Omit<PrivacyFlowStepRecord, 'stepId' | 'timestamp'>) => Promise<string>;
  updateStepIncoming: (stepNumber: number, incoming: PrivacyStageIncoming) => Promise<void>;
  updateStepResolution: (stepNumber: number, resolution: PrivacyStageLocalResolution) => Promise<void>;
  getLatest: () => Promise<PrivacyFlowStepRecord | null>;
  clear: () => Promise<void>;
};

export const privacyFlowStore: PrivacyFlowStore = {
  ...storage,

  async addStep(stepData) {
    const stepId = `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRecord: PrivacyFlowStepRecord = {
      ...stepData,
      stepId,
      timestamp: Date.now(),
    };

    await storage.set(prev => {
      const state = prev || DEFAULT_PRIVACY_FLOW_STATE;
      const filtered = (state.steps || []).filter(s => s.stepNumber !== newRecord.stepNumber);
      const steps = [...filtered, newRecord].slice(-MAX_RECORDS);
      const totalRedactionsCount = steps.reduce((acc, s) => acc + (s.sanitization?.redactionsCount || 0), 0);

      return {
        steps,
        totalRedactionsCount,
        activeStepId: stepId,
        lastUpdated: Date.now(),
      };
    });

    return stepId;
  },

  async updateStepIncoming(stepNumber, incoming) {
    await storage.set(prev => {
      if (!prev || !prev.steps) return DEFAULT_PRIVACY_FLOW_STATE;
      const steps = prev.steps.map(step => {
        if (step.stepNumber === stepNumber) {
          return {
            ...step,
            incoming,
          };
        }
        return step;
      });

      return {
        ...prev,
        steps,
        lastUpdated: Date.now(),
      };
    });
  },

  async updateStepResolution(stepNumber, resolution) {
    await storage.set(prev => {
      if (!prev || !prev.steps) return DEFAULT_PRIVACY_FLOW_STATE;
      const steps = prev.steps.map(step => {
        if (step.stepNumber === stepNumber) {
          return {
            ...step,
            localResolution: resolution,
          };
        }
        return step;
      });

      return {
        ...prev,
        steps,
        lastUpdated: Date.now(),
      };
    });
  },

  async getLatest() {
    const state = await storage.get();
    if (!state || !state.steps || state.steps.length === 0) return null;
    return state.steps[state.steps.length - 1];
  },

  async clear() {
    await storage.set(DEFAULT_PRIVACY_FLOW_STATE);
  },
};
