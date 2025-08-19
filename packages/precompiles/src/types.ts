import type { Provider } from 'ethers';
import type { PublicClient, WalletClient } from 'viem';

export interface PrecompileConfig {
  provider?: Provider;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  network: 'mainnet' | 'testnet' | 'devnet';
}

export interface TokenBalance {
  denom: string;
  amount: string;
  formatted: string;
  decimals: number;
}

export interface ValidatorInfo {
  address: string;
  moniker: string;
  commission: number;
  uptime: number;
  votingPower: string;
  status: 'bonded' | 'unbonded' | 'unbonding';
}

export interface DelegationInfo {
  validatorAddress: string;
  amount: string;
  shares: string;
  rewards: string;
}

export interface StakingRewards {
  validator: string;
  amount: string;
  denom: string;
}

export interface ProposalInfo {
  id: number;
  title: string;
  description: string;
  status: string;
  votingStart: Date;
  votingEnd: Date;
  deposit: string;
}

export interface VoteInfo {
  proposalId: number;
  voter: string;
  option: VoteOption;
  weight: string;
}

export enum VoteOption {
  YES = 1,
  ABSTAIN = 2,
  NO = 3,
  NO_WITH_VETO = 4
}

export interface PriceData {
  denom: string;
  price: number;
  timestamp: Date;
  source: string;
}

export interface TWAPData {
  denom: string;
  price: number;
  lookbackSeconds: number;
  timestamp: Date;
}