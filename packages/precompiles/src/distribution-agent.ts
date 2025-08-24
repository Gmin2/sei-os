import { formatEther } from 'viem';
import { 
  DISTRIBUTION_PRECOMPILE_ABI,
  DISTRIBUTION_PRECOMPILE_ADDRESS,
  getDistributionPrecompileEthersV6Contract
} from '@sei-js/precompiles';
import type { PrecompileConfig, StakingRewards } from './types';
import type { BaseCapability } from '@sei-code/core';

export class DistributionAgentCapability implements BaseCapability {
  public readonly name = 'rewards_operations';
  public readonly description = 'Manage staking rewards and distribution operations';
  
  private config: PrecompileConfig;

  constructor(config: PrecompileConfig) {
    this.config = config;
  }

  async execute(params: {
    action: 'get_rewards' | 'claim_rewards' | 'claim_all_rewards' | 'set_withdraw_address';
    delegator?: string;
    validator?: string;
    validators?: string[];
    withdrawAddress?: string;
  }): Promise<any> {
    switch (params.action) {
      case 'get_rewards':
        return this.getRewards(params.delegator!);
      case 'claim_rewards':
        return this.claimRewards(params.validator!);
      case 'claim_all_rewards':
        return this.claimAllRewards(params.validators!);
      case 'set_withdraw_address':
        return this.setWithdrawAddress(params.withdrawAddress!);
      default:
        throw new Error(`Unknown distribution action: ${params.action}`);
    }
  }

