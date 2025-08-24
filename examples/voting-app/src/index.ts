#!/usr/bin/env tsx

import { config } from 'dotenv';
import { VotingAgent } from './voting-agent.js';

// Load environment variables
config();

async function main() {
  console.log('🗳️  Starting Sei Governance Voting Agent...\n');

  // Create voting agent configuration
  const agentConfig = {
    name: 'Sei Governance Bot',
    description: 'AI-powered governance voting assistant for Sei Network',
    network: 'testnet' as const,
    walletType: 'private-key' as const,
    privateKey: process.env.PRIVATE_KEY,
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    geminiApiKey: process.env.GEMINI_API_KEY
  };

  try {
    // Initialize the voting agent
    const votingAgent = new VotingAgent(agentConfig);
    
    // Initialize components
    await votingAgent.initialize();
    
    // Demonstrate core functionality
    await demonstrateCapabilities(votingAgent);
    
    // Start governance monitoring if in production mode
    if (process.env.NODE_ENV === 'production') {
      console.log('\n🔄 Starting production monitoring...');
      const monitor = await votingAgent.startGovernanceMonitoring(30); // Check every 30 minutes
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down gracefully...');
        monitor.stop();
        await votingAgent.shutdown();
        process.exit(0);
      });

      console.log('🚀 Voting agent is now running in production mode');
      console.log('Press Ctrl+C to stop');
      
      // Keep the process running
      return new Promise(() => {});
    } else {
      // Demo mode - show functionality and exit
      console.log('\n✅ Demo completed successfully!');
      await votingAgent.shutdown();
    }

  } catch (error) {
    console.error('❌ Error running voting agent:', error);
    process.exit(1);
  }
}

async function demonstrateCapabilities(agent: VotingAgent) {
  console.log('\n📋 Demonstrating Voting Agent Capabilities...\n');

  try {
    // 1. Get active governance proposals
    console.log('1. 📊 Fetching active governance proposals...');
    const proposals = await agent.getActiveProposals();
    console.log(`   Found ${proposals.length} active proposals`);
    
    if (proposals.length > 0) {
      console.log(`   Latest: "${proposals[0].title}"`);
    }

    // 2. Get portfolio analytics
    console.log('\n2. 💼 Analyzing portfolio...');
    try {
      const portfolio = await agent.getPortfolioAnalytics();
      console.log(`   Portfolio value: $${portfolio.portfolioSnapshot.totalValue}`);
      console.log(`   Active delegations: ${portfolio.portfolioSnapshot.assets.filter((a: any) => a.type === 'staked').length}`);
      console.log(`   Diversification score: ${portfolio.portfolioSnapshot.performance.diversificationScore?.toFixed(1) || 0}/100`);
    } catch (error) {
      console.log('   ⚠️  Portfolio analysis skipped (requires real wallet connection)');
    }

    // 3. AI Analysis (if available)
    if (process.env.GEMINI_API_KEY && proposals.length > 0) {
      console.log('\n3. 🤖 AI Proposal Analysis...');
      try {
        const analysis = await agent.analyzeProposal(proposals[0].id);
        console.log(`   Proposal: ${analysis.proposal.title}`);
        console.log(`   AI Recommendation: ${analysis.recommendation}`);
        console.log(`   Analysis preview: ${analysis.analysis.substring(0, 200)}...`);
      } catch (error) {
        console.log(`   ⚠️  AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('\n3. 🤖 AI Analysis skipped (requires GEMINI_API_KEY and active proposals)');
    }

    // 4. Voting simulation (won't actually execute without real setup)
    console.log('\n4. 🗳️  Voting capability...');
    console.log('   Voting is available but not executed in demo mode');
    console.log('   Use: await agent.vote(proposalId, "yes") to cast votes');

  } catch (error) {
    console.error('Demo error:', error);
  }
}

// Show usage information
function showUsage() {
  console.log(`
🗳️  Sei Governance Voting Agent
================================

Environment Variables:
  PRIVATE_KEY         - Your wallet private key (optional, falls back to Sei Global Wallet)
  TELEGRAM_BOT_TOKEN  - Telegram bot token for notifications (optional)
  GEMINI_API_KEY     - Google Gemini API key for AI analysis (optional)
  NODE_ENV           - Set to 'production' for continuous monitoring

Usage:
  npm run dev        - Run in demo mode
  npm run start      - Run in production mode
  
Features:
  ✅ Governance proposal monitoring
  ✅ AI-powered proposal analysis
  ✅ Automated voting capabilities
  ✅ Portfolio analytics integration
  ✅ Telegram notifications
  ✅ Risk assessment and recommendations

Examples:
  # Demo mode (shows capabilities)
  npm run dev

  # Production mode (continuous monitoring)
  NODE_ENV=production PRIVATE_KEY=your_key TELEGRAM_BOT_TOKEN=your_token npm run dev
`);
}

// Show usage if no environment setup
if (!process.env.PRIVATE_KEY && !process.env.TELEGRAM_BOT_TOKEN && !process.env.GEMINI_API_KEY) {
  showUsage();
  console.log('🚀 Running demo with limited functionality...\n');
}

// Run the main function
main().catch(console.error);