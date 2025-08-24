import { SeiAgent } from '@sei-code/core';
import { MetaMaskWallet, SeiWallet } from '@sei-code/wallets';
import { SeiPrecompileManager } from '@sei-code/precompiles';
import { TransactionBuilder } from '@sei-code/transactions';
import { NFTMarketplaceAgent, NFTCollectionManager } from '@sei-code/nft';
import { AnalyticsAgent } from '@sei-code/analytics';
import { TelegramBot } from '@sei-code/social';
import { GeminiModel, ClaudeModel, OpenAIModel } from '@sei-code/models';
import { X402Agent } from '@sei-code/x402';
import type { MarketplaceMonitor } from '../services/marketplace-monitor.js';
import type { PriceAnalyzer } from '../services/price-analyzer.js';
import type { TradingStrategy } from '../services/trading-strategy.js';
import type { NotificationService } from '../services/notification-service.js';

interface NFTAgentConfig {
  name: string;
  description: string;
  walletConfig: {
    type: 'metamask' | 'sei-global';
    privateKey?: string;
    network: 'testnet' | 'mainnet';
  };
  modelConfig: {
    provider: 'gemini' | 'claude' | 'openai';
    apiKey: string;
  };
  services: {
    marketplace: MarketplaceMonitor;
    pricing: PriceAnalyzer;
    trading: TradingStrategy;
    notification: NotificationService;
  };
  tradingPreferences: {
    focusCollections: string[];
    avoidCollections: string[];
    favoriteTraits: string[];
    maxFloorPriceMultiplier: number;
  };
}

export class NFTAgent {
  private agent: SeiAgent;
  private wallet: SeiWallet | MetaMaskWallet;
  private precompiles: SeiPrecompileManager;
  private transactions: TransactionBuilder;
  private nftMarketplace: NFTMarketplaceAgent;
  private nftCollection: NFTCollectionManager;
  private analytics: AnalyticsAgent;
  private social: TelegramBot;
  private model: GeminiModel | ClaudeModel | OpenAIModel;
  private x402: X402Agent;
  private config: NFTAgentConfig;
  private monitoringInterval: NodeJS.Timer | null = null;
  private isRunning = false;

  constructor(config: NFTAgentConfig) {
    this.config = config;
    this.setupComponents();
  }

