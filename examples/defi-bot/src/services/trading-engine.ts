import type { SeiWallet, MetaMaskWallet } from '@sei-code/wallets';
import type { SeiPrecompileManager } from '@sei-code/precompiles';

interface TradingConfig {
  network: 'testnet' | 'mainnet';
  autoTradingEnabled: boolean;
  slippageTolerance: number;
  gasMultiplier: number;
}

interface TradeParams {
  action: 'buy' | 'sell' | 'swap';
  asset: string;
  amount: string;
  targetAsset?: string;
  slippage?: number;
  priceLimit?: number;
  reason?: string;
}

interface TradeResult {
  success: boolean;
  transactionHash: string;
  executedAmount: string;
  executedPrice: string;
  gasUsed: string;
  slippage: number;
}

interface ArbitrageOpportunity {
  asset: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profitPercentage: number;
  volume: string;
}

export class TradingEngine {
  private config: TradingConfig;
  private wallet: SeiWallet | MetaMaskWallet | null = null;
  private precompiles: SeiPrecompileManager | null = null;
  private tradeHistory: Map<string, TradeResult[]> = new Map();

  constructor(config: TradingConfig) {
    this.config = config;
  }

  async initialize(wallet: SeiWallet | MetaMaskWallet, precompiles: SeiPrecompileManager): Promise<void> {
    this.wallet = wallet;
    this.precompiles = precompiles;
    console.log('⚡ Trading engine initialized');
  }

  async executeTrade(params: TradeParams): Promise<TradeResult> {
    if (!this.wallet || !this.precompiles) {
      throw new Error('Trading engine not initialized');
    }

    try {
      console.log(`🔄 Executing trade: ${params.action} ${params.amount} ${params.asset}`);

      // Validate trade parameters
      await this.validateTrade(params);

      // Execute the trade based on action
      let result: TradeResult;
      
      switch (params.action) {
        case 'buy':
          result = await this.executeBuy(params);
          break;
        case 'sell':
          result = await this.executeSell(params);
          break;
        case 'swap':
          result = await this.executeSwap(params);
          break;
        default:
          throw new Error(`Unknown trade action: ${params.action}`);
      }

      // Store trade in history
      this.recordTrade(result);

      console.log(`✅ Trade executed: ${result.transactionHash}`);
      return result;

    } catch (error) {
      console.error(`❌ Trade execution failed: ${error.message}`);
      throw error;
    }
  }

  async rebalancePortfolio(strategy?: string): Promise<{
    transactions: TradeResult[];
    newAllocation: Record<string, number>;
    totalGasCost: string;
  }> {
    if (!this.config.autoTradingEnabled) {
      throw new Error('Auto-trading is disabled');
    }

    try {
      console.log(`⚖️ Rebalancing portfolio with strategy: ${strategy || 'default'}`);

      // Mock rebalancing logic - in reality this would:
      // 1. Calculate current vs target allocation
      // 2. Determine required trades
      // 3. Execute trades in optimal order
      // 4. Handle slippage and market impact

      const transactions: TradeResult[] = [
        {
          success: true,
          transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
          executedAmount: '1000',
          executedPrice: '0.5',
          gasUsed: '150000',
          slippage: 0.2
        },
        {
          success: true,
          transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
          executedAmount: '500',
          executedPrice: '7.0',
          gasUsed: '140000',
          slippage: 0.1
        }
      ];

      const newAllocation = {
        SEI: 50,
        ATOM: 30,
        USDC: 20
      };

      const totalGasCost = transactions
        .reduce((sum, tx) => sum + parseInt(tx.gasUsed), 0)
        .toString();

      return {
        transactions,
        newAllocation,
        totalGasCost
      };

    } catch (error) {
      throw new Error(`Rebalancing failed: ${error.message}`);
    }
  }

