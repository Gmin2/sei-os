import 'dotenv/config';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface DeployConfig {
  network: 'testnet' | 'mainnet';
  environment: 'development' | 'staging' | 'production';
  autoStart: boolean;
  healthCheck: boolean;
}

class Deployer {
  private config: DeployConfig;

  constructor(config: DeployConfig) {
    this.config = config;
  }

  async deploy(): Promise<void> {
    console.log('🚀 Starting deployment of Sei Governance Voting App...');
    console.log(`📍 Network: ${this.config.network}`);
    console.log(`🏗️  Environment: ${this.config.environment}`);

    try {
      await this.validateEnvironment();
      await this.buildApplication();
      await this.runTests();
      await this.createDeploymentPackage();
      
      if (this.config.autoStart) {
        await this.startApplication();
      }

      if (this.config.healthCheck) {
        await this.performHealthCheck();
      }

      console.log('✅ Deployment completed successfully!');
      this.printDeploymentSummary();
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating environment...');

    const requiredVars = [
      'PRIVATE_KEY',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'GEMINI_API_KEY',
      'SEI_RPC_URL'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate Telegram bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
      console.log('📱 Validating Telegram bot...');
      try {
        const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
        const result = await response.json();
        
        if (!result.ok) {
          throw new Error('Invalid Telegram bot token');
        }
        
        console.log(`✅ Telegram bot validated: ${result.result.username}`);
      } catch (error) {
        throw new Error(`Telegram bot validation failed: ${error.message}`);
      }
    }

    // Validate Sei RPC
    console.log('🔗 Validating Sei RPC connection...');
    try {
      const response = await fetch(process.env.SEI_RPC_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(`RPC error: ${result.error.message}`);
      }
      
      const chainId = parseInt(result.result, 16);
      const expectedChainId = this.config.network === 'testnet' ? 713715 : 1329;
      
      if (chainId !== expectedChainId) {
        throw new Error(`Wrong chain ID: expected ${expectedChainId}, got ${chainId}`);
      }
      
      console.log(`✅ Sei RPC validated: Chain ID ${chainId}`);
    } catch (error) {
      throw new Error(`Sei RPC validation failed: ${error.message}`);
    }

    console.log('✅ Environment validation passed');
  }

  private async buildApplication(): Promise<void> {
    console.log('🏗️  Building application...');
    
    try {
      execSync('pnpm build', { stdio: 'inherit', cwd: process.cwd() });
      console.log('✅ Application built successfully');
    } catch (error) {
      throw new Error('Build failed');
    }
  }

  private async runTests(): Promise<void> {
    console.log('🧪 Running tests...');
    
    // For now, skip tests if test script doesn't exist
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    
    if (packageJson.scripts && packageJson.scripts.test) {
      try {
        execSync('pnpm test', { stdio: 'inherit', cwd: process.cwd() });
        console.log('✅ All tests passed');
      } catch (error) {
        throw new Error('Tests failed');
      }
    } else {
      console.log('⏭️  No test script found, skipping tests');
    }
  }

  private async createDeploymentPackage(): Promise<void> {
    console.log('📦 Creating deployment package...');
    
    const deploymentInfo = {
      version: JSON.parse(readFileSync('package.json', 'utf8')).version,
      timestamp: new Date().toISOString(),
      network: this.config.network,
      environment: this.config.environment,
      commit: this.getGitCommitHash(),
      buildNumber: this.generateBuildNumber()
    };

    writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('✅ Deployment package created');
  }

  private async startApplication(): Promise<void> {
    console.log('🚀 Starting application...');
    
    // In a real deployment, this might start a PM2 process, systemd service, etc.
    // For demo purposes, we'll just show the command
    console.log('📋 To start the application, run:');
    console.log('   pnpm start');
    console.log('📋 Or for development:');
    console.log('   pnpm dev');
  }

  private async performHealthCheck(): Promise<void> {
    console.log('🏥 Performing health check...');
    
    // Basic health checks
    const checks = [
      { name: 'Config files', check: () => existsSync('.env') },
      { name: 'Build artifacts', check: () => existsSync('dist') },
      { name: 'Package dependencies', check: () => existsSync('node_modules') }
    ];

    for (const { name, check } of checks) {
      if (check()) {
        console.log(`✅ ${name}: OK`);
      } else {
        console.log(`❌ ${name}: FAILED`);
        throw new Error(`Health check failed: ${name}`);
      }
    }

    console.log('✅ Health check passed');
  }

  private getGitCommitHash(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private generateBuildNumber(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private printDeploymentSummary(): void {
    const deploymentInfo = JSON.parse(readFileSync('deployment-info.json', 'utf8'));
    
    console.log('\n📋 Deployment Summary');
    console.log('='.repeat(50));
    console.log(`Version: ${deploymentInfo.version}`);
    console.log(`Build: ${deploymentInfo.buildNumber}`);
    console.log(`Network: ${deploymentInfo.network}`);
    console.log(`Environment: ${deploymentInfo.environment}`);
    console.log(`Timestamp: ${deploymentInfo.timestamp}`);
    console.log(`Commit: ${deploymentInfo.commit.substring(0, 7)}`);
    console.log('='.repeat(50));
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Update your .env file with production values');
    console.log('2. Start the application: pnpm start');
    console.log('3. Monitor logs for any issues');
    console.log('4. Test Telegram bot functionality');
    console.log('5. Verify governance proposal monitoring');
    
    if (this.config.network === 'testnet') {
      console.log('\n⚠️  Testnet Deployment Notes:');
      console.log('• This is a testnet deployment - no real funds at risk');
      console.log('• Monitor testnet proposal activity');
      console.log('• Test all Telegram commands thoroughly');
    } else {
      console.log('\n⚠️  Mainnet Deployment Notes:');
      console.log('• This is a MAINNET deployment - real funds and votes');
      console.log('• Double-check all configuration');
      console.log('• Monitor proposal voting carefully');
      console.log('• Set up proper monitoring and alerts');
    }
  }
}

async function main() {
  const config: DeployConfig = {
    network: (process.env.NETWORK as 'testnet' | 'mainnet') || 'testnet',
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    autoStart: process.argv.includes('--start'),
    healthCheck: !process.argv.includes('--no-health-check')
  };

  const deployer = new Deployer(config);
  await deployer.deploy();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}