  private setupComponents() {
    // Initialize wallet
    if (this.config.walletConfig.type === 'metamask') {
      this.wallet = new MetaMaskWallet({
        privateKey: this.config.walletConfig.privateKey,
        network: this.config.walletConfig.network
      });
    } else {
      this.wallet = new SeiWallet({
        type: 'sei-global',
        network: this.config.walletConfig.network
      });
    }

    // Initialize AI model
    switch (this.config.modelConfig.provider) {
      case 'gemini':
        this.model = new GeminiModel({
          apiKey: this.config.modelConfig.apiKey,
          model: 'gemini-pro'
        });
        break;
      case 'claude':
        this.model = new ClaudeModel({
          apiKey: this.config.modelConfig.apiKey,
          model: 'claude-3-sonnet-20240229'
        });
        break;
      case 'openai':
        this.model = new OpenAIModel({
          apiKey: this.config.modelConfig.apiKey,
          model: 'gpt-4'
        });
        break;
    }

    // Initialize Telegram bot
    this.social = new TelegramBot({
      token: process.env.TELEGRAM_BOT_TOKEN!,
      agent: null // Will be set after agent initialization
    });

    // Initialize main agent
    this.agent = new SeiAgent({
      name: this.config.name,
      description: this.config.description,
      wallet: this.wallet,
      model: this.model,
      capabilities: ['nft', 'analytics', 'social', 'trading'],
      network: this.config.walletConfig.network
    });

    // Set agent reference
    this.social.setAgent(this.agent);

    // Initialize other components
    this.precompiles = new SeiPrecompileManager(this.wallet.getEthersProvider());
    this.transactions = new TransactionBuilder(this.wallet);
    this.nftMarketplace = new NFTMarketplaceAgent(this.agent, this.wallet, this.precompiles);
    this.nftCollection = new NFTCollectionManager(this.agent, this.precompiles);
    this.analytics = new AnalyticsAgent(this.agent, this.precompiles);

    // Initialize X402 for NFT marketplace payments
    this.x402 = new X402Agent(
      this.agent,
      this.wallet,
      {
        network: this.config.walletConfig.network,
        defaultCurrency: 'SEI',
        facilitatorUrl: process.env.X402_FACILITATOR_URL
      },
      {
        enablePayPerUse: true,
        enableSubscriptions: false // Most NFT trades are one-time
      }
    );
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔌 Connecting wallet...');
      await this.wallet.connect();

      console.log('🤖 Setting up agent capabilities...');
      await this.setupCapabilities();

      console.log('📱 Starting Telegram bot...');
      await this.social.start();

      console.log('🎨 Initializing NFT services...');
      await this.config.services.marketplace.initialize();
      await this.config.services.pricing.initialize();
      await this.config.services.trading.initialize(this.wallet, this.nftMarketplace);

      this.agent.emit('info', 'NFT agent initialized successfully');
    } catch (error) {
      this.agent.emit('error', `Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async setupCapabilities(): Promise<void> {
    // NFT collection capabilities
    this.agent.addCapability('getOwnedNFTs', async () => {
      return await this.nftCollection.getOwnedTokens(this.wallet.address);
    });

    this.agent.addCapability('analyzeNFT', async (contractAddress: string, tokenId: string) => {
      const nftData = await this.nftCollection.getTokenMetadata(contractAddress, tokenId);
      const marketData = await this.config.services.pricing.analyzeNFT(contractAddress, tokenId);
      
      const analysis = await this.model.chat(`
        Analyze this NFT and provide investment insights:
        
        Collection: ${nftData.collection?.name}
        Token ID: ${tokenId}
        Traits: ${JSON.stringify(nftData.attributes)}
        Current Price: ${marketData.currentPrice} SEI
        Floor Price: ${marketData.floorPrice} SEI
        Recent Sales: ${marketData.recentSales?.length || 0}
        
        Provide:
        1. Rarity assessment
        2. Price analysis vs floor
        3. Investment recommendation (Buy/Hold/Sell)
        4. Key factors influencing value
      `);
      
      return { nftData, marketData, analysis };
    });

    this.agent.addCapability('findTradingOpportunities', async (maxBudget?: number) => {
      const opportunities = await this.config.services.trading.findOpportunities(maxBudget);
      const analyzed = [];

      for (const opp of opportunities.slice(0, 5)) { // Analyze top 5
        const analysis = await this.model.chat(`
          Quick analysis of this NFT trading opportunity:
          Collection: ${opp.collection}
          Price: ${opp.price} SEI (${opp.percentageUnderFloor}% under floor)
          Traits: ${JSON.stringify(opp.traits)}
          
          Rate this opportunity (1-10) and explain why briefly.
        `);
        
        analyzed.push({ ...opp, aiScore: analysis });
      }

      return analyzed;
    });

    this.agent.addCapability('executeTrade', async (action: 'buy' | 'sell', contractAddress: string, tokenId: string, price?: number) => {
      const validation = await this.config.services.trading.validateTrade({
        action,
        contractAddress,
        tokenId,
        price
      });

      if (!validation.approved) {
        throw new Error(`Trade blocked: ${validation.reason}`);
      }

      let result;
      if (action === 'buy') {
        result = await this.nftMarketplace.buyNFT(contractAddress, tokenId, price?.toString());
      } else {
        result = await this.nftMarketplace.listNFT(contractAddress, tokenId, price?.toString() || '0');
      }

      await this.config.services.notification.sendTradeNotification({
        action,
        contractAddress,
        tokenId,
        price,
        result
      });

      return result;
    });

    this.agent.addCapability('getCollectionAnalytics', async (collectionAddress: string) => {
      return await this.config.services.pricing.getCollectionAnalytics(collectionAddress);
    });

    this.agent.addCapability('setTradingPreferences', async (preferences: any) => {
      this.config.tradingPreferences = { ...this.config.tradingPreferences, ...preferences };
      await this.config.services.trading.updatePreferences(this.config.tradingPreferences);
      
      return { success: true, preferences: this.config.tradingPreferences };
    });

    // Setup Telegram commands
    this.setupTelegramCommands();
  }

  private setupTelegramCommands(): void {
    this.social.onMessage('/collection', async (ctx) => {
      try {
        const owned = await this.agent.executeCapability('getOwnedNFTs');
        
        let message = `🎨 **Your NFT Collection** (${owned.length} items)\\n\\n`;
        
        if (owned.length === 0) {
          message += 'No NFTs found in your wallet.';
        } else {
          // Group by collection
          const byCollection = owned.reduce((acc, nft) => {
            const collection = nft.collection?.name || 'Unknown';
            acc[collection] = (acc[collection] || 0) + 1;
            return acc;
          }, {});

          for (const [collection, count] of Object.entries(byCollection)) {
            message += `**${collection}:** ${count} items\\n`;
          }
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Error fetching collection: ${error.message}`);
      }
    });

    this.social.onMessage('/opportunities', async (ctx) => {
      try {
        ctx.reply('🔍 Searching for trading opportunities...');
        const opportunities = await this.agent.executeCapability('findTradingOpportunities', 1000);
        
        let message = `🎯 **Trading Opportunities**\\n\\n`;
        
        if (opportunities.length === 0) {
          message += 'No opportunities found matching your criteria.';
        } else {
          for (const opp of opportunities.slice(0, 5)) {
            message += `**${opp.collection}** #${opp.tokenId}\\n`;
            message += `• Price: ${opp.price} SEI (${opp.percentageUnderFloor}% under floor)\\n`;
            message += `• AI Score: ${opp.aiScore?.substring(0, 100)}...\\n\\n`;
          }
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Error finding opportunities: ${error.message}`);
      }
    });

    this.social.onMessage('/analyze', async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 3) {
        ctx.reply('Usage: /analyze <contract_address> <token_id>\\nExample: /analyze 0x123... 1');
        return;
      }

      const contractAddress = args[1];
      const tokenId = args[2];

      try {
        ctx.reply('🤖 Analyzing NFT...');
        const analysis = await this.agent.executeCapability('analyzeNFT', contractAddress, tokenId);
        
        let message = `📊 **NFT Analysis**\\n\\n`;
        message += `**Collection:** ${analysis.nftData.collection?.name || 'Unknown'}\\n`;
        message += `**Token ID:** ${tokenId}\\n`;
        message += `**Current Price:** ${analysis.marketData.currentPrice} SEI\\n`;
        message += `**Floor Price:** ${analysis.marketData.floorPrice} SEI\\n\\n`;
        message += `**AI Analysis:**\\n${analysis.analysis}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Analysis failed: ${error.message}`);
      }
    });

    this.social.onMessage('/buy', async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 3) {
        ctx.reply('Usage: /buy <contract_address> <token_id> [max_price]\\nExample: /buy 0x123... 1 100');
        return;
      }

      const contractAddress = args[1];
      const tokenId = args[2];
      const maxPrice = args[3] ? parseFloat(args[3]) : undefined;

      try {
        ctx.reply(`⏳ Attempting to buy NFT #${tokenId}...`);
        const result = await this.agent.executeCapability('executeTrade', 'buy', contractAddress, tokenId, maxPrice);
        
        if (result.success) {
          ctx.reply(`✅ NFT purchased! Transaction: ${result.transactionHash}`);
        } else {
          ctx.reply(`❌ Purchase failed: ${result.error}`);
        }
      } catch (error) {
        ctx.reply(`❌ Trade failed: ${error.message}`);
      }
    });

    this.social.onMessage('/sell', async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 4) {
        ctx.reply('Usage: /sell <contract_address> <token_id> <price>\\nExample: /sell 0x123... 1 150');
        return;
      }

      const contractAddress = args[1];
      const tokenId = args[2];
      const price = parseFloat(args[3]);

      try {
        ctx.reply(`⏳ Listing NFT #${tokenId} for ${price} SEI...`);
        const result = await this.agent.executeCapability('executeTrade', 'sell', contractAddress, tokenId, price);
        
        if (result.success) {
          ctx.reply(`✅ NFT listed for sale! Transaction: ${result.transactionHash}`);
        } else {
          ctx.reply(`❌ Listing failed: ${result.error}`);
        }
      } catch (error) {
        ctx.reply(`❌ Trade failed: ${error.message}`);
      }
    });

    this.social.onMessage('/stats', async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
        ctx.reply('Usage: /stats <collection_address>\\nExample: /stats 0x123...');
        return;
      }

      const collectionAddress = args[1];

      try {
        ctx.reply('📈 Fetching collection analytics...');
        const stats = await this.agent.executeCapability('getCollectionAnalytics', collectionAddress);
        
        let message = `📊 **Collection Analytics**\\n\\n`;
        message += `**Floor Price:** ${stats.floorPrice} SEI\\n`;
        message += `**Volume (24h):** ${stats.volume24h} SEI\\n`;
        message += `**Sales (24h):** ${stats.sales24h}\\n`;
        message += `**Total Supply:** ${stats.totalSupply}\\n`;
        message += `**Owners:** ${stats.uniqueOwners}\\n`;
        message += `**Average Price:** ${stats.averagePrice} SEI\\n\\n`;
        message += `**Trend:** ${stats.trend || 'Stable'}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Error fetching stats: ${error.message}`);
      }
    });

    this.social.onMessage('/preferences', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length === 0) {
        // Show current preferences
        const prefs = this.config.tradingPreferences;
        let message = `⚙️ **Trading Preferences**\\n\\n`;
        message += `**Focus Collections:** ${prefs.focusCollections.join(', ') || 'None'}\\n`;
        message += `**Avoid Collections:** ${prefs.avoidCollections.join(', ') || 'None'}\\n`;
        message += `**Favorite Traits:** ${prefs.favoriteTraits.join(', ') || 'None'}\\n`;
        message += `**Max Floor Price Multiplier:** ${prefs.maxFloorPriceMultiplier}x\\n\\n`;
        message += `Use \`/preferences set <key> <value>\` to update`;
        
        ctx.reply(message, { parse_mode: 'Markdown' });
        return;
      }

      if (args[0] === 'set' && args.length >= 3) {
        const key = args[1];
        const value = args.slice(2).join(' ');
        
        try {
          const updates = {};
          
          if (key === 'focus') {
            updates['focusCollections'] = value.split(',').map(s => s.trim());
          } else if (key === 'avoid') {
            updates['avoidCollections'] = value.split(',').map(s => s.trim());
          } else if (key === 'traits') {
            updates['favoriteTraits'] = value.split(',').map(s => s.trim());
          } else if (key === 'multiplier') {
            updates['maxFloorPriceMultiplier'] = parseFloat(value);
          } else {
            ctx.reply('❌ Unknown preference key. Use: focus, avoid, traits, or multiplier');
            return;
          }
          
          await this.agent.executeCapability('setTradingPreferences', updates);
          ctx.reply(`✅ Preferences updated: ${key} = ${value}`);
        } catch (error) {
          ctx.reply(`❌ Failed to update preferences: ${error.message}`);
        }
      } else {
        ctx.reply('Usage: /preferences or /preferences set <key> <value>');
      }
    });

    this.social.onMessage('/help', async (ctx) => {
      const helpMessage = `
🤖 **NFT Trading Bot Commands:**

*Collection Management:*
/collection - Show your NFT collection
/analyze <contract> <token_id> - Analyze specific NFT

*Trading:*
/opportunities - Find trading opportunities  
/buy <contract> <token_id> [max_price] - Buy NFT
/sell <contract> <token_id> <price> - List NFT for sale

*Analytics:*
/stats <collection_address> - Collection statistics

*Configuration:*
/preferences - Show/update trading preferences

*General:*
/help - Show this help message

**Examples:**
\`/analyze 0x123... 1\`
\`/buy 0x123... 1 100\`
\`/preferences set focus sei-apes,sei-bears\`
      `;
      
      ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });
  }

  async startTrading(): Promise<void> {
    this.isRunning = true;

    // Start market monitoring and trading
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performTradingCycle();
      } catch (error) {
        this.agent.emit('error', `Trading cycle error: ${error.message}`);
      }
    }, 60000); // Every minute

    // Initial trading cycle
    await this.performTradingCycle();
  }

  private async performTradingCycle(): Promise<void> {
    try {
      // Update market data
      await this.config.services.marketplace.updateMarketData();

      // Find new opportunities
      const opportunities = await this.config.services.trading.findOpportunities();
      
      // Notify about high-value opportunities
      for (const opportunity of opportunities) {
        if (opportunity.potentialProfit > 100) { // 100 SEI profit potential
          await this.config.services.notification.sendOpportunityAlert(opportunity);
        }
      }

      // Check for automated trading triggers
      if (process.env.AUTO_TRADING_ENABLED === 'true') {
        await this.executeAutomaticTrades(opportunities);
      }

      // Monitor owned NFTs for selling opportunities
      await this.checkSellingOpportunities();

      // Update analytics
      await this.updateTradingAnalytics();

    } catch (error) {
      this.agent.emit('warn', `Trading cycle failed: ${error.message}`);
    }
  }

  private async executeAutomaticTrades(opportunities: any[]): Promise<void> {
    for (const opportunity of opportunities.slice(0, 3)) { // Max 3 auto-trades per cycle
      try {
        const analysis = await this.model.chat(`
          Should I automatically buy this NFT opportunity?
          Collection: ${opportunity.collection}
          Price: ${opportunity.price} SEI (${opportunity.percentageUnderFloor}% under floor)
          Potential Profit: ${opportunity.potentialProfit} SEI
          Risk Level: ${opportunity.riskLevel}
          
          Consider: budget constraints, market conditions, collection reputation.
          Respond with: YES or NO and brief reason.
        `);

        if (analysis.toLowerCase().includes('yes')) {
          await this.agent.executeCapability('executeTrade', 'buy', opportunity.contractAddress, opportunity.tokenId, opportunity.price);
        }
      } catch (error) {
        this.agent.emit('warn', `Automatic trade failed: ${error.message}`);
      }
    }
  }

  private async checkSellingOpportunities(): Promise<void> {
    try {
      const owned = await this.agent.executeCapability('getOwnedNFTs');
      
      for (const nft of owned) {
        const marketData = await this.config.services.pricing.analyzeNFT(nft.contractAddress, nft.tokenId);
        const profitPotential = await this.config.services.trading.calculateProfitPotential(nft);
        
        if (profitPotential.shouldSell && profitPotential.profitPercentage > 30) { // 30% profit threshold
          await this.config.services.notification.sendSellingRecommendation(nft, profitPotential);
        }
      }
    } catch (error) {
      this.agent.emit('warn', `Selling opportunities check failed: ${error.message}`);
    }
  }

  private async updateTradingAnalytics(): Promise<void> {
    try {
      const portfolio = await this.nftCollection.getOwnedTokens(this.wallet.address);
      const performance = await this.config.services.pricing.calculatePortfolioPerformance(portfolio);
      
      // Store analytics data
      await this.analytics.trackMetrics(this.wallet.address, ['nft_value', 'portfolio_count', 'profit_loss']);
      
    } catch (error) {
      this.agent.emit('warn', `Analytics update failed: ${error.message}`);
    }
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    await this.social.stop();
    await this.wallet.disconnect?.();
    
    this.agent.emit('info', 'NFT agent shutdown complete');
  }
}