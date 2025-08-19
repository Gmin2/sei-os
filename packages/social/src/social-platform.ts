import type { SocialPlatform } from '@sei-code/core';
import type { SocialMessage, SocialCommand, SocialPlatformConfig } from './types';

export abstract class BaseSocialPlatform implements SocialPlatform {
  public readonly name: string;
  protected config: SocialPlatformConfig;
  protected commands: Map<string, SocialCommand> = new Map();
  protected connected: boolean = false;

  constructor(name: string, config: SocialPlatformConfig) {
    this.name = name;
    this.config = config;
    
    // Register default commands
    this.registerDefaultCommands();
    
    // Register custom commands
    if (config.commands) {
      config.commands.forEach(cmd => this.registerCommand(cmd));
    }
  }

  abstract connect(): Promise<void>;
  abstract sendMessage(message: string, recipient?: string): Promise<void>;
  abstract onMessage(callback: (message: any) => void): void;

  /**
   * Register a command
   */
  registerCommand(command: SocialCommand): void {
    this.commands.set(command.command, command);
  }

  /**
   * Get all registered commands
   */
  getCommands(): SocialCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Process a command message
   */
  async processCommand(message: SocialMessage): Promise<string> {
    const text = message.text.trim();
    
    if (!text.startsWith('/')) {
      // Not a command, let the agent handle it
      return await this.config.agent.processMessage(text, message.from.id);
    }

    const parts = text.slice(1).split(' ');
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.commands.get(commandName);
    if (!command) {
      return `Unknown command: /${commandName}. Type /help for available commands.`;
    }

    // Check admin permissions
    if (command.adminOnly && !this.isAdmin(message.from.id)) {
      return '❌ This command requires admin privileges.';
    }

    // Check wallet requirement
    if (command.requiresWallet && !this.config.agent.getWallet()) {
      return '❌ This command requires a connected wallet.';
    }

    try {
      return await command.handler(message, args);
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      return `❌ Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Check if user is admin
   */
  protected isAdmin(userId: string): boolean {
    // This would be implemented by specific platforms
    return false;
  }

  /**
   * Register default commands available on all platforms
   */
  private registerDefaultCommands(): void {
    this.registerCommand({
      command: 'help',
      description: 'Show available commands',
      handler: async () => {
        const commands = this.getCommands()
          .map(cmd => `/${cmd.command} - ${cmd.description}`)
          .join('\n');
        return `🤖 Available commands:\n\n${commands}`;
      }
    });

    this.registerCommand({
      command: 'balance',
      description: 'Check your SEI balance',
      handler: async (message) => {
        try {
          const wallet = this.config.agent.getWallet();
          if (!wallet) {
            return '❌ No wallet connected. Please connect a wallet first.';
          }

          const balance = await wallet.getBalance('usei');
          return `💰 Your SEI balance: ${balance} SEI`;
        } catch (error) {
          return `❌ Error checking balance: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      requiresWallet: true
    });

    this.registerCommand({
      command: 'wallet',
      description: 'Show wallet information',
      handler: async () => {
        const wallet = this.config.agent.getWallet();
        if (!wallet) {
          return '❌ No wallet connected.';
        }

        return `🔗 Wallet connected:\nAddress: ${wallet.address}`;
      },
      requiresWallet: true
    });

    this.registerCommand({
      command: 'status',
      description: 'Show agent status',
      handler: async () => {
        const agent = this.config.agent;
        const capabilities = agent.getCapabilities();
        const wallet = agent.getWallet();

        return `🤖 Agent Status:
Name: ${agent.name}
Description: ${agent.description}
Network: ${agent.network}
Capabilities: ${capabilities.length}
Wallet: ${wallet ? '✅ Connected' : '❌ Not connected'}`;
      }
    });

    this.registerCommand({
      command: 'price',
      description: 'Get current SEI price',
      handler: async (message, args) => {
        try {
          // This would use the oracle capability if available
          const denom = args[0] || 'usei';
          return `📈 Price for ${denom.toUpperCase()}: $0.25 (Demo price)`;
        } catch (error) {
          return `❌ Error getting price: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    });
  }
}