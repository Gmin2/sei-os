export interface NFTMetadata {
  name: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  animation_url?: string;
  youtube_url?: string;
}

export interface NFTCollection {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_link?: string;
  type: 'cw721' | 'erc721';
  totalSupply?: number;
  creator?: string;
  verified?: boolean;
}

export interface NFTToken {
  collection: string;
  tokenId: string;
  owner: string;
  metadata?: NFTMetadata;
  tokenUri?: string;
  lastTransferredAt?: string;
  rarity?: {
    rank: number;
    score: number;
    total: number;
  };
}

export interface NFTTransfer {
  from: string;
  to: string;
  tokenId: string;
  collection: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  value?: string;
}

export interface NFTListingData {
  tokenId: string;
  collection: string;
  seller: string;
  price: string;
  currency: string;
  marketplace: string;
  listedAt: string;
  expiresAt?: string;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
}

export interface NFTSaleData {
  tokenId: string;
  collection: string;
  seller: string;
  buyer: string;
  price: string;
  currency: string;
  marketplace: string;
  soldAt: string;
  transactionHash: string;
}

export interface NFTMarketplaceStats {
  collection: string;
  floorPrice?: string;
  totalVolume: string;
  volumeChange24h: string;
  owners: number;
  totalSupply: number;
  listedCount: number;
  salesCount24h: number;
}

export interface PointerBridgeInfo {
  originalAddress: string;
  evmAddress: string;
  version: number;
  exists: boolean;
  type: 'cw721' | 'native' | 'cw20';
}

export interface NFTMintOptions {
  to: string;
  tokenId?: string;
  tokenUri?: string;
  metadata?: NFTMetadata;
}

export interface NFTTransferOptions {
  from: string;
  to: string;
  tokenId: string;
  data?: string;
}

export interface NFTApprovalOptions {
  to: string;
  tokenId: string;
}

export interface NFTBatchTransferOptions {
  from: string;
  to: string;
  tokenIds: string[];
  amounts?: number[];
  data?: string;
}

export interface NFTAnalytics {
  collection: string;
  totalValue: string;
  floorPriceChange: {
    '24h': number;
    '7d': number;
    '30d': number;
  };
  volumeChange: {
    '24h': number;
    '7d': number;
    '30d': number;
  };
  uniqueHolders: number;
  averageHoldTime: number;
  topTraits: Array<{
    traitType: string;
    value: string;
    count: number;
    rarity: number;
  }>;
}