import { SeiAgent, AgentCapability } from '@sei-code/core';
import { SeiWallet } from '@sei-code/wallets';
import { TransactionBuilder } from '@sei-code/transactions';
import { ethers } from 'ethers';
import { 
  NFTCollection, 
  NFTToken, 
  NFTTransfer,
  NFTBatchTransferOptions,
  NFTApprovalOptions 
} from './types';

const ERC1155_ABI = [
  'function uri(uint256 id) view returns (string)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)',
  'function totalSupply(uint256 id) view returns (uint256)',
  'function exists(uint256 id) view returns (bool)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
  'event ApprovalForAll(address indexed account, address indexed operator, bool approved)',
  'event URI(string value, uint256 indexed id)'
];

export class ERC1155Agent extends AgentCapability {
  private provider: ethers.Provider;

  constructor(agent: SeiAgent, wallet: SeiWallet) {
    super('erc1155', agent);
    this.provider = wallet.getEthersProvider();
  }

  async getCollection(collectionAddress: string): Promise<NFTCollection> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      
      const name = `ERC1155 Collection`;
      const symbol = 'ERC1155';

      return {
        address: collectionAddress,
        name,
        symbol,
        type: 'erc721',
        totalSupply: 0
      };
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 collection info: ${error.message}`);
      throw error;
    }
  }

  async getToken(collectionAddress: string, tokenId: string): Promise<NFTToken | null> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      
      const [exists, uri, totalSupply] = await Promise.all([
        contract.exists(tokenId).catch(() => false),
        contract.uri(tokenId).catch(() => null),
        contract.totalSupply(tokenId).catch(() => 0n)
      ]);

      if (!exists) {
        return null;
      }

      let metadata = null;
      if (uri) {
        try {
          const response = await fetch(uri);
          if (response.ok) {
            metadata = await response.json();
          }
        } catch (error) {
          this.agent.emit('warn', `Failed to fetch metadata from ${uri}: ${error.message}`);
        }
      }

      return {
        collection: collectionAddress,
        tokenId,
        owner: '',
        tokenUri: uri || undefined,
        metadata
      };
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 token: ${error.message}`);
      throw error;
    }
  }

  async getBalance(collectionAddress: string, account: string, tokenId: string): Promise<number> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      const balance = await contract.balanceOf(account, tokenId);
      return Number(balance);
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 balance: ${error.message}`);
      throw error;
    }
  }

  async getBalanceBatch(
    collectionAddress: string, 
    accounts: string[], 
    tokenIds: string[]
  ): Promise<number[]> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      const balances = await contract.balanceOfBatch(accounts, tokenIds);
      return balances.map((balance: bigint) => Number(balance));
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 batch balances: ${error.message}`);
      throw error;
    }
  }

  async getOwnerTokens(collectionAddress: string, owner: string, tokenIds?: string[]): Promise<Array<{
    tokenId: string;
    balance: number;
    token: NFTToken | null;
  }>> {
    try {
      if (!tokenIds || tokenIds.length === 0) {
        this.agent.emit('warn', 'ERC1155 requires specific token IDs to check balances');
        return [];
      }

      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      const accounts = new Array(tokenIds.length).fill(owner);
      const balances = await contract.balanceOfBatch(accounts, tokenIds);
      
      const results = [];
      
      for (let i = 0; i < tokenIds.length; i++) {
        const balance = Number(balances[i]);
        
        if (balance > 0) {
          const token = await this.getToken(collectionAddress, tokenIds[i]);
          results.push({
            tokenId: tokenIds[i],
            balance,
            token
          });
        }
      }

      return results;
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 owner tokens: ${error.message}`);
      throw error;
    }
  }

  async transferToken(
    collectionAddress: string,
    options: {
      from: string;
      to: string;
      tokenId: string;
      amount: number;
      data?: string;
    }
  ): Promise<string> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        ERC1155_ABI,
        this.agent.wallet.getEthersSigner()
      );
      
      const data = options.data || '0x';
      const tx = await contract.safeTransferFrom(
        options.from,
        options.to,
        options.tokenId,
        options.amount,
        data
      );
      
      const receipt = await tx.wait();
      
      this.agent.emit('info', 
        `ERC1155 token ${options.tokenId} (${options.amount}) transferred from ${options.from} to ${options.to}`
      );
      
      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to transfer ERC1155 token: ${error.message}`);
      throw error;
    }
  }

  async batchTransfer(collectionAddress: string, options: NFTBatchTransferOptions): Promise<string> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        ERC1155_ABI,
        this.agent.wallet.getEthersSigner()
      );
      
      const amounts = options.amounts || new Array(options.tokenIds.length).fill(1);
      const data = options.data || '0x';
      
      if (options.tokenIds.length !== amounts.length) {
        throw new Error('Token IDs and amounts arrays must have the same length');
      }
      
      const tx = await contract.safeBatchTransferFrom(
        options.from,
        options.to,
        options.tokenIds,
        amounts,
        data
      );
      
      const receipt = await tx.wait();
      
      this.agent.emit('info', 
        `ERC1155 batch transfer of ${options.tokenIds.length} tokens from ${options.from} to ${options.to}`
      );
      
      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to batch transfer ERC1155 tokens: ${error.message}`);
      throw error;
    }
  }

  async setApprovalForAll(collectionAddress: string, operator: string, approved: boolean): Promise<string> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        ERC1155_ABI,
        this.agent.wallet.getEthersSigner()
      );
      
      const tx = await contract.setApprovalForAll(operator, approved);
      const receipt = await tx.wait();
      
      this.agent.emit('info', `Set ERC1155 approval for all tokens to ${operator}: ${approved}`);
      
      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to set ERC1155 approval for all: ${error.message}`);
      throw error;
    }
  }

  async isApprovedForAll(collectionAddress: string, account: string, operator: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      return await contract.isApprovedForAll(account, operator);
    } catch (error) {
      this.agent.emit('error', `Failed to check ERC1155 approval for all: ${error.message}`);
      throw error;
    }
  }

  async getTotalSupply(collectionAddress: string, tokenId: string): Promise<number> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      const supply = await contract.totalSupply(tokenId);
      return Number(supply);
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 total supply: ${error.message}`);
      throw error;
    }
  }

  async exists(collectionAddress: string, tokenId: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      return await contract.exists(tokenId);
    } catch (error) {
      this.agent.emit('error', `Failed to check if ERC1155 token exists: ${error.message}`);
      throw error;
    }
  }

  async getTransferHistory(
    collectionAddress: string, 
    tokenId?: string, 
    fromBlock = 0
  ): Promise<NFTTransfer[]> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      
      const singleFilter = tokenId 
        ? contract.filters.TransferSingle(null, null, null, tokenId, null)
        : contract.filters.TransferSingle(null, null, null, null, null);
      
      const batchFilter = contract.filters.TransferBatch(null, null, null, null, null);
      
      const [singleEvents, batchEvents] = await Promise.all([
        contract.queryFilter(singleFilter, fromBlock),
        contract.queryFilter(batchFilter, fromBlock)
      ]);
      
      const transfers: NFTTransfer[] = [];
      
      singleEvents.forEach(event => {
        transfers.push({
          from: event.args.from,
          to: event.args.to,
          tokenId: event.args.id.toString(),
          collection: collectionAddress,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: new Date().toISOString(),
          value: event.args.value.toString()
        });
      });
      
      batchEvents.forEach(event => {
        const ids = event.args.ids;
        const values = event.args.values;
        
        for (let i = 0; i < ids.length; i++) {
          if (!tokenId || ids[i].toString() === tokenId) {
            transfers.push({
              from: event.args.from,
              to: event.args.to,
              tokenId: ids[i].toString(),
              collection: collectionAddress,
              transactionHash: event.transactionHash,
              blockNumber: event.blockNumber,
              timestamp: new Date().toISOString(),
              value: values[i].toString()
            });
          }
        }
      });
      
      return transfers.sort((a, b) => a.blockNumber - b.blockNumber);
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 transfer history: ${error.message}`);
      throw error;
    }
  }

  async batchGetTokens(collectionAddress: string, tokenIds: string[]): Promise<(NFTToken | null)[]> {
    const promises = tokenIds.map(tokenId => 
      this.getToken(collectionAddress, tokenId).catch(() => null)
    );
    
    return await Promise.all(promises);
  }

  async getCollectionStats(collectionAddress: string, tokenIds?: string[]): Promise<{
    tokenCount: number;
    totalSupply: number;
    uniqueHolders: number;
    transferCount: number;
  }> {
    try {
      if (!tokenIds || tokenIds.length === 0) {
        this.agent.emit('warn', 'ERC1155 collection stats require specific token IDs');
        return {
          tokenCount: 0,
          totalSupply: 0,
          uniqueHolders: 0,
          transferCount: 0
        };
      }

      const transfers = await this.getTransferHistory(collectionAddress);
      const uniqueHolders = new Set();
      let totalSupply = 0;

      for (const tokenId of tokenIds) {
        const supply = await this.getTotalSupply(collectionAddress, tokenId);
        totalSupply += supply;
      }

      transfers.forEach(transfer => {
        if (transfer.to !== '0x0000000000000000000000000000000000000000') {
          uniqueHolders.add(transfer.to);
        }
      });

      return {
        tokenCount: tokenIds.length,
        totalSupply,
        uniqueHolders: uniqueHolders.size,
        transferCount: transfers.length
      };
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 collection stats: ${error.message}`);
      throw error;
    }
  }

  async getTokensByOwner(
    collectionAddress: string, 
    owner: string, 
    knownTokenIds: string[]
  ): Promise<Array<{ tokenId: string; balance: number }>> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC1155_ABI, this.provider);
      const accounts = new Array(knownTokenIds.length).fill(owner);
      const balances = await contract.balanceOfBatch(accounts, knownTokenIds);
      
      return knownTokenIds
        .map((tokenId, index) => ({
          tokenId,
          balance: Number(balances[index])
        }))
        .filter(item => item.balance > 0);
    } catch (error) {
      this.agent.emit('error', `Failed to get ERC1155 tokens by owner: ${error.message}`);
      throw error;
    }
  }
}