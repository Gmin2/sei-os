import { SeiAgent } from '@sei-code/core';
import { MetaMaskWallet, SeiWallet } from '@sei-code/wallets';
import { SeiPrecompileManager } from '@sei-code/precompiles';
import { TransactionBuilder } from '@sei-code/transactions';
import { AnalyticsAgent } from '@sei-code/analytics';
import { TelegramBot } from '@sei-code/social';
import { GeminiModel, ClaudeModel, OpenAIModel } from '@sei-code/models';
import { X402Agent } from '@sei-code/x402';
import type { PortfolioManager } from '../services/portfolio-manager.js';
import type { TradingEngine } from '../services/trading-engine.js';
import type { RiskManager } from '../services/risk-manager.js';
import type { NotificationService } from '../services/notification-service.js';

interface DeFiAgentConfig {
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
    portfolio: PortfolioManager;
    trading: TradingEngine;
    risk: RiskManager;
    notification: NotificationService;
  };
  strategies: {
    rebalanceThreshold: number;
    yieldFarmingEnabled: boolean;
    arbitrageEnabled: boolean;
  };
}

export class DeFiAgent {
  private agent: SeiAgent;
  private wallet: SeiWallet | MetaMaskWallet;
  private precompiles: SeiPrecompileManager;
  private transactions: TransactionBuilder;
  private analytics: AnalyticsAgent;
  private social: TelegramBot;
  private model: GeminiModel | ClaudeModel | OpenAIModel;
  private x402: X402Agent;
  private config: DeFiAgentConfig;
  private managementInterval: NodeJS.Timer | null = null;
  private isRunning = false;

