import { SeiAgent } from '@sei-code/core';
import { MetaMaskWallet, SeiWallet } from '@sei-code/wallets';
import { SeiPrecompileManager } from '@sei-code/precompiles';
import { GovernanceManager } from '@sei-code/governance';
import { TelegramBot } from '@sei-code/social';
import { GeminiModel, ClaudeModel, OpenAIModel } from '@sei-code/models';
import { AnalyticsAgent } from '@sei-code/analytics';
import type { NotificationService } from '../services/notification-service.js';
import type { GovernanceService } from '../services/governance-service.js';
import type { AnalyticsService } from '../services/analytics-service.js';

interface VotingAgentConfig {
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
    notification: NotificationService;
    governance: GovernanceService;
    analytics: AnalyticsService;
  };
}

export class VotingAgent {
  private agent: SeiAgent;
  private wallet: SeiWallet | MetaMaskWallet;
  private precompiles: SeiPrecompileManager;
  private governance: GovernanceManager;
  private social: TelegramBot;
  private model: GeminiModel | ClaudeModel | OpenAIModel;
  private analytics: AnalyticsAgent;
  private config: VotingAgentConfig;
  private monitoringInterval: NodeJS.Timer | null = null;

  constructor(config: VotingAgentConfig) {
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
      capabilities: ['governance', 'analytics', 'social'],
      network: this.config.walletConfig.network
    });

    // Set agent reference in social bot
    this.social.setAgent(this.agent);

    // Initialize precompiles
    this.precompiles = new SeiPrecompileManager(
      this.wallet.getEthersProvider()
    );

    // Initialize governance manager
    this.governance = new GovernanceManager(
      this.agent,
      this.precompiles
    );

    // Initialize analytics
    this.analytics = new AnalyticsAgent(
      this.agent,
      this.precompiles
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

      console.log('🗳️  Initializing governance monitoring...');
      await this.governance.initialize();

      this.agent.emit('info', 'Voting agent initialized successfully');
    } catch (error) {
      this.agent.emit('error', `Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async setupCapabilities(): Promise<void> {
    // Add governance capabilities
    this.agent.addCapability('getProposals', async () => {
      return await this.governance.getActiveProposals();
    });

    this.agent.addCapability('voteOnProposal', async (proposalId: string, vote: 'yes' | 'no' | 'abstain' | 'no_with_veto') => {
      const result = await this.governance.vote(proposalId, vote);
      
      // Send notification
      await this.config.services.notification.sendNotification(
        `✅ Voted ${vote.toUpperCase()} on proposal #${proposalId}`,
        { proposalId, vote, txHash: result.transactionHash }
      );

      return result;
    });

    this.agent.addCapability('analyzeProposal', async (proposalId: string) => {
      const proposal = await this.governance.getProposal(proposalId);
      
      const analysis = await this.model.chat(`
        Analyze this Sei governance proposal and provide recommendations:
        
        Title: ${proposal.title}
        Description: ${proposal.description}
        Type: ${proposal.type}
        Status: ${proposal.status}
        
        Please provide:
        1. Summary of the proposal
        2. Potential impact on the Sei ecosystem
        3. Voting recommendation (Yes/No/Abstain) with reasoning
        4. Key risks and benefits
      `);

      return {
        proposal,
        analysis,
        recommendation: this.extractRecommendation(analysis)
      };
    });

    this.agent.addCapability('getVotingPower', async () => {
      return await this.governance.getVotingPower(this.wallet.address);
    });

    this.agent.addCapability('getDelegations', async () => {
      return await this.precompiles.staking.getDelegations(this.wallet.address);
    });

    // Setup Telegram commands
    this.setupTelegramCommands();
  }

  private setupTelegramCommands(): void {
    this.social.onMessage('/proposals', async (ctx) => {
      try {
        const proposals = await this.governance.getActiveProposals();
        
        if (proposals.length === 0) {
          ctx.reply('📭 No active proposals at the moment.');
          return;
        }

        let message = '🗳️ **Active Governance Proposals:**\\n\\n';
        for (const proposal of proposals.slice(0, 5)) {
          message += `**#${proposal.id}** ${proposal.title}\\n`;
          message += `Status: ${proposal.status}\\n`;
          message += `Voting ends: ${new Date(proposal.votingEndTime).toLocaleString()}\\n\\n`;
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Error fetching proposals: ${error.message}`);
      }
    });

    this.social.onMessage('/vote', async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 3) {
        ctx.reply('Usage: /vote <proposal_id> <yes|no|abstain|no_with_veto>');
        return;
      }

      const proposalId = args[1];
      const vote = args[2].toLowerCase() as 'yes' | 'no' | 'abstain' | 'no_with_veto';

      if (!['yes', 'no', 'abstain', 'no_with_veto'].includes(vote)) {
        ctx.reply('❌ Invalid vote option. Use: yes, no, abstain, or no_with_veto');
        return;
      }

      try {
        ctx.reply(`⏳ Submitting ${vote.toUpperCase()} vote for proposal #${proposalId}...`);
        const result = await this.agent.executeCapability('voteOnProposal', proposalId, vote);
        ctx.reply(`✅ Vote submitted! Transaction: ${result.transactionHash}`);
      } catch (error) {
        ctx.reply(`❌ Vote failed: ${error.message}`);
      }
    });

    this.social.onMessage('/analyze', async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
        ctx.reply('Usage: /analyze <proposal_id>');
        return;
      }

      const proposalId = args[1];
      
      try {
        ctx.reply('🤖 Analyzing proposal...');
        const analysis = await this.agent.executeCapability('analyzeProposal', proposalId);
        
        let message = `📊 **Proposal Analysis #${proposalId}**\\n\\n`;
        message += `**Title:** ${analysis.proposal.title}\\n\\n`;
        message += `**AI Analysis:**\\n${analysis.analysis}\\n\\n`;
        message += `**Recommendation:** ${analysis.recommendation}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Analysis failed: ${error.message}`);
      }
    });

    this.social.onMessage('/power', async (ctx) => {
      try {
        const votingPower = await this.agent.executeCapability('getVotingPower');
        const delegations = await this.agent.executeCapability('getDelegations');

        let message = `⚡ **Your Voting Power**\\n\\n`;
        message += `Total Voting Power: ${votingPower.totalVotingPower} SEI\\n`;
        message += `Delegated Tokens: ${votingPower.delegatedTokens} SEI\\n\\n`;
        
        if (delegations.length > 0) {
          message += `**Delegations:**\\n`;
          for (const delegation of delegations.slice(0, 5)) {
            message += `• ${delegation.validator.moniker}: ${delegation.balance.amount} SEI\\n`;
          }
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.reply(`❌ Error fetching voting power: ${error.message}`);
      }
    });

    this.social.onMessage('/help', async (ctx) => {
      const helpMessage = `
🤖 **Sei Governance Bot Commands:**

/proposals - Show active governance proposals
/vote <id> <yes|no|abstain|no_with_veto> - Vote on a proposal
/analyze <id> - Get AI analysis of a proposal
/power - Show your voting power and delegations
/help - Show this help message

**Example:**
\`/vote 42 yes\`
\`/analyze 42\`
      `;
      
      ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });
  }

  async startMonitoring(): Promise<void> {
    // Monitor for new proposals every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewProposals();
      } catch (error) {
        this.agent.emit('error', `Monitoring error: ${error.message}`);
      }
    }, parseInt(process.env.PROPOSAL_NOTIFICATION_INTERVAL || '300000'));

    // Initial check
    await this.checkForNewProposals();
  }

  private async checkForNewProposals(): Promise<void> {
    try {
      const proposals = await this.governance.getActiveProposals();
      
      for (const proposal of proposals) {
        // Check if we've already notified about this proposal
        if (!this.hasNotifiedAboutProposal(proposal.id)) {
          await this.notifyNewProposal(proposal);
          this.markProposalNotified(proposal.id);
        }

        // Check if voting is ending soon (within 24 hours)
        const votingEndsAt = new Date(proposal.votingEndTime);
        const now = new Date();
        const hoursRemaining = (votingEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursRemaining <= 24 && hoursRemaining > 0) {
          await this.sendVotingReminder(proposal);
        }
      }
    } catch (error) {
      this.agent.emit('warn', `Proposal monitoring failed: ${error.message}`);
    }
  }

  private async notifyNewProposal(proposal: any): Promise<void> {
    const message = `
🆕 **New Governance Proposal**

**#${proposal.id}** ${proposal.title}

${proposal.description.substring(0, 200)}${proposal.description.length > 200 ? '...' : ''}

**Type:** ${proposal.type}
**Voting ends:** ${new Date(proposal.votingEndTime).toLocaleString()}

Use \`/analyze ${proposal.id}\` for AI analysis
Use \`/vote ${proposal.id} <yes|no|abstain|no_with_veto>\` to vote
    `.trim();

    await this.config.services.notification.sendNotification(message);
  }

  private async sendVotingReminder(proposal: any): Promise<void> {
    const votingEndsAt = new Date(proposal.votingEndTime);
    const hoursRemaining = Math.round((votingEndsAt.getTime() - Date.now()) / (1000 * 60 * 60));

    const message = `
⏰ **Voting Reminder**

Proposal #${proposal.id} voting ends in ${hoursRemaining} hours!

**${proposal.title}**

Haven't voted yet? Use \`/vote ${proposal.id} <option>\`
Need help deciding? Use \`/analyze ${proposal.id}\`
    `.trim();

    await this.config.services.notification.sendNotification(message);
  }

  private hasNotifiedAboutProposal(proposalId: string): boolean {
    // Simple in-memory tracking - in production, use persistent storage
    return this.notifiedProposals.has(proposalId);
  }

  private markProposalNotified(proposalId: string): void {
    this.notifiedProposals.add(proposalId);
  }

  private notifiedProposals = new Set<string>();

  private extractRecommendation(analysis: string): 'YES' | 'NO' | 'ABSTAIN' {
    const lowerAnalysis = analysis.toLowerCase();
    
    if (lowerAnalysis.includes('recommend yes') || lowerAnalysis.includes('vote yes')) {
      return 'YES';
    } else if (lowerAnalysis.includes('recommend no') || lowerAnalysis.includes('vote no')) {
      return 'NO';
    } else {
      return 'ABSTAIN';
    }
  }

  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    await this.social.stop();
    await this.wallet.disconnect?.();
    
    this.agent.emit('info', 'Voting agent shutdown complete');
  }
}