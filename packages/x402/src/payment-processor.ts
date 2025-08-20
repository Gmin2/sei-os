import { SeiAgent, AgentCapability } from '@sei-code/core';
import { SeiWallet } from '@sei-code/wallets';
import { TransactionBuilder } from '@sei-code/transactions';
import { ethers } from 'ethers';
import type {
  PaymentRequest,
  PaymentVerification,
  PaymentProcessorConfig,
  FacilitatorVerifyRequest,
  FacilitatorVerifyResponse,
  FacilitatorSettleRequest,
  FacilitatorSettleResponse,
  PaymentHeader,
  PaymentEvent,
  X402Response,
  PaymentAccept
} from './types';

export class PaymentProcessor extends AgentCapability {
  private config: PaymentProcessorConfig;
  private wallet: SeiWallet;
  private txBuilder: TransactionBuilder;
  private paymentHistory: Map<string, PaymentVerification> = new Map();

  constructor(agent: SeiAgent, wallet: SeiWallet, config: PaymentProcessorConfig) {
    super('payment-processor', agent);
    this.config = config;
    this.wallet = wallet;
    this.txBuilder = new TransactionBuilder(wallet);
  }

  async createPaymentRequest(
    amount: string,
    recipient: string,
    options: Partial<PaymentRequest> = {}
  ): Promise<PaymentRequest> {
    try {
      const paymentRequest: PaymentRequest = {
        amount,
        currency: options.currency || this.config.defaultCurrency,
        recipient,
        description: options.description || 'Agent service payment',
        metadata: options.metadata || {},
        expiresAt: options.expiresAt || new Date(Date.now() + 3600000).toISOString() // 1 hour
      };

      this.agent.emit('info', `Created payment request for ${amount} ${paymentRequest.currency}`);
      
      return paymentRequest;
    } catch (error) {
      this.agent.emit('error', `Failed to create payment request: ${error.message}`);
      throw error;
    }
  }

  async generateX402Response(
    requests: PaymentRequest[],
    resourceUrl: string
  ): Promise<X402Response> {
    try {
      const accepts: PaymentAccept[] = requests.map(req => ({
        method: req.currency === 'SEI' ? 'SEI' : 'ERC20',
        network: this.config.network,
        to: req.recipient,
        amount: req.amount,
        currency: req.currency,
        description: req.description,
        metadata: {
          ...req.metadata,
          expiresAt: req.expiresAt,
          resource: resourceUrl
        }
      }));

      return {
        x402Version: '1.0',
        accepts
      };
    } catch (error) {
      this.agent.emit('error', `Failed to generate X402 response: ${error.message}`);
      throw error;
    }
  }

  async verifyPayment(
    paymentHeader: PaymentHeader,
    expectedAmount: string,
    expectedRecipient: string
  ): Promise<PaymentVerification | null> {
    try {
      if (this.config.facilitatorUrl) {
        return await this.verifyWithFacilitator(paymentHeader, expectedAmount, expectedRecipient);
      } else {
        return await this.verifyDirectly(paymentHeader, expectedAmount, expectedRecipient);
      }
    } catch (error) {
      this.agent.emit('error', `Payment verification failed: ${error.message}`);
      return null;
    }
  }

