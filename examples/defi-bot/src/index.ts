import 'dotenv/config';
import { DeFiAgent } from './agents/defi-agent.js';
import { PortfolioManager } from './services/portfolio-manager.js';
import { TradingEngine } from './services/trading-engine.js';
import { RiskManager } from './services/risk-manager.js';
import { NotificationService } from './services/notification-service.js';

async function main() {
  console.log('💼 Starting Sei DeFi Portfolio Manager Bot...');

  try {
    // Initialize services
    const notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN!,
      chatId: process.env.TELEGRAM_CHAT_ID!,
      enableWebhooks: process.env.ENABLE_WEBHOOKS === 'true'
    });

    const portfolioManager = new PortfolioManager({
      network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet',
      updateInterval: parseInt(process.env.PORTFOLIO_UPDATE_INTERVAL || '300000'), // 5 minutes
      trackingEnabled: true
    });

    const riskManager = new RiskManager({
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '0.1'), // 10% max position
      stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '5'), // 5% stop loss
      takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '20'), // 20% take profit
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '2') // 2% max daily loss
    });

    const tradingEngine = new TradingEngine({
      network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet',
      autoTradingEnabled: process.env.AUTO_TRADING_ENABLED === 'true',
      slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '1'), // 1%
      gasMultiplier: parseFloat(process.env.GAS_MULTIPLIER || '1.2') // 120% of estimated gas
    });

    // Initialize DeFi agent
    const defiAgent = new DeFiAgent({
      name: 'Sei DeFi Portfolio Manager',
      description: 'AI-powered DeFi portfolio management and optimization',
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
        portfolio: portfolioManager,
        trading: tradingEngine,
        risk: riskManager,
        notification: notificationService
      },
      strategies: {
        rebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD || '5'), // 5%
        yieldFarmingEnabled: process.env.YIELD_FARMING_ENABLED === 'true',
        arbitrageEnabled: process.env.ARBITRAGE_ENABLED === 'true'
      }
    });

    await defiAgent.initialize();

    // Start portfolio monitoring and management
    console.log('✅ Agent initialized successfully');
    console.log('📊 Starting portfolio monitoring...');
    
    await defiAgent.startManagement();

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down DeFi agent...');
      await defiAgent.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start DeFi agent:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);