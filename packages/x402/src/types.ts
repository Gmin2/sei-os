export interface PaymentRequest {
  amount: string;
  currency: 'SEI' | 'USDC' | string;
  recipient: string;
  description?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
}

export interface PaymentVerification {
  paymentId: string;
  transactionHash: string;
  verified: boolean;
  amount: string;
  payer: string;
  recipient: string;
  timestamp: string;
  blockNumber: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: 'SEI' | 'USDC' | string;
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  features: string[];
  maxUsage?: {
    requests?: number;
    tokens?: number;
    bandwidth?: string;
  };
  trialPeriod?: number; // days
}

export interface Subscription {
  id: string;
  planId: string;
  subscriber: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial' | 'past_due';
  startDate: string;
  endDate: string;
  nextBillingDate?: string;
  trialEndsAt?: string;
  usage: {
    requests: number;
    tokens: number;
    bandwidth: string;
    resetDate: string;
  };
  paymentHistory: PaymentVerification[];
}

export interface PaymentProcessorConfig {
  facilitatorUrl?: string;
  network: 'sei' | 'sei-testnet' | 'sei-devnet';
  defaultCurrency: 'SEI' | 'USDC' | string;
  feePercentage?: number; // 0-100
  autoSettle?: boolean;
  webhookUrl?: string;
}

export interface AgentMonetizationConfig {
  plans: SubscriptionPlan[];
  payPerUse?: {
    enabled: boolean;
    pricePerRequest: string;
    pricePerToken: string;
    currency: 'SEI' | 'USDC' | string;
  };
  freeTrialDays?: number;
  gracePeriodDays?: number;
  webhooks?: {
    onSubscription: string;
    onPayment: string;
    onUsageExceeded: string;
  };
}

export interface UsageMetrics {
  subscriber: string;
  period: string;
  requests: number;
  tokens: number;
  bandwidth: string;
  cost: string;
  currency: string;
  timestamp: string;
}

export interface PaymentWebhook {
  type: 'payment.completed' | 'payment.failed' | 'subscription.created' | 'subscription.cancelled' | 'usage.exceeded';
  id: string;
  timestamp: string;
  data: {
    payment?: PaymentVerification;
    subscription?: Subscription;
    usage?: UsageMetrics;
    error?: string;
  };
}

export interface X402Response {
  x402Version: string;
  accepts: PaymentAccept[];
}

export interface PaymentAccept {
  method: 'SEI' | 'ERC20';
  network: string;
  to: string;
  amount: string;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentHeader {
  method: string;
  network: string;
  transaction?: string;
  proof?: string;
  signature?: string;
  metadata?: Record<string, any>;
}

export interface FacilitatorVerifyRequest {
  payment: PaymentHeader;
  resource: string;
  amount: string;
  currency: string;
  recipient: string;
}

export interface FacilitatorVerifyResponse {
  valid: boolean;
  payment?: PaymentVerification;
  error?: string;
  shouldSettle?: boolean;
}

export interface FacilitatorSettleRequest {
  payment: PaymentHeader;
  verification: PaymentVerification;
  recipient: string;
}

export interface FacilitatorSettleResponse {
  settled: boolean;
  transactionHash?: string;
  error?: string;
  timestamp: string;
}

export interface AgentServiceConfig {
  name: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pricing: {
    type: 'per_request' | 'per_token' | 'subscription' | 'free';
    amount?: string;
    currency?: string;
    planId?: string;
  };
  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
    concurrent?: number;
  };
  authentication?: {
    required: boolean;
    type: 'subscription' | 'payment' | 'api_key';
  };
}

export interface PaymentEvent {
  type: 'payment_received' | 'payment_verified' | 'payment_settled' | 'payment_failed';
  paymentId: string;
  amount: string;
  currency: string;
  payer: string;
  recipient: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionEvent {
  type: 'subscription_created' | 'subscription_renewed' | 'subscription_cancelled' | 'subscription_expired' | 'trial_started' | 'trial_ended';
  subscriptionId: string;
  subscriber: string;
  planId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface UsageEvent {
  type: 'usage_recorded' | 'usage_limit_exceeded' | 'usage_reset';
  subscriptionId: string;
  subscriber: string;
  usage: UsageMetrics;
  limits?: {
    requests?: number;
    tokens?: number;
    bandwidth?: string;
  };
  timestamp: string;
}