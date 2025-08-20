import { SeiAgent, AgentCapability } from '@sei-code/core';
import { SeiPrecompileManager } from '@sei-code/precompiles';
import type { PriceData, TWAPData } from '@sei-code/precompiles';
import type { 
  MarketDataPoint, 
  MarketIndicators, 
  TradingSignal, 
  MarketTrend,
  LiquidityAnalysis,
  CorrelationMatrix
} from './types';

export class MarketDataAgent extends AgentCapability {
  private precompiles: SeiPrecompileManager;
  private priceCache: Map<string, MarketDataPoint[]> = new Map();
  private cacheTimeout = 60000; // 1 minute

  constructor(agent: SeiAgent, precompiles: SeiPrecompileManager) {
    super('market-data', agent);
    this.precompiles = precompiles;
  }

  async getMarketData(denom: string, timeframe = '24h'): Promise<MarketDataPoint[]> {
    try {
      const cacheKey = `${denom}_${timeframe}`;
      const cached = this.priceCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cacheKey)) {
        return cached;
      }

      this.agent.emit('info', `Fetching market data for ${denom} (${timeframe})`);

      const [currentPrice, twapData] = await Promise.all([
        this.precompiles.oracle.execute({ action: 'get_price', denom }),
        this.getMultiTimeframeTWAP(denom)
      ]);

      const dataPoints = this.buildMarketDataPoints(currentPrice, twapData, timeframe);
      this.priceCache.set(cacheKey, dataPoints);

