import type { Provider } from 'ethers';

export interface SeiAgentConfig {
  name: string;
  description: string;
  capabilities: string[];
  network: 'mainnet' | 'testnet' | 'devnet';
  wallet?: SeiWallet;
  provider?: Provider;
}

export interface SeiWallet {
  address: string;
  privateKey?: string;
  connect(): Promise<void>;
  getBalance(denom: string): Promise<string>;
  signTransaction(tx: any): Promise<string>;
}

export interface AgentCapability {
  name: string;
  description: string;
  execute(params: any): Promise<any>;
}

export interface AgentMessage {
  id: string;
  timestamp: Date;
  from: string;
  to: string;
  content: string;
  type: 'text' | 'action' | 'result';
}

export interface AgentEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export interface AIModel {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  chat(message: string, context?: any): Promise<string>;
}

export interface SocialPlatform {
  name: string;
  connect(): Promise<void>;
  sendMessage(message: string, recipient?: string): Promise<void>;
  onMessage(callback: (message: any) => void): void;
}