  async optimizeYield(opportunities: any[], riskAssessment: any): Promise<{
    selectedOpportunities: any[];
    totalYieldIncrease: number;
    transactions: TradeResult[];
  }> {
    try {
      // Filter opportunities based on risk assessment
      const safeOpportunities = opportunities.filter(opp => 
        riskAssessment.riskScores[opp.protocol] <= 0.7 // Max 70% risk
      );

      // Sort by risk-adjusted yield
      const rankedOpportunities = safeOpportunities
        .map(opp => ({
          ...opp,
          riskAdjustedYield: opp.apy * (1 - riskAssessment.riskScores[opp.protocol])
        }))
        .sort((a, b) => b.riskAdjustedYield - a.riskAdjustedYield);

      // Select top opportunities
      const selectedOpportunities = rankedOpportunities.slice(0, 3);
      
      // Execute yield optimization transactions
      const transactions: TradeResult[] = [];
      
      for (const opportunity of selectedOpportunities) {
        if (opportunity.asset === 'SEI' && opportunity.protocol === 'Sei Staking') {
          // Stake SEI
          const stakeResult = await this.stakeTokens('SEI', '1000');
          transactions.push(stakeResult);
        }
      }

      const totalYieldIncrease = selectedOpportunities
        .reduce((sum, opp) => sum + opp.apy, 0) / selectedOpportunities.length;

      return {
        selectedOpportunities,
        totalYieldIncrease,
        transactions
      };

    } catch (error) {
      throw new Error(`Yield optimization failed: ${error.message}`);
    }
  }

