import OpenAI from 'openai';
import type { AIModel } from '@sei-code/core';

export class OpenAIModel implements AIModel {
  public readonly name = 'openai';
  public readonly provider = 'openai' as const;
  
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async chat(message: string, context?: any): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildSystemPrompt(context?: any): string {
    let prompt = `You are a helpful AI assistant for Sei blockchain operations. You can help users with:
- Checking balances and portfolio information
- Staking and delegation operations
- Price monitoring and alerts
- Governance participation
- DeFi strategies

Keep responses concise and helpful.`;

    if (context?.agent) {
      prompt += `\n\nAgent Info:
- Name: ${context.agent.name}
- Description: ${context.agent.description}
- Available capabilities: ${context.agent.capabilities?.map((c: any) => c.name).join(', ') || 'none'}`;
    }

    return prompt;
  }
}