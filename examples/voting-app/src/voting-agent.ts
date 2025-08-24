import { SeiAgent } from '@sei-code/core';
import { WalletFactory } from '@sei-code/wallets';
import { SeiPrecompileManager, VoteOption } from '@sei-code/precompiles';
import { TelegramBotPlatform } from '@sei-code/social';
import { GeminiModel } from '@sei-code/models';
// import { AnalyticsAgent } from '@sei-code/analytics';
import type { SeiWallet } from '@sei-code/core';

export interface VotingAgentConfig {
  name: string;
  description: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  walletType?: 'sei-global' | 'metamask' | 'private-key';
  privateKey?: string;
  telegramToken?: string;
  geminiApiKey?: string;
}

export class VotingAgent {
  private agent!: SeiAgent;
  private wallet!: SeiWallet;
  private precompiles!: SeiPrecompileManager;
  private telegram?: TelegramBotPlatform;
  private aiModel?: GeminiModel;
  // private analytics!: AnalyticsAgent;

  constructor(private config: VotingAgentConfig) {
    // Initialize components
    this.initializeWallet();
    this.initializeAgent();
    this.initializePrecompiles();
    // this.initializeAnalytics();
    
    if (config.telegramToken) {
      this.initializeTelegram();
    }
    
    if (config.geminiApiKey) {
      this.initializeAI();
    }

    this.setupCapabilities();
  }

  private initializeWallet() {
    if (this.config.privateKey) {
      this.wallet = WalletFactory.fromPrivateKey(
        this.config.privateKey,
        this.config.network
      );
    } else {
      this.wallet = WalletFactory.createSeiWallet(this.config.network);
    }
  }

  private initializeAgent() {
    this.agent = new SeiAgent({
      name: this.config.name,
      description: this.config.description,
      capabilities: ['governance', 'analytics', 'social'],
      network: this.config.network,
      wallet: this.wallet
    });
  }

  private initializePrecompiles() {
    // Get provider from wallet
    const provider = this.wallet.getEthersProvider();
    this.precompiles = SeiPrecompileManager.withEthers(provider, this.config.network);
  }

  // private initializeAnalytics() {
  //   this.analytics = new AnalyticsAgent(this.agent, this.precompiles);
  // }

  private initializeTelegram() {
    if (!this.config.telegramToken) return;
    
    this.telegram = new TelegramBotPlatform({
      token: this.config.telegramToken,
      agent: this.agent
    });
  }

  private initializeAI() {
    if (!this.config.geminiApiKey) return;
    
    this.aiModel = new GeminiModel(this.config.geminiApiKey, 'gemini-pro');
  }

  private setupCapabilities() {
    // Add governance capabilities
    this.agent.addCapability({
      name: 'getProposals',
      description: 'Get active governance proposals',
      execute: async () => {
        return await this.precompiles.governance.execute({
          action: 'get_proposals'
        });
      }
    });

    this.agent.addCapability({
      name: 'voteOnProposal',
      description: 'Vote on a governance proposal',
      execute: async (params: { proposalId: number; vote: 'yes' | 'no' | 'abstain' | 'no_with_veto' }) => {
        const result = await this.precompiles.governance.execute({
          action: 'vote',
          proposalId: params.proposalId,
          voteOption: this.stringToVoteOption(params.vote)
        });
        
        // Send notification if telegram is available
        if (this.telegram) {
          await this.notifyVoteResult(params.proposalId, params.vote, result);
        }
        
        return result;
      }
    });

    this.agent.addCapability({
      name: 'analyzeProposal',
      description: 'Analyze a governance proposal using AI',
      execute: async (params: { proposalId: number }) => {
        const proposal = await this.precompiles.governance.execute({
          action: 'get_proposal',
          proposalId: params.proposalId
        });

        if (!this.aiModel) {
          return { proposal, analysis: 'AI analysis not available' };
        }

        const analysis = await this.aiModel.chat(`
          Analyze this Sei governance proposal:
          
          Proposal ID: ${proposal.id}
          Title: ${proposal.title}
          Description: ${proposal.description}
          Type: ${proposal.type}
          Status: ${proposal.status}
          
          Please provide:
          1. Summary of the proposal
          2. Potential impact on Sei ecosystem
          3. Voting recommendation (Yes/No/Abstain) with reasoning
          4. Key risks and benefits
        `);

        return {
          proposal,
          analysis,
          recommendation: this.extractRecommendation(analysis)
        };
      }
    });

    this.agent.addCapability({
      name: 'getPortfolioSummary',
      description: 'Get comprehensive portfolio analysis',
      execute: async () => {
        if (!this.wallet.address) {
          throw new Error('Wallet address not available');
        }
        
        const portfolioSummary = await this.precompiles.getPortfolioSummary(this.wallet.address);
        // const dashboard = await this.analytics.getDashboard(this.wallet.address);

        return {
          ...portfolioSummary,
          // analytics: dashboard
        };
      }
    });
  }

