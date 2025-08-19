import { parseEther } from 'viem';
import type { SeiWallet } from '@sei-code/core';
import type { TransactionParams, TransactionResult, TransactionType } from './types';
import type { BaseCapability } from '@sei-code/core';

export class TransactionBuilder implements BaseCapability {
  public readonly name = 'transaction_builder';
  public readonly description = 'Build and execute Sei transactions with optimal gas settings';
  
  private wallet: SeiWallet;

  constructor(wallet: SeiWallet) {
    this.wallet = wallet;
  }

  async execute(params: {
    action: 'build' | 'send' | 'estimate_gas' | 'get_nonce';
    type?: TransactionType;
    to?: string;
    value?: string;
    data?: string;
  }): Promise<any> {
    switch (params.action) {
      case 'build':
        return this.buildTransaction({
          to: params.to!,
          value: params.value,
          data: params.data
        });
      case 'send':
        return this.sendTransaction({
          to: params.to!,
          value: params.value,
          data: params.data
        });
      case 'estimate_gas':
        return this.estimateGas({
          to: params.to!,
          value: params.value,
          data: params.data
        });
      case 'get_nonce':
        return this.getNonce();
      default:
        throw new Error(`Unknown transaction action: ${params.action}`);
    }
  }

  /**
   * Build a transaction with optimal gas settings
   */
  async buildTransaction(params: TransactionParams): Promise<TransactionParams> {
    try {
      // Estimate gas if not provided
      if (!params.gasLimit) {
        const gasEstimate = await this.estimateGas(params);
        params.gasLimit = (BigInt(gasEstimate) * 120n / 100n).toString(); // Add 20% buffer
      }

      // Get gas price if not provided
      if (!params.gasPrice) {
        params.gasPrice = await this.getOptimalGasPrice();
      }

      return params;
    } catch (error) {
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a transaction
   */
  async sendTransaction(params: TransactionParams): Promise<TransactionResult> {
    try {
      const builtTx = await this.buildTransaction(params);
      const hash = await this.wallet.signTransaction(builtTx);
      
      return {
        hash,
        status: 'pending'
      };
    } catch (error) {
      return {
        hash: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(params: TransactionParams): Promise<string> {
    // Simplified gas estimation
    // In practice, this would call the provider's estimateGas method
    
    if (params.data && params.data !== '0x') {
      // Contract interaction
      return '100000';
    } else if (params.value && parseFloat(params.value) > 0) {
      // Token transfer
      return '21000';
    } else {
      // Simple transaction
      return '21000';
    }
  }

  /**
   * Get optimal gas price
   */
  async getOptimalGasPrice(): Promise<string> {
    // Simplified gas price - in practice would query network
    return '1000000000'; // 1 gwei in wei
  }

  /**
   * Get current nonce for the wallet
   */
  async getNonce(): Promise<number> {
    // Simplified nonce - in practice would query network
    return 0;
  }

  /**
   * Create transfer transaction
   */
  createTransfer(to: string, amount: string): TransactionParams {
    return {
      to,
      value: amount,
      data: '0x'
    };
  }

  /**
   * Create contract call transaction
   */
  createContractCall(contractAddress: string, data: string, value?: string): TransactionParams {
    return {
      to: contractAddress,
      value: value || '0',
      data
    };
  }

  /**
   * Create batch of transactions
   */
  createBatch(transactions: TransactionParams[]): TransactionParams[] {
    return transactions.map(tx => ({
      ...tx,
      gasLimit: tx.gasLimit || '100000',
      gasPrice: tx.gasPrice || '1000000000'
    }));
  }

  /**
   * Calculate transaction cost
   */
  async calculateCost(params: TransactionParams): Promise<{
    gasCost: string;
    totalCost: string;
    gasLimit: string;
    gasPrice: string;
  }> {
    const gasLimit = params.gasLimit || await this.estimateGas(params);
    const gasPrice = params.gasPrice || await this.getOptimalGasPrice();
    
    const gasCost = (BigInt(gasLimit) * BigInt(gasPrice)).toString();
    const value = params.value ? parseEther(params.value).toString() : '0';
    const totalCost = (BigInt(gasCost) + BigInt(value)).toString();

    return {
      gasCost,
      totalCost,
      gasLimit,
      gasPrice
    };
  }

  /**
   * Validate transaction parameters
   */
  validateTransaction(params: TransactionParams): boolean {
    if (!params.to || params.to.length !== 42) {
      throw new Error('Invalid recipient address');
    }

    if (params.value) {
      const value = parseFloat(params.value);
      if (value < 0 || isNaN(value)) {
        throw new Error('Invalid transaction value');
      }
    }

    if (params.data && !params.data.startsWith('0x')) {
      throw new Error('Invalid transaction data format');
    }

    return true;
  }

  /**
   * Create common Sei-specific transactions
   */
  createStakeTransaction(validatorAddress: string, amount: string): TransactionParams {
    // This would use the staking precompile
    return {
      to: '0x0000000000000000000000000000000000001005', // Staking precompile
      value: amount,
      data: `0x` // Would encode delegate function call
    };
  }

  createClaimRewardsTransaction(validatorAddress: string): TransactionParams {
    // This would use the distribution precompile
    return {
      to: '0x0000000000000000000000000000000000001007', // Distribution precompile
      value: '0',
      data: `0x` // Would encode withdrawDelegationRewards function call
    };
  }

  createVoteTransaction(proposalId: number, voteOption: number): TransactionParams {
    // This would use the governance precompile
    return {
      to: '0x0000000000000000000000000000000000001006', // Governance precompile
      value: '0',
      data: `0x` // Would encode vote function call
    };
  }
}