import 'dotenv/config';
import { VotingAgent } from './agents/voting-agent.js';
import { NotificationService } from './services/notification-service.js';
import { GovernanceService } from './services/governance-service.js';
import { AnalyticsService } from './services/analytics-service.js';

async function main() {
  console.log('🗳️  Starting Sei Governance Voting Agent...');

  try {
    // Initialize services
    const notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN!,
      chatId: process.env.TELEGRAM_CHAT_ID!
    });

    const governanceService = new GovernanceService({
      network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet',
      rpcUrl: process.env.SEI_RPC_URL!
    });

    const analyticsService = new AnalyticsService({
      network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet'
    });

    // Initialize voting agent
    const votingAgent = new VotingAgent({
      name: 'Sei Governance Assistant',
      description: 'AI-powered governance voting agent for Sei blockchain',
      walletConfig: {
        type: process.env.WALLET_TYPE as 'metamask' | 'sei-global' || 'metamask',
        privateKey: process.env.PRIVATE_KEY,
        network: process.env.NETWORK as 'testnet' | 'mainnet' || 'testnet'
      },
      modelConfig: {
        provider: process.env.MODEL_PROVIDER as 'gemini' | 'claude' | 'openai' || 'gemini',
        apiKey: process.env.GEMINI_API_KEY!
      },
      services: {
        notification: notificationService,
        governance: governanceService,
        analytics: analyticsService
      }
    });

    await votingAgent.initialize();

    // Start monitoring governance proposals
    console.log('✅ Agent initialized successfully');
    console.log('📊 Monitoring governance proposals...');
    
    await votingAgent.startMonitoring();

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down voting agent...');
      await votingAgent.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start voting agent:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);