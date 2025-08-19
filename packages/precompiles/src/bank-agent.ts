import { formatEther } from 'viem';
import { 
  BANK_PRECOMPILE_ABI,
  BANK_PRECOMPILE_ADDRESS,
  getBankPrecompileEthersContract
} from '@sei-js/precompiles';
import type { PrecompileConfig, TokenBalance } from './types';
import type { BaseCapability } from '@sei-code/core';

export class BankAgentCapability implements BaseCapability {
  public readonly name = 'bank_operations';
  public readonly description = 'Perform Sei native token operations (balances, transfers, metadata)';
  
  private config: PrecompileConfig;

  constructor(config: PrecompileConfig) {
    this.config = config;
  }

  async execute(params: {
    action: 'get_balance' | 'get_all_balances' | 'get_token_info' | 'transfer';
    address?: string;
    denom?: string;
    to?: string;
    amount?: string;
  }): Promise<any> {
    switch (params.action) {
      case 'get_balance':
        return this.getBalance(params.address!, params.denom || 'usei');
      case 'get_all_balances':
        return this.getAllBalances(params.address!);
      case 'get_token_info':
        return this.getTokenInfo(params.denom!);
      case 'transfer':
        return this.transferTokens(params.to!, params.denom!, params.amount!);
      default:
        throw new Error(`Unknown bank action: ${params.action}`);
    }
  }

  /**
   * Get balance for a specific token denomination
   */
  async getBalance(address: string, denom: string = 'usei'): Promise<TokenBalance> {
    try {
      if (this.config.publicClient) {
        // Use Viem
        const balance = await this.config.publicClient.readContract({
          address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
          abi: BANK_PRECOMPILE_ABI,
          functionName: 'balance',
          args: [address as `0x${string}`, denom]
        });

        const decimals = await this.config.publicClient.readContract({
          address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
          abi: BANK_PRECOMPILE_ABI,
          functionName: 'decimals',
          args: [denom]
        });

        return {
          denom,
          amount: balance.toString(),
          formatted: formatEther(balance as bigint),
          decimals: Number(decimals)
        };
      } else if (this.config.provider) {
        // Use Ethers
        const bankContract = getBankPrecompileEthersContract(this.config.provider);
        const balance = await bankContract.balance(address, denom);
        const decimals = await bankContract.decimals(denom);

        return {
          denom,
          amount: balance.toString(),
          formatted: formatEther(balance),
          decimals: Number(decimals)
        };
      } else {
        throw new Error('No provider or client configured');
      }
    } catch (error) {
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all token balances for an address
   */
  async getAllBalances(address: string): Promise<TokenBalance[]> {
    try {
      if (this.config.publicClient) {
        const balances = await this.config.publicClient.readContract({
          address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
          abi: BANK_PRECOMPILE_ABI,
          functionName: 'all_balances',
          args: [address as `0x${string}`]
        });

        const result: TokenBalance[] = [];
        for (const coin of balances as any[]) {
          const decimals = await this.config.publicClient.readContract({
            address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
            abi: BANK_PRECOMPILE_ABI,
            functionName: 'decimals',
            args: [coin.denom]
          });

          result.push({
            denom: coin.denom,
            amount: coin.amount.toString(),
            formatted: formatEther(coin.amount),
            decimals: Number(decimals)
          });
        }

        return result;
      } else if (this.config.provider) {
        const bankContract = getBankPrecompileEthersContract(this.config.provider);
        const balances = await bankContract.all_balances(address);

        const result: TokenBalance[] = [];
        for (const coin of balances) {
          const decimals = await bankContract.decimals(coin.denom);
          
          result.push({
            denom: coin.denom,
            amount: coin.amount.toString(),
            formatted: formatEther(coin.amount),
            decimals: Number(decimals)
          });
        }

        return result;
      } else {
        throw new Error('No provider or client configured');
      }
    } catch (error) {
      throw new Error(`Failed to get all balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token metadata
   */
  async getTokenInfo(denom: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }> {
    try {
      if (this.config.publicClient) {
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          this.config.publicClient.readContract({
            address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
            abi: BANK_PRECOMPILE_ABI,
            functionName: 'name',
            args: [denom]
          }),
          this.config.publicClient.readContract({
            address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
            abi: BANK_PRECOMPILE_ABI,
            functionName: 'symbol',
            args: [denom]
          }),
          this.config.publicClient.readContract({
            address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
            abi: BANK_PRECOMPILE_ABI,
            functionName: 'decimals',
            args: [denom]
          }),
          this.config.publicClient.readContract({
            address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
            abi: BANK_PRECOMPILE_ABI,
            functionName: 'supply',
            args: [denom]
          })
        ]);

        return {
          name: name as string,
          symbol: symbol as string,
          decimals: Number(decimals),
          totalSupply: (totalSupply as bigint).toString()
        };
      } else if (this.config.provider) {
        const bankContract = getBankPrecompileEthersContract(this.config.provider);
        
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          bankContract.name(denom),
          bankContract.symbol(denom),
          bankContract.decimals(denom),
          bankContract.supply(denom)
        ]);

        return {
          name,
          symbol,
          decimals: Number(decimals),
          totalSupply: totalSupply.toString()
        };
      } else {
        throw new Error('No provider or client configured');
      }
    } catch (error) {
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transfer tokens (requires wallet client)
   */
  async transferTokens(to: string, denom: string, amount: string): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for transfers');
    }

    try {
      // This would need the wallet client's address
      const from = this.config.walletClient.account?.address;
      if (!from) {
        throw new Error('No wallet address available');
      }

      const hash = await this.config.walletClient.writeContract({
        address: BANK_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: BANK_PRECOMPILE_ABI,
        functionName: 'send',
        args: [from, to as `0x${string}`, denom, BigInt(amount)]
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to transfer tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}