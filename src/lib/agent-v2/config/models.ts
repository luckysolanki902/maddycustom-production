// Model configurations for agents

import { MODELS } from './constants';

export interface ModelConfig {
  name: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  classifier: {
    name: MODELS.CLASSIFIER,
    temperature: 0.1, // Low temperature for consistent classification
    maxTokens: 500,
  },
  
  dataQuery: {
    name: MODELS.DATA_QUERY,
    temperature: 0.7, // Balanced for tool use and conversation
    maxTokens: 1000,
  },
  
  vectorStore: {
    name: MODELS.VECTOR_STORE,
    temperature: 0.3, // Lower for factual retrieval
    maxTokens: 800,
  },
  
  directAnswer: {
    name: MODELS.DIRECT_ANSWER,
    temperature: 0.8, // Higher for natural conversation
    maxTokens: 300,
  },
  
  handoff: {
    name: MODELS.HANDOFF,
    temperature: 0.5,
    maxTokens: 300,
  },
};
