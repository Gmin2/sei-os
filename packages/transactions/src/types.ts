export interface TransactionParams {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface BatchTransactionParams {
  transactions: TransactionParams[];
  executeSequentially?: boolean;
  stopOnFailure?: boolean;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

export interface TransactionReceipt {
  hash: string;
  blockNumber: number;
  gasUsed: string;
  status: 'success' | 'failure';
  logs: any[];
}

export enum TransactionType {
  TRANSFER = 'transfer',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  CLAIM_REWARDS = 'claim_rewards',
  VOTE = 'vote',
  SWAP = 'swap',
  CONTRACT_CALL = 'contract_call'
}