  constructor(config: DeFiAgentConfig) {
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
      capabilities: ['defi', 'analytics', 'social', 'trading'],
      network: this.config.walletConfig.network
    });

    // Set agent reference
    this.social.setAgent(this.agent);

    // Initialize other components
    this.precompiles = new SeiPrecompileManager(this.wallet.getEthersProvider());
    this.transactions = new TransactionBuilder(this.wallet);
    this.analytics = new AnalyticsAgent(this.agent, this.precompiles);

    // Initialize X402 for monetization
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
        enableSubscriptions: true
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

      console.log('📊 Initializing portfolio tracking...');
      await this.config.services.portfolio.initialize(this.wallet.address);

      console.log('⚡ Setting up trading engine...');
      await this.config.services.trading.initialize(this.wallet, this.precompiles);

      this.agent.emit('info', 'DeFi agent initialized successfully');
    } catch (error) {
      this.agent.emit('error', `Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async setupCapabilities(): Promise<void> {
    // Portfolio management capabilities
    this.agent.addCapability('getPortfolioSummary', async () => {
      return await this.config.services.portfolio.getPortfolioSummary();
    });

    this.agent.addCapability('analyzePortfolio', async () => {
      const summary = await this.config.services.portfolio.getPortfolioSummary();
      const analysis = await this.model.chat(`
        Analyze this DeFi portfolio and provide recommendations:
        
        Total Value: ${summary.totalValue} SEI
        Assets: ${summary.assets.length}
        Allocation: ${JSON.stringify(summary.allocation)}
        Performance: ${summary.performance}
        
        Provide:
        1. Portfolio health assessment
        2. Diversification recommendations
        3. Yield optimization suggestions
        4. Risk management advice
      `);
      
      return { summary, analysis };
    });

    this.agent.addCapability('rebalancePortfolio', async (strategy?: string) => {
      const riskCheck = await this.config.services.risk.validateRebalance();
      if (!riskCheck.approved) {
        throw new Error(`Rebalancing blocked: ${riskCheck.reason}`);
      }

      const result = await this.config.services.trading.rebalancePortfolio(strategy);
      
      await this.config.services.notification.sendNotification(
        `📊 Portfolio rebalanced: ${result.transactions.length} transactions executed`,
        { strategy, result }
      );

      return result;
    });

    this.agent.addCapability('executeTradeWithAI', async (intent: string) => {
      const analysis = await this.model.chat(`
        Parse this trading intent and provide structured trade parameters:
        Intent: "${intent}"
        
        Extract:
        - Action (buy/sell)
        - Asset/token
        - Amount or percentage
        - Constraints (slippage, price limits)
        
        Respond in JSON format only.
      `);

      try {
        const tradeParams = JSON.parse(analysis);
        const riskCheck = await this.config.services.risk.validateTrade(tradeParams);
        
        if (!riskCheck.approved) {
          throw new Error(`Trade blocked: ${riskCheck.reason}`);
        }

        return await this.config.services.trading.executeTrade(tradeParams);
      } catch (error) {
        throw new Error(`Trade execution failed: ${error.message}`);
      }
    });

    this.agent.addCapability('getYieldOpportunities', async () => {
      return await this.config.services.portfolio.findYieldOpportunities();
    });

    this.agent.addCapability('optimizeYield', async () => {
      const opportunities = await this.config.services.portfolio.findYieldOpportunities();
      const riskAssessment = await this.config.services.risk.assessYieldRisks(opportunities);
      
      return await this.config.services.trading.optimizeYield(opportunities, riskAssessment);
    });

    // Setup Telegram commands
    this.setupTelegramCommands();
  }

  private setupTelegramCommands(): void {
    this.social.onMessage('/portfolio', async (ctx) => {
      try {
        const summary = await this.agent.executeCapability('getPortfolioSummary');
        
        let message = `💼 **Portfolio Summary**\\n\\n`;
        message += `**Total Value:** ${summary.totalValue} SEI (${summary.totalValueUSD} USD)\\n`;
        message += `**24h Change:** ${summary.dailyChange > 0 ? '📈' : '📉'} ${summary.dailyChange.toFixed(2)}%\\n`;
        message += `**Assets:** ${summary.assets.length}\\n\\n`;
        
        message += `**Top Holdings:**\\n`;
        for (const asset of summary.assets.slice(0, 5)) {
          message += `• ${asset.symbol}: ${asset.balance} (${asset.valueUSD} USD)\\n`;
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Error fetching portfolio: ${error.message}`);
      }
    });

    this.social.onMessage('/analyze', async (ctx) => {
      try {
        ctx.reply('🤖 Analyzing portfolio...');
        const analysis = await this.agent.executeCapability('analyzePortfolio');
        
        let message = `📊 **Portfolio Analysis**\\n\\n`;
        message += `**AI Analysis:**\\n${analysis.analysis}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Analysis failed: ${error.message}`);
      }
    });

    this.social.onMessage('/rebalance', async (ctx) => {
      try {
        ctx.reply('⚖️ Rebalancing portfolio...');
        const result = await this.agent.executeCapability('rebalancePortfolio');
        
        ctx.reply(`✅ Portfolio rebalanced! Executed ${result.transactions.length} trades.`);
      } catch (error) {
        ctx.reply(`❌ Rebalancing failed: ${error.message}`);
      }
    });

    this.social.onMessage('/yield', async (ctx) => {
      try {
        const opportunities = await this.agent.executeCapability('getYieldOpportunities');
        
        let message = `🌾 **Yield Opportunities**\\n\\n`;
        
        if (opportunities.length === 0) {
          message += 'No yield opportunities found at the moment.';
        } else {
          for (const opp of opportunities.slice(0, 5)) {
            message += `**${opp.protocol}**\\n`;
            message += `• Asset: ${opp.asset}\\n`;
            message += `• APY: ${opp.apy}%\\n`;
            message += `• Risk: ${opp.riskLevel}\\n\\n`;
          }
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Error fetching yield opportunities: ${error.message}`);
      }
    });

    this.social.onMessage('/trade', async (ctx) => {
      const intent = ctx.message.text.replace('/trade ', '');
      
      if (intent === '/trade') {
        ctx.reply('Usage: /trade <your trading intent>\\nExample: /trade buy 100 SEI');
        return;
      }

      try {
        ctx.reply(`⏳ Processing trade: "${intent}"...`);
        const result = await this.agent.executeCapability('executeTradeWithAI', intent);
        
        ctx.reply(`✅ Trade executed! Transaction: ${result.transactionHash}`);
      } catch (error) {
        ctx.reply(`❌ Trade failed: ${error.message}`);
      }
    });

    this.social.onMessage('/risk', async (ctx) => {
      try {
        const riskReport = await this.config.services.risk.generateRiskReport();
        
        let message = `⚠️ **Risk Report**\\n\\n`;
        message += `**Overall Risk:** ${riskReport.overallRisk}\\n`;
        message += `**Portfolio Concentration:** ${riskReport.concentrationRisk}\\n`;
        message += `**Daily PnL:** ${riskReport.dailyPnL > 0 ? '📈' : '📉'} ${riskReport.dailyPnL.toFixed(2)}%\\n\\n`;
        
        if (riskReport.alerts.length > 0) {
          message += `**Alerts:**\\n`;
          for (const alert of riskReport.alerts) {
            message += `• ${alert}\\n`;
          }
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Error generating risk report: ${error.message}`);
      }
    });

    this.social.onMessage('/help', async (ctx) => {
      const helpMessage = `
🤖 **DeFi Portfolio Manager Commands:**

*Portfolio Management:*
/portfolio - Show portfolio summary
/analyze - Get AI portfolio analysis
/rebalance - Rebalance portfolio
/yield - Show yield opportunities

*Trading:*
/trade <intent> - Execute trade with AI
Example: \`/trade buy 100 SEI\`

*Risk Management:*
/risk - Show risk report

*General:*
/help - Show this help message

**Natural Language Trading Examples:**
• \`/trade buy some ATOM with 10% of portfolio\`
• \`/trade sell half my SEI position\`
• \`/trade swap 1000 SEI for USDC\`
      `;
      
      ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });
  }

  async startManagement(): Promise<void> {
    this.isRunning = true;

    // Start portfolio monitoring and automatic management
    this.managementInterval = setInterval(async () => {
      try {
        await this.performPeriodicTasks();
      } catch (error) {
        this.agent.emit('error', `Management cycle error: ${error.message}`);
      }
    }, 60000); // Every minute

    // Initial management cycle
    await this.performPeriodicTasks();
  }

  private async performPeriodicTasks(): Promise<void> {
    try {
      // Update portfolio data
      await this.config.services.portfolio.updatePortfolioData();

      // Check risk limits
      const riskCheck = await this.config.services.risk.checkRiskLimits();
      if (riskCheck.violations.length > 0) {
        await this.handleRiskViolations(riskCheck.violations);
      }

      // Check for rebalancing opportunities
      const shouldRebalance = await this.config.services.portfolio.shouldRebalance(
        this.config.strategies.rebalanceThreshold
      );
      
      if (shouldRebalance && this.config.strategies.yieldFarmingEnabled) {
        await this.considerRebalancing();
      }

      // Check yield opportunities
      if (this.config.strategies.yieldFarmingEnabled) {
        await this.checkYieldOptimization();
      }

      // Check arbitrage opportunities
      if (this.config.strategies.arbitrageEnabled) {
        await this.checkArbitrageOpportunities();
      }

    } catch (error) {
      this.agent.emit('warn', `Periodic task failed: ${error.message}`);
    }
  }

  private async handleRiskViolations(violations: any[]): Promise<void> {
    for (const violation of violations) {
      await this.config.services.notification.sendAlert(
        `🚨 Risk Violation: ${violation.type}`,
        violation.message,
        'high'
      );

      // Take automatic protective action if configured
      if (violation.autoAction) {
        await this.executeProtectiveAction(violation.autoAction);
      }
    }
  }

  private async considerRebalancing(): Promise<void> {
    const analysis = await this.model.chat(`
      Should I rebalance the portfolio now? Consider:
      - Current market conditions
      - Recent portfolio performance
      - Risk factors
      
      Respond with YES or NO and brief reasoning.
    `);

    if (analysis.toLowerCase().includes('yes')) {
      try {
        await this.agent.executeCapability('rebalancePortfolio', 'ai-suggested');
      } catch (error) {
        this.agent.emit('warn', `Auto-rebalancing failed: ${error.message}`);
      }
    }
  }

  private async checkYieldOptimization(): Promise<void> {
    const opportunities = await this.config.services.portfolio.findYieldOpportunities();
    const currentYield = await this.config.services.portfolio.getCurrentYield();

    for (const opportunity of opportunities) {
      if (opportunity.apy > currentYield + 2) { // 2% higher APY
        await this.config.services.notification.sendNotification(
          `🌾 High yield opportunity: ${opportunity.protocol} offering ${opportunity.apy}% APY`,
          opportunity
        );
      }
    }
  }

  private async checkArbitrageOpportunities(): Promise<void> {
    // Simple arbitrage detection logic
    // In practice, this would be much more sophisticated
    const opportunities = await this.config.services.trading.findArbitrageOpportunities();
    
    for (const opp of opportunities) {
      if (opp.profitPercentage > 1) { // Minimum 1% profit
        await this.config.services.notification.sendNotification(
          `⚡ Arbitrage opportunity: ${opp.profitPercentage.toFixed(2)}% profit available`,
          opp
        );
      }
    }
  }

  private async executeProtectiveAction(action: any): Promise<void> {
    try {
      switch (action.type) {
        case 'stop_loss':
          await this.config.services.trading.executeTrade({
            action: 'sell',
            asset: action.asset,
            amount: action.amount,
            reason: 'stop_loss'
          });
          break;
        case 'reduce_exposure':
          await this.config.services.trading.reduceExposure(action.asset, action.percentage);
          break;
      }
    } catch (error) {
      this.agent.emit('error', `Protective action failed: ${error.message}`);
    }
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    
    if (this.managementInterval) {
      clearInterval(this.managementInterval);
    }
    
    await this.social.stop();
    await this.wallet.disconnect?.();
    
    this.agent.emit('info', 'DeFi agent shutdown complete');
  }
}