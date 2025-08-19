import Anthropic from '@anthropic-ai/sdk';
import type { AIModel } from '@sei-code/core';

export class ClaudeModel implements AIModel {
  public readonly name = 'claude';
  public readonly provider = 'anthropic' as const;
  
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-3-sonnet-20240229') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(message: string, context?: any): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message }
        ]
      });

      const content = response.content[0];
      return content.type === 'text' ? content.text : 'No response generated';
    } catch (error) {
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildSystemPrompt(context?: any): string {
    let prompt = `You are a helpful AI assistant specialized in Sei blockchain operations. You provide clear, accurate information about:

- Sei network and token operations
- Staking, delegation, and rewards
- DeFi strategies and yield optimization
- Governance proposals and voting
- Price analysis and market data

Always be helpful, accurate, and concise in your responses.`;

    if (context?.agent) {
      prompt += `\n\nYou are working with agent "${context.agent.name}" which has these capabilities: ${context.agent.capabilities?.map((c: any) => c.name).join(', ') || 'none'}`;
    }

    return prompt;
  }
}