  private async verifyWithFacilitator(
    paymentHeader: PaymentHeader,
    expectedAmount: string,
    expectedRecipient: string
  ): Promise<PaymentVerification | null> {
    try {
      const verifyRequest: FacilitatorVerifyRequest = {
        payment: paymentHeader,
        resource: paymentHeader.metadata?.resource || '',
        amount: expectedAmount,
        currency: paymentHeader.metadata?.currency || this.config.defaultCurrency,
        recipient: expectedRecipient
      };

      const response = await fetch(`${this.config.facilitatorUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(verifyRequest)
      });

      if (!response.ok) {
        throw new Error(`Facilitator verify failed: ${response.statusText}`);
      }

      const result: FacilitatorVerifyResponse = await response.json();

      if (result.valid && result.payment) {
        this.paymentHistory.set(result.payment.paymentId, result.payment);
        this.emitPaymentEvent('payment_verified', result.payment);
        return result.payment;
      }

      return null;
    } catch (error) {
      this.agent.emit('error', `Facilitator verification failed: ${error.message}`);
      return null;
    }
  }

  private async verifyDirectly(
    paymentHeader: PaymentHeader,
    expectedAmount: string,
    expectedRecipient: string
  ): Promise<PaymentVerification | null> {
    try {
      if (!paymentHeader.transaction) {
        throw new Error('Transaction hash required for direct verification');
      }

      const provider = this.wallet.getEthersProvider();
      const receipt = await provider.getTransactionReceipt(paymentHeader.transaction);

      if (!receipt) {
        this.agent.emit('warn', `Transaction not found: ${paymentHeader.transaction}`);
        return null;
      }

      if (receipt.status !== 1) {
        this.agent.emit('warn', `Transaction failed: ${paymentHeader.transaction}`);
        return null;
      }

      const transaction = await provider.getTransaction(paymentHeader.transaction);
      if (!transaction) {
        return null;
      }

      // Verify amount and recipient
      const actualAmount = ethers.formatEther(transaction.value);
      const actualRecipient = transaction.to?.toLowerCase();
      const expectedRecipientLower = expectedRecipient.toLowerCase();

      if (actualRecipient !== expectedRecipientLower) {
        this.agent.emit('warn', `Recipient mismatch: expected ${expectedRecipient}, got ${transaction.to}`);
        return null;
      }

      const expectedAmountWei = ethers.parseEther(expectedAmount);
      if (transaction.value < expectedAmountWei) {
        this.agent.emit('warn', `Amount too low: expected ${expectedAmount}, got ${actualAmount}`);
        return null;
      }

      const verification: PaymentVerification = {
        paymentId: `${paymentHeader.transaction}_${Date.now()}`,
        transactionHash: paymentHeader.transaction,
        verified: true,
        amount: actualAmount,
        payer: transaction.from,
        recipient: transaction.to || '',
        timestamp: new Date().toISOString(),
        blockNumber: receipt.blockNumber
      };

      this.paymentHistory.set(verification.paymentId, verification);
      this.emitPaymentEvent('payment_verified', verification);
      
      return verification;
    } catch (error) {
      this.agent.emit('error', `Direct verification failed: ${error.message}`);
      return null;
    }
  }

  async settlePayment(
    paymentHeader: PaymentHeader,
    verification: PaymentVerification
  ): Promise<boolean> {
    try {
      if (this.config.facilitatorUrl) {
        return await this.settleWithFacilitator(paymentHeader, verification);
      } else {
        // For direct settlement, payment is already on-chain
        this.emitPaymentEvent('payment_settled', verification);
        return true;
      }
    } catch (error) {
      this.agent.emit('error', `Payment settlement failed: ${error.message}`);
      return false;
    }
  }

  private async settleWithFacilitator(
    paymentHeader: PaymentHeader,
    verification: PaymentVerification
  ): Promise<boolean> {
    try {
      const settleRequest: FacilitatorSettleRequest = {
        payment: paymentHeader,
        verification,
        recipient: verification.recipient
      };

      const response = await fetch(`${this.config.facilitatorUrl}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settleRequest)
      });

      if (!response.ok) {
        throw new Error(`Facilitator settle failed: ${response.statusText}`);
      }

      const result: FacilitatorSettleResponse = await response.json();

      if (result.settled) {
        this.emitPaymentEvent('payment_settled', verification);
        return true;
      }

