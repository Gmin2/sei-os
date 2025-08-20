export { ERC721Agent } from './erc721-agent';
export { ERC1155Agent } from './erc1155-agent';
export { MarketplaceAgent } from './marketplace-agent';

export * from './types';

export {
  NFTMetadata,
  NFTCollection,
  NFTToken,
  NFTTransfer,
  NFTListingData,
  NFTSaleData,
  NFTMarketplaceStats,
  PointerBridgeInfo,
  NFTMintOptions,
  NFTTransferOptions,
  NFTApprovalOptions,
  NFTBatchTransferOptions
} from './types';

import { SeiAgent } from '@sei-code/core';
import { SeiWallet } from '@sei-code/wallets';
import { ERC721Agent } from './erc721-agent';
import { ERC1155Agent } from './erc1155-agent';
import { MarketplaceAgent } from './marketplace-agent';

export class NFTAgent {
  public erc721: ERC721Agent;
  public erc1155: ERC1155Agent;
  public marketplace: MarketplaceAgent;

  constructor(agent: SeiAgent, wallet: SeiWallet) {
    this.erc721 = new ERC721Agent(agent, wallet);
    this.erc1155 = new ERC1155Agent(agent, wallet);
    this.marketplace = new MarketplaceAgent(agent, wallet);
  }

  async createCW721Pointer(cw721Address: string, gasFee = '0.01') {
    return this.erc721.createPointer(cw721Address, gasFee);
  }

  async getCW721Pointer(cw721Address: string) {
    return this.erc721.getPointer(cw721Address);
  }

  async getOrCreateCW721Pointer(cw721Address: string, gasFee = '0.01') {
    return this.erc721.getOrCreatePointer(cw721Address, gasFee);
  }

  async getNFT(collectionAddress: string, tokenId: string) {
    try {
      return await this.erc721.getToken(collectionAddress, tokenId);
    } catch (error) {
      return await this.erc1155.getToken(collectionAddress, tokenId);
    }
  }

  async getCollection(collectionAddress: string) {
    try {
      return await this.erc721.getCollection(collectionAddress);
    } catch (error) {
      return await this.erc1155.getCollection(collectionAddress);
    }
  }

  async transferNFT(
    collectionAddress: string,
    options: {
      from: string;
      to: string;
      tokenId: string;
      amount?: number;
      data?: string;
    }
  ) {
    if (options.amount && options.amount > 1) {
      return this.erc1155.transferToken(collectionAddress, {
        from: options.from,
        to: options.to,
        tokenId: options.tokenId,
        amount: options.amount,
        data: options.data
      });
    } else {
      return this.erc721.transferToken({
        from: options.from,
        to: options.to,
        tokenId: options.tokenId
      });
    }
  }

  async listForSale(
    marketplaceName: string,
    nftContract: string,
    tokenId: string,
    price: string
  ) {
    return this.marketplace.createListing(marketplaceName, nftContract, tokenId, price);
  }

  async buyNFT(
    marketplaceName: string,
    nftContract: string,
    tokenId: string,
    maxPrice?: string
  ) {
    return this.marketplace.buyItem(marketplaceName, nftContract, tokenId, maxPrice);
  }

  async findBestPrice(nftContract: string, tokenId: string) {
    return this.marketplace.findBestPrice(nftContract, tokenId);
  }
}