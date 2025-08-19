import type { AgentEvent } from './types';

/**
 * Event types for the agent system
 */
export enum AgentEventType {
  AGENT_STARTED = 'agent_started',
  AGENT_STOPPED = 'agent_stopped',
  CAPABILITY_ADDED = 'capability_added',
  CAPABILITY_REMOVED = 'capability_removed',
  CAPABILITY_EXECUTED = 'capability_executed',
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_SENT = 'message_sent',
  WALLET_CONNECTED = 'wallet_connected',
  TRANSACTION_SENT = 'transaction_sent',
  TRANSACTION_CONFIRMED = 'transaction_confirmed',
  ERROR = 'error'
}

/**
 * Event manager for handling agent events
 */
export class AgentEventManager {
  private listeners: Map<string, Array<(event: AgentEvent) => void>> = new Map();

  /**
   * Add an event listener
   */
  on(eventType: string, callback: (event: AgentEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Remove an event listener
   */
  off(eventType: string, callback: (event: AgentEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  emit(eventType: string, data: any): void {
    const event: AgentEvent = {
      type: eventType,
      data,
      timestamp: new Date()
    };

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Get all event types that have listeners
   */
  getEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Clear all listeners for an event type
   */
  clearListeners(eventType: string): void {
    this.listeners.delete(eventType);
  }

  /**
   * Clear all listeners
   */
  clearAllListeners(): void {
    this.listeners.clear();
  }
}