# seiai - Sei AI Studio CLI

A Claude Code-style CLI for generating Sei blockchain dApps using natural language. Build AI-powered applications for Sei with simple English descriptions.

## Installation

```bash
npm install -g seiai
```

## Quick Start

### 🤖 Interactive Studio (Recommended)

Launch the Claude Code-style interactive interface:

```bash
seiai studio
```

Then describe what you want to build:
- "I want to build a voting app for Sei with Telegram notifications"
- "Create a DeFi portfolio tracker with real-time alerts"
- "Build an NFT marketplace with analytics dashboard"

### 🚀 Direct Generation

Generate a project directly from the command line:

```bash
seiai generate "governance voting app with Telegram bot"
```

### 🔧 Enhance Existing Projects

Add features to an existing project:

```bash
seiai enhance ./my-sei-app "add price monitoring and alerts"
```

### 🌐 Deploy to Sei Network

Deploy your dApp to Sei blockchain:

```bash
seiai deploy --network testnet
```

## Commands

### `seiai studio`

Launch the interactive Claude Code-style studio interface. This provides the full conversational experience where you can:
- Describe your dApp in natural language
- Get real-time analysis of required packages and features
- Generate, enhance, and deploy projects interactively
- Switch between projects and manage deployments

### `seiai generate <description>`

Generate a new Sei dApp from a natural language description.

**Options:**
- `-n, --network <network>` - Target network (testnet, mainnet, devnet)
- `-o, --output <dir>` - Output directory
- `-t, --template <template>` - Force specific template
- `-p, --packages <packages>` - Additional packages to include
- `--skip-install` - Skip npm install
- `--dry-run` - Show what would be generated
- `-v, --verbose` - Verbose output

**Examples:**
```bash
# Basic generation
seiai generate "voting app for governance"

# With specific options
seiai generate "DeFi bot" --network testnet --output ./my-defi-bot

# Dry run to see what would be generated
seiai generate "NFT marketplace" --dry-run

# Add specific packages
seiai generate "social bot" --packages "analytics,x402"
```

### `seiai enhance <project> <description>`

Add features to an existing Sei dApp project.

**Options:**
- `-v, --verbose` - Verbose output
- `--dry-run` - Show what would be added

**Examples:**
```bash
# Add features to existing project
seiai enhance ./my-voting-app "add price alerts and analytics"

# See what would be added without making changes
seiai enhance ./my-bot "add NFT trading" --dry-run
```

### `seiai deploy`

Deploy a Sei dApp to the blockchain.

**Options:**
- `-n, --network <network>` - Target network (testnet, mainnet, devnet)
- `-p, --project <dir>` - Project directory to deploy
- `--estimate` - Estimate deployment cost
- `-v, --verbose` - Verbose output

**Examples:**
```bash
# Deploy current directory to testnet
seiai deploy --network testnet

# Deploy specific project
seiai deploy --project ./my-sei-app --network mainnet

# Estimate deployment cost
seiai deploy --estimate --network testnet
```

## Natural Language Processing

The CLI uses advanced natural language processing to understand your requirements and automatically:

### 📦 Package Detection
Automatically detects which @sei-code packages you need:
- **Core**: Always included for base agent functionality
- **Wallets**: For wallet connections and transactions
- **Governance**: For voting and governance features
- **Social**: For Telegram/Discord bots
- **NFT**: For NFT operations and marketplaces
- **Analytics**: For data analysis and monitoring
- **Models**: For AI/LLM integration
- **X402**: For payments and subscriptions

### 🎯 Project Type Recognition
Recognizes common dApp patterns:
- **Voting Apps**: Governance participation tools
- **DeFi Apps**: Trading, analytics, and portfolio management
- **Social Bots**: Telegram/Discord integrations
- **NFT Apps**: Marketplaces and trading platforms
- **Analytics Apps**: Data dashboards and monitoring

### 🔧 Feature Extraction
Identifies specific features from your description:
- Real-time notifications
- Price monitoring and alerts
- Automated trading strategies
- Portfolio tracking
- Payment processing
- Social integrations

### 🌐 Integration Detection
Automatically sets up external integrations:
- **Telegram**: Bot creation and message handling
- **Discord**: Server integration and notifications
- **Webhooks**: External API callbacks
- **Twitter**: Social media integration

## Templates

The CLI includes several built-in templates:

### `voting-app`
Governance voting application with:
- Proposal monitoring
- Voting functionality
- Telegram notifications
- Voting power tracking

### `defi-app`
DeFi application with:
- Portfolio analysis
- Price monitoring
- Oracle integration
- Trading capabilities

