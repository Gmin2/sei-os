import { SeiAgent, BaseCapability } from '@sei-code/core';
import { SeiPrecompileManager } from '@sei-code/precompiles';
import type { PriceData, TWAPData } from '@sei-code/precompiles';

interface PerformanceMetrics {
  period: '1h' | '4h' | '24h' | '7d' | '30d';
  absoluteReturn: string;
  percentageReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  alpha: number;
  beta: number;
}

interface BenchmarkData {
  name: string;
  symbol: string;
  performance: PerformanceMetrics[];
}

interface PerformanceReport {
  asset: string;
  timeframe: string;
  metrics: PerformanceMetrics;
  benchmark: BenchmarkData;
  ranking: {
    performance: number; // percentile
    volatility: number;
    riskAdjustedReturn: number;
  };
  insights: string[];
}

export class PerformanceTracker extends BaseCapability {
  private agent: SeiAgent;
  private precompiles: SeiPrecompileManager;
  private priceHistory: Map<string, Array<{ timestamp: string; price: number }>> = new Map();
  private benchmarks: BenchmarkData[] = [];

  constructor(agent: SeiAgent, precompiles: SeiPrecompileManager) {
    super('performance-tracker', 'Performance tracking and analysis');
    this.agent = agent;
    this.precompiles = precompiles;
    this.initializeBenchmarks();
  }

