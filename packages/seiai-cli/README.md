# 🤖 Sei AI Studio CLI

A robust, Claude Code-style CLI for generating Sei blockchain applications with natural language. Build complete dApps by simply describing what you want!

## ✨ Features

- **🧠 Natural Language Processing**: Describe your dApp in plain English
- **🏗️ Intelligent Code Generation**: Generates complete TypeScript projects with proper structure
- **📦 Modular Architecture**: Uses @sei-code packages for maximum functionality
- **🎨 Interactive Studio Mode**: Claude Code-style terminal interface
- **⚡ Smart Package Detection**: Automatically selects the right packages for your project
- **🔧 Template System**: Pre-built templates for common use cases
- **🌐 Multi-Network Support**: Deploy to testnet, devnet, or mainnet
- **🛠️ Comprehensive Error Handling**: Helpful error messages and suggestions

## 🚀 Installation

```bash
# Install globally
npm install -g seiai

# Or use with npx
npx seiai studio
```

## 📖 Quick Start

### Interactive Studio Mode

Launch the interactive terminal interface:

```bash
seiai studio
```

### Direct Generation

Generate a project directly from command line:

```bash
# Generate from description
seiai generate "Build a DeFi portfolio tracker with Telegram bot"

# With specific options
seiai generate "NFT marketplace with automated trading" \
  --network testnet \
  --output ./my-nft-app \
  --template nft-trader

# Dry run to see what would be generated
seiai generate "Social trading bot" --dry-run
```

## 🛠️ Commands

### `studio` - Interactive Mode
### `generate` - Direct Generation  
### `enhance` - Add Features
### `deploy` - Deploy to Sei

## 🎯 Use Cases

- **DeFi Applications**: Portfolio trackers, trading bots, yield farming
- **Governance & Voting**: DAO interfaces, proposal systems, validator dashboards  
- **NFT Applications**: Marketplaces, trading bots, analytics platforms
- **Social & Communication**: Telegram/Discord bots, notification systems

## 🏗️ Generated Project Structure

Complete TypeScript projects with proper configuration, testing, and documentation.

## 📄 License

MIT License

---

**Ready to build your next Sei dApp?** 

```bash
npx seiai studio
```

Start describing what you want to build! 🚀