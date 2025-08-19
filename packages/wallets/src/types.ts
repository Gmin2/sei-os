export interface WalletConfig {
  type: 'sei-global' | 'metamask' | 'private-key';
  network: 'mainnet' | 'testnet' | 'devnet';
  privateKey?: string;
  rpcUrl?: string;
}

export interface WalletConnection {
  address: string;
  isConnected: boolean;
  network: string;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
}