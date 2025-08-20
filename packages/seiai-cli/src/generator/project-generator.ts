import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { 
  GenerationOptions, 
  AnalyzedRequest, 
  ProjectInfo, 
  TemplateManifest,
  TemplateFile 
} from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ProjectGenerator {
  private templatesDir: string;
  private examplesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, '../../templates');
    this.examplesDir = path.join(__dirname, '../../examples');
  }

  async generateProject(options: GenerationOptions, analysis: AnalyzedRequest): Promise<void> {
    const { projectName, outputDir, template, packages, features, network, integrations } = options;
    
    // Ensure output directory doesn't exist
    if (await fs.pathExists(outputDir)) {
      throw new Error(`Directory ${outputDir} already exists`);
    }

    // Create base project structure
    await this.createBaseStructure(outputDir, projectName);
    
    // Generate package.json
    await this.generatePackageJson(outputDir, projectName, packages, analysis);
    
    // Generate TypeScript config
    await this.generateTsConfig(outputDir);
    
    // Generate main application files
    await this.generateApplicationFiles(outputDir, template, packages, features, integrations, network);
    
    // Generate documentation
    await this.generateDocumentation(outputDir, projectName, analysis, options);
    
    // Generate deployment scripts
    await this.generateDeploymentScripts(outputDir, network);
    
    // Install dependencies if requested
    if (!options.skipInstall) {
      await this.installDependencies(outputDir);
    }
  }

  async enhanceProject(project: ProjectInfo, analysis: AnalyzedRequest): Promise<void> {
    const projectPath = project.path;
    
    // Add new packages to package.json
    if (analysis.packages.length > 0) {
      await this.addPackagesToProject(projectPath, analysis.packages.map(p => p.name));
    }
    
    // Add new features
    if (analysis.features.length > 0) {
      await this.addFeaturesToProject(projectPath, analysis.features, project.config.template);
    }
    
    // Add new integrations
    if (analysis.integrations.length > 0) {
      await this.addIntegrationsToProject(projectPath, analysis.integrations);
    }
    
    // Update project config
    project.config.packages = [...new Set([...project.config.packages, ...analysis.packages.map(p => p.name)])];
    project.config.features = [...new Set([...project.config.features, ...analysis.features])];
    project.lastModified = new Date().toISOString();
  }

  private async createBaseStructure(outputDir: string, projectName: string): Promise<void> {
    const structure = [
      'src',
      'src/agents',
      'src/services', 
      'src/utils',
      'src/types',
      'contracts',
      'scripts',
      'docs',
      'tests'
    ];

    for (const dir of structure) {
      await fs.ensureDir(path.join(outputDir, dir));
    }
  }

  private async generatePackageJson(
    outputDir: string,
    projectName: string,
    packages: string[],
    analysis: AnalyzedRequest
  ): Promise<void> {
    const packageJson = {
      name: projectName,
      version: '1.0.0',
      description: analysis.projectType === 'custom' 
        ? `A custom Sei agent application`
        : `A ${analysis.projectType} application for Sei blockchain`,
      main: 'dist/index.js',
      type: 'module',
      scripts: {
        build: 'tsc',
        dev: 'node --loader ts-node/esm src/index.ts',
        start: 'node dist/index.js',
        test: 'jest',
        lint: 'eslint src --ext .ts',
        'type-check': 'tsc --noEmit',
        deploy: 'node scripts/deploy.js',
        'deploy:testnet': 'node scripts/deploy.js --network testnet',
        'deploy:mainnet': 'node scripts/deploy.js --network mainnet'
      },
      keywords: [
        'sei',
        'blockchain',
        'agent',
        analysis.projectType,
        ...analysis.features.map(f => f.toLowerCase().replace(/\s+/g, '-'))
      ],
      author: '',
      license: 'MIT',
      dependencies: this.generateDependencies(packages),
      devDependencies: {
        'typescript': '^5.0.0',
        '@types/node': '^20.0.0',
        'ts-node': '^10.9.0',
        'jest': '^29.0.0',
        '@types/jest': '^29.0.0',
        'eslint': '^8.0.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
        '@typescript-eslint/parser': '^6.0.0'
      }
    };

    await fs.writeJson(path.join(outputDir, 'package.json'), packageJson, { spaces: 2 });
  }

  private generateDependencies(packages: string[]): Record<string, string> {
    const dependencies: Record<string, string> = {};
    
    // Add @sei-code packages
    packages.forEach(pkg => {
      dependencies[`@sei-code/${pkg}`] = '^1.0.0';
    });

    // Add common dependencies
    dependencies['dotenv'] = '^16.0.0';
    dependencies['winston'] = '^3.8.0';

    return dependencies;
  }

  private async generateTsConfig(outputDir: string): Promise<void> {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        allowJs: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        outDir: './dist',
        rootDir: './src',
        resolveJsonModule: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*']
        }
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    };

    await fs.writeJson(path.join(outputDir, 'tsconfig.json'), tsConfig, { spaces: 2 });
  }

  private async generateApplicationFiles(
    outputDir: string,
    template: string,
    packages: string[],
    features: string[],
    integrations: any[],
    network: string
  ): Promise<void> {
    // Generate main index.ts
    await this.generateMainFile(outputDir, template, packages, integrations);
    
    // Generate agent configuration
    await this.generateAgentConfig(outputDir, packages, features, network);
    
    // Generate environment file
    await this.generateEnvFile(outputDir, integrations, network);
    
    // Generate specific template files
    await this.generateTemplateFiles(outputDir, template, packages, features);
    
    // Generate integration files
    await this.generateIntegrationFiles(outputDir, integrations);
  }

  private async generateMainFile(
    outputDir: string,
    template: string,
    packages: string[],
    integrations: any[]
  ): Promise<void> {
    const imports = this.generateImports(packages, integrations);
    const agentSetup = this.generateAgentSetup(template, packages);
    const integrationSetup = this.generateIntegrationSetup(integrations);

    const content = `${imports}

async function main() {
  try {
    console.log('🤖 Starting Sei Agent...');
    
    ${agentSetup}
    
    ${integrationSetup}
    
    // Start the agent
    await agent.start();
    console.log('✅ Agent started successfully!');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\\n🛑 Shutting down agent...');
      await agent.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start agent:', error);
    process.exit(1);
  }
}

main().catch(console.error);`;

    await fs.writeFile(path.join(outputDir, 'src/index.ts'), content);
  }

  private generateImports(packages: string[], integrations: any[]): string {
    const imports = [
      "import dotenv from 'dotenv';",
      "import { SeiAgent } from '@sei-code/core';"
    ];

    // Add package imports
    packages.forEach(pkg => {
      if (pkg === 'core') return; // Already imported
      
      switch (pkg) {
        case 'wallets':
          imports.push("import { SeiWallet } from '@sei-code/wallets';");
          break;
        case 'social':
          imports.push("import { TelegramBot } from '@sei-code/social';");
          break;
        case 'models':
          imports.push("import { GeminiModel } from '@sei-code/models';");
          break;
        case 'governance':
          imports.push("import { GovernanceAgent } from '@sei-code/governance';");
          break;
        case 'nft':
          imports.push("import { ERC721Agent } from '@sei-code/nft';");
          break;
        case 'analytics':
          imports.push("import { PortfolioAnalyzer } from '@sei-code/analytics';");
          break;
        case 'x402':
          imports.push("import { X402Agent } from '@sei-code/x402';");
          break;
        default:
          imports.push(`import { /* TODO: Add imports */ } from '@sei-code/${pkg}';`);
      }
    });

    imports.push("import { agentConfig } from './config/agent-config.js';");
    imports.push("");
    imports.push("dotenv.config();");

    return imports.join('\n');
  }

  private generateAgentSetup(template: string, packages: string[]): string {
    let setup = `    // Initialize the main agent
    const agent = new SeiAgent(agentConfig);`;

    if (packages.includes('wallets')) {
      setup += `
    
    // Initialize wallet
    const wallet = new SeiWallet({
      type: 'sei-global',
      network: process.env.SEI_NETWORK || 'testnet'
    });
    await wallet.connect();
    agent.setWallet(wallet);`;
    }

    if (packages.includes('models')) {
      setup += `
    
    // Initialize AI model
    const model = new GeminiModel({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-pro'
    });
    agent.setModel(model);`;
    }

    return setup;
  }

  private generateIntegrationSetup(integrations: any[]): string {
    if (integrations.length === 0) return '';

    let setup = '\n    // Initialize integrations';

    for (const integration of integrations) {
      switch (integration.type) {
        case 'telegram':
          setup += `
    const telegramBot = new TelegramBot({
      token: process.env.TELEGRAM_BOT_TOKEN!,
      agent: agent
    });
    await telegramBot.start();`;
          break;
      }
    }

    return setup;
  }

  private async generateAgentConfig(
    outputDir: string,
    packages: string[],
    features: string[],
    network: string
  ): Promise<void> {
    const configDir = path.join(outputDir, 'src/config');
    await fs.ensureDir(configDir);

    const config = {
      name: 'Sei Agent',
      description: 'AI-powered agent for Sei blockchain',
      version: '1.0.0',
      network,
      capabilities: packages,
      features,
      settings: {
        logLevel: 'info',
        retryAttempts: 3,
        timeout: 30000
      }
    };

    const content = `import type { AgentConfig } from '@sei-code/core';

export const agentConfig: AgentConfig = ${JSON.stringify(config, null, 2)};`;

    await fs.writeFile(path.join(configDir, 'agent-config.ts'), content);
  }

  private async generateEnvFile(
    outputDir: string,
    integrations: any[],
    network: string
  ): Promise<void> {
    let envContent = `# Sei Network Configuration
SEI_NETWORK=${network}
SEI_RPC_URL=https://rpc.sei-apis.com
SEI_CHAIN_ID=sei-chain

# Wallet Configuration
PRIVATE_KEY=your_private_key_here
MNEMONIC=your_mnemonic_phrase_here

# AI Model Configuration
GEMINI_API_KEY=your_gemini_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

`;

    // Add integration-specific environment variables
    for (const integration of integrations) {
      switch (integration.type) {
        case 'telegram':
          envContent += `# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

`;
          break;
        case 'discord':
          envContent += `# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here

`;
          break;
      }
    }

    await fs.writeFile(path.join(outputDir, '.env.example'), envContent);
    await fs.writeFile(path.join(outputDir, '.env'), envContent);
  }

  private async generateTemplateFiles(
    outputDir: string,
    template: string,
    packages: string[],
    features: string[]
  ): Promise<void> {
    switch (template) {
      case 'voting-app':
        await this.generateVotingAppFiles(outputDir, packages);
        break;
      case 'defi-app':
        await this.generateDeFiAppFiles(outputDir, packages);
        break;
      case 'social-bot':
        await this.generateSocialBotFiles(outputDir, packages);
        break;
      case 'nft-trader':
        await this.generateNFTTraderFiles(outputDir, packages);
        break;
      default:
        await this.generateCustomAppFiles(outputDir, packages, features);
    }
  }

  private async generateVotingAppFiles(outputDir: string, packages: string[]): Promise<void> {
    const agentContent = `import { SeiAgent, AgentCapability } from '@sei-code/core';
import { GovernanceAgent } from '@sei-code/governance';

export class VotingAgent extends AgentCapability {
  private governance: GovernanceAgent;

  constructor(agent: SeiAgent) {
    super('voting-agent', agent);
    this.governance = new GovernanceAgent(agent);
  }

  async getActiveProposals() {
    return await this.governance.getActiveProposals();
  }

  async vote(proposalId: string, option: 'yes' | 'no' | 'abstain') {
    return await this.governance.vote(proposalId, option);
  }

  async getVotingPower(address: string) {
    return await this.governance.getVotingPower(address);
  }
}`;

    await fs.writeFile(path.join(outputDir, 'src/agents/voting-agent.ts'), agentContent);
  }

  private async generateDeFiAppFiles(outputDir: string, packages: string[]): Promise<void> {
    const agentContent = `import { SeiAgent, AgentCapability } from '@sei-code/core';
import { BankPrecompile, OraclePrecompile } from '@sei-code/precompiles';

export class DeFiAgent extends AgentCapability {
  private bank: BankPrecompile;
  private oracle: OraclePrecompile;

  constructor(agent: SeiAgent) {
    super('defi-agent', agent);
    this.bank = new BankPrecompile(agent.provider);
    this.oracle = new OraclePrecompile(agent.provider);
  }

  async getPortfolio(address: string) {
    const balances = await this.bank.getAllBalances(address);
    const prices = await this.oracle.getExchangeRates();
    
    return {
      balances,
      prices,
      totalValue: this.calculateTotalValue(balances, prices)
    };
  }

  private calculateTotalValue(balances: any[], prices: any[]): string {
    // Implementation for portfolio value calculation
    return '0';
  }
}`;

    await fs.writeFile(path.join(outputDir, 'src/agents/defi-agent.ts'), agentContent);
  }

  private async generateSocialBotFiles(outputDir: string, packages: string[]): Promise<void> {
    const agentContent = `import { SeiAgent, AgentCapability } from '@sei-code/core';
import { TelegramBot } from '@sei-code/social';

export class SocialAgent extends AgentCapability {
  private telegram: TelegramBot;

  constructor(agent: SeiAgent, telegramToken: string) {
    super('social-agent', agent);
    this.telegram = new TelegramBot({
      token: telegramToken,
      agent: agent
    });
    this.setupCommands();
  }

  private setupCommands() {
    this.telegram.onMessage('/start', (ctx) => {
      ctx.reply('Welcome to Sei Agent! Type /help for available commands.');
    });

    this.telegram.onMessage('/balance', async (ctx) => {
      try {
        const balance = await this.agent.wallet?.getBalance('usei');
        ctx.reply(\`Your SEI balance: \${balance} uSEI\`);
      } catch (error) {
        ctx.reply('Failed to get balance. Please check your wallet connection.');
      }
    });

    this.telegram.onMessage('/help', (ctx) => {
      const helpText = \`
Available commands:
/start - Start the bot
/balance - Check your SEI balance
/help - Show this help message
      \`;
      ctx.reply(helpText);
    });
  }
}`;

    await fs.writeFile(path.join(outputDir, 'src/agents/social-agent.ts'), agentContent);
  }

  private async generateNFTTraderFiles(outputDir: string, packages: string[]): Promise<void> {
    const agentContent = `import { SeiAgent, AgentCapability } from '@sei-code/core';
import { ERC721Agent, MarketplaceAgent } from '@sei-code/nft';

export class NFTTradingAgent extends AgentCapability {
  private nft: ERC721Agent;
  private marketplace: MarketplaceAgent;

  constructor(agent: SeiAgent) {
    super('nft-trading-agent', agent);
    this.nft = new ERC721Agent(agent);
    this.marketplace = new MarketplaceAgent(agent);
  }

  async getNFTCollection(contractAddress: string) {
    return await this.nft.getCollection(contractAddress);
  }

  async buyNFT(tokenId: string, contractAddress: string, price: string) {
    return await this.marketplace.buyToken(contractAddress, tokenId, price);
  }

  async listNFT(tokenId: string, contractAddress: string, price: string) {
    return await this.marketplace.listToken(contractAddress, tokenId, price);
  }
}`;

    await fs.writeFile(path.join(outputDir, 'src/agents/nft-trading-agent.ts'), agentContent);
  }

  private async generateCustomAppFiles(
    outputDir: string,
    packages: string[],
    features: string[]
  ): Promise<void> {
    const agentContent = `import { SeiAgent, AgentCapability } from '@sei-code/core';

export class CustomAgent extends AgentCapability {
  constructor(agent: SeiAgent) {
    super('custom-agent', agent);
  }

  // Add your custom agent methods here
  async customMethod() {
    this.agent.emit('info', 'Custom agent method called');
  }
}`;

    await fs.writeFile(path.join(outputDir, 'src/agents/custom-agent.ts'), agentContent);
  }

  private async generateIntegrationFiles(outputDir: string, integrations: any[]): Promise<void> {
    if (integrations.length === 0) return;

    const servicesDir = path.join(outputDir, 'src/services');
    await fs.ensureDir(servicesDir);

    for (const integration of integrations) {
      switch (integration.type) {
        case 'telegram':
          await this.generateTelegramService(servicesDir);
          break;
        case 'webhook':
          await this.generateWebhookService(servicesDir);
          break;
      }
    }
  }

  private async generateTelegramService(servicesDir: string): Promise<void> {
    const content = `import { TelegramBot } from '@sei-code/social';
import { SeiAgent } from '@sei-code/core';

export class TelegramService {
  private bot: TelegramBot;

  constructor(agent: SeiAgent, token: string) {
    this.bot = new TelegramBot({
      token,
      agent
    });
  }

  async start() {
    await this.bot.start();
  }

  async stop() {
    await this.bot.stop();
  }

  async sendMessage(chatId: string, message: string) {
    await this.bot.sendMessage(chatId, message);
  }
}`;

    await fs.writeFile(path.join(servicesDir, 'telegram-service.ts'), content);
  }

  private async generateWebhookService(servicesDir: string): Promise<void> {
    const content = `export class WebhookService {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendWebhook(data: any) {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(\`Webhook failed: \${response.status}\`);
      }

      return await response.json();
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }
}`;

    await fs.writeFile(path.join(servicesDir, 'webhook-service.ts'), content);
  }

  private async generateDocumentation(
    outputDir: string,
    projectName: string,
    analysis: AnalyzedRequest,
    options: GenerationOptions
  ): Promise<void> {
    const readme = `# ${projectName}

${analysis.projectType === 'custom' 
  ? 'A custom Sei agent application'
  : `A ${analysis.projectType} application for Sei blockchain`}

## Features

${analysis.features.map(f => `- ${f}`).join('\n')}

## Packages Used

${options.packages.map(p => `- @sei-code/${p}`).join('\n')}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. Start development:
   \`\`\`bash
   npm run dev
   \`\`\`

## Deployment

Deploy to Sei testnet:
\`\`\`bash
npm run deploy:testnet
\`\`\`

Deploy to Sei mainnet:
\`\`\`bash
npm run deploy:mainnet
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── agents/           # Agent implementations
│   ├── services/         # External service integrations
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Main entry point
├── contracts/           # Smart contracts (if applicable)
├── scripts/             # Deployment and utility scripts
├── docs/               # Documentation
└── tests/              # Test files
\`\`\`

## Generated by Sei AI Studio

This project was generated using [Sei AI Studio](https://github.com/sei-agent-studio/sei-agent-studio) - a Claude Code-style CLI for building Sei blockchain applications with natural language.
`;

    await fs.writeFile(path.join(outputDir, 'README.md'), readme);
  }

  private async generateDeploymentScripts(outputDir: string, network: string): Promise<void> {
    const scriptsDir = path.join(outputDir, 'scripts');
    await fs.ensureDir(scriptsDir);

    const deployScript = `import { SeiAgent } from '@sei-code/core';
import { SeiWallet } from '@sei-code/wallets';
import dotenv from 'dotenv';

dotenv.config();

async function deploy() {
  const network = process.argv.includes('--network') 
    ? process.argv[process.argv.indexOf('--network') + 1]
    : 'testnet';

  console.log(\`🚀 Deploying to \${network}...\`);

  try {
    // Initialize wallet for deployment
    const wallet = new SeiWallet({
      type: 'private-key',
      network,
      privateKey: process.env.PRIVATE_KEY
    });

    await wallet.connect();
    console.log(\`📍 Deployer address: \${wallet.getAddress()}\`);

    // Add your deployment logic here
    console.log('✅ Deployment completed successfully!');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

deploy().catch(console.error);`;

    await fs.writeFile(path.join(scriptsDir, 'deploy.js'), deployScript);
  }

  private async installDependencies(outputDir: string): Promise<void> {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install'], {
        cwd: outputDir,
        stdio: 'pipe'
      });

      npm.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });

      npm.on('error', reject);
    });
  }

  private async addPackagesToProject(projectPath: string, newPackages: string[]): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    newPackages.forEach(pkg => {
      packageJson.dependencies[`@sei-code/${pkg}`] = '^1.0.0';
    });
    
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }

  private async addFeaturesToProject(
    projectPath: string,
    newFeatures: string[],
    template: string
  ): Promise<void> {
    // This would implement adding new features to existing project files
    // For now, just log what would be added
    console.log(chalk.blue(`Would add features: ${newFeatures.join(', ')}`));
  }

  private async addIntegrationsToProject(
    projectPath: string,
    newIntegrations: any[]
  ): Promise<void> {
    // This would implement adding new integrations to existing project
    // For now, just log what would be added
    console.log(chalk.blue(`Would add integrations: ${newIntegrations.map(i => i.type).join(', ')}`));
  }
}