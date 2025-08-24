// Main analytics agents
export { PortfolioAnalyzer } from './portfolio-analyzer';
export { PerformanceTracker } from './performance-tracker';
export { MarketDataAgent } from './market-data';

// Export all types
export * from './types';

// Import types for use in this file
import type { PortfolioSnapshot, PerformanceReport, PerformanceMetrics } from './types';

// Re-export commonly used precompile types for convenience
export type { 
  TokenBalance, 
  ValidatorInfo, 
  DelegationInfo, 
  StakingRewards,
  PriceData,
  TWAPData
} from '@sei-code/precompiles';

import { SeiAgent } from '@sei-code/core';
import { SeiPrecompileManager } from '@sei-code/precompiles';
import { PortfolioAnalyzer } from './portfolio-analyzer';
import { PerformanceTracker } from './performance-tracker';
import { MarketDataAgent } from './market-data';
import type { AnalyticsConfig } from './types';

/**
 * Comprehensive analytics agent that combines portfolio tracking, 
 * performance analysis, and market data capabilities
 */
export class AnalyticsAgent {
  public portfolio: PortfolioAnalyzer;
  public performance: PerformanceTracker;
  public market: MarketDataAgent;

  private config: AnalyticsConfig;

  constructor(
    agent: SeiAgent, 
    precompiles: SeiPrecompileManager,
    config: Partial<AnalyticsConfig> = {}
  ) {
    this.config = {
      updateInterval: 300, // 5 minutes
      priceHistoryDepth: 30, // 30 days
      enableAlerts: true,
      benchmarkAssets: ['usei', 'uatom'],
      riskFreeRate: 3.0, // 3% annual
      confidenceLevel: 95, // 95% for VaR
      ...config
    };

    this.portfolio = new PortfolioAnalyzer(agent, precompiles);
    this.performance = new PerformanceTracker(agent, precompiles);
    this.market = new MarketDataAgent(agent, precompiles);
  }

  /**
   * Get comprehensive analytics dashboard for a user
   */
  async getDashboard(userAddress: string): Promise<{
    portfolioSnapshot: PortfolioSnapshot;
    performanceReports: PerformanceReport[];
    marketTrends: any;
    allocation: any;
    performanceHistory: any;
    recommendations: any[];
  }> {
    try {
      const [portfolioSnapshot, performanceReports, marketTrends] = await Promise.all([
        this.portfolio.analyzePortfolio(userAddress),
        this.performance.trackAssetPerformance('usei', ['24h', '7d', '30d']),
        this.market.getMarketTrend('usei', ['24h', '7d'])
      ]);

      const allocation = await this.portfolio.getAssetAllocation(userAddress);
      const performanceHistory = await this.portfolio.trackPerformanceOverTime(userAddress);

      return {
        portfolioSnapshot,
        performanceReports: performanceReports as unknown as PerformanceReport[],
        marketTrends,
        allocation,
        performanceHistory,
        recommendations: []
      };
    } catch (error) {
      throw new Error(`Failed to generate dashboard: ${error.message}`);
    }
  }

  /**
   * Compare multiple portfolios
   */
  async comparePortfolios(addresses: string[]): Promise<{
    portfolios: Array<{
      address: string;
      snapshot: PortfolioSnapshot;
    }>;
    comparison: any;
  }> {
    return this.portfolio.comparePortfolios(addresses);
  }

  /**
   * Get market overview for multiple assets
   */
  async getMarketOverview(denoms: string[] = ['usei', 'uatom', 'uosmo']): Promise<{
    correlations: any;
    trends: any;
    performance: any;
    summary: any;
  }> {
    try {
      const [correlations, trends, performance] = await Promise.all([
        this.market.calculateCorrelationMatrix(denoms),
        Promise.all(denoms.map(denom => this.market.getMarketTrend(denom, ['24h']))),
        this.performance.compareAssetPerformance(denoms, '24h')
      ]);

      return {
        correlations,
        trends: trends.flat(),
        performance,
        summary: {
          totalAssets: denoms.length,
          bullishCount: trends.flat().filter(t => t.trend === 'bullish').length,
          bearishCount: trends.flat().filter(t => t.trend === 'bearish').length,
          topPerformer: performance.summary.bestPerformer,
          worstPerformer: performance.summary.worstPerformer
        }
      };
    } catch (error) {
      throw new Error(`Failed to get market overview: ${error.message}`);
    }
  }