### `social-bot`
Social platform bot with:
- Multi-platform support (Telegram, Discord)
- AI-powered responses
- Command handling
- User management

### `nft-trader`
NFT marketplace application with:
- Collection browsing
- Trading functionality
- Marketplace integration
- Portfolio tracking

### `custom`
Generic template for custom applications

## Project Structure

Generated projects follow this structure:

```
my-sei-app/
├── src/
│   ├── agents/           # Agent implementations
│   ├── services/         # External service integrations
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   ├── config/          # Configuration files
│   └── index.ts         # Main entry point
├── contracts/           # Smart contracts (if applicable)
├── scripts/             # Deployment scripts
├── docs/               # Documentation
├── tests/              # Test files
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── .env                # Environment variables
└── README.md           # Project documentation
```

## Environment Variables

Projects require these environment variables:

```bash
# Sei Network
SEI_NETWORK=testnet
SEI_RPC_URL=https://rpc.sei-apis.com

# Wallet
PRIVATE_KEY=your_private_key_here
MNEMONIC=your_mnemonic_phrase_here

# AI Models (optional)
GEMINI_API_KEY=your_gemini_key_here
CLAUDE_API_KEY=your_claude_key_here
OPENAI_API_KEY=your_openai_key_here

# Integrations (as needed)
TELEGRAM_BOT_TOKEN=your_telegram_token_here
DISCORD_BOT_TOKEN=your_discord_token_here
```

## Examples

### Example 1: Voting Bot
```bash
seiai generate "I want to build a governance voting bot that sends Telegram notifications when new proposals are created and reminds users to vote"
```

This generates:
- Governance agent with proposal monitoring
- Telegram bot integration
- Notification system
- Voting reminders
- Real-time proposal tracking

### Example 2: DeFi Portfolio Tracker
```bash
seiai generate "Create a DeFi portfolio tracker that monitors my SEI holdings, shows price alerts, and can execute automated trades based on conditions"
```

This generates:
- Portfolio analysis agent
- Price monitoring with Oracle integration
- Alert system
- Automated trading capabilities
- Analytics dashboard

### Example 3: NFT Marketplace Bot
```bash
seiai generate "Build an NFT marketplace bot that can browse collections, track floor prices, and automatically buy NFTs under certain conditions"
```

This generates:
- NFT marketplace integration
- Collection monitoring
- Price tracking
- Automated buying logic
- Portfolio management

## Advanced Usage

### Custom Package Selection

Force specific packages:
```bash
seiai generate "simple bot" --packages "core,wallets,social,models,x402"
```

### Template Override

Use a specific template regardless of analysis:
```bash
seiai generate "my app" --template voting-app
```

### Multi-Network Deployment

Deploy to different networks:
```bash
# Test on testnet first
seiai deploy --network testnet

# Then deploy to mainnet
seiai deploy --network mainnet
```

### Enhancement Workflow

1. Generate base project:
   ```bash
   seiai generate "voting app"
   ```

2. Add features:
   ```bash
   seiai enhance ./voting-app "add price monitoring and analytics dashboard"
   ```

3. Deploy:
   ```bash
   seiai deploy --network testnet
   ```

## Configuration

Create a global config file at `~/.seiai/config.json`:

```json
{
  "defaultNetwork": "testnet",
  "defaultTemplate": "custom",
  "apiKeys": {
    "gemini": "your_key_here",
    "claude": "your_key_here"
  },
  "walletConfig": {
    "type": "sei-global",
    "network": "testnet"
  }
}
```

## Troubleshooting

### Common Issues

1. **"Package not found" errors**
   - Run `npm install` in your project directory
   - Check that all @sei-code packages are published

2. **"Network connection failed"**
   - Verify your SEI_RPC_URL is correct
   - Check network connectivity
   - Ensure the target network is accessible

3. **"Deployment failed"**
   - Check wallet balance for deployment fees
   - Verify environment variables are set
   - Use `--verbose` flag for detailed error information

4. **"Command not found: seiai"**
   - Install globally: `npm install -g seiai`
   - Or run with npx: `npx seiai studio`

### Getting Help

- Use `seiai --help` for command overview
- Use `seiai <command> --help` for specific command help
- Use `--verbose` flag for detailed error information
- Check the generated README.md in your project for specific instructions

## Contributing

This CLI is part of the Sei Agent Studio project. To contribute:

1. Clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Test locally: `npm link`

## License

MIT License - see LICENSE file for details.

---

**Generated by Sei AI Studio** - Building the future of Sei blockchain development with AI.