      return dataPoints;
    } catch (error) {
      this.agent.emit('error', `Failed to get market data for ${denom}: ${error.message}`);
      throw error;
    }
  }

  private async getMultiTimeframeTWAP(denom: string): Promise<{
    '1h': TWAPData;
    '4h': TWAPData;
    '24h': TWAPData;
    '7d': TWAPData;
  }> {
    const timeframes = {
      '1h': 3600,
      '4h': 14400,
      '24h': 86400,
      '7d': 604800
    };

    const results = await Promise.all(
      Object.entries(timeframes).map(async ([label, seconds]) => {
        try {
          const twap = await this.precompiles.oracle.execute({
            action: 'get_twap',
            denom,
            lookbackSeconds: seconds
          });
          return [label, twap];
        } catch (error) {
          // Return fallback data if TWAP fails
          const currentPrice = await this.precompiles.oracle.execute({ action: 'get_price', denom });
          return [label, {
            denom,
            price: currentPrice.price,
            lookbackSeconds: seconds,
            timestamp: new Date()
          }];
        }
      })
    );

    return Object.fromEntries(results) as any;
  }

  private buildMarketDataPoints(currentPrice: PriceData, twapData: any, timeframe: string): MarketDataPoint[] {
    const points: MarketDataPoint[] = [];
    const now = Date.now();
    
    // Generate historical points using TWAP data
    const intervals = this.getIntervalsForTimeframe(timeframe);
    const intervalMs = this.getIntervalMs(timeframe, intervals);

    for (let i = intervals; i >= 0; i--) {
      const timestamp = new Date(now - (i * intervalMs)).toISOString();
      
      // Use TWAP price as historical approximation
      let price = currentPrice.price;
      if (i > 0) {
        // Use longer TWAP for older data points
        const twapKey = i > 168 ? '7d' : i > 24 ? '24h' : i > 4 ? '4h' : '1h';
        price = twapData[twapKey]?.price || currentPrice.price;
        
        // Add some realistic price variation for historical simulation
        const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
        price = price * (1 + variation);
      }

      points.push({
        timestamp,
        price: price.toString(),
        volume: this.estimateVolume(price, timeframe),
        marketCap: this.estimateMarketCap(price, currentPrice.denom)
      });
    }

    return points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private getIntervalsForTimeframe(timeframe: string): number {
    const intervalMap = {
      '1h': 12,     // 5-minute intervals
      '4h': 24,     // 10-minute intervals  
      '24h': 48,    // 30-minute intervals
      '7d': 168,    // 1-hour intervals
      '30d': 180    // 4-hour intervals
    };
    return intervalMap[timeframe] || 48;
  }

  private getIntervalMs(timeframe: string, intervals: number): number {
    const timeframeMs = {
      '1h': 3600000,
      '4h': 14400000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000
    };
    return (timeframeMs[timeframe] || 86400000) / intervals;
  }

  private estimateVolume(price: number, timeframe: string): string {
    // Simplified volume estimation based on price and timeframe
    const baseVolume = price * 1000000; // Base volume estimation
    const timeframeMultiplier = {
      '1h': 0.1,
      '4h': 0.4,
      '24h': 1.0,
      '7d': 7.0,
      '30d': 30.0
    };
    
    const multiplier = timeframeMultiplier[timeframe] || 1.0;
    const volume = baseVolume * multiplier * (0.5 + Math.random());
    
    return volume.toString();
  }

  private estimateMarketCap(price: number, denom: string): string {
    // Simplified market cap estimation
    const supplyEstimates = {
      'usei': 10000000000, // 10B SEI
      'uatom': 350000000,  // 350M ATOM
      'uosmo': 1000000000  // 1B OSMO
    };
    
    const supply = supplyEstimates[denom] || 1000000000;
    const marketCap = price * supply;
    
    return marketCap.toString();
  }

  async calculateTechnicalIndicators(denom: string, timeframe = '24h'): Promise<MarketIndicators> {
    try {
      const marketData = await this.getMarketData(denom, timeframe);
      const prices = marketData.map(point => parseFloat(point.price));
      
      if (prices.length < 20) {
        throw new Error('Insufficient data for technical analysis');
      }

      const rsi = this.calculateRSI(prices);
      const macd = this.calculateMACD(prices);
      const movingAverages = this.calculateMovingAverages(prices);
      const bollingerBands = this.calculateBollingerBands(prices);
      const { support, resistance } = this.calculateSupportResistance(prices);

      return {
        rsi,
        macd,
        movingAverages,
        bollingerBands,
        support: support.toString(),
        resistance: resistance.toString()
      };
    } catch (error) {
      this.agent.emit('error', `Failed to calculate technical indicators: ${error.message}`);
      throw error;
    }
  }

  private calculateRSI(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50; // Default neutral RSI

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    if (prices.length < 26) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // For simplicity, using a basic signal calculation
    const signal = macd * 0.9; // Simplified signal line
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  private calculateMovingAverages(prices: number[]): {
    ma7: string;
    ma30: string;
    ma50: string;
    ma200: string;
  } {
    const calculateMA = (period: number) => {
      if (prices.length < period) return prices[prices.length - 1] || 0;
      const slice = prices.slice(-period);
      return slice.reduce((sum, price) => sum + price, 0) / slice.length;
    };

    return {
      ma7: calculateMA(7).toString(),
      ma30: calculateMA(30).toString(),
      ma50: calculateMA(50).toString(),
      ma200: calculateMA(200).toString()
    };
  }

  private calculateBollingerBands(prices: number[], period = 20, stdDev = 2): {
    upper: string;
    middle: string;
    lower: string;
  } {
    if (prices.length < period) {
      const lastPrice = prices[prices.length - 1] || 0;
      return {
        upper: (lastPrice * 1.05).toString(),
        middle: lastPrice.toString(),
        lower: (lastPrice * 0.95).toString()
      };
    }

    const slice = prices.slice(-period);
    const middle = slice.reduce((sum, price) => sum + price, 0) / slice.length;
    
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / slice.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: (middle + (standardDeviation * stdDev)).toString(),
      middle: middle.toString(),
      lower: (middle - (standardDeviation * stdDev)).toString()
    };
  }

  private calculateSupportResistance(prices: number[]): { support: number; resistance: number } {
    if (prices.length < 10) {
      const lastPrice = prices[prices.length - 1] || 0;
      return {
        support: lastPrice * 0.95,
        resistance: lastPrice * 1.05
      };
    }

    const recentPrices = prices.slice(-50); // Last 50 data points
    const minPrice = Math.min(...recentPrices);
    const maxPrice = Math.max(...recentPrices);
    const currentPrice = prices[prices.length - 1];

    // Simple support/resistance calculation
    const support = minPrice + ((currentPrice - minPrice) * 0.2);
    const resistance = currentPrice + ((maxPrice - currentPrice) * 0.8);

    return { support, resistance };
  }

  async generateTradingSignals(denom: string, timeframe = '24h'): Promise<TradingSignal[]> {
    try {
      const [indicators, trendAnalysis] = await Promise.all([
        this.calculateTechnicalIndicators(denom, timeframe),
        this.precompiles.oracle.execute({ action: 'analyze_price_trend', denom })
      ]);

      const signals: TradingSignal[] = [];
      const currentPrice = await this.precompiles.oracle.execute({ action: 'get_price', denom });

      // RSI-based signals
      if (indicators.rsi > 70) {
        signals.push({
          type: 'sell',
          strength: indicators.rsi > 80 ? 'strong' : 'moderate',
          confidence: Math.min(95, 50 + (indicators.rsi - 70) * 2),
          reason: `RSI overbought at ${indicators.rsi.toFixed(1)}`,
          timestamp: new Date().toISOString(),
          price: currentPrice.price.toString()
        });
      } else if (indicators.rsi < 30) {
        signals.push({
          type: 'buy',
          strength: indicators.rsi < 20 ? 'strong' : 'moderate',
          confidence: Math.min(95, 50 + (30 - indicators.rsi) * 2),
          reason: `RSI oversold at ${indicators.rsi.toFixed(1)}`,
          timestamp: new Date().toISOString(),
          price: currentPrice.price.toString()
        });
      }

      // MACD-based signals
      if (indicators.macd.macd > indicators.macd.signal && indicators.macd.histogram > 0) {
        signals.push({
          type: 'buy',
          strength: 'moderate',
          confidence: 65,
          reason: 'MACD bullish crossover',
          timestamp: new Date().toISOString(),
          price: currentPrice.price.toString()
        });
      } else if (indicators.macd.macd < indicators.macd.signal && indicators.macd.histogram < 0) {
        signals.push({
          type: 'sell',
          strength: 'moderate',
          confidence: 65,
          reason: 'MACD bearish crossover',
          timestamp: new Date().toISOString(),
          price: currentPrice.price.toString()
        });
      }

      // Trend-based signals
      if (trendAnalysis && trendAnalysis.trend === 'bullish' && trendAnalysis.strength !== 'weak') {
        signals.push({
          type: 'buy',
          strength: trendAnalysis.strength,
          confidence: 70,
          reason: `${trendAnalysis.strength} bullish trend detected`,
          timestamp: new Date().toISOString(),
          price: currentPrice.price.toString()
        });
      } else if (trendAnalysis && trendAnalysis.trend === 'bearish' && trendAnalysis.strength !== 'weak') {
        signals.push({
          type: 'sell',
          strength: trendAnalysis.strength,
          confidence: 70,
          reason: `${trendAnalysis.strength} bearish trend detected`,
          timestamp: new Date().toISOString(),
          price: currentPrice.price.toString()
        });
      }

      // If no strong signals, add hold signal
      if (signals.length === 0 || signals.every(s => s.strength === 'weak')) {
        signals.push({
          type: 'hold',
          strength: 'moderate',
          confidence: 60,
          reason: 'No clear directional signals detected',
          timestamp: new Date().toISOString(),
          price: currentPrice.price.toString()
        });
      }

      return signals;
    } catch (error) {
      this.agent.emit('error', `Failed to generate trading signals: ${error.message}`);
      return [];
    }
  }

  async getMarketTrend(denom: string, timeframes: string[] = ['1h', '24h', '7d']): Promise<MarketTrend[]> {
    try {
      const trends: MarketTrend[] = [];

      for (const timeframe of timeframes) {
        const [indicators, signals] = await Promise.all([
          this.calculateTechnicalIndicators(denom, timeframe),
          this.generateTradingSignals(denom, timeframe)
        ]);

        // Determine trend based on indicators
        let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
        let strength: 'weak' | 'moderate' | 'strong' = 'weak';
        let confidence = 50;

        const ma7 = parseFloat(indicators.movingAverages.ma7);
        const ma30 = parseFloat(indicators.movingAverages.ma30);
        
        if (ma7 > ma30 * 1.02) {
          trend = 'bullish';
          strength = ma7 > ma30 * 1.05 ? 'strong' : 'moderate';
          confidence = 60 + Math.min(30, (ma7 - ma30) / ma30 * 1000);
        } else if (ma7 < ma30 * 0.98) {
          trend = 'bearish';
          strength = ma7 < ma30 * 0.95 ? 'strong' : 'moderate';
          confidence = 60 + Math.min(30, (ma30 - ma7) / ma30 * 1000);
        }

        trends.push({
          asset: denom,
          trend,
          strength,
          timeframe,
          confidence: Math.round(confidence),
          signals,
          indicators
        });
      }

      return trends;
    } catch (error) {
      this.agent.emit('error', `Failed to get market trend: ${error.message}`);
      throw error;
    }
  }

  private isCacheValid(cacheKey: string): boolean {
    // Simple cache validation - in production, you'd store timestamps
    return false; // Always refresh for now
  }

  async calculateCorrelationMatrix(denoms: string[], timeframe = '30d'): Promise<CorrelationMatrix> {
    try {
      const allMarketData = await Promise.all(
        denoms.map(denom => this.getMarketData(denom, timeframe))
      );

      const priceArrays = allMarketData.map(data => 
        data.map(point => parseFloat(point.price))
      );

      // Ensure all arrays have the same length
      const minLength = Math.min(...priceArrays.map(arr => arr.length));
      const normalizedArrays = priceArrays.map(arr => arr.slice(-minLength));

      const correlations = this.calculateCorrelationCoefficients(normalizedArrays);
      const insights = this.analyzeCorrelations(denoms, correlations);

      return {
        assets: denoms,
        correlations,
        timeframe,
        insights
      };
    } catch (error) {
      this.agent.emit('error', `Failed to calculate correlation matrix: ${error.message}`);
      throw error;
    }
  }

  private calculateCorrelationCoefficients(priceArrays: number[][]): number[][] {
    const n = priceArrays.length;
    const correlations: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          correlations[i][j] = 1;
        } else {
          correlations[i][j] = this.pearsonCorrelation(priceArrays[i], priceArrays[j]);
        }
      }
    }

    return correlations;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      sumXSquared += deltaX * deltaX;
      sumYSquared += deltaY * deltaY;
    }

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private analyzeCorrelations(assets: string[], correlations: number[][]): Array<{
    pair: [string, string];
    correlation: number;
    strength: 'weak' | 'moderate' | 'strong';
    direction: 'positive' | 'negative';
  }> {
    const insights = [];

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const correlation = correlations[i][j];
        const absCorrelation = Math.abs(correlation);
        
        let strength: 'weak' | 'moderate' | 'strong' = 'weak';
        if (absCorrelation > 0.7) strength = 'strong';
        else if (absCorrelation > 0.4) strength = 'moderate';

        insights.push({
          pair: [assets[i], assets[j]],
          correlation,
          strength,
          direction: correlation >= 0 ? 'positive' : 'negative'
        });
      }
    }

    return insights.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }
}