# Sei Governance Voting Agent

A comprehensive AI-powered governance agent for the Sei blockchain that monitors proposals, provides intelligent analysis, and facilitates voting through Telegram bot integration.

## Features

- 🗳️ **Automated Proposal Monitoring**: Tracks new governance proposals in real-time
- 🤖 **AI-Powered Analysis**: Uses Gemini/Claude/OpenAI to analyze proposals and provide voting recommendations
- 📱 **Telegram Bot Integration**: Interactive bot for voting, analysis, and notifications
- 📊 **Analytics & Insights**: Comprehensive voting analytics and governance health metrics
- ⚡ **Real-time Notifications**: Instant alerts for new proposals and voting deadlines
- 🔐 **Multi-Wallet Support**: Compatible with MetaMask and Sei Global Wallet

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Sei wallet with some SEI tokens for voting
- AI API key (Gemini, Claude, or OpenAI)

### Installation

```bash
# Clone and navigate to the voting app
cd examples/voting-app

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Configuration

Edit your `.env` file with the following:

```bash
# Wallet Configuration
PRIVATE_KEY=your_wallet_private_key
WALLET_TYPE=metamask
NETWORK=testnet

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_telegram_chat_id

# AI Model (choose one)
GEMINI_API_KEY=your_gemini_api_key
MODEL_PROVIDER=gemini

# Sei Network
SEI_RPC_URL=https://evm-rpc-testnet.sei-apis.com
SEI_CHAIN_ID=713715
```

### Running the Agent

```bash
# Development mode with hot reload
pnpm dev

# Production mode
pnpm build
pnpm start

# Deploy with validation
pnpm run deploy
```

## Telegram Bot Commands

Once running, your Telegram bot will respond to these commands:

### Basic Commands
- `/help` - Show all available commands
- `/proposals` - List active governance proposals
- `/power` - Show your voting power and delegations

### Voting Commands
- `/vote <id> <yes|no|abstain|no_with_veto>` - Vote on a proposal
- `/analyze <id>` - Get AI analysis of a proposal

### Examples
```
/proposals
/analyze 42
/vote 42 yes
/power
```

## Architecture

```
src/
├── agents/
│   └── voting-agent.ts      # Main agent orchestrator
├── services/
│   ├── notification-service.ts    # Telegram notifications
│   ├── governance-service.ts      # Governance data & analytics
│   └── analytics-service.ts       # Voting insights & metrics
└── index.ts                       # Application entry point
```

### Key Components

- **VotingAgent**: Core orchestrator that coordinates all services
- **NotificationService**: Handles Telegram bot communication
- **GovernanceService**: Fetches governance data and provides analytics
- **AnalyticsService**: Tracks voting patterns and generates insights

## AI Analysis Features

The agent provides intelligent analysis of governance proposals:

- **Proposal Summarization**: Clear, concise summaries of complex proposals
- **Impact Assessment**: Analysis of potential ecosystem effects
- **Voting Recommendations**: AI-powered suggestions with reasoning
- **Risk Analysis**: Identification of potential risks and benefits

Example AI analysis output:
```
📊 Proposal Analysis #42

Title: Sei Network Validator Commission Adjustment

AI Analysis:
This proposal seeks to adjust the maximum validator commission 
rate from 5% to 7%. The change would:

1. Give validators more flexibility in commission rates
2. Potentially attract new validators to the network
3. May slightly increase delegation costs for users

Recommendation: YES - Benefits network decentralization
```

## Monitoring & Alerts

The agent automatically monitors for:

- 🆕 **New Proposals**: Instant notifications when proposals are submitted
- ⏰ **Voting Deadlines**: Reminders 24 hours before voting ends
- 📈 **Voting Progress**: Updates on proposal voting progress
- 🏆 **Results**: Final voting results and outcomes

## Analytics Dashboard

Get comprehensive insights into:

- **Voting Patterns**: Your historical voting behavior
- **Participation Rates**: How active you are in governance
- **Governance Health**: Overall network governance metrics
- **Validator Behavior**: How validators are voting on proposals

## Deployment

### Testnet Deployment
```bash
NETWORK=testnet pnpm run deploy
```

### Mainnet Deployment
```bash
NETWORK=mainnet pnpm run deploy --start
```

The deploy script will:
1. ✅ Validate all configuration
2. 🏗️ Build the application
3. 🧪 Run tests (if available)
4. 📦 Create deployment package
5. 🚀 Optionally start the service
6. 🏥 Run health checks

## Development

### Project Structure
```
voting-app/
├── src/
│   ├── agents/           # Core agent logic
│   ├── services/         # Supporting services
│   └── index.ts          # Main entry point
├── scripts/
│   └── deploy.ts         # Deployment automation
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment template
└── README.md             # This file
```

### Adding New Features

1. **New Telegram Commands**: Add handlers in `voting-agent.ts`
2. **AI Analysis**: Extend prompts in the `analyzeProposal` capability
3. **Notifications**: Add new notification types in `notification-service.ts`
4. **Analytics**: Extend metrics in `analytics-service.ts`

### Testing

```bash
# Run tests (if test script exists)
pnpm test

# Test Telegram bot locally
pnpm dev
# Send /help to your bot
```

## Troubleshooting

### Common Issues

**Bot not responding**
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Check that chat ID matches your Telegram user/group
- Ensure bot has been started with `/start` command

**Voting fails**
- Check wallet has sufficient SEI for transaction fees
- Verify private key is correct and has voting power
- Ensure proposal ID exists and voting is still active

**AI analysis not working**
- Verify API key for your chosen model provider
- Check API quotas and billing status
- Try switching model providers in `.env`

### Logs and Debugging

The agent provides detailed logging:
- 📱 Telegram interactions
- 🗳️ Voting transactions
- 🤖 AI analysis requests
- ❌ Errors and warnings

Monitor logs for troubleshooting:
```bash
# Development mode shows all logs
pnpm dev

# Production logs
pnpm start 2>&1 | tee voting-agent.log
```

## Security Notes

- 🔐 Never commit `.env` file to version control
- 🔑 Store private keys securely (consider hardware wallets for mainnet)
- 📱 Use Telegram bot in private chats only for sensitive operations
- 🔄 Regularly rotate API keys and tokens
- 🎯 Test thoroughly on testnet before mainnet deployment

## Contributing

This example demonstrates the power of the Sei Agent Studio packages. You can:

1. Fork and customize for your governance needs
2. Add new AI model integrations
3. Extend analytics and reporting
4. Integrate with other Sei ecosystem tools
5. Build additional notification channels

## Support

- 📚 [Sei Agent Studio Documentation](../../README.md)
- 🐛 [Report Issues](https://github.com/sei-agent-studio/issues)
- 💬 [Community Discord](https://discord.gg/sei)
- 📖 [Sei Network Docs](https://docs.sei.io)

Built with ❤️ using [Sei Agent Studio](https://github.com/sei-agent-studio)