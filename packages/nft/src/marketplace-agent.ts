import { SeiAgent, BaseCapability } from '@sei-code/core';
import { SeiWallet } from '@sei-code/wallets';
import { TransactionBuilder } from '@sei-code/transactions';
import { ethers } from 'ethers';
import { 
  NFTListingData, 
  NFTSaleData, 
  NFTMarketplaceStats,
  NFTToken,
  NFTCollection
} from './types';

interface MarketplaceConfig {
  name: string;
  contractAddress: string;
  abi: any[];
  feePercentage: number;
  supportedTokenTypes: ('erc721' | 'erc1155')[];
}

const GENERIC_MARKETPLACE_ABI = [
  'function createListing(address nftContract, uint256 tokenId, uint256 price, address paymentToken)',
  'function buyItem(address nftContract, uint256 tokenId)',
  'function cancelListing(address nftContract, uint256 tokenId)',
  'function updateListingPrice(address nftContract, uint256 tokenId, uint256 newPrice)',
  'function getListing(address nftContract, uint256 tokenId) view returns (tuple(address seller, uint256 price, address paymentToken, bool active))',
  'function getMarketplaceFee() view returns (uint256)',
  'function getListingsByCollection(address nftContract) view returns (tuple(uint256 tokenId, address seller, uint256 price, address paymentToken, bool active)[])',
  'event ItemListed(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price, address paymentToken)',
  'event ItemSold(address indexed nftContract, uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)',
  'event ListingCancelled(address indexed nftContract, uint256 indexed tokenId, address indexed seller)',
  'event ListingUpdated(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 newPrice)'
];

export class MarketplaceAgent extends BaseCapability {
  private provider: ethers.Provider;
  private marketplaces: Map<string, MarketplaceConfig> = new Map();
  private wallet: SeiWallet;
  private agent: SeiAgent;

  constructor(agent: SeiAgent, wallet: SeiWallet) {
    super('marketplace', 'NFT marketplace operations and trading');
    this.agent = agent;
    this.wallet = wallet;
    this.provider = wallet.getEthersProvider();
    this.initializeDefaultMarketplaces();
  }