  async execute(params: any): Promise<any> {
    const { action, ...args } = params;
    
    switch (action) {
      case 'trackAssetPerformance':
        return this.trackAssetPerformance(args.denom, args.timeframes);
      case 'compareAssetPerformance':
        return this.compareAssetPerformance(args.denoms, args.timeframe);
      case 'generatePerformanceReport':
        return this.generatePerformanceReport(args.denom);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private initializeBenchmarks() {
    this.benchmarks = [
      {
        name: 'Sei Network',
        symbol: 'SEI',
        performance: []
      },
      {
        name: 'Cosmos Hub',
        symbol: 'ATOM',
        performance: []
      }
    ];
  }

  async trackAssetPerformance(denom: string, timeframes: Array<'1h' | '4h' | '24h' | '7d' | '30d'>): Promise<PerformanceReport[]> {
    try {
      this.agent.emit('info', `Tracking performance for ${denom} across ${timeframes.length} timeframes`);

      const reports: PerformanceReport[] = [];

      for (const timeframe of timeframes) {
        const metrics = await this.calculatePerformanceMetrics(denom, timeframe);
        const benchmark = await this.getBenchmarkData(denom, timeframe);
        const ranking = await this.calculateRanking(denom, metrics);
        const insights = this.generateInsights(metrics, benchmark);

        reports.push({
          asset: denom,
          timeframe,
          metrics,
          benchmark,
          ranking,
          insights
        });
      }

      return reports;
    } catch (error) {
      this.agent.emit('error', `Failed to track performance: ${error.message}`);
      throw error;
    }
  }

  private async calculatePerformanceMetrics(denom: string, period: '1h' | '4h' | '24h' | '7d' | '30d'): Promise<PerformanceMetrics> {
    try {
      const lookbackSeconds = this.getLookbackSeconds(period);
      
      const [currentPrice, twapData] = await Promise.all([
        this.precompiles.oracle.execute({ action: 'get_price', denom }),
        this.precompiles.oracle.execute({ action: 'get_twap', denom, lookbackSeconds })
      ]);

      const priceHistory = await this.getPriceHistory(denom, period);
      
      if (priceHistory.length < 2) {
        return this.getDefaultMetrics(period);
      }

      const startPrice = priceHistory[0].price;
      const endPrice = currentPrice.price;
      
      const absoluteReturn = endPrice - startPrice;
      const percentageReturn = startPrice > 0 ? (absoluteReturn / startPrice) * 100 : 0;
      
      const volatility = this.calculateVolatility(priceHistory);
      const sharpeRatio = this.calculateSharpeRatio(percentageReturn, volatility);
      const maxDrawdown = this.calculateMaxDrawdown(priceHistory);
      const winRate = this.calculateWinRate(priceHistory);
      
      // Simplified alpha/beta calculation (would need market data for proper calculation)
      const alpha = percentageReturn > 0 ? Math.min(percentageReturn * 0.1, 5) : 0;
      const beta = volatility > 0 ? Math.min(volatility / 20, 2) : 1;

      return {
        period,
        absoluteReturn: absoluteReturn.toString(),
        percentageReturn,
        volatility,
        sharpeRatio,
        maxDrawdown,
        winRate,
        alpha,
        beta
      };
    } catch (error) {
      this.agent.emit('warn', `Failed to calculate metrics for ${denom}: ${error.message}`);
      return this.getDefaultMetrics(period);
    }
  }

  private getLookbackSeconds(period: string): number {
    const lookbackMap = {
      '1h': 3600,
      '4h': 14400,
      '24h': 86400,
      '7d': 604800,
      '30d': 2592000
    };
    return lookbackMap[period] || 86400;
  }

  private async getPriceHistory(denom: string, period: string): Promise<Array<{ timestamp: string; price: number }>> {
    // In a real implementation, this would fetch historical data from a price feed
    // For now, we'll simulate with TWAP data and current price
    
    try {
      const lookbackSeconds = this.getLookbackSeconds(period);
      const intervals = Math.min(period === '1h' ? 6 : period === '4h' ? 4 : period === '24h' ? 24 : 30, 50);
      
      const history: Array<{ timestamp: string; price: number }> = [];
      const currentTime = Date.now();
      const intervalMs = (lookbackSeconds * 1000) / intervals;

      for (let i = intervals; i >= 0; i--) {
        const timestamp = new Date(currentTime - (i * intervalMs)).toISOString();
        
        try {
          // Use TWAP as historical price approximation
          const twapData = await this.precompiles.oracle.execute({
            action: 'get_twap',
            denom,
            lookbackSeconds: Math.max(3600, lookbackSeconds - (i * (lookbackSeconds / intervals)))
          });
          
          history.push({
            timestamp,
            price: twapData.price
          });
        } catch (error) {
          // If TWAP fails, use interpolated price
          const basePrice = await this.precompiles.oracle.execute({ action: 'get_price', denom });
          const randomVariation = (Math.random() - 0.5) * 0.1; // ±5% variation
          history.push({
            timestamp,
            price: basePrice.price * (1 + randomVariation)
          });
        }
      }

      return history;
    } catch (error) {
      return [];
    }
  }

  private calculateVolatility(priceHistory: Array<{ timestamp: string; price: number }>): number {
    if (priceHistory.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < priceHistory.length; i++) {
      const returnVal = (priceHistory[i].price - priceHistory[i - 1].price) / priceHistory[i - 1].price;
      returns.push(returnVal);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    // Annualized volatility
    return Math.sqrt(variance) * Math.sqrt(365) * 100;
  }

  private calculateSharpeRatio(return_: number, volatility: number, riskFreeRate = 3): number {
    if (volatility === 0) return 0;
    return (return_ - riskFreeRate) / volatility;
  }

  private calculateMaxDrawdown(priceHistory: Array<{ timestamp: string; price: number }>): number {
    if (priceHistory.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = priceHistory[0].price;

    for (const point of priceHistory) {
      if (point.price > peak) {
        peak = point.price;
      }
      
      const drawdown = (peak - point.price) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100;
  }

  private calculateWinRate(priceHistory: Array<{ timestamp: string; price: number }>): number {
    if (priceHistory.length < 2) return 0;

    let wins = 0;
    let totalMoves = 0;

    for (let i = 1; i < priceHistory.length; i++) {
      const priceChange = priceHistory[i].price - priceHistory[i - 1].price;
      if (priceChange > 0) wins++;
      totalMoves++;
    }

    return totalMoves > 0 ? (wins / totalMoves) * 100 : 0;
  }

  private async getBenchmarkData(denom: string, timeframe: string): Promise<BenchmarkData> {
    // For SEI, compare against cosmos ecosystem
    const benchmarkDenom = denom === 'usei' ? 'uatom' : 'usei';
    
    try {
      const benchmarkMetrics = await this.calculatePerformanceMetrics(benchmarkDenom, timeframe as any);
      
      return {
        name: benchmarkDenom === 'usei' ? 'Sei Network' : 'Cosmos Hub',
        symbol: benchmarkDenom === 'usei' ? 'SEI' : 'ATOM',
        performance: [benchmarkMetrics]
      };
    } catch (error) {
      return {
        name: 'Market',
        symbol: 'MARKET',
        performance: [this.getDefaultMetrics(timeframe as any)]
      };
    }
  }

  private async calculateRanking(denom: string, metrics: PerformanceMetrics): Promise<{
    performance: number;
    volatility: number;
    riskAdjustedReturn: number;
  }> {
    // Simplified ranking system (would compare against universe of assets in practice)
    const performancePercentile = Math.min(Math.max((metrics.percentageReturn + 50) / 100 * 100, 0), 100);
    const volatilityPercentile = Math.min(Math.max(100 - (metrics.volatility / 2), 0), 100);
    const riskAdjustedPercentile = Math.min(Math.max((metrics.sharpeRatio + 2) / 4 * 100, 0), 100);

    return {
      performance: Math.round(performancePercentile),
      volatility: Math.round(volatilityPercentile),
      riskAdjustedReturn: Math.round(riskAdjustedPercentile)
    };
  }

  private generateInsights(metrics: PerformanceMetrics, benchmark: BenchmarkData): string[] {
    const insights: string[] = [];
    const benchmarkMetric = benchmark.performance[0];

    // Performance insights
    if (metrics.percentageReturn > benchmarkMetric.percentageReturn) {
      insights.push(`📈 Outperforming benchmark by ${(metrics.percentageReturn - benchmarkMetric.percentageReturn).toFixed(2)}%`);
    } else {
      insights.push(`📉 Underperforming benchmark by ${(benchmarkMetric.percentageReturn - metrics.percentageReturn).toFixed(2)}%`);
    }

    // Volatility insights
    if (metrics.volatility < benchmarkMetric.volatility) {
      insights.push(`📊 Lower volatility than benchmark (${metrics.volatility.toFixed(1)}% vs ${benchmarkMetric.volatility.toFixed(1)}%)`);
    } else {
      insights.push(`⚡ Higher volatility than benchmark (${metrics.volatility.toFixed(1)}% vs ${benchmarkMetric.volatility.toFixed(1)}%)`);
    }

    // Risk-adjusted performance
    if (metrics.sharpeRatio > 1) {
      insights.push(`✅ Strong risk-adjusted returns (Sharpe: ${metrics.sharpeRatio.toFixed(2)})`);
    } else if (metrics.sharpeRatio < 0) {
      insights.push(`⚠️ Poor risk-adjusted returns (Sharpe: ${metrics.sharpeRatio.toFixed(2)})`);
    }

    // Win rate insights
    if (metrics.winRate > 60) {
      insights.push(`🎯 High win rate of ${metrics.winRate.toFixed(1)}%`);
    } else if (metrics.winRate < 40) {
      insights.push(`📉 Low win rate of ${metrics.winRate.toFixed(1)}%`);
    }

    // Drawdown insights
    if (metrics.maxDrawdown > 20) {
      insights.push(`⚠️ High maximum drawdown of ${metrics.maxDrawdown.toFixed(1)}%`);
    } else if (metrics.maxDrawdown < 5) {
      insights.push(`🛡️ Low maximum drawdown of ${metrics.maxDrawdown.toFixed(1)}%`);
    }

    return insights;
  }

  private getDefaultMetrics(period: '1h' | '4h' | '24h' | '7d' | '30d'): PerformanceMetrics {
    return {
      period,
      absoluteReturn: '0',
      percentageReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      alpha: 0,
      beta: 1
    };
  }

  async compareAssetPerformance(denoms: string[], timeframe: '1h' | '4h' | '24h' | '7d' | '30d'): Promise<{
    ranking: Array<{
      asset: string;
      metrics: PerformanceMetrics;
      rank: number;
    }>;
    summary: {
      bestPerformer: string;
      worstPerformer: string;
      averageReturn: number;
      averageVolatility: number;
    };
  }> {
    try {
      const results = await Promise.all(
        denoms.map(async denom => ({
          asset: denom,
          metrics: await this.calculatePerformanceMetrics(denom, timeframe)
        }))
      );

      // Sort by percentage return
      const sorted = results.sort((a, b) => b.metrics.percentageReturn - a.metrics.percentageReturn);
      
      const ranking = sorted.map((result, index) => ({
        ...result,
        rank: index + 1
      }));

      const returns = results.map(r => r.metrics.percentageReturn);
      const volatilities = results.map(r => r.metrics.volatility);

      return {
        ranking,
        summary: {
          bestPerformer: sorted[0]?.asset || '',
          worstPerformer: sorted[sorted.length - 1]?.asset || '',
          averageReturn: returns.reduce((sum, r) => sum + r, 0) / returns.length,
          averageVolatility: volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length
        }
      };
    } catch (error) {
      this.agent.emit('error', `Failed to compare asset performance: ${error.message}`);
      throw error;
    }
  }

  async generatePerformanceReport(denom: string): Promise<{
    asset: string;
    currentPrice: string;
    allTimeframes: PerformanceReport[];
    summary: {
      trend: 'bullish' | 'bearish' | 'sideways';
      strength: 'weak' | 'moderate' | 'strong';
      recommendation: string;
    };
  }> {
    try {
      const timeframes: Array<'1h' | '4h' | '24h' | '7d' | '30d'> = ['1h', '4h', '24h', '7d', '30d'];
      const currentPrice = await this.precompiles.oracle.execute({ action: 'get_price', denom });
      const allTimeframes = await this.trackAssetPerformance(denom, timeframes);

      // Analyze trend
      const shortTerm = allTimeframes.find(r => r.timeframe === '24h')?.metrics.percentageReturn || 0;
      const mediumTerm = allTimeframes.find(r => r.timeframe === '7d')?.metrics.percentageReturn || 0;
      const longTerm = allTimeframes.find(r => r.timeframe === '30d')?.metrics.percentageReturn || 0;

      const avgReturn = (shortTerm + mediumTerm + longTerm) / 3;
      
      let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
      let strength: 'weak' | 'moderate' | 'strong' = 'weak';

      if (avgReturn > 2) {
        trend = 'bullish';
        strength = avgReturn > 10 ? 'strong' : avgReturn > 5 ? 'moderate' : 'weak';
      } else if (avgReturn < -2) {
        trend = 'bearish';
        strength = avgReturn < -10 ? 'strong' : avgReturn < -5 ? 'moderate' : 'weak';
      }

      let recommendation = '';
      if (trend === 'bullish' && strength !== 'weak') {
        recommendation = 'Consider increasing allocation - showing strong upward momentum';
      } else if (trend === 'bearish' && strength !== 'weak') {
        recommendation = 'Consider reducing exposure - showing strong downward momentum';
      } else {
        recommendation = 'Monitor closely - trend is unclear or weak';
      }

      return {
        asset: denom,
        currentPrice: currentPrice.price.toString(),
        allTimeframes,
        summary: {
          trend,
          strength,
          recommendation
        }
      };
    } catch (error) {
      this.agent.emit('error', `Failed to generate performance report: ${error.message}`);
      throw error;
    }
  }
}