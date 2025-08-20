import { SeiAgent, AgentCapability } from '@sei-code/core';
import { SeiWallet } from '@sei-code/wallets';
import { TransactionBuilder } from '@sei-code/transactions';
import { 
  POINTER_PRECOMPILE_ADDRESS, 
  POINTER_PRECOMPILE_ABI,
  POINTERVIEW_PRECOMPILE_ADDRESS,
  POINTERVIEW_PRECOMPILE_ABI 
} from '@sei-js/precompiles';
import { ethers } from 'ethers';
import { 
  NFTCollection, 
  NFTToken, 
  NFTTransfer, 
  PointerBridgeInfo,
  NFTMintOptions,
  NFTTransferOptions,
  NFTApprovalOptions 
} from './types';

const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)'
];

export class ERC721Agent extends AgentCapability {
  private provider: ethers.Provider;
  private pointerContract: ethers.Contract;
  private pointerviewContract: ethers.Contract;

  constructor(agent: SeiAgent, wallet: SeiWallet) {
    super('erc721', agent);
    
    this.provider = wallet.getEthersProvider();
    this.pointerContract = new ethers.Contract(
      POINTER_PRECOMPILE_ADDRESS,
      POINTER_PRECOMPILE_ABI,
      wallet.getEthersSigner()
    );
    this.pointerviewContract = new ethers.Contract(
      POINTERVIEW_PRECOMPILE_ADDRESS,
      POINTERVIEW_PRECOMPILE_ABI,
      this.provider
    );
  }

  async createPointer(cw721Address: string, gasFee = '0.01'): Promise<PointerBridgeInfo> {
    try {
      const tx = await this.pointerContract.addCW721Pointer(cw721Address, {
        value: ethers.parseEther(gasFee)
      });
      
      const receipt = await tx.wait();
      const evmAddress = receipt.logs[0]?.address;
      
      if (!evmAddress) {
        throw new Error('Failed to extract pointer address from transaction receipt');
      }

      return {
        originalAddress: cw721Address,
        evmAddress,
        version: 1,
        exists: true,
        type: 'cw721'
      };
    } catch (error) {
      this.agent.emit('error', `Failed to create CW721 pointer: ${error.message}`);
      throw error;
    }
  }

  async getPointer(cw721Address: string): Promise<PointerBridgeInfo | null> {
    try {
      const [addr, version, exists] = await this.pointerviewContract.getCW721Pointer(cw721Address);
      
      if (!exists) {
        return null;
      }

      return {
        originalAddress: cw721Address,
        evmAddress: addr,
        version: Number(version),
        exists: true,
        type: 'cw721'
      };
    } catch (error) {
      this.agent.emit('error', `Failed to get CW721 pointer: ${error.message}`);
      return null;
    }
  }

  async getOrCreatePointer(cw721Address: string, gasFee = '0.01'): Promise<PointerBridgeInfo> {
    const existingPointer = await this.getPointer(cw721Address);
    
    if (existingPointer) {
      this.agent.emit('info', `CW721 pointer already exists at ${existingPointer.evmAddress}`);
      return existingPointer;
    }

    this.agent.emit('info', `Creating new CW721 pointer for ${cw721Address}`);
    return await this.createPointer(cw721Address, gasFee);
  }

