import type { Provider } from 'ethers';
import type { PublicClient, WalletClient } from 'viem';
import type { PrecompileConfig } from './types';
import { BankAgentCapability } from './bank-agent';
import { StakingAgentCapability } from './staking-agent';
import { OracleAgentCapability } from './oracle-agent';
import { DistributionAgentCapability } from './distribution-agent';
import { GovernanceAgentCapability } from './governance-agent';

/**
 * Central manager for all Sei precompile operations
 */
export class SeiPrecompileManager {
  private config: PrecompileConfig;
  
  public readonly bank: BankAgentCapability;
  public readonly staking: StakingAgentCapability;
  public readonly oracle: OracleAgentCapability;
  public readonly distribution: DistributionAgentCapability;
  public readonly governance: GovernanceAgentCapability;

  constructor(config: PrecompileConfig) {
    this.config = config;
    
    // Initialize all precompile capabilities
    this.bank = new BankAgentCapability(config);
    this.staking = new StakingAgentCapability(config);
    this.oracle = new OracleAgentCapability(config);
    this.distribution = new DistributionAgentCapability(config);
    this.governance = new GovernanceAgentCapability(config);
  }

  /**
   * Create manager with Viem clients
   */
  static withViem(publicClient: PublicClient, walletClient?: WalletClient, network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'): SeiPrecompileManager {
    return new SeiPrecompileManager({
      publicClient,
      walletClient,
      network
    });
  }

  /**
   * Create manager with Ethers provider
   */
  static withEthers(provider: Provider, network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'): SeiPrecompileManager {
    return new SeiPrecompileManager({
      provider,
      network
    });
  }

  /**
   * Get all available capabilities
   */
  getAllCapabilities() {
    return [
      this.bank,
      this.staking,
      this.oracle,
      this.distribution,
      this.governance
    ];
  }

  /**
   * Execute a cross-precompile operation
   */
  async executeCombo(operations: Array<{
    precompile: 'bank' | 'staking' | 'oracle' | 'distribution' | 'governance';
    action: string;
    params: any;
  }>): Promise<any[]> {
    const results = [];
    
    for (const op of operations) {
      let result;
      
      switch (op.precompile) {
        case 'bank':
          result = await this.bank.execute({ action: op.action, ...op.params });
          break;
        case 'staking':
          result = await this.staking.execute({ action: op.action, ...op.params });
          break;
        case 'oracle':
          result = await this.oracle.execute({ action: op.action, ...op.params });
          break;
        case 'distribution':
          result = await this.distribution.execute({ action: op.action, ...op.params });
          break;
        case 'governance':
          result = await this.governance.execute({ action: op.action, ...op.params });
          break;
        default:
          throw new Error(`Unknown precompile: ${op.precompile}`);
      }
      
      results.push(result);
    }
    
    return results;
  }

