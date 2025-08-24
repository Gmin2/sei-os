import { formatEther, parseEther } from 'viem';
import { 
  STAKING_PRECOMPILE_ABI,
  STAKING_PRECOMPILE_ADDRESS,
  getStakingPrecompileEthersV6Contract
} from '@sei-js/precompiles';
import type { PrecompileConfig, DelegationInfo, ValidatorInfo } from './types';
import type { BaseCapability } from '@sei-code/core';

export class StakingAgentCapability implements BaseCapability {
  public readonly name = 'staking_operations';
  public readonly description = 'Perform Sei staking operations (delegate, undelegate, redelegate, query delegations)';
  
  private config: PrecompileConfig;

  constructor(config: PrecompileConfig) {
    this.config = config;
  }

  async execute(params: {
    action: 'delegate' | 'undelegate' | 'redelegate' | 'get_delegation' | 'get_validators';
    validator?: string;
    fromValidator?: string;
    toValidator?: string;
    amount?: string;
    delegator?: string;
  }): Promise<any> {
    switch (params.action) {
      case 'delegate':
        return this.delegate(params.validator!, params.amount!);
      case 'undelegate':
        return this.undelegate(params.validator!, params.amount!);
      case 'redelegate':
        return this.redelegate(params.fromValidator!, params.toValidator!, params.amount!);
      case 'get_delegation':
        return this.getDelegation(params.delegator!, params.validator!);
      case 'get_validators':
        return this.getValidators();
      default:
        throw new Error(`Unknown staking action: ${params.action}`);
    }
  }

  /**
   * Delegate tokens to a validator
   */
  async delegate(validatorAddress: string, amount: string): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for delegation');
    }

    try {
      const hash = await this.config.walletClient.writeContract({
        address: STAKING_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: STAKING_PRECOMPILE_ABI,
        functionName: 'delegate',
        args: [validatorAddress],
        value: parseEther(amount),
        chain: null,
        account: this.config.walletClient.account!
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to delegate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Undelegate tokens from a validator
   */
  async undelegate(validatorAddress: string, amount: string): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for undelegation');
    }

    try {
      const hash = await this.config.walletClient.writeContract({
        address: STAKING_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: STAKING_PRECOMPILE_ABI,
        functionName: 'undelegate',
        args: [validatorAddress, parseEther(amount)],
        chain: null,
        account: this.config.walletClient.account!
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to undelegate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Redelegate tokens between validators
   */
  async redelegate(fromValidator: string, toValidator: string, amount: string): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for redelegation');
    }

    try {
      const hash = await this.config.walletClient.writeContract({
        address: STAKING_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: STAKING_PRECOMPILE_ABI,
        functionName: 'redelegate',
        args: [fromValidator, toValidator, parseEther(amount)],
        chain: null,
        account: this.config.walletClient.account!
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to redelegate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get delegation information
   */
  async getDelegation(delegatorAddress: string, validatorAddress: string): Promise<DelegationInfo> {
    try {
      if (this.config.publicClient) {
        const delegation = await this.config.publicClient.readContract({
          address: STAKING_PRECOMPILE_ADDRESS as `0x${string}`,
          abi: STAKING_PRECOMPILE_ABI,
          functionName: 'delegation',
          args: [delegatorAddress as `0x${string}`, validatorAddress]
        });

        const delegationData = delegation as any;
        
        return {
          validatorAddress: delegationData.delegation.validator_address,
          amount: formatEther(delegationData.balance.amount),
          shares: delegationData.delegation.shares.toString(),
          rewards: '0' // Would need Distribution precompile for rewards
        };
      } else if (this.config.provider) {
        const stakingContract = getStakingPrecompileEthersV6Contract(this.config.provider);
        const delegation = await stakingContract.delegation(delegatorAddress, validatorAddress);

        return {
          validatorAddress: delegation.delegation.validator_address,
          amount: formatEther(delegation.balance.amount),
          shares: delegation.delegation.shares.toString(),
          rewards: '0' // Would need Distribution precompile for rewards
        };
      } else {
        throw new Error('No provider or client configured');
      }
    } catch (error) {
      throw new Error(`Failed to get delegation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get validator information (simplified - would need additional data sources)
   */
  async getValidators(): Promise<ValidatorInfo[]> {
    // This is a simplified implementation
    // In practice, you'd need to query the Cosmos SDK directly or use additional APIs
    // for complete validator information like commission, uptime, etc.
    
    return [
      {
        address: 'seivaloper1example1',
        moniker: 'Sei Validator 1',
        commission: 0.05,
        uptime: 0.99,
        votingPower: '1000000',
        status: 'bonded'
      },
      {
        address: 'seivaloper1example2', 
        moniker: 'Sei Validator 2',
        commission: 0.03,
        uptime: 0.98,
        votingPower: '2000000',
        status: 'bonded'
      }
    ];
  }

  /**
   * Select optimal validator based on criteria
   */
  async selectOptimalValidator(criteria: {
    maxCommission?: number;
    minUptime?: number;
    excludeValidators?: string[];
  } = {}): Promise<ValidatorInfo> {
    const validators = await this.getValidators();
    
    let filtered = validators.filter(v => v.status === 'bonded');
    
    if (criteria.maxCommission) {
      filtered = filtered.filter(v => v.commission <= criteria.maxCommission!);
    }
    
    if (criteria.minUptime) {
      filtered = filtered.filter(v => v.uptime >= criteria.minUptime!);
    }
    
    if (criteria.excludeValidators) {
      filtered = filtered.filter(v => !criteria.excludeValidators!.includes(v.address));
    }
    
    if (filtered.length === 0) {
      throw new Error('No validators match the specified criteria');
    }
    
    // Sort by lowest commission, then highest uptime
    filtered.sort((a, b) => {
      if (a.commission !== b.commission) {
        return a.commission - b.commission;
      }
      return b.uptime - a.uptime;
    });
    
    return filtered[0];
  }

  /**
   * Auto-compound staking rewards (would require integration with Distribution precompile)
   */
  async autoCompound(delegatorAddress: string, validatorAddress: string): Promise<string[]> {
    // This would require:
    // 1. Check pending rewards using Distribution precompile
    // 2. Withdraw rewards
    // 3. Delegate withdrawn rewards back to validator
    
    throw new Error('Auto-compound requires Distribution precompile integration');
  }
}