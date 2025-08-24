import { SeiAgent, BaseCapability } from '@sei-code/core';
import { SeiPrecompileManager } from '@sei-code/precompiles';
import type { 
  TokenBalance, 
  DelegationInfo, 
  PriceData,
  StakingRewards
} from '@sei-code/precompiles';

interface PortfolioSnapshot {
  timestamp: string;
  totalValue: string;
  assets: PortfolioAsset[];
  performance: PerformanceMetrics;
}

interface PortfolioAsset {
  denom: string;
  symbol: string;
  balance: string;
  value: string;
  price: string;
  allocation: number;
  type: 'liquid' | 'staked' | 'rewards';
  change24h?: number;
}

interface PerformanceMetrics {
  totalReturn: string;
  totalReturnPercentage: number;
  dailyReturn: string;
  dailyReturnPercentage: number;
  bestAsset: string;
  worstAsset: string;
  diversificationScore: number;
}

export class PortfolioAnalyzer extends BaseCapability {
  private precompiles: SeiPrecompileManager;
  private snapshots: Map<string, PortfolioSnapshot[]> = new Map();
  private agent: SeiAgent;

  constructor(agent: SeiAgent, precompiles: SeiPrecompileManager) {
    super('portfolio-analyzer', 'Portfolio analysis and tracking');
    this.agent = agent;
    this.precompiles = precompiles;
  }

