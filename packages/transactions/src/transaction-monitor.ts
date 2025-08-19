import type { TransactionResult, TransactionReceipt } from './types';

export class TransactionMonitor {
  private pendingTransactions: Map<string, TransactionResult> = new Map();
  private callbacks: Map<string, Array<(result: TransactionResult) => void>> = new Map();

  /**
   * Monitor a transaction
   */
  async monitorTransaction(hash: string): Promise<TransactionResult> {
    return new Promise((resolve) => {
      // Add callback
      if (!this.callbacks.has(hash)) {
        this.callbacks.set(hash, []);
      }
      this.callbacks.get(hash)!.push(resolve);

      // Start monitoring if not already
      if (!this.pendingTransactions.has(hash)) {
        this.startMonitoring(hash);
      }
    });
  }

  /**
   * Start monitoring a transaction
   */
  private async startMonitoring(hash: string): Promise<void> {
    this.pendingTransactions.set(hash, {
      hash,
      status: 'pending'
    });

    // Simulate monitoring (in practice, would poll blockchain)
    setTimeout(() => {
      const result: TransactionResult = {
        hash,
        status: 'confirmed',
        blockNumber: 12345,
        gasUsed: '21000'
      };

      this.updateTransaction(hash, result);
    }, 5000); // 5 second confirmation time for demo
  }

  /**
   * Update transaction status
   */
  private updateTransaction(hash: string, result: TransactionResult): void {
    this.pendingTransactions.set(hash, result);

    // Notify callbacks
    const callbacks = this.callbacks.get(hash) || [];
    callbacks.forEach(callback => callback(result));

    // Clean up if confirmed or failed
    if (result.status !== 'pending') {
      this.callbacks.delete(hash);
      setTimeout(() => {
        this.pendingTransactions.delete(hash);
      }, 300000); // Keep for 5 minutes after confirmation
    }
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(hash: string): TransactionResult | null {
    return this.pendingTransactions.get(hash) || null;
  }

  /**
   * Get all pending transactions
   */
  getPendingTransactions(): TransactionResult[] {
    return Array.from(this.pendingTransactions.values())
      .filter(tx => tx.status === 'pending');
  }

  /**
   * Wait for multiple transactions
   */
  async waitForTransactions(hashes: string[]): Promise<TransactionResult[]> {
    const promises = hashes.map(hash => this.monitorTransaction(hash));
    return Promise.all(promises);
  }

  /**
   * Cancel monitoring (for cleanup)
   */
  cancelMonitoring(hash: string): void {
    this.callbacks.delete(hash);
    this.pendingTransactions.delete(hash);
  }
}