  async getCollection(collectionAddress: string): Promise<NFTCollection> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC721_ABI, this.provider);
      
      const [name, symbol, totalSupply] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.totalSupply().catch(() => 0)
      ]);

      return {
        address: collectionAddress,
        name,
        symbol,
        type: 'erc721',
        totalSupply: Number(totalSupply)
      };
    } catch (error) {
      this.agent.emit('error', `Failed to get collection info: ${error.message}`);
      throw error;
    }
  }

  async getToken(collectionAddress: string, tokenId: string): Promise<NFTToken | null> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC721_ABI, this.provider);
      
      const [owner, tokenUri] = await Promise.all([
        contract.ownerOf(tokenId),
        contract.tokenURI(tokenId).catch(() => null)
      ]);

      let metadata = null;
      if (tokenUri) {
        try {
          const response = await fetch(tokenUri);
          if (response.ok) {
            metadata = await response.json();
          }
        } catch (error) {
          this.agent.emit('warn', `Failed to fetch metadata from ${tokenUri}: ${error.message}`);
        }
      }

      return {
        collection: collectionAddress,
        tokenId,
        owner,
        tokenUri: tokenUri || undefined,
        metadata
      };
    } catch (error) {
      if (error.message.includes('nonexistent token')) {
        return null;
      }
      this.agent.emit('error', `Failed to get token: ${error.message}`);
      throw error;
    }
  }

  async getOwnerTokens(collectionAddress: string, owner: string): Promise<NFTToken[]> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC721_ABI, this.provider);
      const balance = await contract.balanceOf(owner);
      
      if (balance === 0n) {
        return [];
      }

      const tokens: NFTToken[] = [];
      
      for (let i = 0; i < Number(balance); i++) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(owner, i);
          const token = await this.getToken(collectionAddress, tokenId.toString());
          
          if (token) {
            tokens.push(token);
          }
        } catch (error) {
          this.agent.emit('warn', `Failed to get token at index ${i}: ${error.message}`);
        }
      }

      return tokens;
    } catch (error) {
      this.agent.emit('error', `Failed to get owner tokens: ${error.message}`);
      throw error;
    }
  }

  async transferToken(options: NFTTransferOptions): Promise<string> {
    try {
      const txBuilder = new TransactionBuilder(this.agent.wallet);
      
      const contract = new ethers.Contract(
        options.tokenId, 
        ERC721_ABI, 
        this.agent.wallet.getEthersSigner()
      );
      
      const tx = await contract.transferFrom(options.from, options.to, options.tokenId);
      const receipt = await tx.wait();
      
      this.agent.emit('info', `NFT ${options.tokenId} transferred from ${options.from} to ${options.to}`);
      
      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to transfer NFT: ${error.message}`);
      throw error;
    }
  }

  async approveToken(collectionAddress: string, options: NFTApprovalOptions): Promise<string> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        ERC721_ABI,
        this.agent.wallet.getEthersSigner()
      );
      
      const tx = await contract.approve(options.to, options.tokenId);
      const receipt = await tx.wait();
      
      this.agent.emit('info', `NFT ${options.tokenId} approved for ${options.to}`);
      
      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to approve NFT: ${error.message}`);
      throw error;
    }
  }

  async setApprovalForAll(collectionAddress: string, operator: string, approved: boolean): Promise<string> {
    try {
      const contract = new ethers.Contract(
        collectionAddress,
        ERC721_ABI,
        this.agent.wallet.getEthersSigner()
      );
      
      const tx = await contract.setApprovalForAll(operator, approved);
      const receipt = await tx.wait();
      
      this.agent.emit('info', `Set approval for all NFTs to ${operator}: ${approved}`);
      
      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to set approval for all: ${error.message}`);
      throw error;
    }
  }

  async getApproved(collectionAddress: string, tokenId: string): Promise<string> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC721_ABI, this.provider);
      return await contract.getApproved(tokenId);
    } catch (error) {
      this.agent.emit('error', `Failed to get approved address: ${error.message}`);
      throw error;
    }
  }

  async isApprovedForAll(collectionAddress: string, owner: string, operator: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC721_ABI, this.provider);
      return await contract.isApprovedForAll(owner, operator);
    } catch (error) {
      this.agent.emit('error', `Failed to check approval for all: ${error.message}`);
      throw error;
    }
  }

  async getTransferHistory(collectionAddress: string, tokenId?: string, fromBlock = 0): Promise<NFTTransfer[]> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC721_ABI, this.provider);
      
      const filter = tokenId 
        ? contract.filters.Transfer(null, null, tokenId)
        : contract.filters.Transfer(null, null, null);
      
      const events = await contract.queryFilter(filter, fromBlock);
      
      return events.map(event => ({
        from: event.args.from,
        to: event.args.to,
        tokenId: event.args.tokenId.toString(),
        collection: collectionAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      this.agent.emit('error', `Failed to get transfer history: ${error.message}`);
      throw error;
    }
  }

  async validateTokenId(collectionAddress: string, tokenId: string): Promise<boolean> {
    try {
      const token = await this.getToken(collectionAddress, tokenId);
      return token !== null;
    } catch (error) {
      return false;
    }
  }

  async batchGetTokens(collectionAddress: string, tokenIds: string[]): Promise<(NFTToken | null)[]> {
    const promises = tokenIds.map(tokenId => 
      this.getToken(collectionAddress, tokenId).catch(() => null)
    );
    
    return await Promise.all(promises);
  }

  async getCollectionStats(collectionAddress: string): Promise<{
    totalSupply: number;
    uniqueOwners: number;
    transferCount: number;
  }> {
    try {
      const contract = new ethers.Contract(collectionAddress, ERC721_ABI, this.provider);
      const totalSupply = await contract.totalSupply().catch(() => 0);
      
      const transfers = await this.getTransferHistory(collectionAddress);
      const uniqueOwners = new Set(transfers.map(t => t.to)).size;
      
      return {
        totalSupply: Number(totalSupply),
        uniqueOwners,
        transferCount: transfers.length
      };
    } catch (error) {
      this.agent.emit('error', `Failed to get collection stats: ${error.message}`);
      throw error;
    }
  }
}