  async execute(params: any): Promise<any> {
    const { action, ...args } = params;
    
    switch (action) {
      case 'analyzePortfolio':
        return this.analyzePortfolio(args.userAddress);
      case 'comparePortfolios':
        return this.comparePortfolios([args.address1, args.address2]);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async analyzePortfolio(userAddress: string): Promise<PortfolioSnapshot> {
    try {
      this.agent.emit('info', `Analyzing portfolio for ${userAddress}`);

      const [balances, delegations, rewards, prices] = await Promise.all([
        this.precompiles.bank.execute({ action: 'get_all_balances', address: userAddress }),
        this.getAllDelegations(userAddress),
        this.precompiles.distribution.execute({ action: 'get_rewards', delegator: userAddress }),
        this.precompiles.oracle.execute({ action: 'get_prices' })
      ]);

      const assets = await this.buildAssetList(balances, delegations, rewards, prices);
      const totalValue = this.calculateTotalValue(assets);
      const performance = await this.calculatePerformance(userAddress, assets, totalValue);

      const snapshot: PortfolioSnapshot = {
        timestamp: new Date().toISOString(),
        totalValue: totalValue.toString(),
        assets,
        performance
      };

      this.saveSnapshot(userAddress, snapshot);

      return snapshot;
    } catch (error) {
      this.agent.emit('error', `Failed to analyze portfolio: ${error.message}`);
      throw error;
    }
  }

  private async getAllDelegations(userAddress: string): Promise<DelegationInfo[]> {
    try {
      const validators = await this.precompiles.staking.execute({ action: 'get_validators' });
      const delegations: DelegationInfo[] = [];

      for (const validator of validators.slice(0, 10)) {
        try {
          const delegation = await this.precompiles.staking.execute({
            action: 'get_delegation',
            delegator: userAddress,
            validator: validator.address
          });
          
          if (delegation && parseFloat(delegation.amount) > 0) {
            delegations.push(delegation);
          }
        } catch (error) {
          // Skip validators with no delegation
        }
      }

      return delegations;
    } catch (error) {
      this.agent.emit('warn', `Failed to get delegations: ${error.message}`);
      return [];
    }
  }

  private async buildAssetList(
    balances: TokenBalance[],
    delegations: DelegationInfo[],
    rewards: any,
    prices: PriceData[]
  ): Promise<PortfolioAsset[]> {
    const assets: PortfolioAsset[] = [];
    const priceMap = new Map(prices.map(p => [p.denom, p]));

    for (const balance of balances) {
      if (parseFloat(balance.amount) > 0) {
        const price = priceMap.get(balance.denom);
        const priceValue = price ? price.price : 0;
        const value = parseFloat(balance.formatted) * priceValue;

        assets.push({
          denom: balance.denom,
          symbol: this.getSymbolFromDenom(balance.denom),
          balance: balance.formatted,
          value: value.toString(),
          price: priceValue.toString(),
          allocation: 0, // Will be calculated later
          type: 'liquid'
        });
      }
    }

    for (const delegation of delegations) {
      if (parseFloat(delegation.amount) > 0) {
        const price = priceMap.get('usei'); // Assume staking is in SEI
        const priceValue = price ? price.price : 0;
        const value = parseFloat(delegation.amount) * priceValue;

        assets.push({
          denom: 'usei',
          symbol: 'SEI',
          balance: delegation.amount,
          value: value.toString(),
          price: priceValue.toString(),
          allocation: 0,
          type: 'staked'
        });
      }
    }

    if (rewards && parseFloat(rewards.totalRewards) > 0) {
      const price = priceMap.get('usei');
      const priceValue = price ? price.price : 0;
      const value = parseFloat(rewards.totalRewards) * priceValue;

      assets.push({
        denom: 'usei',
        symbol: 'SEI',
        balance: rewards.totalRewards,
        value: value.toString(),
        price: priceValue.toString(),
        allocation: 0,
        type: 'rewards'
      });
    }

    const totalValue = assets.reduce((sum, asset) => sum + parseFloat(asset.value), 0);
    
    return assets.map(asset => ({
      ...asset,
      allocation: totalValue > 0 ? (parseFloat(asset.value) / totalValue) * 100 : 0
    }));
  }

  private calculateTotalValue(assets: PortfolioAsset[]): number {
    return assets.reduce((sum, asset) => sum + parseFloat(asset.value), 0);
  }

  private async calculatePerformance(
    userAddress: string,
    assets: PortfolioAsset[],
    currentValue: number
  ): Promise<PerformanceMetrics> {
    const previousSnapshots = this.snapshots.get(userAddress) || [];
    
    let dailyReturn = '0';
    let dailyReturnPercentage = 0;
    
    if (previousSnapshots.length > 0) {
      const previousSnapshot = previousSnapshots[previousSnapshots.length - 1];
      const previousValue = parseFloat(previousSnapshot.totalValue);
      
      if (previousValue > 0) {
        const returnValue = currentValue - previousValue;
        dailyReturn = returnValue.toString();
        dailyReturnPercentage = (returnValue / previousValue) * 100;
      }
    }

    const bestAsset = assets.length > 0 
      ? assets.reduce((best, current) => 
          parseFloat(current.value) > parseFloat(best.value) ? current : best
        ).symbol
      : '';

    const worstAsset = assets.length > 0
      ? assets.reduce((worst, current) =>
          parseFloat(current.value) < parseFloat(worst.value) ? current : worst
        ).symbol
      : '';

    const diversificationScore = this.calculateDiversificationScore(assets);

    return {
      totalReturn: dailyReturn,
      totalReturnPercentage: dailyReturnPercentage,
      dailyReturn,
      dailyReturnPercentage,
      bestAsset,
      worstAsset,
      diversificationScore
    };
  }

  private calculateDiversificationScore(assets: PortfolioAsset[]): number {
    if (assets.length <= 1) return 0;
    
    // Calculate Herfindahl-Hirschman Index for diversification
    const hhi = assets.reduce((sum, asset) => {
      const weight = asset.allocation / 100;
      return sum + (weight * weight);
    }, 0);
    
    // Convert to 0-100 scale (lower HHI = higher diversification)
    return Math.max(0, (1 - hhi) * 100);
  }

  private getSymbolFromDenom(denom: string): string {
    const symbolMap: Record<string, string> = {
      'usei': 'SEI',
      'uatom': 'ATOM',
      'uusdc': 'USDC',
      'uosmo': 'OSMO'
    };
    
    return symbolMap[denom] || denom.toUpperCase();
  }

  private saveSnapshot(userAddress: string, snapshot: PortfolioSnapshot): void {
    const userSnapshots = this.snapshots.get(userAddress) || [];
    userSnapshots.push(snapshot);
    
    // Keep only last 30 snapshots
    if (userSnapshots.length > 30) {
      userSnapshots.shift();
    }
    
    this.snapshots.set(userAddress, userSnapshots);
  }

  async getPortfolioHistory(userAddress: string): Promise<PortfolioSnapshot[]> {
    return this.snapshots.get(userAddress) || [];
  }

  async comparePortfolios(addresses: string[]): Promise<{
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
  }> {
    try {
      const portfolios = await Promise.all(
        addresses.map(async address => ({
          address,
          snapshot: await this.analyzePortfolio(address)
        }))
      );

      const values = portfolios.map(p => parseFloat(p.snapshot.totalValue));
      const bestIndex = values.indexOf(Math.max(...values));
      const worstIndex = values.indexOf(Math.min(...values));
      
      const averageValue = values.reduce((sum, val) => sum + val, 0) / values.length;
      const totalValue = values.reduce((sum, val) => sum + val, 0);

      return {
        portfolios,
        comparison: {
          bestPerformer: portfolios[bestIndex].address,
          worstPerformer: portfolios[worstIndex].address,
          averageValue: averageValue.toString(),
          totalCombinedValue: totalValue.toString()
        }
      };
    } catch (error) {
      this.agent.emit('error', `Failed to compare portfolios: ${error.message}`);
      throw error;
    }
  }

  async getAssetAllocation(userAddress: string): Promise<{
    liquid: number;
    staked: number;
    rewards: number;
    breakdown: Array<{
      asset: string;
      percentage: number;
      value: string;
    }>;
  }> {
    const snapshot = await this.analyzePortfolio(userAddress);
    
    const liquidValue = snapshot.assets
      .filter(a => a.type === 'liquid')
      .reduce((sum, asset) => sum + parseFloat(asset.value), 0);
    
    const stakedValue = snapshot.assets
      .filter(a => a.type === 'staked')
      .reduce((sum, asset) => sum + parseFloat(asset.value), 0);
    
    const rewardsValue = snapshot.assets
      .filter(a => a.type === 'rewards')
      .reduce((sum, asset) => sum + parseFloat(asset.value), 0);
    
    const totalValue = parseFloat(snapshot.totalValue);
    
    const breakdown = snapshot.assets.map(asset => ({
      asset: asset.symbol,
      percentage: asset.allocation,
      value: asset.value
    }));

    return {
      liquid: totalValue > 0 ? (liquidValue / totalValue) * 100 : 0,
      staked: totalValue > 0 ? (stakedValue / totalValue) * 100 : 0,
      rewards: totalValue > 0 ? (rewardsValue / totalValue) * 100 : 0,
      breakdown
    };
  }

  async trackPerformanceOverTime(userAddress: string, days = 30): Promise<{
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
  }> {
    const history = await this.getPortfolioHistory(userAddress);
    
    if (history.length < 2) {
      return {
        data: [],
        summary: {
          totalReturn: '0',
          totalReturnPercentage: 0,
          bestDay: '',
          worstDay: '',
          volatility: 0
        }
      };
    }

    const data = history.map((snapshot, index) => {
      const previousValue = index > 0 ? parseFloat(history[index - 1].totalValue) : parseFloat(snapshot.totalValue);
      const currentValue = parseFloat(snapshot.totalValue);
      const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;

      return {
        date: snapshot.timestamp.split('T')[0],
        value: snapshot.totalValue,
        change
      };
    });

    const firstValue = parseFloat(history[0].totalValue);
    const lastValue = parseFloat(history[history.length - 1].totalValue);
    const totalReturn = lastValue - firstValue;
    const totalReturnPercentage = firstValue > 0 ? (totalReturn / firstValue) * 100 : 0;

    const changes = data.map(d => d.change);
    const bestDayIndex = changes.indexOf(Math.max(...changes));
    const worstDayIndex = changes.indexOf(Math.min(...changes));
    
    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const variance = changes.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / changes.length;
    const volatility = Math.sqrt(variance);

    return {
      data,
      summary: {
        totalReturn: totalReturn.toString(),
        totalReturnPercentage,
        bestDay: data[bestDayIndex]?.date || '',
        worstDay: data[worstDayIndex]?.date || '',
        volatility
      }
    };
  }
}