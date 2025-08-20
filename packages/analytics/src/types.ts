// Re-export types from precompiles for consistency
export type { 
  TokenBalance, 
  ValidatorInfo, 
  DelegationInfo, 
  StakingRewards,
  PriceData,
  TWAPData
} from '@sei-code/precompiles';

export interface PortfolioSnapshot {
  timestamp: string;
  totalValue: string;
  assets: PortfolioAsset[];
  performance: PerformanceMetrics;
}

export interface PortfolioAsset {
  denom: string;
  symbol: string;
  balance: string;
  value: string;
  price: string;
  allocation: number;
  type: 'liquid' | 'staked' | 'rewards';
  change24h?: number;
}

export interface PerformanceMetrics {
  period?: '1h' | '4h' | '24h' | '7d' | '30d';
  totalReturn: string;
  totalReturnPercentage: number;
  dailyReturn: string;
  dailyReturnPercentage: number;
  bestAsset?: string;
  worstAsset?: string;
  diversificationScore?: number;
  volatility?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  alpha?: number;
  beta?: number;
}

export interface MarketDataPoint {
  timestamp: string;
  price: string;
  volume?: string;
  marketCap?: string;
  supply?: string;
}

export interface MarketIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    ma7: string;
    ma30: string;
    ma50: string;
    ma200: string;
  };
  bollingerBands: {
    upper: string;
    middle: string;
    lower: string;
  };
  support: string;
  resistance: string;
}

export interface TradingSignal {
  type: 'buy' | 'sell' | 'hold';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number; // 0-100
  reason: string;
  timestamp: string;
  price: string;
}

export interface RiskMetrics {
  portfolioAddress: string;
  riskScore: number; // 0-100
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  var95: string; // Value at Risk (95% confidence)
  cvar95: string; // Conditional Value at Risk
  diversificationRatio: number;
  concentrationRisk: number;
  liquidityRisk: 'low' | 'medium' | 'high';
  riskFactors: string[];
  recommendations: string[];
}

export interface YieldOpportunity {
  protocol: string;
  type: 'staking' | 'lending' | 'farming' | 'liquidity_mining';
  asset: string;
  apy: number;
  tvl: string;
  risk: 'low' | 'medium' | 'high';
  lockPeriod?: string;
  minAmount?: string;
  rewards: string[];
  impermanentLossRisk?: number;
}

export interface PerformanceReport {
  asset: string;
  timeframe: string;
  metrics: PerformanceMetrics;
  benchmark: BenchmarkData;
  ranking: {
    performance: number;
    volatility: number;
    riskAdjustedReturn: number;
  };
  insights: string[];
}

export interface BenchmarkData {
  name: string;
  symbol: string;
  performance: PerformanceMetrics[];
}

export interface PortfolioComparison {
  portfolios: Array<{
    address: string;
    snapshot: PortfolioSnapshot;
  }>;
  comparison: {
    bestPerformer: string;
    worstPerformer: string;
    averageValue: string;
    totalCombinedValue: string;
  };
}

export interface AssetAllocation {
  liquid: number;
  staked: number;
  rewards: number;
  breakdown: Array<{
    asset: string;
    percentage: number;
    value: string;
  }>;
}

export interface PerformanceTimelineData {
  data: Array<{
    date: string;
    value: string;
    change: number;
  }>;
  summary: {
    totalReturn: string;
    totalReturnPercentage: number;
    bestDay: string;
    worstDay: string;
    volatility: number;
  };
}

export interface MarketTrend {
  asset: string;
  trend: 'bullish' | 'bearish' | 'sideways';
  strength: 'weak' | 'moderate' | 'strong';
  timeframe: string;
  confidence: number;
  signals: TradingSignal[];
  indicators: MarketIndicators;
}

export interface LiquidityAnalysis {
  asset: string;
  liquidityScore: number; // 0-100
  averageDailyVolume: string;
  bidAskSpread: number;
  marketDepth: {
    bids: Array<{ price: string; amount: string }>;
    asks: Array<{ price: string; amount: string }>;
  };
  slippageEstimate: {
    '1%': number;
    '5%': number;
    '10%': number;
  };
}

export interface CorrelationMatrix {
  assets: string[];
  correlations: number[][]; // Correlation coefficients matrix
  timeframe: string;
  insights: Array<{
    pair: [string, string];
    correlation: number;
    strength: 'weak' | 'moderate' | 'strong';
    direction: 'positive' | 'negative';
  }>;
}

export interface AlertConfig {
  id: string;
  type: 'price' | 'portfolio_value' | 'yield' | 'risk' | 'correlation';
  asset?: string;
  condition: 'above' | 'below' | 'change_percent' | 'crosses';
  threshold: string;
  timeframe?: string;
  enabled: boolean;
  lastTriggered?: string;
  notificationMethods: ('telegram' | 'webhook' | 'email')[];
}

export interface AlertNotification {
  id: string;
  alertId: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  data: any;
  acknowledged: boolean;
}

export interface AnalyticsConfig {
  updateInterval: number; // seconds
  priceHistoryDepth: number; // days
  enableAlerts: boolean;
  benchmarkAssets: string[];
  riskFreeRate: number; // percentage
  confidenceLevel: number; // for VaR calculations
}