import { SeiAgent, AgentCapability } from '@sei-code/core';
import { SeiWallet } from '@sei-code/wallets';
import { PaymentProcessor } from './payment-processor';
import type {
  SubscriptionPlan,
  Subscription,
  UsageMetrics,
  PaymentVerification,
  SubscriptionEvent,
  UsageEvent,
  AgentMonetizationConfig
} from './types';

export class SubscriptionManager extends AgentCapability {
  private paymentProcessor: PaymentProcessor;
  private plans: Map<string, SubscriptionPlan> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private usageMetrics: Map<string, UsageMetrics[]> = new Map();
  private config: AgentMonetizationConfig;

  constructor(
    agent: SeiAgent, 
    paymentProcessor: PaymentProcessor,
    config: AgentMonetizationConfig
  ) {
    super('subscription-manager', agent);
    this.paymentProcessor = paymentProcessor;
    this.config = config;
    this.initializePlans();
  }

  private initializePlans(): void {
    this.config.plans.forEach(plan => {
      this.plans.set(plan.id, plan);
    });
    
    this.agent.emit('info', `Initialized ${this.plans.size} subscription plans`);
  }

  async createSubscription(
    subscriber: string,
    planId: string,
    paymentVerification?: PaymentVerification
  ): Promise<Subscription> {
    try {
      const plan = this.plans.get(planId);
      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      const startDate = now.toISOString();
      
      // Calculate end date based on plan interval
      const endDate = this.calculateEndDate(now, plan.interval);
      const nextBillingDate = this.calculateNextBillingDate(now, plan.interval);

      // Check if trial period applies
      const isTrialEligible = plan.trialPeriod && plan.trialPeriod > 0;
      const trialEndsAt = isTrialEligible 
        ? new Date(now.getTime() + (plan.trialPeriod * 24 * 60 * 60 * 1000)).toISOString()
        : undefined;

      const subscription: Subscription = {
        id: subscriptionId,
        planId,
        subscriber,
        status: isTrialEligible && !paymentVerification ? 'trial' : 'active',
        startDate,
        endDate,
        nextBillingDate: isTrialEligible && !paymentVerification ? trialEndsAt : nextBillingDate,
        trialEndsAt,
        usage: {
          requests: 0,
          tokens: 0,
          bandwidth: '0',
          resetDate: now.toISOString()
        },
        paymentHistory: paymentVerification ? [paymentVerification] : []
      };

      this.subscriptions.set(subscriptionId, subscription);
      this.usageMetrics.set(subscriptionId, []);

      this.emitSubscriptionEvent('subscription_created', subscription);

      if (isTrialEligible && !paymentVerification) {
        this.emitSubscriptionEvent('trial_started', subscription);
        this.scheduleTrialEnd(subscription);
      }

      this.agent.emit('info', `Created subscription ${subscriptionId} for ${subscriber}`);
      
      return subscription;
    } catch (error) {
      this.agent.emit('error', `Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      subscription.status = 'cancelled';
      subscription.endDate = new Date().toISOString();
      
      this.subscriptions.set(subscriptionId, subscription);
      this.emitSubscriptionEvent('subscription_cancelled', subscription);

      this.agent.emit('info', `Cancelled subscription ${subscriptionId}`);
    } catch (error) {
      this.agent.emit('error', `Failed to cancel subscription: ${error.message}`);
      throw error;
    }
  }

  async renewSubscription(subscriptionId: string, paymentVerification: PaymentVerification): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      const plan = this.plans.get(subscription.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${subscription.planId}`);
      }

      // Verify payment amount matches plan price
      const expectedAmount = plan.price;
      if (parseFloat(paymentVerification.amount) < parseFloat(expectedAmount)) {
        throw new Error(`Payment amount insufficient: expected ${expectedAmount}, got ${paymentVerification.amount}`);
      }

      const now = new Date();
      const newEndDate = this.calculateEndDate(now, plan.interval);
      const newNextBillingDate = this.calculateNextBillingDate(now, plan.interval);

      subscription.status = 'active';
      subscription.endDate = newEndDate;
      subscription.nextBillingDate = newNextBillingDate;
      subscription.paymentHistory.push(paymentVerification);

      // Reset usage for new billing period
      subscription.usage = {
        requests: 0,
        tokens: 0,
        bandwidth: '0',
        resetDate: now.toISOString()
      };

      this.subscriptions.set(subscriptionId, subscription);
      this.emitSubscriptionEvent('subscription_renewed', subscription);

      this.agent.emit('info', `Renewed subscription ${subscriptionId}`);
    } catch (error) {
      this.agent.emit('error', `Failed to renew subscription: ${error.message}`);
      throw error;
    }
  }

  async recordUsage(
    subscriptionId: string,
    requests: number = 0,
    tokens: number = 0,
    bandwidth: string = '0'
  ): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      const plan = this.plans.get(subscription.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${subscription.planId}`);
      }

      // Update usage
      subscription.usage.requests += requests;
      subscription.usage.tokens += tokens;
      subscription.usage.bandwidth = this.addBandwidth(subscription.usage.bandwidth, bandwidth);

      this.subscriptions.set(subscriptionId, subscription);

      // Record usage metrics
      const usageRecord: UsageMetrics = {
        subscriber: subscription.subscriber,
        period: this.getCurrentBillingPeriod(subscription),
        requests,
        tokens,
        bandwidth,
        cost: this.calculateUsageCost(requests, tokens, bandwidth),
        currency: plan.currency,
        timestamp: new Date().toISOString()
      };

      const existingMetrics = this.usageMetrics.get(subscriptionId) || [];
      existingMetrics.push(usageRecord);
      this.usageMetrics.set(subscriptionId, existingMetrics);

      this.emitUsageEvent('usage_recorded', subscription, usageRecord);

      // Check usage limits
      await this.checkUsageLimits(subscription, plan);

    } catch (error) {
      this.agent.emit('error', `Failed to record usage: ${error.message}`);
      throw error;
    }
  }

  private async checkUsageLimits(subscription: Subscription, plan: SubscriptionPlan): Promise<void> {
    if (!plan.maxUsage) return;

    const exceeded = [];

    if (plan.maxUsage.requests && subscription.usage.requests > plan.maxUsage.requests) {
      exceeded.push(`requests (${subscription.usage.requests}/${plan.maxUsage.requests})`);
    }

    if (plan.maxUsage.tokens && subscription.usage.tokens > plan.maxUsage.tokens) {
      exceeded.push(`tokens (${subscription.usage.tokens}/${plan.maxUsage.tokens})`);
    }

    if (plan.maxUsage.bandwidth) {
      const usedBandwidth = this.parseBandwidth(subscription.usage.bandwidth);
      const maxBandwidth = this.parseBandwidth(plan.maxUsage.bandwidth);
      if (usedBandwidth > maxBandwidth) {
        exceeded.push(`bandwidth (${subscription.usage.bandwidth}/${plan.maxUsage.bandwidth})`);
      }
    }

    if (exceeded.length > 0) {
      const usageRecord: UsageMetrics = {
        subscriber: subscription.subscriber,
        period: this.getCurrentBillingPeriod(subscription),
        requests: subscription.usage.requests,
        tokens: subscription.usage.tokens,
        bandwidth: subscription.usage.bandwidth,
        cost: '0',
        currency: plan.currency,
        timestamp: new Date().toISOString()
      };

      this.emitUsageEvent('usage_limit_exceeded', subscription, usageRecord, plan.maxUsage);
      
      this.agent.emit('warn', `Usage limits exceeded for subscription ${subscription.id}: ${exceeded.join(', ')}`);
    }
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    return this.subscriptions.get(subscriptionId) || null;
  }

  async getSubscriptionsBySubscriber(subscriber: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.subscriber === subscriber);
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.status === 'active' || sub.status === 'trial');
  }

  async getUsageMetrics(subscriptionId: string): Promise<UsageMetrics[]> {
    return this.usageMetrics.get(subscriptionId) || [];
  }

  async validateAccess(subscriptionId: string, requestType: 'request' | 'token' | 'bandwidth'): Promise<{
    allowed: boolean;
    reason?: string;
    remaining?: number;
  }> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        return { allowed: false, reason: 'Subscription not found' };
      }

      if (subscription.status !== 'active' && subscription.status !== 'trial') {
        return { allowed: false, reason: `Subscription status: ${subscription.status}` };
      }

      // Check if subscription has expired
      const now = new Date();
      const endDate = new Date(subscription.endDate);
      if (now > endDate) {
        return { allowed: false, reason: 'Subscription expired' };
      }

      const plan = this.plans.get(subscription.planId);
      if (!plan || !plan.maxUsage) {
        return { allowed: true }; // Unlimited plan
      }

      // Check specific usage limits
      switch (requestType) {
        case 'request':
          if (plan.maxUsage.requests) {
            const remaining = plan.maxUsage.requests - subscription.usage.requests;
            return {
              allowed: remaining > 0,
              reason: remaining <= 0 ? 'Request limit exceeded' : undefined,
              remaining: Math.max(0, remaining)
            };
          }
          break;

        case 'token':
          if (plan.maxUsage.tokens) {
            const remaining = plan.maxUsage.tokens - subscription.usage.tokens;
            return {
              allowed: remaining > 0,
              reason: remaining <= 0 ? 'Token limit exceeded' : undefined,
              remaining: Math.max(0, remaining)
            };
          }
          break;

        case 'bandwidth':
          if (plan.maxUsage.bandwidth) {
            const usedBandwidth = this.parseBandwidth(subscription.usage.bandwidth);
            const maxBandwidth = this.parseBandwidth(plan.maxUsage.bandwidth);
            const remaining = maxBandwidth - usedBandwidth;
            return {
              allowed: remaining > 0,
              reason: remaining <= 0 ? 'Bandwidth limit exceeded' : undefined,
              remaining: Math.max(0, remaining)
            };
          }
          break;
      }

      return { allowed: true };
    } catch (error) {
      this.agent.emit('error', `Access validation failed: ${error.message}`);
      return { allowed: false, reason: 'Validation error' };
    }
  }

  async processPayPerUsePayment(
    subscriber: string,
    requestCount: number = 1,
    tokenCount: number = 0
  ): Promise<PaymentVerification | null> {
    try {
      if (!this.config.payPerUse?.enabled) {
        throw new Error('Pay-per-use is not enabled');
      }

      const totalCost = this.calculatePayPerUseCost(requestCount, tokenCount);
      
      if (totalCost <= 0) {
        return null; // No payment required
      }

      // Create payment request
      const paymentRequest = await this.paymentProcessor.createPaymentRequest(
        totalCost.toString(),
        this.agent.wallet.getAddress(), // Agent receives the payment
        {
          currency: this.config.payPerUse.currency,
          description: `Pay-per-use: ${requestCount} requests, ${tokenCount} tokens`,
          metadata: {
            subscriber,
            requestCount,
            tokenCount,
            type: 'pay_per_use'
          }
        }
      );

      this.agent.emit('info', `Pay-per-use payment required: ${totalCost} ${this.config.payPerUse.currency}`);
      
      // In a real implementation, this would return a payment request
      // that the client needs to fulfill
      return null;
    } catch (error) {
      this.agent.emit('error', `Pay-per-use payment processing failed: ${error.message}`);
      throw error;
    }
  }

  private calculatePayPerUseCost(requestCount: number, tokenCount: number): number {
    if (!this.config.payPerUse?.enabled) return 0;

    const requestCost = requestCount * parseFloat(this.config.payPerUse.pricePerRequest || '0');
    const tokenCost = tokenCount * parseFloat(this.config.payPerUse.pricePerToken || '0');
    
    return requestCost + tokenCost;
  }

  private calculateUsageCost(requests: number, tokens: number, bandwidth: string): string {
    return this.calculatePayPerUseCost(requests, tokens).toString();
  }

  private calculateEndDate(startDate: Date, interval: string): string {
    const endDate = new Date(startDate);
    
    switch (interval) {
      case 'daily':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }
    
    return endDate.toISOString();
  }

  private calculateNextBillingDate(startDate: Date, interval: string): string {
    return this.calculateEndDate(startDate, interval);
  }

  private getCurrentBillingPeriod(subscription: Subscription): string {
    const start = new Date(subscription.usage.resetDate);
    const end = new Date(subscription.endDate);
    return `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  }

  private addBandwidth(current: string, additional: string): string {
    const currentBytes = this.parseBandwidth(current);
    const additionalBytes = this.parseBandwidth(additional);
    return this.formatBandwidth(currentBytes + additionalBytes);
  }

  private parseBandwidth(bandwidth: string): number {
    const match = bandwidth.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    
    const multipliers = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 };
    return value * (multipliers[unit] || 1);
  }

  private formatBandwidth(bytes: number): string {
    if (bytes === 0) return '0B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    
    while (bytes >= 1024 && index < units.length - 1) {
      bytes /= 1024;
      index++;
    }
    
    return `${bytes.toFixed(2)}${units[index]}`;
  }

  private scheduleTrialEnd(subscription: Subscription): void {
    if (!subscription.trialEndsAt) return;
    
    const trialEndTime = new Date(subscription.trialEndsAt).getTime();
    const now = Date.now();
    const delay = trialEndTime - now;
    
    if (delay > 0) {
      setTimeout(() => {
        const currentSub = this.subscriptions.get(subscription.id);
        if (currentSub && currentSub.status === 'trial') {
          currentSub.status = 'expired';
          this.subscriptions.set(subscription.id, currentSub);
          this.emitSubscriptionEvent('trial_ended', currentSub);
        }
      }, delay);
    }
  }

  private emitSubscriptionEvent(type: SubscriptionEvent['type'], subscription: Subscription): void {
    const event: SubscriptionEvent = {
      type,
      subscriptionId: subscription.id,
      subscriber: subscription.subscriber,
      planId: subscription.planId,
      timestamp: new Date().toISOString()
    };

    this.agent.emit('subscription_event', event);
  }

  private emitUsageEvent(
    type: UsageEvent['type'], 
    subscription: Subscription, 
    usage: UsageMetrics,
    limits?: any
  ): void {
    const event: UsageEvent = {
      type,
      subscriptionId: subscription.id,
      subscriber: subscription.subscriber,
      usage,
      limits,
      timestamp: new Date().toISOString()
    };

    this.agent.emit('usage_event', event);
  }

  getPlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values());
  }

  addPlan(plan: SubscriptionPlan): void {
    this.plans.set(plan.id, plan);
    this.agent.emit('info', `Added subscription plan: ${plan.name}`);
  }

  removePlan(planId: string): void {
    this.plans.delete(planId);
    this.agent.emit('info', `Removed subscription plan: ${planId}`);
  }

  getConfig(): AgentMonetizationConfig {
    return { ...this.config };
  }
}