  /**
   * Generate investment recommendations based on portfolio analysis
   */
  async getInvestmentRecommendations(userAddress: string) {
    try {
      const [portfolioData, allocation, marketTrends] = await Promise.all([
        this.portfolio.analyzePortfolio(userAddress),
        this.portfolio.getAssetAllocation(userAddress),
        this.market.getMarketTrend('usei', ['7d', '30d'])
      ]);

      const recommendations: any[] = [];

      // Diversification recommendations
      if (portfolioData.performance.diversificationScore < 30) {
        recommendations.push({
          type: 'diversification',
          priority: 'high',
          title: 'Improve Portfolio Diversification',
          description: `Your diversification score is ${portfolioData.performance.diversificationScore.toFixed(1)}/100. Consider spreading investments across more assets.`,
          action: 'Add 2-3 different assets to reduce concentration risk'
        });
      }

      // Liquidity recommendations
      if (allocation.liquid < 10) {
        recommendations.push({
          type: 'liquidity',
          priority: 'medium',
          title: 'Increase Liquid Holdings',
          description: `Only ${allocation.liquid.toFixed(1)}% of your portfolio is liquid. Consider maintaining 10-20% in liquid form.`,
          action: 'Undelegate some staked tokens for better liquidity'
        });
      }

      // Market-based recommendations
      const bullishTrend = marketTrends.some(t => t.trend === 'bullish' && t.strength !== 'weak');
      if (bullishTrend && allocation.liquid > 30) {
        recommendations.push({
          type: 'market_opportunity',
          priority: 'medium',
          title: 'Consider Staking During Bullish Trend',
          description: 'Market shows bullish momentum. Consider staking some liquid tokens to earn rewards.',
          action: 'Stake 10-20% of liquid holdings with reliable validators'
        });
      }

      // Performance recommendations
      if (portfolioData.performance.dailyReturnPercentage < -5) {
        recommendations.push({
          type: 'risk_management',
          priority: 'high',
          title: 'Review Risk Exposure',
          description: `Portfolio is down ${Math.abs(portfolioData.performance.dailyReturnPercentage).toFixed(1)}% today. Review risk exposure.`,
          action: 'Consider reducing position sizes or hedging strategies'
        });
      }

      return {
        recommendations,
        riskLevel: this.assessRiskLevel(portfolioData),
        nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };
    } catch (error) {
      throw new Error(`Failed to generate recommendations: ${error.message}`);
    }
  }

  /**
   * Track specific metrics over time
   */
  async trackMetrics(userAddress: string, metrics: string[] = ['totalValue', 'diversification', 'yields']) {
    try {
      const history = await this.portfolio.getPortfolioHistory(userAddress);
      
      const trackedMetrics = metrics.map(metric => {
        const data = history.map(snapshot => {
          let value: number;
          
          switch (metric) {
            case 'totalValue':
              value = parseFloat(snapshot.totalValue);
              break;
            case 'diversification':
              value = snapshot.performance.diversificationScore || 0;
              break;
            case 'yields':
              value = snapshot.performance.dailyReturnPercentage;
              break;
            default:
              value = 0;
          }

          return {
            timestamp: snapshot.timestamp,
            value
          };
        });

        return {
          metric,
          data,
          trend: this.calculateTrend(data.map(d => d.value)),
          latest: data[data.length - 1]?.value || 0
        };
      });

      return trackedMetrics;
    } catch (error) {
      throw new Error(`Failed to track metrics: ${error.message}`);
    }
  }

  private assessRiskLevel(portfolio: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Low diversification increases risk
    if (portfolio.performance.diversificationScore < 30) riskScore += 30;
    else if (portfolio.performance.diversificationScore < 50) riskScore += 15;

    // High volatility increases risk
    const dailyChange = Math.abs(portfolio.performance.dailyReturnPercentage);
    if (dailyChange > 10) riskScore += 25;
    else if (dailyChange > 5) riskScore += 15;

    // High concentration in staked assets
    const stakedRatio = portfolio.assets
      .filter((a: any) => a.type === 'staked')
      .reduce((sum: number, a: any) => sum + a.allocation, 0);
    
    if (stakedRatio > 80) riskScore += 20;
    else if (stakedRatio > 60) riskScore += 10;

    if (riskScore > 50) return 'high';
    if (riskScore > 25) return 'medium';
    return 'low';
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5); // Last 5 values
    const slope = this.calculateSlope(recent);
    
    if (slope > 0.02) return 'increasing';
    if (slope < -0.02) return 'decreasing';
    return 'stable';
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squared indices
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * Get configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}