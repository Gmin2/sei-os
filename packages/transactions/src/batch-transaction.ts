import type { SeiWallet } from '@sei-code/core';
import type { TransactionParams, BatchTransactionParams, TransactionResult } from './types';
import { TransactionBuilder } from './transaction-builder';

export class BatchTransactionExecutor {
  private transactionBuilder: TransactionBuilder;
  private wallet: SeiWallet;

  constructor(wallet: SeiWallet) {
    this.wallet = wallet;
    this.transactionBuilder = new TransactionBuilder(wallet);
  }

  /**
   * Execute multiple transactions
   */
  async executeBatch(params: BatchTransactionParams): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];

    if (params.executeSequentially) {
      // Execute one by one
      for (const tx of params.transactions) {
        try {
          const result = await this.transactionBuilder.sendTransaction(tx);
          results.push(result);

          // Stop if transaction failed and stopOnFailure is true
          if (result.status === 'failed' && params.stopOnFailure) {
            break;
          }
        } catch (error) {
          results.push({
            hash: '',
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          if (params.stopOnFailure) {
            break;
          }
        }
      }
    } else {
      // Execute in parallel
      const promises = params.transactions.map(tx =>
        this.transactionBuilder.sendTransaction(tx).catch(error => ({
          hash: '',
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Create a compound staking operation (claim rewards + re-delegate)
   */
  async createAutoCompoundBatch(validatorAddress: string): Promise<BatchTransactionParams> {
    return {
      transactions: [
        this.transactionBuilder.createClaimRewardsTransaction(validatorAddress),
        // Would add re-delegation transaction after claiming
      ],
      executeSequentially: true,
      stopOnFailure: true
    };
  }

  /**
   * Create a portfolio rebalancing batch
   */
  async createRebalanceBatch(operations: Array<{
    type: 'unstake' | 'stake';
    validator: string;
    amount: string;
  }>): Promise<BatchTransactionParams> {
    const transactions: TransactionParams[] = [];

    for (const op of operations) {
      if (op.type === 'stake') {
        transactions.push(
          this.transactionBuilder.createStakeTransaction(op.validator, op.amount)
        );
      } else {
        // Would create unstake transaction
        transactions.push({
          to: '0x0000000000000000000000000000000000001005',
          value: '0',
          data: '0x' // Would encode undelegate function
        });
      }
    }

    return {
      transactions,
      executeSequentially: true,
      stopOnFailure: true
    };
  }

  /**
   * Estimate total cost for batch
   */
  async estimateBatchCost(transactions: TransactionParams[]): Promise<{
    totalGasCost: string;
    totalValue: string;
    individual: Array<{
      gasCost: string;
      value: string;
    }>;
  }> {
    const costs = await Promise.all(
      transactions.map(tx => this.transactionBuilder.calculateCost(tx))
    );

    const totalGasCost = costs.reduce(
      (sum, cost) => (BigInt(sum) + BigInt(cost.gasCost)).toString(),
      '0'
    );

    const totalValue = costs.reduce(
      (sum, cost) => (BigInt(sum) + BigInt(cost.totalCost)).toString(),
      '0'
    );

    return {
      totalGasCost,
      totalValue,
      individual: costs.map(cost => ({
        gasCost: cost.gasCost,
        value: cost.totalCost
      }))
    };
  }
}