  /**
   * DeFi Portfolio Summary
   */
  async getPortfolioSummary(userAddress: string): Promise<{
    totalValue: number;
    balances: any[];
    delegations: any[];
    rewards: any;
    governance: any;
  }> {
    try {
      const [balances, delegations, rewards, governance] = await Promise.all([
        this.bank.execute({ action: 'get_all_balances', address: userAddress }),
        this.staking.execute({ action: 'get_validators' }).then(validators =>
          Promise.all(validators.slice(0, 3).map((v: any) =>
            this.staking.execute({ action: 'get_delegation', delegator: userAddress, validator: v.address })
          ))
        ),
        this.distribution.execute({ action: 'get_rewards', delegator: userAddress }),
        this.governance.execute({ action: 'get_proposals' })
      ]);

      // Get current prices for valuation
      const prices = await this.oracle.execute({ action: 'get_prices' });
      const seiPrice = prices.find((p: any) => p.denom === 'usei')?.price || 0;

      // Calculate total value
      let totalValue = 0;
      for (const balance of balances) {
        if (balance.denom === 'usei') {
          totalValue += parseFloat(balance.formatted) * seiPrice;
        }
      }

      // Add staked value
      for (const delegation of delegations) {
        if (delegation.amount) {
          totalValue += parseFloat(delegation.amount) * seiPrice;
        }
      }

      return {
        totalValue,
        balances,
        delegations: delegations.filter((d: any) => d.amount && parseFloat(d.amount) > 0),
        rewards,
        governance: {
          activeProposals: governance.filter((p: any) => p.status === 'voting').length,
          totalProposals: governance.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to get portfolio summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Yield Optimization Strategy
   */
  async getYieldStrategy(userAddress: string): Promise<{
    recommendations: Array<{
      action: string;
      reason: string;
      expectedReturn: string;
      risk: 'low' | 'medium' | 'high';
    }>;
    currentYield: string;
    optimizedYield: string;
  }> {
    try {
      const [rewards, delegations, validators] = await Promise.all([
        this.distribution.execute({ action: 'get_rewards', delegator: userAddress }),
        this.staking.execute({ action: 'get_validators' }).then(vals =>
          Promise.all(vals.slice(0, 5).map((v: any) =>
            this.staking.execute({ action: 'get_delegation', delegator: userAddress, validator: v.address })
          ))
        ),
        this.staking.execute({ action: 'get_validators' })
      ]);

      const recommendations = [];
      let currentYield = '0';
      let optimizedYield = '0';

      // Analyze current staking
      const activeDelegations = delegations.filter((d: any) => d.amount && parseFloat(d.amount) > 0);
      
      if (activeDelegations.length === 0) {
        recommendations.push({
          action: 'Start staking to earn rewards',
          reason: 'No current delegations found',
          expectedReturn: '8-12% APY',
          risk: 'low' as const
        });
      } else {
        // Check for reward claiming opportunities
        if (parseFloat(rewards.totalRewards) > 0.1) {
          recommendations.push({
            action: 'Claim and compound staking rewards',
            reason: `${rewards.totalRewards} SEI rewards available`,
            expectedReturn: '5-8% boost',
            risk: 'low' as const
          });
        }

        // Check validator diversification
        if (activeDelegations.length === 1) {
          recommendations.push({
            action: 'Diversify across multiple validators',
            reason: 'Reduce single validator risk',
            expectedReturn: '2-3% risk-adjusted improvement',
            risk: 'low' as const
          });
        }

        // Simple yield calculation (this would be more sophisticated in practice)
        const totalDelegated = activeDelegations.reduce((sum: number, d: any) => sum + parseFloat(d.amount), 0);
        const totalRewards = parseFloat(rewards.totalRewards);
        currentYield = ((totalRewards / totalDelegated) * 365 * 100).toFixed(2); // Annualized
        optimizedYield = (parseFloat(currentYield) * 1.15).toFixed(2); // 15% improvement estimate
      }

      return {
        recommendations,
        currentYield: `${currentYield}%`,
        optimizedYield: `${optimizedYield}%`
      };
    } catch (error) {
      throw new Error(`Failed to get yield strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Risk Management Analysis
   */
  async getRiskAnalysis(userAddress: string): Promise<{
    riskScore: number; // 0-100
    riskFactors: string[];
    recommendations: string[];
    portfolio: {
      diversification: number;
      concentration: string[];
      liquidityRisk: string;
    };
  }> {
    try {
      const [balances, delegations, prices] = await Promise.all([
        this.bank.execute({ action: 'get_all_balances', address: userAddress }),
        this.staking.execute({ action: 'get_validators' }).then(vals =>
          Promise.all(vals.slice(0, 5).map((v: any) =>
            this.staking.execute({ action: 'get_delegation', delegator: userAddress, validator: v.address })
          ))
        ),
        this.oracle.execute({ action: 'get_prices' })
      ]);

      const activeDelegations = delegations.filter((d: any) => d.amount && parseFloat(d.amount) > 0);
      const seiBalance = balances.find((b: any) => b.denom === 'usei');
      
      let riskScore = 0;
      const riskFactors = [];
      const recommendations = [];

      // Liquidity risk
      const totalBalance = seiBalance ? parseFloat(seiBalance.formatted) : 0;
      const totalStaked = activeDelegations.reduce((sum: number, d: any) => sum + parseFloat(d.amount), 0);
      const liquidityRatio = totalBalance / (totalBalance + totalStaked);
      
      if (liquidityRatio < 0.1) {
        riskScore += 30;
        riskFactors.push('Low liquidity - most assets are staked');
        recommendations.push('Consider keeping 10-20% in liquid form');
      }

      // Concentration risk
      if (activeDelegations.length === 1) {
        riskScore += 25;
        riskFactors.push('Single validator concentration');
        recommendations.push('Diversify across 3-5 reliable validators');
      }

      // Price volatility (simplified)
      const seiPrice = prices.find((p: any) => p.denom === 'usei');
      if (seiPrice) {
        // This would use historical volatility in practice
        riskScore += 15; // Base volatility score for crypto
        riskFactors.push('Market volatility risk');
      }

      // Governance participation
      const govActivity = await this.governance.execute({ action: 'get_proposals' });
      const activeProposals = govActivity.filter((p: any) => p.status === 'voting');
      if (activeProposals.length > 0) {
        recommendations.push('Participate in governance to protect your interests');
      }

      return {
        riskScore: Math.min(riskScore, 100),
        riskFactors,
        recommendations,
        portfolio: {
          diversification: activeDelegations.length,
          concentration: activeDelegations.length === 1 ? ['Single validator risk'] : [],
          liquidityRisk: liquidityRatio < 0.1 ? 'High' : liquidityRatio < 0.2 ? 'Medium' : 'Low'
        }
      };
    } catch (error) {
      throw new Error(`Failed to analyze risk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}