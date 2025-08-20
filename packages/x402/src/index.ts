// Core components
export { PaymentProcessor } from './payment-processor';
export { SubscriptionManager } from './subscription-manager';

// Export all types
export * from './types';

// Re-export useful x402 utilities
export type { Resource, Network, Price } from '@sei-js/x402';

import { SeiAgent } from '@sei-code/core';
import { SeiWallet } from '@sei-code/wallets';
import { PaymentProcessor } from './payment-processor';
import { SubscriptionManager } from './subscription-manager';
import type { 
  PaymentProcessorConfig, 
  AgentMonetizationConfig, 
  AgentServiceConfig,
  PaymentRequest,
  PaymentVerification,
  Subscription,
  SubscriptionPlan,
  UsageMetrics
} from './types';

/**
 * Complete x402 payment and subscription management for Sei agents
 */
export class X402Agent {
  public payment: PaymentProcessor;
  public subscription: SubscriptionManager;
  
  private agent: SeiAgent;
  private services: Map<string, AgentServiceConfig> = new Map();

  constructor(
    agent: SeiAgent,
    wallet: SeiWallet,
    paymentConfig: PaymentProcessorConfig,
    monetizationConfig: AgentMonetizationConfig
  ) {
    this.agent = agent;
    this.payment = new PaymentProcessor(agent, wallet, paymentConfig);
    this.subscription = new SubscriptionManager(agent, this.payment, monetizationConfig);
  }

  /**
   * Configure a paid service endpoint
   */
  async configureService(config: AgentServiceConfig): Promise<void> {
    this.services.set(config.endpoint, config);
    this.agent.emit('info', `Configured paid service: ${config.name} at ${config.endpoint}`);
  }

  /**
   * Process a request to a paid service
   */
  async processServiceRequest(
    endpoint: string,
    subscriber: string,
    paymentHeader?: any
  ): Promise<{
    allowed: boolean;
    reason?: string;
    paymentRequired?: PaymentRequest;
    subscriptionRequired?: SubscriptionPlan[];
  }> {
    try {
      const service = this.services.get(endpoint);
      if (!service) {
        return { allowed: false, reason: 'Service not found' };
      }

      // Handle free services
      if (service.pricing.type === 'free') {
        return { allowed: true };
      }

      // Handle subscription-based services
      if (service.pricing.type === 'subscription') {
        const subscriptions = await this.subscription.getSubscriptionsBySubscriber(subscriber);
        const activeSubscription = subscriptions.find(sub => 
          sub.planId === service.pricing.planId && 
          (sub.status === 'active' || sub.status === 'trial')
        );

        if (!activeSubscription) {
          const plans = this.subscription.getPlans().filter(plan => 
            plan.id === service.pricing.planId
          );
          return { 
            allowed: false, 
            reason: 'Subscription required',
            subscriptionRequired: plans
          };
        }

        // Check usage limits
        const accessCheck = await this.subscription.validateAccess(
          activeSubscription.id, 
          'request'
        );
        
        if (!accessCheck.allowed) {
          return { allowed: false, reason: accessCheck.reason };
        }

        // Record usage
        await this.subscription.recordUsage(activeSubscription.id, 1, 0, '0');
        return { allowed: true };
      }

      // Handle per-request payment
      if (service.pricing.type === 'per_request') {
        if (!paymentHeader) {
          const paymentRequest = await this.payment.createPaymentRequest(
            service.pricing.amount!,
            this.agent.wallet.getAddress(),
            {
              currency: service.pricing.currency || 'SEI',
              description: `Access to ${service.name}`,
              metadata: {
                service: service.name,
                endpoint: service.endpoint,
                subscriber
              }
            }
          );
          
          return { 
            allowed: false, 
            reason: 'Payment required',
            paymentRequired: paymentRequest
          };
        }

        // Verify payment
        const verification = await this.payment.verifyPayment(
          paymentHeader,
          service.pricing.amount!,
          this.agent.wallet.getAddress()
        );

        if (!verification) {
          return { allowed: false, reason: 'Payment verification failed' };
        }

        // Settle payment
        await this.payment.settlePayment(paymentHeader, verification);
        return { allowed: true };
      }

      return { allowed: false, reason: 'Invalid pricing configuration' };
    } catch (error) {
      this.agent.emit('error', `Service request processing failed: ${error.message}`);
      return { allowed: false, reason: 'Processing error' };
    }
  }