  async findArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    try {
      // Mock arbitrage opportunities - in reality this would:
      // 1. Query multiple DEXes/exchanges
      // 2. Compare prices across venues
      // 3. Calculate profit after fees and slippage
      // 4. Consider gas costs and market impact

      return [
        {
          asset: 'SEI',
          buyExchange: 'DragonSwap',
          sellExchange: 'SeiSwap',
          buyPrice: 0.495,
          sellPrice: 0.505,
          profitPercentage: 2.02,
          volume: '10000'
        },
        {
          asset: 'ATOM',
          buyExchange: 'SeiSwap',
          sellExchange: 'DragonSwap',
          buyPrice: 6.95,
          sellPrice: 7.02,
          profitPercentage: 1.01,
          volume: '5000'
        }
      ].filter(opp => opp.profitPercentage > 0.5); // Minimum 0.5% profit

    } catch (error) {
      console.error(`Arbitrage search failed: ${error.message}`);
      return [];
    }
  }

  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<{
    buyResult: TradeResult;
    sellResult: TradeResult;
    netProfit: string;
    profitPercentage: number;
  }> {
    try {
      console.log(`⚡ Executing arbitrage: ${opportunity.asset} ${opportunity.profitPercentage}%`);

      // Execute buy on lower-priced exchange
      const buyResult = await this.executeTrade({
        action: 'buy',
        asset: opportunity.asset,
        amount: opportunity.volume,
        reason: 'arbitrage_buy'
      });

      // Execute sell on higher-priced exchange
      const sellResult = await this.executeTrade({
        action: 'sell',
        asset: opportunity.asset,
        amount: opportunity.volume,
        reason: 'arbitrage_sell'
      });

      const buyValue = parseFloat(buyResult.executedAmount) * parseFloat(buyResult.executedPrice);
      const sellValue = parseFloat(sellResult.executedAmount) * parseFloat(sellResult.executedPrice);
      const netProfit = (sellValue - buyValue).toString();
      const profitPercentage = ((sellValue - buyValue) / buyValue) * 100;

      return {
        buyResult,
        sellResult,
        netProfit,
        profitPercentage
      };

    } catch (error) {
      throw new Error(`Arbitrage execution failed: ${error.message}`);
    }
  }

  async reduceExposure(asset: string, percentage: number): Promise<TradeResult> {
    try {
      // Calculate amount to sell based on current holdings
      const currentBalance = await this.getCurrentBalance(asset);
      const amountToSell = (parseFloat(currentBalance) * percentage / 100).toString();

      return await this.executeTrade({
        action: 'sell',
        asset,
        amount: amountToSell,
        reason: 'risk_reduction'
      });

    } catch (error) {
      throw new Error(`Exposure reduction failed: ${error.message}`);
    }
  }

  async getTradeHistory(limit: number = 50): Promise<TradeResult[]> {
    const allTrades = Array.from(this.tradeHistory.values()).flat();
    return allTrades
      .sort((a, b) => b.transactionHash.localeCompare(a.transactionHash)) // Mock sorting
      .slice(0, limit);
  }

  async getTradingMetrics(): Promise<{
    totalTrades: number;
    successRate: number;
    totalVolume: string;
    averageSlippage: number;
    profitLoss: string;
    bestTrade: TradeResult | null;
    worstTrade: TradeResult | null;
  }> {
    const trades = await this.getTradeHistory(1000);
    
    const totalTrades = trades.length;
    const successfulTrades = trades.filter(t => t.success).length;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;
    
    const totalVolume = trades
      .reduce((sum, trade) => sum + parseFloat(trade.executedAmount), 0)
      .toString();
    
    const averageSlippage = trades.length > 0 
      ? trades.reduce((sum, trade) => sum + trade.slippage, 0) / trades.length 
      : 0;

    // Mock P&L calculation
    const profitLoss = '1250.75';

    return {
      totalTrades,
      successRate,
      totalVolume,
      averageSlippage,
      profitLoss,
      bestTrade: trades[0] || null,
      worstTrade: trades[trades.length - 1] || null
    };
  }

  private async validateTrade(params: TradeParams): Promise<void> {
    // Validate slippage tolerance
    const slippage = params.slippage || this.config.slippageTolerance;
    if (slippage < 0 || slippage > 50) {
      throw new Error('Invalid slippage tolerance');
    }

    // Validate amount
    if (parseFloat(params.amount) <= 0) {
      throw new Error('Invalid trade amount');
    }

    // Check balance for sell orders
    if (params.action === 'sell') {
      const balance = await this.getCurrentBalance(params.asset);
      if (parseFloat(balance) < parseFloat(params.amount)) {
        throw new Error(`Insufficient balance: ${balance} ${params.asset}`);
      }
    }
  }

  private async executeBuy(params: TradeParams): Promise<TradeResult> {
    // Mock buy execution - in reality this would interact with DEX contracts
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
      executedAmount: params.amount,
      executedPrice: '0.5', // Mock price
      gasUsed: '150000',
      slippage: Math.random() * 0.5 // Random slippage up to 0.5%
    };
  }

  private async executeSell(params: TradeParams): Promise<TradeResult> {
    // Mock sell execution
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
      executedAmount: params.amount,
      executedPrice: '0.5', // Mock price
      gasUsed: '140000',
      slippage: Math.random() * 0.3
    };
  }

  private async executeSwap(params: TradeParams): Promise<TradeResult> {
    // Mock swap execution
    if (!params.targetAsset) {
      throw new Error('Target asset required for swap');
    }

    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
      executedAmount: params.amount,
      executedPrice: '7.0', // Mock price
      gasUsed: '180000',
      slippage: Math.random() * 0.8
    };
  }

  private async stakeTokens(asset: string, amount: string): Promise<TradeResult> {
    // Mock staking transaction
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
      executedAmount: amount,
      executedPrice: '1.0', // 1:1 for staking
      gasUsed: '200000',
      slippage: 0 // No slippage for staking
    };
  }

  private async getCurrentBalance(asset: string): Promise<string> {
    if (!this.wallet || !this.precompiles) {
      throw new Error('Wallet not connected');
    }

    // Mock balance check - in reality would query blockchain
    const mockBalances: Record<string, string> = {
      SEI: '10000',
      ATOM: '500',
      USDC: '2500'
    };

    return mockBalances[asset] || '0';
  }

  private recordTrade(result: TradeResult): void {
    const userAddress = this.wallet?.address || 'unknown';
    const history = this.tradeHistory.get(userAddress) || [];
    history.push(result);
    
    // Keep only last 100 trades per user
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.tradeHistory.set(userAddress, history);
  }
}