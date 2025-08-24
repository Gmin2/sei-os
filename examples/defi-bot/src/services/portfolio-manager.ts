interface PortfolioConfig {
  network: 'testnet' | 'mainnet';
  updateInterval: number;
  trackingEnabled: boolean;
}

interface AssetHolding {
  symbol: string;
  denom: string;
  balance: string;
  valueUSD: string;
  allocation: number; // percentage
  price: number;
  priceChange24h: number;
}

interface PortfolioSummary {
  totalValue: string;
  totalValueUSD: string;
  dailyChange: number;
  assets: AssetHolding[];
  allocation: Record<string, number>;
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export class PortfolioManager {
  private config: PortfolioConfig;
  private userAddress: string = '';
  private portfolioHistory: Map<string, any[]> = new Map();

  constructor(config: PortfolioConfig) {
    this.config = config;
  }

  async initialize(userAddress: string): Promise<void> {
    this.userAddress = userAddress;
    console.log(`📊 Portfolio manager initialized for ${userAddress}`);
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    try {
      // Mock portfolio data - in reality this would query the blockchain
      const assets: AssetHolding[] = [
        {
          symbol: 'SEI',
          denom: 'usei',
          balance: '10,000',
          valueUSD: '5,000',
          allocation: 45.5,
          price: 0.5,
          priceChange24h: 5.2
        },
        {
          symbol: 'ATOM',
          denom: 'uatom',
          balance: '500',
          valueUSD: '3,500',
          allocation: 31.8,
          price: 7.0,
          priceChange24h: -2.1
        },
        {
          symbol: 'USDC',
          denom: 'uusdc',
          balance: '2,500',
          valueUSD: '2,500',
          allocation: 22.7,
          price: 1.0,
          priceChange24h: 0.1
        }
      ];

      const totalValueUSD = assets.reduce((sum, asset) => sum + parseFloat(asset.valueUSD), 0);
      const dailyChange = this.calculateDailyChange(assets);

      return {
        totalValue: (totalValueUSD / 0.5).toString(), // Convert to SEI
        totalValueUSD: totalValueUSD.toString(),
        dailyChange,
        assets,
        allocation: this.calculateAllocation(assets),
        performance: {
          daily: dailyChange,
          weekly: 12.3, // Mock data
          monthly: 28.7
        }
      };
    } catch (error) {
      throw new Error(`Failed to get portfolio summary: ${error.message}`);
    }
  }

  async updatePortfolioData(): Promise<void> {
    try {
      const summary = await this.getPortfolioSummary();
      
      // Store historical data
      const history = this.portfolioHistory.get(this.userAddress) || [];
      history.push({
        timestamp: new Date().toISOString(),
        totalValue: summary.totalValue,
        totalValueUSD: summary.totalValueUSD,
        assets: summary.assets.length,
        dailyChange: summary.dailyChange
      });

      // Keep only last 1000 records
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }

      this.portfolioHistory.set(this.userAddress, history);
    } catch (error) {
      console.error(`Portfolio update failed: ${error.message}`);
    }
  }

