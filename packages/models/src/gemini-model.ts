import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIModel } from '@sei-code/core';

export class GeminiModel implements AIModel {
  public readonly name = 'gemini';
  public readonly provider = 'google' as const;
  
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-pro') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async chat(message: string, context?: any): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      
      const prompt = this.buildPrompt(message, context);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      return response.text() || 'No response generated';
    } catch (error) {
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(message: string, context?: any): string {
    let prompt = `You are a Sei blockchain AI assistant. Help users with blockchain operations, staking, DeFi, and governance.

User message: ${message}`;

    if (context?.agent) {
      prompt += `\n\nAgent context: ${context.agent.name} - ${context.agent.description}`;
    }

    return prompt;
  }
}