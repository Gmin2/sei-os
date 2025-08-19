import { 
  ORACLE_PRECOMPILE_ABI,
  ORACLE_PRECOMPILE_ADDRESS,
  getOraclePrecompileEthersContract
} from '@sei-js/precompiles';
import type { PrecompileConfig, PriceData, TWAPData } from './types';
import type { BaseCapability } from '@sei-code/core';

export class OracleAgentCapability implements BaseCapability {
  public readonly name = 'oracle_operations';
  public readonly description = 'Access Sei oracle price feeds and TWAP data';
  
  private config: PrecompileConfig;

  constructor(config: PrecompileConfig) {
    this.config = config;
  }

  async execute(params: {
    action: 'get_prices' | 'get_price' | 'get_twap' | 'monitor_price' | 'price_alert';
    denom?: string;
    lookbackSeconds?: number;
    threshold?: number;
  }): Promise<any> {
    switch (params.action) {
      case 'get_prices':
        return this.getAllPrices();
      case 'get_price':
        return this.getPrice(params.denom!);
      case 'get_twap':
        return this.getTWAP(params.denom!, params.lookbackSeconds || 3600);
      case 'monitor_price':
        return this.monitorPrice(params.denom!, params.threshold || 0.05);
      case 'price_alert':
        return this.checkPriceAlert(params.denom!, params.threshold || 0.05);
      default:
        throw new Error(`Unknown oracle action: ${params.action}`);
    }
  }

