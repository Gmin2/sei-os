import type { SeiWallet } from '@sei-code/core';
import type { WalletConfig } from './types';
import { SeiGlobalWallet } from './sei-wallet';
import { MetaMaskWallet } from './metamask-wallet';

/**
 * Factory for creating wallet instances
 */
export class WalletFactory {
  /**
   * Create a wallet instance based on configuration
   */
  static create(config: WalletConfig): SeiWallet {
    switch (config.type) {
      case 'sei-global':
        return new SeiGlobalWallet(config);
      case 'metamask':
        return new MetaMaskWallet(config);
      case 'private-key':
        if (!config.privateKey) {
          throw new Error('Private key is required for private-key wallet type');
        }
        return new SeiGlobalWallet(config);
      default:
        throw new Error(`Unsupported wallet type: ${(config as any).type}`);
    }
  }

  /**
   * Create a wallet from private key
   */
  static fromPrivateKey(
    privateKey: string, 
    network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'
  ): SeiWallet {
    return WalletFactory.create({
      type: 'private-key',
      network,
      privateKey
    });
  }

  /**
   * Create a Sei Global Wallet instance
   */
  static createSeiWallet(network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'): SeiWallet {
    return WalletFactory.create({
      type: 'sei-global',
      network
    });
  }

  /**
   * Create a MetaMask wallet instance
   */
  static createMetaMaskWallet(network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'): SeiWallet {
    return WalletFactory.create({
      type: 'metamask',
      network
    });
  }

  /**
   * Get supported wallet types
   */
  static getSupportedTypes(): string[] {
    return ['sei-global', 'metamask', 'private-key'];
  }

  /**
   * Validate wallet configuration
   */
  static validateConfig(config: WalletConfig): boolean {
    if (!config.type || !config.network) {
      return false;
    }

    if (!this.getSupportedTypes().includes(config.type)) {
      return false;
    }

    if (!['mainnet', 'testnet', 'devnet'].includes(config.network)) {
      return false;
    }

    if (config.type === 'private-key' && !config.privateKey) {
      return false;
    }

    return true;
  }
}