  /**
   * Create a subscription for a user
   */
  async createSubscription(
    subscriber: string,
    planId: string,
    paymentVerification?: PaymentVerification
  ): Promise<Subscription> {
    return this.subscription.createSubscription(subscriber, planId, paymentVerification);
  }

  /**
   * Process a payment
   */
  async processPayment(
    to: string,
    amount: string,
    currency = 'SEI'
  ): Promise<PaymentVerification> {
    return this.payment.processPayment(to, amount, currency);
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(timeframe = '30d'): Promise<{
    totalRevenue: string;
    subscriptionRevenue: string;
    payPerUseRevenue: string;
    activeSubscriptions: number;
    totalPayments: number;
    averagePayment: string;
    topSubscribers: Array<{
      subscriber: string;
      revenue: string;
      subscriptions: number;
    }>;
  }> {
    try {
      const paymentHistory = await this.payment.getPaymentHistory(1000);
      const activeSubscriptions = await this.subscription.getActiveSubscriptions();
      
      // Calculate timeframe start
      const cutoffDate = new Date();
      if (timeframe === '7d') cutoffDate.setDate(cutoffDate.getDate() - 7);
      else if (timeframe === '30d') cutoffDate.setDate(cutoffDate.getDate() - 30);
      else if (timeframe === '90d') cutoffDate.setDate(cutoffDate.getDate() - 90);

      // Filter payments within timeframe
      const recentPayments = paymentHistory.filter(payment => 
        new Date(payment.timestamp) >= cutoffDate
      );

      const totalRevenue = recentPayments
        .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      // Calculate subscription vs pay-per-use revenue
      let subscriptionRevenue = 0;
      let payPerUseRevenue = 0;

      for (const subscription of activeSubscriptions) {
        const subscriptionPayments = subscription.paymentHistory.filter(payment =>
          new Date(payment.timestamp) >= cutoffDate
        );
        subscriptionRevenue += subscriptionPayments
          .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      }

      payPerUseRevenue = totalRevenue - subscriptionRevenue;

      // Calculate subscriber analytics
      const subscriberStats = new Map<string, { revenue: number; subscriptions: number }>();
      
      for (const subscription of activeSubscriptions) {
        const existing = subscriberStats.get(subscription.subscriber) || { revenue: 0, subscriptions: 0 };
        const revenue = subscription.paymentHistory
          .filter(payment => new Date(payment.timestamp) >= cutoffDate)
          .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        
        subscriberStats.set(subscription.subscriber, {
          revenue: existing.revenue + revenue,
          subscriptions: existing.subscriptions + 1
        });
      }

      const topSubscribers = Array.from(subscriberStats.entries())
        .map(([subscriber, stats]) => ({
          subscriber,
          revenue: stats.revenue.toString(),
          subscriptions: stats.subscriptions
        }))
        .sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
        .slice(0, 10);

      return {
        totalRevenue: totalRevenue.toString(),
        subscriptionRevenue: subscriptionRevenue.toString(),
        payPerUseRevenue: payPerUseRevenue.toString(),
        activeSubscriptions: activeSubscriptions.length,
        totalPayments: recentPayments.length,
        averagePayment: recentPayments.length > 0 
          ? (totalRevenue / recentPayments.length).toString() 
          : '0',
        topSubscribers
      };
    } catch (error) {
      this.agent.emit('error', `Revenue analytics failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalBandwidth: string;
    activeUsers: number;
    averageUsagePerUser: {
      requests: number;
      tokens: number;
      bandwidth: string;
    };
    topServices: Array<{
      endpoint: string;
      requests: number;
      revenue: string;
    }>;
  }> {
    try {
      const activeSubscriptions = await this.subscription.getActiveSubscriptions();
      
      let totalRequests = 0;
      let totalTokens = 0;
      let totalBandwidthBytes = 0;
      const serviceUsage = new Map<string, { requests: number; revenue: number }>();

      for (const subscription of activeSubscriptions) {
        totalRequests += subscription.usage.requests;
        totalTokens += subscription.usage.tokens;
        totalBandwidthBytes += this.parseBandwidth(subscription.usage.bandwidth);

        // Get usage metrics for detailed analysis
        const metrics = await this.subscription.getUsageMetrics(subscription.id);
        for (const metric of metrics) {
          // This would need service endpoint tracking in usage metrics
          // For now, we'll use a simplified approach
        }
      }

      const activeUsers = activeSubscriptions.length;
      const avgRequests = activeUsers > 0 ? totalRequests / activeUsers : 0;
      const avgTokens = activeUsers > 0 ? totalTokens / activeUsers : 0;
      const avgBandwidth = activeUsers > 0 ? totalBandwidthBytes / activeUsers : 0;

      const topServices = Array.from(this.services.entries())
        .map(([endpoint, config]) => ({
          endpoint,
          requests: serviceUsage.get(endpoint)?.requests || 0,
          revenue: (serviceUsage.get(endpoint)?.revenue || 0).toString()
        }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 5);

      return {
        totalRequests,
        totalTokens,
        totalBandwidth: this.formatBandwidth(totalBandwidthBytes),
        activeUsers,
        averageUsagePerUser: {
          requests: Math.round(avgRequests),
          tokens: Math.round(avgTokens),
          bandwidth: this.formatBandwidth(avgBandwidth)
        },
        topServices
      };
    } catch (error) {
      this.agent.emit('error', `Usage analytics failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate monetization report
   */
  async generateMonetizationReport(): Promise<{
    revenue: any;
    usage: any;
    subscriptions: {
      total: number;
      active: number;
      trials: number;
      cancelled: number;
      churnRate: number;
    };
    recommendations: string[];
  }> {
    try {
      const [revenue, usage] = await Promise.all([
        this.getRevenueAnalytics(),
        this.getUsageAnalytics()
      ]);

      const allSubscriptions = Array.from(this.subscription['subscriptions'].values());
      const subscriptionStats = {
        total: allSubscriptions.length,
        active: allSubscriptions.filter(s => s.status === 'active').length,
        trials: allSubscriptions.filter(s => s.status === 'trial').length,
        cancelled: allSubscriptions.filter(s => s.status === 'cancelled').length,
        churnRate: 0 // Would need historical data to calculate properly
      };

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (subscriptionStats.trials > subscriptionStats.active) {
        recommendations.push('High trial-to-paid conversion opportunity - consider trial optimization');
      }
      
      if (parseFloat(revenue.payPerUseRevenue) > parseFloat(revenue.subscriptionRevenue)) {
        recommendations.push('Consider promoting subscription plans for recurring revenue');
      }
      
      if (usage.activeUsers < 10) {
        recommendations.push('Focus on user acquisition to scale monetization');
      }

      return {
        revenue,
        usage,
        subscriptions: subscriptionStats,
        recommendations
      };
    } catch (error) {
      this.agent.emit('error', `Monetization report generation failed: ${error.message}`);
      throw error;
    }
  }

  private parseBandwidth(bandwidth: string): number {
    const match = bandwidth.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    
    const multipliers: Record<string, number> = { 
      B: 1, 
      KB: 1024, 
      MB: 1024**2, 
      GB: 1024**3, 
      TB: 1024**4 
    };
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

  /**
   * Get configured services
   */
  getServices(): AgentServiceConfig[] {
    return Array.from(this.services.values());
  }

  /**
   * Remove a service configuration
   */
  removeService(endpoint: string): void {
    this.services.delete(endpoint);
    this.agent.emit('info', `Removed service configuration for ${endpoint}`);
  }

  /**
   * Enable webhook notifications
   */
  async enableWebhooks(webhookUrl: string): Promise<void> {
    await this.payment.enableWebhooks(webhookUrl);
    this.agent.emit('info', `Webhooks enabled for X402 agent`);
  }
}