  /**
   * Initialize the voting agent
   */
  async initialize(): Promise<void> {
    console.log(`🤖 Initializing ${this.config.name}...`);

    // Connect wallet
    console.log('🔌 Connecting wallet...');
    await this.wallet.connect();
    console.log(`✅ Wallet connected: ${this.wallet.address}`);

    // Start Telegram bot if configured
    if (this.telegram) {
      console.log('📱 Starting Telegram bot...');
      await this.telegram.connect();
      console.log('✅ Telegram bot started');
    }

    console.log('🗳️  Voting agent ready!');
    this.agent.emit('info', 'Voting agent initialized successfully');
  }

  /**
   * Get active governance proposals
   */
  async getActiveProposals() {
    try {
      const proposals = await this.precompiles.governance.execute({
        action: 'get_proposals'
      });
      
      return proposals.filter((p: any) => p.status === 'voting');
    } catch (error) {
      throw new Error(`Failed to get proposals: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Vote on a proposal
   */
  async vote(proposalId: number, vote: 'yes' | 'no' | 'abstain' | 'no_with_veto') {
    try {
      const result = await this.precompiles.governance.execute({
        action: 'vote',
        proposalId,
        voteOption: this.stringToVoteOption(vote)
      });

      // Send notification
      if (this.telegram) {
        await this.notifyVoteResult(proposalId, vote, result);
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to vote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get AI analysis of a proposal
   */
  async analyzeProposal(proposalId: number) {
    if (!this.aiModel) {
      throw new Error('AI model not configured');
    }

    const proposal = await this.precompiles.governance.execute({
      action: 'get_proposal',
      proposalId
    });

    const analysis = await this.aiModel.chat(`
      Please analyze this Sei governance proposal and provide detailed insights:

      **Proposal Details:**
      - ID: ${proposal.id}
      - Title: ${proposal.title}
      - Description: ${proposal.description}
      - Type: ${proposal.type}
      - Status: ${proposal.status}
      - Voting Start: ${proposal.votingStartTime}
      - Voting End: ${proposal.votingEndTime}

      **Analysis Required:**
      1. **Executive Summary**: Brief overview of what this proposal does
      2. **Technical Impact**: How this affects Sei's technology/protocol
      3. **Economic Impact**: Financial implications for token holders
      4. **Risk Assessment**: Potential risks and benefits
      5. **Voting Recommendation**: Clear recommendation (YES/NO/ABSTAIN) with reasoning
      6. **Key Considerations**: Important factors voters should consider

      Please provide a comprehensive analysis that helps voters make an informed decision.
    `);

    return {
      proposal,
      analysis,
      recommendation: this.extractRecommendation(analysis),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics() {
    if (!this.wallet.address) {
      throw new Error('Wallet not connected');
    }

    // return await this.analytics.getDashboard(this.wallet.address);
    throw new Error('Analytics not implemented yet');
  }

  /**
   * Monitor governance activity
   */
  async startGovernanceMonitoring(intervalMinutes: number = 60) {
    console.log(`🔍 Starting governance monitoring (checking every ${intervalMinutes} minutes)...`);

    const monitor = async () => {
      try {
        const activeProposals = await this.getActiveProposals();
        
        if (this.telegram) {
          for (const proposal of activeProposals) {
            // Notify about new proposals (simple implementation)
            await this.notifyNewProposal(proposal);
          }
        }

        console.log(`📊 Found ${activeProposals.length} active proposals`);
      } catch (error) {
        console.error('❌ Monitoring error:', error);
      }
    };

    // Initial check
    await monitor();

    // Set up periodic monitoring
    const interval = setInterval(monitor, intervalMinutes * 60 * 1000);

    return {
      stop: () => clearInterval(interval)
    };
  }

  private async notifyVoteResult(proposalId: number, vote: string, result: any) {
    if (!this.telegram) return;

    const message = `✅ **Vote Cast Successfully**
    
🗳️ **Proposal #${proposalId}**
📊 **Vote:** ${vote.toUpperCase()}
🔗 **Transaction:** ${result}

Your vote has been recorded on the blockchain!`;

    // This would need actual chat ID management in real implementation
    console.log('📱 Telegram notification:', message);
  }

  private async notifyNewProposal(proposal: any) {
    if (!this.telegram) return;

    const message = `🆕 **New Governance Proposal**

📋 **${proposal.title}**
🔢 **ID:** #${proposal.id}
📅 **Voting Ends:** ${proposal.votingEndTime}

Use /analyze ${proposal.id} to get AI insights
Use /vote ${proposal.id} <yes|no|abstain> to cast your vote`;

    console.log('📱 New proposal notification:', message);
  }

  private stringToVoteOption(vote: 'yes' | 'no' | 'abstain' | 'no_with_veto'): VoteOption {
    switch (vote.toLowerCase()) {
      case 'yes':
        return VoteOption.YES;
      case 'no':
        return VoteOption.NO;
      case 'abstain':
        return VoteOption.ABSTAIN;
      case 'no_with_veto':
        return VoteOption.NO_WITH_VETO;
      default:
        throw new Error(`Invalid vote option: ${vote}`);
    }
  }

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

  /**
   * Shutdown the voting agent
   */
  async shutdown() {
    console.log('🔄 Shutting down voting agent...');

    if (this.telegram) {
      await this.telegram.disconnect();
    }

    console.log('✅ Voting agent shutdown complete');
  }
}