  async shouldRebalance(threshold: number): Promise<boolean> {
    try {
      const summary = await this.getPortfolioSummary();
      const targetAllocation = this.getTargetAllocation();

      // Check if any asset allocation deviates more than threshold
      for (const asset of summary.assets) {
        const target = targetAllocation[asset.symbol] || 0;
        const deviation = Math.abs(asset.allocation - target);
        
        if (deviation > threshold) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Rebalance check failed: ${error.message}`);
      return false;
    }
  }

  async findYieldOpportunities(): Promise<Array<{
    protocol: string;
    asset: string;
    apy: number;
    riskLevel: 'low' | 'medium' | 'high';
    lockupPeriod?: string;
    minimumAmount?: string;
  }>> {
    // Mock yield opportunities - in reality this would query various DeFi protocols
    return [
      {
        protocol: 'Sei Staking',
        asset: 'SEI',
        apy: 15.2,
        riskLevel: 'low',
        lockupPeriod: '21 days unbonding'
      },
      {
        protocol: 'Liquid Staking',
        asset: 'SEI',
        apy: 13.8,
        riskLevel: 'low'
      },
      {
        protocol: 'SEI-USDC LP',
        asset: 'SEI/USDC',
        apy: 28.5,
        riskLevel: 'medium',
        minimumAmount: '1000'
      },
      {
        protocol: 'Yield Farming',
        asset: 'ATOM',
        apy: 45.2,
        riskLevel: 'high',
        lockupPeriod: '7 days'
      }
    ];
  }

  async getCurrentYield(): Promise<number> {
    // Calculate current portfolio yield
    const summary = await this.getPortfolioSummary();
    
    // Mock calculation - would check actual staking rewards, LP rewards, etc.
    let weightedYield = 0;
    const yields = { SEI: 15.2, ATOM: 12.5, USDC: 5.0 };
    
    for (const asset of summary.assets) {
      const yield_ = yields[asset.symbol] || 0;
      weightedYield += (asset.allocation / 100) * yield_;
    }
    
    return weightedYield;
  }

  async getPortfolioHistory(days: number = 30): Promise<any[]> {
    const history = this.portfolioHistory.get(this.userAddress) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return history.filter(entry => 
      new Date(entry.timestamp) >= cutoffDate
    );
  }

  async getAssetPerformance(symbol: string, timeframe: string): Promise<{
    symbol: string;
    performance: number;
    volatility: number;
    sharpeRatio: number;
    bestDay: number;
    worstDay: number;
  }> {
    // Mock asset performance data
    const performanceData = {
      SEI: { performance: 25.3, volatility: 45.2, sharpeRatio: 0.56, bestDay: 12.5, worstDay: -8.3 },
      ATOM: { performance: 18.7, volatility: 38.1, sharpeRatio: 0.49, bestDay: 9.2, worstDay: -6.7 },
      USDC: { performance: 5.2, volatility: 2.1, sharpeRatio: 2.48, bestDay: 0.8, worstDay: -0.3 }
    };

    return {
      symbol,
      ...(performanceData[symbol] || { performance: 0, volatility: 0, sharpeRatio: 0, bestDay: 0, worstDay: 0 })
    };
  }

  async getCorrelationMatrix(): Promise<Record<string, Record<string, number>>> {
    // Mock correlation data between assets
    return {
      SEI: { SEI: 1.0, ATOM: 0.73, USDC: -0.12 },
      ATOM: { SEI: 0.73, ATOM: 1.0, USDC: -0.08 },
      USDC: { SEI: -0.12, ATOM: -0.08, USDC: 1.0 }
    };
  }

  async optimizeAllocation(strategy: 'conservative' | 'balanced' | 'aggressive'): Promise<Record<string, number>> {
    const strategies = {
      conservative: { SEI: 30, ATOM: 20, USDC: 50 },
      balanced: { SEI: 45, ATOM: 35, USDC: 20 },
      aggressive: { SEI: 60, ATOM: 35, USDC: 5 }
    };

    return strategies[strategy];
  }

  private calculateDailyChange(assets: AssetHolding[]): number {
    let totalChange = 0;
    let totalWeight = 0;

    for (const asset of assets) {
      const weight = asset.allocation / 100;
      totalChange += asset.priceChange24h * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalChange / totalWeight : 0;
  }

  private calculateAllocation(assets: AssetHolding[]): Record<string, number> {
    const allocation: Record<string, number> = {};
    
    for (const asset of assets) {
      allocation[asset.symbol] = asset.allocation;
    }
    
    return allocation;
  }

  private getTargetAllocation(): Record<string, number> {
    // Default target allocation - could be user-configurable
    return {
      SEI: 50,
      ATOM: 30,
      USDC: 20
    };
  }

  async getDiversificationScore(): Promise<{
    score: number; // 0-100
    analysis: {
      assetCount: number;
      maxConcentration: number;
      herfindahlIndex: number;
      recommendations: string[];
    };
  }> {
    const summary = await this.getPortfolioSummary();
    const correlations = await this.getCorrelationMatrix();
    
    // Calculate Herfindahl-Hirschman Index for concentration
    const hhi = summary.assets.reduce((sum, asset) => {
      const allocation = asset.allocation / 100;
      return sum + (allocation * allocation);
    }, 0);

    const maxConcentration = Math.max(...summary.assets.map(a => a.allocation));
    
    // Score based on diversification factors
    let score = 100;
    
    // Penalize high concentration
    if (maxConcentration > 50) score -= (maxConcentration - 50) * 2;
    if (hhi > 0.4) score -= (hhi - 0.4) * 100;
    
    // Penalize too few assets
    if (summary.assets.length < 3) score -= (3 - summary.assets.length) * 20;
    
    score = Math.max(0, Math.min(100, score));

    const recommendations: string[] = [];
    
    if (maxConcentration > 60) {
      recommendations.push('Consider reducing concentration in your largest position');
    }
    
    if (summary.assets.length < 4) {
      recommendations.push('Add more assets to improve diversification');
    }
    
    if (hhi > 0.5) {
      recommendations.push('Portfolio is highly concentrated - spread investments more evenly');
    }

    return {
      score,
      analysis: {
        assetCount: summary.assets.length,
        maxConcentration,
        herfindahlIndex: hhi,
        recommendations
      }
    };
  }
}