  /**
   * Get pending rewards for a delegator
   */
  async getRewards(delegatorAddress: string): Promise<{
    totalRewards: string;
    rewardsByValidator: StakingRewards[];
  }> {
    try {
      if (this.config.publicClient) {
        const rewards = await this.config.publicClient.readContract({
          address: DISTRIBUTION_PRECOMPILE_ADDRESS as `0x${string}`,
          abi: DISTRIBUTION_PRECOMPILE_ABI,
          functionName: 'rewards',
          args: [delegatorAddress as `0x${string}`]
        });

        const rewardsData = rewards as any;
        
        const rewardsByValidator: StakingRewards[] = rewardsData.rewards.map((reward: any) => ({
          validator: reward.validator_address,
          amount: formatEther(reward.coins[0]?.amount || 0n),
          denom: reward.coins[0]?.denom || 'usei'
        }));

        const totalRewards = rewardsData.total.reduce((sum: bigint, coin: any) => {
          return sum + coin.amount;
        }, 0n);

        return {
          totalRewards: formatEther(totalRewards),
          rewardsByValidator
        };
      } else if (this.config.provider) {
        const distributionContract = getDistributionPrecompileEthersV6Contract(this.config.provider);
        const rewards = await distributionContract.rewards(delegatorAddress);

        const rewardsByValidator: StakingRewards[] = rewards.rewards.map((reward: any) => ({
          validator: reward.validator_address,
          amount: formatEther(reward.coins[0]?.amount || 0n),
          denom: reward.coins[0]?.denom || 'usei'
        }));

        const totalRewards = rewards.total.reduce((sum: bigint, coin: any) => {
          return sum + coin.amount;
        }, 0n);

        return {
          totalRewards: formatEther(totalRewards),
          rewardsByValidator
        };
      } else {
        throw new Error('No provider or client configured');
      }
    } catch (error) {
      throw new Error(`Failed to get rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Claim rewards from a specific validator
   */
  async claimRewards(validatorAddress: string): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for claiming rewards');
    }

    try {
      const hash = await this.config.walletClient.writeContract({
        address: DISTRIBUTION_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: DISTRIBUTION_PRECOMPILE_ABI,
        functionName: 'withdrawDelegationRewards',
        args: [validatorAddress],
        chain: null,
        account: this.config.walletClient.account!
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to claim rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Claim rewards from multiple validators
   */
  async claimAllRewards(validatorAddresses: string[]): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for claiming rewards');
    }

    try {
      const hash = await this.config.walletClient.writeContract({
        address: DISTRIBUTION_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: DISTRIBUTION_PRECOMPILE_ABI,
        functionName: 'withdrawMultipleDelegationRewards',
        args: [validatorAddresses],
        chain: null,
        account: this.config.walletClient.account!
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to claim all rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set withdraw address for rewards
   */
  async setWithdrawAddress(withdrawAddress: string): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for setting withdraw address');
    }

    try {
      const hash = await this.config.walletClient.writeContract({
        address: DISTRIBUTION_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: DISTRIBUTION_PRECOMPILE_ABI,
        functionName: 'setWithdrawAddress',
        args: [withdrawAddress as `0x${string}`],
        chain: null,
        account: this.config.walletClient.account!
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to set withdraw address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Auto-compound rewards by claiming and re-delegating
   */
  async autoCompound(delegatorAddress: string, validatorAddress: string): Promise<{
    claimHash: string;
    delegateHash?: string;
    rewardsAmount: string;
  }> {
    try {
      // First get pending rewards
      const rewardsInfo = await this.getRewards(delegatorAddress);
      const validatorReward = rewardsInfo.rewardsByValidator.find(r => r.validator === validatorAddress);
      
      if (!validatorReward || parseFloat(validatorReward.amount) <= 0) {
        throw new Error('No rewards available for compounding');
      }

      // Claim rewards
      const claimHash = await this.claimRewards(validatorAddress);
      
      // Wait a bit for the claim to process (in real implementation, you'd wait for confirmation)
      // Then re-delegate the claimed amount
      // Note: This would require integration with the Staking precompile
      
      return {
        claimHash,
        rewardsAmount: validatorReward.amount
      };
    } catch (error) {
      throw new Error(`Failed to auto-compound: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate APY based on rewards history (simplified)
   */
  async calculateAPY(delegatorAddress: string, validatorAddress: string, delegatedAmount: string): Promise<{
    estimatedAPY: number;
    dailyRewards: string;
    monthlyRewards: string;
    yearlyRewards: string;
  }> {
    try {
      const rewardsInfo = await this.getRewards(delegatorAddress);
      const validatorReward = rewardsInfo.rewardsByValidator.find(r => r.validator === validatorAddress);
      
      if (!validatorReward) {
        throw new Error('No rewards data available for APY calculation');
      }

      // This is a simplified calculation
      // In practice, you'd need historical rewards data
      const currentRewards = parseFloat(validatorReward.amount);
      const delegated = parseFloat(delegatedAmount);
      
      // Assume current rewards represent 1 day of rewards (very simplified)
      const dailyRewards = currentRewards;
      const yearlyRewards = dailyRewards * 365;
      const estimatedAPY = (yearlyRewards / delegated) * 100;

      return {
        estimatedAPY,
        dailyRewards: dailyRewards.toString(),
        monthlyRewards: (dailyRewards * 30).toString(),
        yearlyRewards: yearlyRewards.toString()
      };
    } catch (error) {
      throw new Error(`Failed to calculate APY: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get optimal reward claiming strategy
   */
  async getClaimStrategy(delegatorAddress: string): Promise<{
    recommendation: 'claim_all' | 'claim_selective' | 'wait';
    reason: string;
    validators: string[];
    estimatedGasCost: string;
    rewardsAmount: string;
  }> {
    try {
      const rewardsInfo = await this.getRewards(delegatorAddress);
      const totalRewards = parseFloat(rewardsInfo.totalRewards);
      
      // Simple strategy logic
      if (totalRewards < 0.1) {
        return {
          recommendation: 'wait',
          reason: 'Rewards too small, wait for more accumulation',
          validators: [],
          estimatedGasCost: '0',
          rewardsAmount: totalRewards.toString()
        };
      }

      const significantRewards = rewardsInfo.rewardsByValidator.filter(
        r => parseFloat(r.amount) > 0.01
      );

      if (significantRewards.length === rewardsInfo.rewardsByValidator.length) {
        return {
          recommendation: 'claim_all',
          reason: 'All validators have significant rewards',
          validators: significantRewards.map(r => r.validator),
          estimatedGasCost: '0.001', // Simplified
          rewardsAmount: totalRewards.toString()
        };
      }

      return {
        recommendation: 'claim_selective',
        reason: 'Only some validators have significant rewards',
        validators: significantRewards.map(r => r.validator),
        estimatedGasCost: (significantRewards.length * 0.001).toString(),
        rewardsAmount: significantRewards.reduce((sum, r) => sum + parseFloat(r.amount), 0).toString()
      };
    } catch (error) {
      throw new Error(`Failed to get claim strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}