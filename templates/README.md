# Sei Agent Studio Templates

This directory contains templates for the `seiai` CLI tool to generate complete Sei agent applications using natural language.

## Available Templates

### 🗳️ Governance Voting App (`voting-app`)
AI-powered governance agent with Telegram integration for Sei blockchain voting.

**Features:**
- Automated proposal monitoring
- AI-powered proposal analysis
- Telegram bot integration
- Voting power tracking
- Real-time notifications
- Governance analytics

**Use Cases:**
- DAO participation automation
- Governance research and analysis
- Community voting coordination
- Proposal impact assessment

### 💼 DeFi Portfolio Manager (`defi-app`)
Comprehensive DeFi portfolio management with automated trading and risk management.

**Features:**
- Automated portfolio management
- AI-powered trading decisions
- Yield optimization
- Risk management
- Real-time analytics
- Arbitrage detection

**Use Cases:**
- Portfolio optimization
- Yield farming automation
- Risk-managed trading
- DeFi strategy execution

### 🎨 NFT Trading Agent (`nft-trader`)
AI-powered NFT trading bot with market analysis and automated trading.

**Features:**
- Automated NFT trading
- AI-powered market analysis
- Price prediction and trends
- Portfolio tracking
- Rarity analysis
- Marketplace monitoring

**Use Cases:**
- NFT investment automation
- Market opportunity detection
- Collection analytics
- Trading strategy execution

### 🤖 AI Social Bot (`social-bot`)
Intelligent social media bot with AI conversations and blockchain integration.

**Features:**
- AI-powered conversations
- Multi-platform support
- Blockchain wallet integration
- Payment processing
- Community management
- Content moderation

**Use Cases:**
- Community engagement
- Customer support automation
- Social trading coordination
- Educational bot creation

## Template Structure

Each template contains:

- `manifest.json` - Template configuration and metadata
- `templates/` - Handlebars template files
- `assets/` - Screenshots and documentation assets
- `docs/` - Template-specific documentation

## Using Templates

### With seiai CLI

```bash
# Interactive generation
seiai studio

# Direct generation
seiai generate "DeFi portfolio manager with risk controls"

# List available templates
seiai templates list

# Generate from specific template
seiai templates use voting-app --name "my-governance-bot"
```

### Template Variables

Templates support variables for customization:

```json
{
  "projectName": "My Custom Agent",
  "network": "testnet",
  "aiProvider": "gemini",
  "autoTrading": false
}
```

### Environment Variables

Templates automatically generate `.env.example` files with required configuration:

```bash
# Copy and configure
cp .env.example .env
nano .env
```

## Creating Custom Templates

### Template Manifest

```json
{
  "name": "my-template",
  "displayName": "My Custom Template",
  "description": "Description of what this template creates",
  "category": "custom",
  "packages": ["@sei-code/core", "@sei-code/wallets"],
  "variables": {
    "projectName": {
      "type": "string",
      "required": true,
      "default": "My Project"
    }
  },
  "files": [
    {
      "path": "src/index.ts",
      "template": "src/index.ts.hbs",
      "description": "Main entry point"
    }
  ]
}
```

### Template Files

Use Handlebars syntax for dynamic content:

```typescript
// src/index.ts.hbs
import { SeiAgent } from '@sei-code/core';

const agent = new SeiAgent({
  name: '{{ projectName }}',
  network: '{{ network }}'
});
```

### Conditional Content

```handlebars
{{#if telegramBot}}
import { TelegramBot } from '@sei-code/social';
{{/if}}

{{#each packages}}
import * from '{{this}}';
{{/each}}
```

## Template Development

### File Organization

```
templates/my-template/
├── manifest.json           # Template configuration
├── templates/              # Handlebars template files
│   ├── package.json.hbs
│   ├── src/
│   │   ├── index.ts.hbs
│   │   └── agents/
│   └── README.md.hbs
├── assets/                 # Screenshots and images
│   ├── screenshot1.png
│   └── demo.gif
└── docs/                   # Template documentation
    ├── quickstart.md
    └── api.md
```

### Variable Types

```json
{
  "variables": {
    "stringVar": {
      "type": "string",
      "required": true,
      "default": "default value"
    },
    "numberVar": {
      "type": "number",
      "min": 1,
      "max": 100,
      "default": 10
    },
    "booleanVar": {
      "type": "boolean",
      "default": false
    },
    "enumVar": {
      "type": "enum",
      "options": ["option1", "option2"],
      "default": "option1"
    },
    "multiselectVar": {
      "type": "multiselect",
      "options": ["a", "b", "c"],
      "default": ["a", "b"]
    }
  }
}
```

### Conditional Files

```json
{
  "files": [
    {
      "path": "src/telegram-bot.ts",
      "template": "src/telegram-bot.ts.hbs",
      "condition": "{{ telegramEnabled }}"
    }
  ]
}
```

## Best Practices

### Template Design

1. **Start Simple**: Begin with basic functionality
2. **Modular Features**: Use conditional file generation
3. **Clear Variables**: Provide good defaults and descriptions
4. **Comprehensive Documentation**: Include usage examples
5. **Error Handling**: Validate inputs and provide helpful errors

### Code Quality

1. **TypeScript**: Use strict TypeScript configuration
2. **Dependencies**: Only include necessary packages
3. **Environment**: Provide complete `.env.example`
4. **Scripts**: Include build, dev, and deploy scripts
5. **Testing**: Provide test templates when applicable

### Documentation

1. **README**: Clear setup and usage instructions
2. **API Docs**: Document all functions and classes
3. **Examples**: Provide working examples
4. **Troubleshooting**: Common issues and solutions
5. **Screenshots**: Visual guides for complex features

## Template Categories

- **governance** - DAO and voting applications
- **defi** - DeFi trading and portfolio management
- **nft** - NFT trading and collection management
- **social** - Social bots and community tools
- **analytics** - Data analysis and reporting
- **custom** - Specialized or experimental templates

## Contributing

1. Fork the repository
2. Create a new template directory
3. Follow the template structure guidelines
4. Add comprehensive documentation
5. Test the template thoroughly
6. Submit a pull request

### Template Checklist

- [ ] Complete `manifest.json` with all required fields
- [ ] All template files use proper Handlebars syntax
- [ ] Variables have sensible defaults and validation
- [ ] Environment variables are documented
- [ ] README.md provides clear setup instructions
- [ ] Template generates working code
- [ ] All dependencies are specified correctly
- [ ] No hardcoded values (use variables instead)
- [ ] Error scenarios are handled gracefully
- [ ] Documentation is comprehensive and accurate

## Support

- 📚 [Template Development Guide](docs/template-development.md)
- 🐛 [Report Template Issues](https://github.com/sei-agent-studio/templates/issues)
- 💬 [Community Discord](https://discord.gg/sei-agent-studio)
- 📖 [Sei Agent Studio Docs](https://docs.sei-agent-studio.com)

---

Built with ❤️ for the Sei ecosystem