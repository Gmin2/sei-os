import { BrowserProvider, formatEther, parseEther } from 'ethers';
import type { SeiWallet } from '@sei-code/core';
import type { WalletConfig, WalletConnection, TransactionRequest, TransactionResult } from './types';

export class MetaMaskWallet implements SeiWallet {
  public address: string = '';
  public privateKey?: string;
  private provider: BrowserProvider | null = null;
  private config: WalletConfig;
  private connected: boolean = false;

  constructor(config: WalletConfig) {
    this.config = config;
  }

  /**
   * Connect to MetaMask
   */
  async connect(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('MetaMask wallet only available in browser environment');
    }

    if (!(window as any).ethereum) {
      throw new Error('MetaMask not installed. Please install MetaMask extension.');
    }

    try {
      this.provider = new BrowserProvider((window as any).ethereum);
      
      // Request account access
      await (window as any).ethereum.request({
        method: 'eth_requestAccounts'
      });

      const signer = await this.provider.getSigner();
      this.address = await signer.getAddress();
      this.connected = true;

      // Switch to Sei network if not already
      await this.switchToSeiNetwork();
    } catch (error) {
      throw new Error(`Failed to connect to MetaMask: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get balance for a specific denomination
   */
  async getBalance(denom: string = 'usei'): Promise<string> {
    if (!this.connected || !this.provider) {
      throw new Error('Wallet not connected');
    }

    try {
      if (denom === 'usei' || denom === 'sei') {
        const balance = await this.provider.getBalance(this.address);
        return formatEther(balance);
      } else {
        // For other denominations, would need Bank precompile
        return '0';
      }
    } catch (error) {
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: TransactionRequest): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const signer = await this.provider.getSigner();
      const transaction = {
        to: tx.to,
        value: tx.value ? parseEther(tx.value) : 0,
        data: tx.data || '0x',
        gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined
      };

      const signedTx = await signer.signTransaction(transaction);
      return signedTx;
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a transaction
   */
  async sendTransaction(tx: TransactionRequest): Promise<TransactionResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const signer = await this.provider.getSigner();
      const transaction = {
        to: tx.to,
        value: tx.value ? parseEther(tx.value) : 0,
        data: tx.data || '0x',
        gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined
      };

      const txResponse = await signer.sendTransaction(transaction);
      
      return {
        hash: txResponse.hash,
        status: 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet connection info
   */
  getConnection(): WalletConnection {
    return {
      address: this.address,
      isConnected: this.connected,
      network: this.config.network
    };
  }

  /**
   * Get Ethers provider
   */
  getEthersProvider(): any {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return this.provider;
  }

  /**
   * Get Ethers signer
   */
  getEthersSigner(): any {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return this.provider.getSigner();
  }

  /**
   * Disconnect the wallet
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.address = '';
    this.provider = null;
  }

  /**
   * Switch to Sei network in MetaMask
   */
  private async switchToSeiNetwork(): Promise<void> {
    if (!this.provider) return;

    const chainId = this.getChainId();
    const networkConfig = this.getNetworkConfig();

    try {
      // Try to switch to the network
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (switchError: any) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
        } catch (addError) {
          throw new Error(`Failed to add Sei network to MetaMask: ${addError}`);
        }
      } else {
        throw new Error(`Failed to switch to Sei network: ${switchError.message}`);
      }
    }
  }

  /**
   * Get chain ID for the configured network
   */
  private getChainId(): string {
    switch (this.config.network) {
      case 'mainnet':
        return '0x531'; // 1329 in hex
      case 'testnet':
        return '0x57E4'; // 22500 in hex  
      case 'devnet':
        return '0x713C0'; // 463808 in hex
      default:
        throw new Error(`Unsupported network: ${this.config.network}`);
    }
  }

  /**
   * Get network configuration for MetaMask
   */
  private getNetworkConfig() {
    const baseConfig = {
      chainId: this.getChainId(),
      chainName: '',
      nativeCurrency: {
        name: 'SEI',
        symbol: 'SEI',
        decimals: 18
      },
      rpcUrls: [''],
      blockExplorerUrls: ['']
    };

    switch (this.config.network) {
      case 'mainnet':
        return {
          ...baseConfig,
          chainName: 'Sei Network',
          rpcUrls: ['https://evm-rpc.sei-apis.com'],
          blockExplorerUrls: ['https://seitrace.com']
        };
      case 'testnet':
        return {
          ...baseConfig,
          chainName: 'Sei Testnet',
          rpcUrls: ['https://evm-rpc-testnet.sei-apis.com'],
          blockExplorerUrls: ['https://seitrace.com/?chain=atlantic-2']
        };
      case 'devnet':
        return {
          ...baseConfig,
          chainName: 'Sei Devnet',
          rpcUrls: ['https://evm-rpc-arctic-1.sei-apis.com'],
          blockExplorerUrls: ['https://seitrace.com/?chain=arctic-1']
        };
      default:
        throw new Error(`Unsupported network: ${this.config.network}`);
    }
  }
}