  async execute(params: any): Promise<any> {
    const { action, ...args } = params;
    
    switch (action) {
      case 'createListing':
        return this.createListing(args.marketplace, args.nftContract, args.tokenId, args.price, args.paymentToken);
      case 'buyItem':
        return this.buyItem(args.marketplace, args.nftContract, args.tokenId);
      case 'cancelListing':
        return this.cancelListing(args.marketplace, args.nftContract, args.tokenId);
      case 'getListings':
        return this.getCollectionListings(args.marketplace, args.nftContract);
      case 'getMarketplaceStats':
        return this.getMarketplaceStats(args.marketplace, args.nftContract);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private initializeDefaultMarketplaces() {
    this.addMarketplace({
      name: 'Sei NFT Marketplace',
      contractAddress: '0x0000000000000000000000000000000000000000',
      abi: GENERIC_MARKETPLACE_ABI,
      feePercentage: 2.5,
      supportedTokenTypes: ['erc721', 'erc1155']
    });
  }

  addMarketplace(config: MarketplaceConfig) {
    this.marketplaces.set(config.name, config);
    this.agent.emit('info', `Added marketplace: ${config.name}`);
  }

  getMarketplace(name: string): MarketplaceConfig | undefined {
    return this.marketplaces.get(name);
  }

  getAvailableMarketplaces(): string[] {
    return Array.from(this.marketplaces.keys());
  }

  async createListing(
    marketplaceName: string,
    nftContract: string,
    tokenId: string,
    price: string,
    paymentToken = '0x0000000000000000000000000000000000000000'
  ): Promise<string> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.wallet.getEthersSigner()
      );

      const priceWei = ethers.parseEther(price);
      const tx = await contract.createListing(nftContract, tokenId, priceWei, paymentToken);
      const receipt = await tx.wait();

      this.agent.emit('info', 
        `Listed NFT ${tokenId} from collection ${nftContract} for ${price} on ${marketplaceName}`
      );

      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to create listing: ${error.message}`);
      throw error;
    }
  }

  async buyItem(
    marketplaceName: string,
    nftContract: string,
    tokenId: string,
    maxPrice?: string
  ): Promise<string> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.wallet.getEthersSigner()
      );

      const listing = await this.getListing(marketplaceName, nftContract, tokenId);
      if (!listing || listing.status !== 'active') {
        throw new Error('Item is not listed for sale');
      }

      if (maxPrice) {
        const maxPriceWei = ethers.parseEther(maxPrice);
        const listingPriceWei = ethers.parseEther(listing.price);
        
        if (listingPriceWei > maxPriceWei) {
          throw new Error(`Listing price ${listing.price} exceeds maximum ${maxPrice}`);
        }
      }

      const priceWei = ethers.parseEther(listing.price);
      const tx = await contract.buyItem(nftContract, tokenId, { value: priceWei });
      const receipt = await tx.wait();

      this.agent.emit('info', 
        `Purchased NFT ${tokenId} from collection ${nftContract} for ${listing.price} on ${marketplaceName}`
      );

      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to buy item: ${error.message}`);
      throw error;
    }
  }

  async cancelListing(
    marketplaceName: string,
    nftContract: string,
    tokenId: string
  ): Promise<string> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.wallet.getEthersSigner()
      );

      const tx = await contract.cancelListing(nftContract, tokenId);
      const receipt = await tx.wait();

      this.agent.emit('info', 
        `Cancelled listing for NFT ${tokenId} from collection ${nftContract} on ${marketplaceName}`
      );

      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to cancel listing: ${error.message}`);
      throw error;
    }
  }

  async updateListingPrice(
    marketplaceName: string,
    nftContract: string,
    tokenId: string,
    newPrice: string
  ): Promise<string> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.wallet.getEthersSigner()
      );

      const newPriceWei = ethers.parseEther(newPrice);
      const tx = await contract.updateListingPrice(nftContract, tokenId, newPriceWei);
      const receipt = await tx.wait();

      this.agent.emit('info', 
        `Updated listing price for NFT ${tokenId} to ${newPrice} on ${marketplaceName}`
      );

      return receipt.hash;
    } catch (error) {
      this.agent.emit('error', `Failed to update listing price: ${error.message}`);
      throw error;
    }
  }

  async getListing(
    marketplaceName: string,
    nftContract: string,
    tokenId: string
  ): Promise<NFTListingData | null> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.provider
      );

      const listing = await contract.getListing(nftContract, tokenId);
      
      if (!(listing as any).active) {
        return null;
      }

      return {
        tokenId,
        collection: nftContract,
        seller: listing.seller,
        price: ethers.formatEther(listing.price),
        currency: listing.paymentToken === '0x0000000000000000000000000000000000000000' ? 'SEI' : listing.paymentToken,
        marketplace: marketplaceName,
        listedAt: new Date().toISOString(),
        status: 'active'
      };
    } catch (error) {
      this.agent.emit('error', `Failed to get listing: ${error.message}`);
      return null;
    }
  }

  async getCollectionListings(
    marketplaceName: string,
    nftContract: string
  ): Promise<NFTListingData[]> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.provider
      );

      const listings = await contract.getListingsByCollection(nftContract);
      
      return listings
        .filter((listing: any) => (listing as any).active)
        .map((listing: any) => ({
          tokenId: listing.tokenId.toString(),
          collection: nftContract,
          seller: listing.seller,
          price: ethers.formatEther(listing.price),
          currency: listing.paymentToken === '0x0000000000000000000000000000000000000000' ? 'SEI' : listing.paymentToken,
          marketplace: marketplaceName,
          listedAt: new Date().toISOString(),
          status: 'active' as const
        }));
    } catch (error) {
      this.agent.emit('error', `Failed to get collection listings: ${error.message}`);
      return [];
    }
  }

  async getMarketplaceStats(
    marketplaceName: string,
    nftContract: string,
    fromBlock = 0
  ): Promise<NFTMarketplaceStats> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.provider
      );

      const [saleEvents, listingEvents] = await Promise.all([
        contract.queryFilter(contract.filters.ItemSold(nftContract, null, null, null, null), fromBlock),
        contract.queryFilter(contract.filters.ItemListed(nftContract, null, null, null, null), fromBlock)
      ]);

      let totalVolume = 0n;
      let floorPrice: string | undefined;
      const prices: bigint[] = [];
      const owners = new Set<string>();

      saleEvents.forEach((event: any) => {
        totalVolume += event.args.price;
        prices.push(event.args.price);
        owners.add(event.args.buyer);
      });

      const activeListings = await this.getCollectionListings(marketplaceName, nftContract);
      const listingPrices = activeListings.map(listing => ethers.parseEther(listing.price));
      
      if (listingPrices.length > 0) {
        const minPrice = listingPrices.reduce((min, price) => price < min ? price : min);
        floorPrice = ethers.formatEther(minPrice);
      }

      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      const recent24hSales = saleEvents.filter((event: any) => {
        return event.blockNumber > (fromBlock + 1000);
      });

      return {
        collection: nftContract,
        floorPrice,
        totalVolume: ethers.formatEther(totalVolume),
        volumeChange24h: '0',
        owners: owners.size,
        totalSupply: 0,
        listedCount: activeListings.length,
        salesCount24h: recent24hSales.length
      };
    } catch (error) {
      this.agent.emit('error', `Failed to get marketplace stats: ${error.message}`);
      throw error;
    }
  }

  async getSalesHistory(
    marketplaceName: string,
    nftContract: string,
    tokenId?: string,
    fromBlock = 0
  ): Promise<NFTSaleData[]> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.provider
      );

      const filter = tokenId 
        ? contract.filters.ItemSold(nftContract, tokenId, null, null, null)
        : contract.filters.ItemSold(nftContract, null, null, null, null);

      const events = await contract.queryFilter(filter, fromBlock);

      return events.map((event: any) => ({
        tokenId: event.args.tokenId.toString(),
        collection: nftContract,
        seller: event.args.seller,
        buyer: event.args.buyer,
        price: ethers.formatEther(event.args.price),
        currency: 'SEI',
        marketplace: marketplaceName,
        soldAt: new Date().toISOString(),
        transactionHash: event.transactionHash
      }));
    } catch (error) {
      this.agent.emit('error', `Failed to get sales history: ${error.message}`);
      return [];
    }
  }

  async getListingHistory(
    marketplaceName: string,
    nftContract: string,
    tokenId?: string,
    fromBlock = 0
  ): Promise<NFTListingData[]> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const contract = new ethers.Contract(
        marketplace.contractAddress,
        marketplace.abi,
        this.provider
      );

      const filter = tokenId 
        ? contract.filters.ItemListed(nftContract, tokenId, null, null, null)
        : contract.filters.ItemListed(nftContract, null, null, null, null);

      const events = await contract.queryFilter(filter, fromBlock);

      return events.map((event: any) => ({
        tokenId: event.args.tokenId.toString(),
        collection: nftContract,
        seller: event.args.seller,
        price: ethers.formatEther(event.args.price),
        currency: event.args.paymentToken === '0x0000000000000000000000000000000000000000' ? 'SEI' : event.args.paymentToken,
        marketplace: marketplaceName,
        listedAt: new Date().toISOString(),
        status: 'active' as const
      }));
    } catch (error) {
      this.agent.emit('error', `Failed to get listing history: ${error.message}`);
      return [];
    }
  }

  async findBestPrice(nftContract: string, tokenId: string): Promise<{
    marketplace: string;
    listing: NFTListingData;
  } | null> {
    const allListings: Array<{ marketplace: string; listing: NFTListingData }> = [];

    for (const marketplaceName of this.getAvailableMarketplaces()) {
      try {
        const listing = await this.getListing(marketplaceName, nftContract, tokenId);
        if (listing) {
          allListings.push({ marketplace: marketplaceName, listing });
        }
      } catch (error) {
        this.agent.emit('warn', `Failed to check ${marketplaceName}: ${error.message}`);
      }
    }

    if (allListings.length === 0) {
      return null;
    }

    return allListings.reduce((best, current) => {
      const currentPrice = parseFloat(current.listing.price);
      const bestPrice = parseFloat(best.listing.price);
      return currentPrice < bestPrice ? current : best;
    });
  }

  async batchCreateListings(
    marketplaceName: string,
    listings: Array<{
      nftContract: string;
      tokenId: string;
      price: string;
      paymentToken?: string;
    }>
  ): Promise<string[]> {
    const results: string[] = [];

    for (const listing of listings) {
      try {
        const txHash = await this.createListing(
          marketplaceName,
          listing.nftContract,
          listing.tokenId,
          listing.price,
          listing.paymentToken
        );
        results.push(txHash);
      } catch (error) {
        this.agent.emit('error', `Failed to list ${listing.tokenId}: ${error.message}`);
        results.push('');
      }
    }

    return results;
  }

  async estimateMarketplaceFees(
    marketplaceName: string,
    price: string
  ): Promise<{
    marketplaceFee: string;
    netAmount: string;
    feePercentage: number;
  }> {
    try {
      const marketplace = this.getMarketplace(marketplaceName);
      if (!marketplace) {
        throw new Error(`Marketplace ${marketplaceName} not found`);
      }

      const priceWei = ethers.parseEther(price);
      const feeWei = (priceWei * BigInt(Math.floor(marketplace.feePercentage * 100))) / 10000n;
      const netWei = priceWei - feeWei;

      return {
        marketplaceFee: ethers.formatEther(feeWei),
        netAmount: ethers.formatEther(netWei),
        feePercentage: marketplace.feePercentage
      };
    } catch (error) {
      this.agent.emit('error', `Failed to estimate fees: ${error.message}`);
      throw error;
    }
  }
}