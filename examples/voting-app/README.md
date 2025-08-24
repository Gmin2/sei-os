# 🗳️ Sei Governance Voting Agent

An intelligent governance voting agent for Sei Network that combines AI analysis, portfolio insights, and automated monitoring to help you participate effectively in Sei's governance.

## ✨ Features

- **🤖 AI-Powered Analysis**: Get intelligent recommendations on governance proposals using Google Gemini
- **📊 Portfolio Integration**: Analyze how proposals might affect your portfolio
- **📱 Telegram Notifications**: Real-time updates about new proposals and voting results
- **🔍 Automated Monitoring**: Continuous tracking of governance activity
- **⚡ Smart Voting**: Execute votes with comprehensive analysis and safety checks
- **📈 Analytics Dashboard**: Deep insights into your governance participation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Sei Network testnet/mainnet access
- Optional: Telegram Bot Token, Gemini API Key

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration (optional for demo)
nano .env
```

### Running the Agent

```bash
# Demo mode (shows capabilities without real transactions)
pnpm run dev

# Production mode (requires environment variables)
NODE_ENV=production pnpm run dev
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Wallet private key for signing transactions | Optional* |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | Optional |
| `GEMINI_API_KEY` | Google AI API key | Optional |
| `NODE_ENV` | Set to 'production' for live monitoring | Optional |

*If no private key is provided, the agent will attempt to use Sei Global Wallet (browser extension).

### Getting API Keys

1. **Telegram Bot Token**:
   - Message @BotFather on Telegram
   - Use `/newbot` command and follow instructions
   - Copy the token to your `.env` file

2. **Gemini API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key to your `.env` file

## 🎯 Usage Examples

### Basic Voting

```typescript
import { VotingAgent } from './src/voting-agent.js';

const agent = new VotingAgent({
  name: 'My Governance Bot',
  description: 'Personal governance assistant',
  network: 'testnet',
  privateKey: 'your-private-key',
  geminiApiKey: 'your-api-key'
});

await agent.initialize();

// Get active proposals
const proposals = await agent.getActiveProposals();

// Analyze proposal with AI
const analysis = await agent.analyzeProposal(proposals[0].id);
console.log('AI Recommendation:', analysis.recommendation);

// Cast vote
await agent.vote(proposals[0].id, 'yes');
```

### Portfolio-Integrated Governance

```typescript
// Get comprehensive portfolio analysis
const analytics = await agent.getPortfolioAnalytics();

// Check how proposals might affect your holdings
const portfolioValue = analytics.portfolioSnapshot.totalValue;
const stakingRewards = analytics.portfolioSnapshot.performance.totalRewards;

console.log(`Portfolio Value: $${portfolioValue}`);
console.log(`Annual Rewards: ${stakingRewards}%`);
```

### Automated Monitoring

```typescript
// Start continuous governance monitoring
const monitor = await agent.startGovernanceMonitoring(30); // Check every 30 minutes

// The agent will:
// - Monitor for new proposals
// - Send Telegram notifications
// - Provide AI analysis
// - Track voting deadlines

// Stop monitoring
monitor.stop();
```

## 🏗️ Architecture

The voting agent is built using the Sei Agent Studio modular architecture:

```
VotingAgent
├── @sei-code/core          # Agent framework and capabilities
├── @sei-code/wallets       # Wallet management (Sei Global, MetaMask, Private Key)
├── @sei-code/precompiles   # Governance, staking, and other precompiles
├── @sei-code/social        # Telegram bot integration
├── @sei-code/models        # AI models (Gemini, Claude, OpenAI)
└── @sei-code/analytics     # Portfolio and performance analytics
```

### Key Components

1. **VotingAgent**: Main orchestrator class
2. **SeiPrecompileManager**: Governance operations via Sei precompiles
3. **TelegramBotPlatform**: Social notifications and commands
4. **AnalyticsAgent**: Portfolio and market analysis
5. **AIModel**: Proposal analysis and recommendations

## 📊 Governance Features

### Proposal Analysis

The agent provides comprehensive analysis including:

- **Executive Summary**: Clear overview of the proposal
- **Technical Impact**: How it affects Sei's protocol
- **Economic Impact**: Financial implications for holders
- **Risk Assessment**: Potential risks and benefits
- **Voting Recommendation**: AI-powered suggestion with reasoning

### Smart Voting

- **Safety Checks**: Validates proposals before voting
- **Portfolio Context**: Considers your holdings when recommending votes
- **Execution Tracking**: Monitors transaction status and provides confirmations
- **Notification System**: Alerts via Telegram when votes are cast

### Monitoring & Alerts

- **New Proposal Detection**: Immediate alerts for new governance proposals
- **Voting Deadline Tracking**: Reminders before voting periods close  
- **Result Notifications**: Updates when voting concludes
- **Participation Analytics**: Track your governance engagement over time

## 🔒 Security & Best Practices

### Private Key Management

- **Environment Variables**: Never hardcode private keys
- **File Permissions**: Ensure `.env` files are properly secured
- **Wallet Integration**: Prefer browser wallet integration when possible

### Transaction Safety

- **Simulation**: All transactions are simulated before execution
- **Confirmation**: Manual approval required for critical operations
- **Gas Management**: Automatic gas estimation and optimization
- **Error Handling**: Comprehensive error catching and reporting

### AI Analysis Disclaimer

- AI recommendations are for informational purposes only
- Always conduct your own research before voting
- Consider multiple perspectives and community discussions
- The agent provides insights, not financial advice

## 🤝 Contributing

This example demonstrates the capabilities of the Sei Agent Studio framework. To extend or customize:

1. **Add New Capabilities**: Implement additional agent capabilities
2. **Extend AI Analysis**: Improve proposal analysis algorithms
3. **Custom Notifications**: Add Discord, Slack, or email notifications  
4. **Advanced Strategies**: Implement voting strategies based on portfolio composition

## 📈 Roadmap

Potential future enhancements:

- [ ] Multi-signature governance support
- [ ] Advanced voting strategies (portfolio-weighted, etc.)
- [ ] Cross-chain governance integration
- [ ] DAO tooling integration
- [ ] Governance analytics dashboard
- [ ] Mobile app integration

## 🆘 Support

- **Documentation**: Check the main Sei Agent Studio docs
- **Issues**: Report bugs via GitHub issues
- **Community**: Join the Sei Discord for discussions
- **Examples**: See other examples in the `/examples` directory

## 📄 License

MIT License - see LICENSE file for details.

---

**⚠️ Disclaimer**: This is example code for educational purposes. Always test thoroughly on testnet before using with real funds. The authors are not responsible for any losses incurred through the use of this software.