      return false;
    } catch (error) {
      this.agent.emit('error', `Facilitator settlement failed: ${error.message}`);
      return false;
    }
  }

  async processPayment(
    to: string,
    amount: string,
    currency = this.config.defaultCurrency
  ): Promise<PaymentVerification> {
    try {
      this.agent.emit('info', `Processing payment: ${amount} ${currency} to ${to}`);

      let transactionHash: string;

      if (currency === 'SEI') {
        // Send native SEI
        const tx = await this.txBuilder.sendNativeTokens(to, amount);
        transactionHash = tx.hash;
      } else {
        // Send ERC20 token (simplified - would need token contract address)
        throw new Error('ERC20 payments not yet implemented');
      }

      // Wait for confirmation
      const provider = this.wallet.getEthersProvider();
      const receipt = await provider.waitForTransaction(transactionHash);

      if (!receipt || receipt.status !== 1) {
        throw new Error('Transaction failed');
      }

      const verification: PaymentVerification = {
        paymentId: `${transactionHash}_${Date.now()}`,
        transactionHash,
        verified: true,
        amount,
        payer: this.wallet.getAddress(),
        recipient: to,
        timestamp: new Date().toISOString(),
        blockNumber: receipt.blockNumber
      };

      this.paymentHistory.set(verification.paymentId, verification);
      this.emitPaymentEvent('payment_received', verification);

      return verification;
    } catch (error) {
      this.agent.emit('error', `Payment processing failed: ${error.message}`);
      throw error;
    }
  }

  async getPaymentHistory(limit = 50): Promise<PaymentVerification[]> {
    const payments = Array.from(this.paymentHistory.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return payments;
  }

  async getPaymentById(paymentId: string): Promise<PaymentVerification | null> {
    return this.paymentHistory.get(paymentId) || null;
  }

  async validatePaymentExpiry(expiresAt: string): Promise<boolean> {
    const expiry = new Date(expiresAt);
    const now = new Date();
    return now < expiry;
  }

  async calculateFees(amount: string): Promise<{
    baseAmount: string;
    fees: string;
    totalAmount: string;
  }> {
    const baseAmountNum = parseFloat(amount);
    const feeRate = this.config.feePercentage || 0;
    const fees = (baseAmountNum * feeRate) / 100;
    const totalAmount = baseAmountNum + fees;

    return {
      baseAmount: baseAmountNum.toString(),
      fees: fees.toString(),
      totalAmount: totalAmount.toString()
    };
  }

  async estimateGasCost(to: string, amount: string): Promise<{
    gasLimit: string;
    gasPrice: string;
    estimatedCost: string;
  }> {
    try {
      const provider = this.wallet.getEthersProvider();
      const signer = this.wallet.getEthersSigner();
      
      const gasPrice = await provider.getGasPrice();
      
      const transaction = {
        to,
        value: ethers.parseEther(amount),
        from: await signer.getAddress()
      };

      const gasLimit = await provider.estimateGas(transaction);
      const estimatedCost = ethers.formatEther(gasLimit * gasPrice);

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
        estimatedCost
      };
    } catch (error) {
      this.agent.emit('error', `Gas estimation failed: ${error.message}`);
      throw error;
    }
  }

  private emitPaymentEvent(type: PaymentEvent['type'], verification: PaymentVerification): void {
    const event: PaymentEvent = {
      type,
      paymentId: verification.paymentId,
      amount: verification.amount,
      currency: this.config.defaultCurrency,
      payer: verification.payer,
      recipient: verification.recipient,
      timestamp: verification.timestamp
    };

    this.agent.emit('payment_event', event);
  }

  async enableWebhooks(webhookUrl: string): Promise<void> {
    this.config.webhookUrl = webhookUrl;
    this.agent.emit('info', `Webhooks enabled for URL: ${webhookUrl}`);
  }

  async sendWebhook(event: PaymentEvent): Promise<boolean> {
    if (!this.config.webhookUrl) {
      return false;
    }

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Type': event.type
        },
        body: JSON.stringify(event)
      });

      return response.ok;
    } catch (error) {
      this.agent.emit('error', `Webhook delivery failed: ${error.message}`);
      return false;
    }
  }

  getConfig(): PaymentProcessorConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<PaymentProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.agent.emit('info', 'Payment processor configuration updated');
  }
}