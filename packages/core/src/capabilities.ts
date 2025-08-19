import type { AgentCapability } from './types';

/**
 * Base class for agent capabilities
 */
export abstract class BaseCapability implements AgentCapability {
  public readonly name: string;
  public readonly description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  abstract execute(params: any): Promise<any>;
}

/**
 * Simple text response capability
 */
export class TextResponseCapability extends BaseCapability {
  constructor() {
    super('text_response', 'Respond with text messages');
  }

  async execute(params: { message: string }): Promise<string> {
    return `Echo: ${params.message}`;
  }
}

/**
 * Capability registry for managing available capabilities
 */
export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private capabilities: Map<string, () => AgentCapability> = new Map();

  private constructor() {
    // Register default capabilities
    this.register('text_response', () => new TextResponseCapability());
  }

  static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  /**
   * Register a new capability factory
   */
  register(name: string, factory: () => AgentCapability): void {
    this.capabilities.set(name, factory);
  }

  /**
   * Create a capability instance by name
   */
  create(name: string): AgentCapability | null {
    const factory = this.capabilities.get(name);
    return factory ? factory() : null;
  }

  /**
   * Get all registered capability names
   */
  getAvailableCapabilities(): string[] {
    return Array.from(this.capabilities.keys());
  }
}

/**
 * Helper function to create a simple capability
 */
export function createCapability(
  name: string,
  description: string,
  execute: (params: any) => Promise<any>
): AgentCapability {
  return {
    name,
    description,
    execute
  };
}