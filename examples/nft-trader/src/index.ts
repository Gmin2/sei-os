import 'dotenv/config';
import { NFTAgent } from './agents/nft-agent.js';
import { MarketplaceMonitor } from './services/marketplace-monitor.js';
import { PriceAnalyzer } from './services/price-analyzer.js';
import { TradingStrategy } from './services/trading-strategy.js';
import { NotificationService } from './services/notification-service.js';

async function main() {
  console.log('🎨 Starting Sei NFT Trading Agent...');

  try {
    // Initialize services
    const notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN!,
      chatId: process.env.TELEGRAM_CHAT_ID!,
      enableWebhooks: process.env.ENABLE_WEBHOOKS === 'true'
    });

    const marketplaceMonitor = new MarketplaceMonitor({
      network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet',
      updateInterval: parseInt(process.env.MARKETPLACE_UPDATE_INTERVAL || '300000'), // 5 minutes
      monitoredMarketplaces: ['Pallet', 'Dagora', 'yieldmos'],
      priceThresholds: {
        highValue: parseFloat(process.env.HIGH_VALUE_THRESHOLD || '1000'), // 1000 SEI
        mediumValue: parseFloat(process.env.MEDIUM_VALUE_THRESHOLD || '100'), // 100 SEI
        dealThreshold: parseFloat(process.env.DEAL_THRESHOLD || '0.8') // 80% of floor price
      }
    });

    const priceAnalyzer = new PriceAnalyzer({
      network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet',
      historicalDataDepth: parseInt(process.env.HISTORICAL_DATA_DEPTH || '30'), // 30 days
      trendAnalysisEnabled: true,
      rarityWeighting: true
    });

    const tradingStrategy = new TradingStrategy({
      network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet',
      autoTradingEnabled: process.env.AUTO_TRADING_ENABLED === 'true',
      maxInvestmentPerNFT: parseFloat(process.env.MAX_INVESTMENT_PER_NFT || '500'), // 500 SEI max
      profitTargetPercentage: parseFloat(process.env.PROFIT_TARGET_PERCENTAGE || '50'), // 50% profit target
      maxHoldingPeriod: parseInt(process.env.MAX_HOLDING_PERIOD || '2592000000'), // 30 days in ms
      riskTolerance: process.env.RISK_TOLERANCE as 'low' | 'medium' | 'high' || 'medium'
    });

    // Initialize NFT agent
    const nftAgent = new NFTAgent({
      name: 'Sei NFT Trading Assistant',
      description: 'AI-powered NFT trading and collection management',
      walletConfig: {
        type: process.env.WALLET_TYPE as 'metamask' | 'sei-global' || 'metamask',
        privateKey: process.env.PRIVATE_KEY,
        network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet'
      },
      modelConfig: {
        provider: process.env.MODEL_PROVIDER as 'gemini' | 'claude' | 'openai' || 'gemini',
        apiKey: process.env.GEMINI_API_KEY || process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY!
      },
      services: {
        marketplace: marketplaceMonitor,
        pricing: priceAnalyzer,
        trading: tradingStrategy,
        notification: notificationService
      },
      tradingPreferences: {
        focusCollections: process.env.FOCUS_COLLECTIONS?.split(',') || ['sei-apes', 'sei-bears'],
        avoidCollections: process.env.AVOID_COLLECTIONS?.split(',') || [],
        favoriteTraits: process.env.FAVORITE_TRAITS?.split(',') || [],
        maxFloorPriceMultiplier: parseFloat(process.env.MAX_FLOOR_PRICE_MULTIPLIER || '3') // Max 3x floor price
      }
    });

    await nftAgent.initialize();

    // Start NFT market monitoring and trading
    console.log('✅ Agent initialized successfully');
    console.log('🎨 Starting NFT market monitoring...');
    
    await nftAgent.startTrading();

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down NFT agent...');
      await nftAgent.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start NFT agent:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);