  /**
   * Get all current exchange rates
   */
  async getAllPrices(): Promise<PriceData[]> {
    try {
      if (this.config.publicClient) {
        const exchangeRates = await this.config.publicClient.readContract({
          address: ORACLE_PRECOMPILE_ADDRESS as `0x${string}`,
          abi: ORACLE_PRECOMPILE_ABI,
          functionName: 'getExchangeRates'
        });

        return (exchangeRates as any[]).map(rate => ({
          denom: rate.denom,
          price: parseFloat(rate.oracleExchangeRateVal.exchangeRate),
          timestamp: new Date(Number(rate.oracleExchangeRateVal.lastUpdateTimestamp) * 1000),
          source: 'sei-oracle'
        }));
      } else if (this.config.provider) {
        const oracleContract = getOraclePrecompileEthersContract(this.config.provider);
        const exchangeRates = await oracleContract.getExchangeRates();

        return exchangeRates.map(rate => ({
          denom: rate.denom,
          price: parseFloat(rate.oracleExchangeRateVal.exchangeRate),
          timestamp: new Date(Number(rate.oracleExchangeRateVal.lastUpdateTimestamp) * 1000),
          source: 'sei-oracle'
        }));
      } else {
        throw new Error('No provider or client configured');
      }
    } catch (error) {
      throw new Error(`Failed to get prices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get price for a specific denomination
   */
  async getPrice(denom: string): Promise<PriceData> {
    const allPrices = await this.getAllPrices();
    const price = allPrices.find(p => p.denom === denom);
    
    if (!price) {
      throw new Error(`Price not found for denomination: ${denom}`);
    }
    
    return price;
  }

  /**
   * Get TWAP data for a specific timeframe
   */
  async getTWAP(denom: string, lookbackSeconds: number = 3600): Promise<TWAPData> {
    try {
      if (this.config.publicClient) {
        const twapData = await this.config.publicClient.readContract({
          address: ORACLE_PRECOMPILE_ADDRESS as `0x${string}`,
          abi: ORACLE_PRECOMPILE_ABI,
          functionName: 'getOracleTwaps',
          args: [BigInt(lookbackSeconds)]
        });

        const denomData = (twapData as any[]).find(t => t.denom === denom);
        if (!denomData) {
          throw new Error(`TWAP data not found for denomination: ${denom}`);
        }

        return {
          denom: denomData.denom,
          price: parseFloat(denomData.twap),
          lookbackSeconds: Number(denomData.lookbackSeconds),
          timestamp: new Date()
        };
      } else if (this.config.provider) {
        const oracleContract = getOraclePrecompileEthersContract(this.config.provider);
        const twapData = await oracleContract.getOracleTwaps(BigInt(lookbackSeconds));

        const denomData = twapData.find(t => t.denom === denom);
        if (!denomData) {
          throw new Error(`TWAP data not found for denomination: ${denom}`);
        }

        return {
          denom: denomData.denom,
          price: parseFloat(denomData.twap),
          lookbackSeconds: Number(denomData.lookbackSeconds),
          timestamp: new Date()
        };
      } else {
        throw new Error('No provider or client configured');
      }
    } catch (error) {
      throw new Error(`Failed to get TWAP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Monitor price changes and detect significant movements
   */
  async monitorPrice(denom: string, thresholdPercent: number = 0.05): Promise<{
    currentPrice: number;
    twapPrice: number;
    deviation: number;
    alert: boolean;
    direction: 'up' | 'down' | 'stable';
  }> {
    try {
      const [currentPrice, twapPrice] = await Promise.all([
        this.getPrice(denom),
        this.getTWAP(denom, 86400) // 24h TWAP
      ]);

      const deviation = (currentPrice.price - twapPrice.price) / twapPrice.price;
      const deviationPercent = Math.abs(deviation);
      const alert = deviationPercent > thresholdPercent;
      
      let direction: 'up' | 'down' | 'stable' = 'stable';
      if (deviation > thresholdPercent) direction = 'up';
      else if (deviation < -thresholdPercent) direction = 'down';

      return {
        currentPrice: currentPrice.price,
        twapPrice: twapPrice.price,
        deviation: deviation * 100, // Convert to percentage
        alert,
        direction
      };
    } catch (error) {
      throw new Error(`Failed to monitor price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if price has moved beyond threshold
   */
  async checkPriceAlert(denom: string, thresholdPercent: number = 0.05): Promise<{
    alert: boolean;
    message: string;
    data: any;
  }> {
    const monitoring = await this.monitorPrice(denom, thresholdPercent);
    
    if (monitoring.alert) {
      const direction = monitoring.direction === 'up' ? 'increased' : 'decreased';
      const message = `🚨 Price Alert: ${denom.toUpperCase()} has ${direction} by ${Math.abs(monitoring.deviation).toFixed(2)}% (Current: ${monitoring.currentPrice}, 24h TWAP: ${monitoring.twapPrice})`;
      
      return {
        alert: true,
        message,
        data: monitoring
      };
    }

    return {
      alert: false,
      message: `✅ ${denom.toUpperCase()} price is stable (deviation: ${monitoring.deviation.toFixed(2)}%)`,
      data: monitoring
    };
  }

  /**
   * Get multiple timeframe TWAP data
   */
  async getMultiTimeframeTWAP(denom: string): Promise<{
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
        const twap = await this.getTWAP(denom, seconds);
        return [label, twap];
      })
    );

    return Object.fromEntries(results) as any;
  }

  /**
   * Analyze price trends
   */
  async analyzePriceTrend(denom: string): Promise<{
    trend: 'bullish' | 'bearish' | 'sideways';
    strength: 'weak' | 'moderate' | 'strong';
    analysis: string;
    data: any;
  }> {
    try {
      const multiTwap = await this.getMultiTimeframeTWAP(denom);
      const currentPrice = await this.getPrice(denom);

      const price1h = multiTwap['1h'].price;
      const price4h = multiTwap['4h'].price;
      const price24h = multiTwap['24h'].price;
      const price7d = multiTwap['7d'].price;

      // Simple trend analysis
      const short_trend = (currentPrice.price - price1h) / price1h;
      const medium_trend = (currentPrice.price - price4h) / price4h;
      const long_trend = (currentPrice.price - price24h) / price24h;

      let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
      let strength: 'weak' | 'moderate' | 'strong' = 'weak';

      const avgTrend = (short_trend + medium_trend + long_trend) / 3;
      
      if (avgTrend > 0.02) {
        trend = 'bullish';
        strength = avgTrend > 0.05 ? 'strong' : avgTrend > 0.03 ? 'moderate' : 'weak';
      } else if (avgTrend < -0.02) {
        trend = 'bearish';
        strength = avgTrend < -0.05 ? 'strong' : avgTrend < -0.03 ? 'moderate' : 'weak';
      }

      const analysis = `${denom.toUpperCase()} is showing ${strength} ${trend} momentum. Current: ${currentPrice.price}, 1h: ${price1h}, 4h: ${price4h}, 24h: ${price24h}`;

      return {
        trend,
        strength,
        analysis,
        data: {
          currentPrice: currentPrice.price,
          changes: {
            '1h': short_trend * 100,
            '4h': medium_trend * 100,
            '24h': long_trend * 100
          },
          twaps: multiTwap
        }
      };
    } catch (error) {
      throw new Error(`Failed to analyze price trend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}