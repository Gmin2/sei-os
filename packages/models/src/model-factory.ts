import type { AIModel } from '@sei-code/core';
import { OpenAIModel } from './openai-model';
import { ClaudeModel } from './claude-model';
import { GeminiModel } from './gemini-model';

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  model?: string;
}

export class ModelFactory {
  static create(config: ModelConfig): AIModel {
    switch (config.provider) {
      case 'openai':
        return new OpenAIModel(config.apiKey, config.model);
      case 'anthropic':
        return new ClaudeModel(config.apiKey, config.model);
      case 'google':
        return new GeminiModel(config.apiKey, config.model);
      default:
        throw new Error(`Unsupported model provider: ${config.provider}`);
    }
  }

  static createOpenAI(apiKey: string, model?: string): OpenAIModel {
    return new OpenAIModel(apiKey, model);
  }

  static createClaude(apiKey: string, model?: string): ClaudeModel {
    return new ClaudeModel(apiKey, model);
  }

  static createGemini(apiKey: string, model?: string): GeminiModel {
    return new GeminiModel(apiKey, model);
  }
}