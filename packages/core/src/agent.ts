import { EventEmitter } from 'events';
import type { 
  SeiAgentConfig, 
  AgentCapability, 
  AgentMessage, 
  AIModel, 
  SocialPlatform,
  SeiWallet 
} from './types';

export class SeiAgent extends EventEmitter {
  public readonly name: string;
  public readonly description: string;
  public readonly network: string;
  private capabilities: Map<string, AgentCapability> = new Map();
  private wallet?: SeiWallet;
  private aiModel?: AIModel;
  private socialPlatform?: SocialPlatform;
  private messageHistory: AgentMessage[] = [];

  constructor(config: SeiAgentConfig) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.network = config.network;
    this.wallet = config.wallet;
  }

  /**
   * Get the wallet address
   */
  getWalletAddress(): string {
    return this.wallet?.address || '';
  }

  /**
   * Add a capability to the agent
   */
  addCapability(capability: AgentCapability): void {
    this.capabilities.set(capability.name, capability);
    this.emit('capabilityAdded', capability);
  }

  /**
   * Remove a capability from the agent
   */
  removeCapability(name: string): boolean {
    const removed = this.capabilities.delete(name);
    if (removed) {
      this.emit('capabilityRemoved', name);
    }
    return removed;
  }

  /**
   * Get all available capabilities
   */
  getCapabilities(): AgentCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Execute a capability by name
   */
  async executeCapability(name: string, params: any): Promise<any> {
    const capability = this.capabilities.get(name);
    if (!capability) {
      throw new Error(`Capability '${name}' not found`);
    }

    try {
      const result = await capability.execute(params);
      this.emit('capabilityExecuted', { name, params, result });
      return result;
    } catch (error) {
      this.emit('capabilityError', { name, params, error });
      throw error;
    }
  }

  /**
   * Set the AI model for natural language processing
   */
  setAIModel(model: AIModel): void {
    this.aiModel = model;
    this.emit('aiModelSet', model);
  }

  /**
   * Set the social platform for communication
   */
  setSocialPlatform(platform: SocialPlatform): void {
    this.socialPlatform = platform;
    platform.onMessage((message) => {
      this.handleIncomingMessage(message);
    });
    this.emit('socialPlatformSet', platform);
  }

  /**
   * Process a natural language message
   */
  async processMessage(content: string, from: string = 'user'): Promise<string> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      timestamp: new Date(),
      from,
      to: this.name,
      content,
      type: 'text'
    };

    this.messageHistory.push(message);
    this.emit('messageReceived', message);

    try {
      // Use AI model to understand intent and generate response
      if (this.aiModel) {
        const context = {
          agent: {
            name: this.name,
            description: this.description,
            capabilities: this.getCapabilities().map(c => ({
              name: c.name,
              description: c.description
            }))
          },
          history: this.messageHistory.slice(-5) // Last 5 messages for context
        };

        const response = await this.aiModel.chat(content, context);
        
        // Check if response indicates a capability should be executed
        const capabilityMatch = this.extractCapabilityFromResponse(response);
        if (capabilityMatch) {
          const result = await this.executeCapability(capabilityMatch.name, capabilityMatch.params);
          const finalResponse = `${response}\n\nResult: ${JSON.stringify(result)}`;
          
          const responseMessage: AgentMessage = {
            id: this.generateMessageId(),
            timestamp: new Date(),
            from: this.name,
            to: from,
            content: finalResponse,
            type: 'result'
          };
          
          this.messageHistory.push(responseMessage);
          this.emit('messageSent', responseMessage);
          
          return finalResponse;
        }

        const responseMessage: AgentMessage = {
          id: this.generateMessageId(),
          timestamp: new Date(),
          from: this.name,
          to: from,
          content: response,
          type: 'text'
        };

        this.messageHistory.push(responseMessage);
        this.emit('messageSent', responseMessage);

        return response;
      }

      // Fallback response if no AI model
      const fallbackResponse = "I understand you're asking about Sei blockchain operations. Please set up an AI model for better responses.";
      
      const responseMessage: AgentMessage = {
        id: this.generateMessageId(),
        timestamp: new Date(),
        from: this.name,
        to: from,
        content: fallbackResponse,
        type: 'text'
      };

      this.messageHistory.push(responseMessage);
      this.emit('messageSent', responseMessage);

      return fallbackResponse;

    } catch (error) {
      this.emit('messageError', { message, error });
      throw error;
    }
  }

  /**
   * Get wallet information
   */
  getWallet(): SeiWallet | undefined {
    return this.wallet;
  }

  /**
   * Set wallet for blockchain operations
   */
  setWallet(wallet: SeiWallet): void {
    this.wallet = wallet;
    this.emit('walletSet', wallet);
  }

  /**
   * Get message history
   */
  getMessageHistory(): AgentMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Start the agent (connect wallet, social platforms, etc.)
   */
  async start(): Promise<void> {
    try {
      if (this.wallet) {
        await this.wallet.connect();
        this.emit('walletConnected', this.wallet);
      }

      if (this.socialPlatform) {
        await this.socialPlatform.connect();
        this.emit('socialPlatformConnected', this.socialPlatform);
      }

      this.emit('agentStarted');
    } catch (error) {
      this.emit('agentStartError', error);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    this.emit('agentStopped');
  }

  private handleIncomingMessage(message: any): void {
    // Handle incoming messages from social platforms
    this.processMessage(message.content, message.from).catch((error) => {
      console.error('Error processing incoming message:', error);
    });
  }

  private extractCapabilityFromResponse(response: string): { name: string; params: any } | null {
    // Simple pattern matching for capability execution
    // In a real implementation, this would be more sophisticated
    const capabilityPattern = /execute:(\w+)\((.*)\)/;
    const match = response.match(capabilityPattern);
    
    if (match) {
      try {
        const params = match[2] ? JSON.parse(match[2]) : {};
        return { name: match[1], params };
      } catch {
        return null;
      }
    }
    
    return null;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}