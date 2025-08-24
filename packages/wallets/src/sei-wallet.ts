import { Wallet, JsonRpcProvider, formatEther, parseEther } from 'ethers';
import type { SeiWallet } from '@sei-code/core';
import type { WalletConfig, WalletConnection, TransactionRequest, TransactionResult } from './types';

export class SeiGlobalWallet implements SeiWallet {
  public address: string = '';
  public privateKey?: string;
  private provider: JsonRpcProvider;
  private wallet?: Wallet;
  private config: WalletConfig;
  private connected: boolean = false;

  constructor(config: WalletConfig) {
    this.config = config;
    this.privateKey = config.privateKey;
    
    // Set up RPC URL based on network
    const rpcUrl = config.rpcUrl || this.getDefaultRpcUrl(config.network);
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  /**
   * Connect to the wallet
   */
  async connect(): Promise<void> {
    try {
      if (this.config.type === 'private-key' && this.privateKey) {
        // Create wallet from private key
        this.wallet = new Wallet(this.privateKey, this.provider);
        this.address = this.wallet.address;
        this.connected = true;
      } else if (this.config.type === 'sei-global') {
        // For browser environment with Sei Global Wallet
        if (typeof window !== 'undefined' && (window as any).sei) {
          const accounts = await (window as any).sei.request({
            method: 'eth_requestAccounts'
          });
          this.address = accounts[0];
          this.connected = true;
        } else {
          throw new Error('Sei Global Wallet not found. Please install Sei Wallet extension.');
        }
      } else {
        throw new Error('Invalid wallet configuration');
      }
    } catch (error) {
      throw new Error(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get balance for a specific denomination
   */
  async getBalance(denom: string = 'usei'): Promise<string> {
    if (!this.connected) {
      throw new Error('Wallet not connected');
    }

    try {
      if (denom === 'usei' || denom === 'sei') {
        // Get ETH balance (SEI in EVM)
        const balance = await this.provider.getBalance(this.address);
        return formatEther(balance);
      } else {
        // For other denominations, we would need to call the Bank precompile
        // This is a placeholder for now
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
    if (!this.wallet) {
      throw new Error('Wallet not initialized for signing');
    }

    try {
      const transaction = {
        to: tx.to,
        value: tx.value ? parseEther(tx.value) : 0,
        data: tx.data || '0x',
        gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined
      };

      const signedTx = await this.wallet.signTransaction(transaction);
      return signedTx;
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a transaction
   */
  async sendTransaction(tx: TransactionRequest): Promise<TransactionResult> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized for sending transactions');
    }

    try {
      const transaction = {
        to: tx.to,
        value: tx.value ? parseEther(tx.value) : 0,
        data: tx.data || '0x',
        gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined
      };

      const txResponse = await this.wallet.sendTransaction(transaction);
      
      return {
        hash: txResponse.hash,
        status: 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(hash: string): Promise<TransactionResult> {
    try {
      const receipt = await this.provider.waitForTransaction(hash);
      
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      return {
        hash,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      throw new Error(`Failed to wait for transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Disconnect the wallet
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.address = '';
    this.wallet = undefined;
  }

  /**
   * Get default RPC URL for network
   */
  private getDefaultRpcUrl(network: string): string {
    switch (network) {
      case 'mainnet':
        return 'https://evm-rpc.sei-apis.com';
      case 'testnet':
        return 'https://evm-rpc-testnet.sei-apis.com';
      case 'devnet':
        return 'https://evm-rpc-arctic-1.sei-apis.com';
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  getEthersProvider(): JsonRpcProvider {
    return this.provider;
  }

  getEthersSigner(): Wallet {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    return this.wallet;
  }

  getAddress(): string {
    return this.address;
  }


}