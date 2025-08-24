import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { DeploymentManager } from '../deployment/deployment-manager.js';
import type { CLIOptions, ProjectInfo } from '../types.js';

export function createDeployCommand(): Command {
  const deploy = new Command('deploy');
  
  deploy
    .description('Deploy a Sei dApp to the specified network')
    .option('-n, --network <network>', 'Target network (testnet, mainnet, devnet)', 'testnet')
    .option('-p, --project <dir>', 'Project directory to deploy', '.')
    .option('--estimate', 'Estimate deployment cost without deploying', false)
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (options: CLIOptions) => {
      try {
        const projectPath = path.resolve(options.project || '.');
        const network = options.network || 'testnet';
        
        // Validate project directory
        if (!(await fs.pathExists(projectPath))) {
          throw new Error(`Project directory not found: ${projectPath}`);
        }
        
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (!(await fs.pathExists(packageJsonPath))) {
          throw new Error(`Not a valid project directory: ${projectPath} (missing package.json)`);
        }
        
        const packageJson = await fs.readJson(packageJsonPath);
        const projectInfo = await loadProjectInfo(projectPath, packageJson);
        
        const deploymentManager = new DeploymentManager();
        
        if (options.estimate) {
          const spinner = ora('📊 Estimating deployment cost...').start();
          
          try {
            const estimate = await deploymentManager.estimateDeploymentCost(projectInfo, network);
            spinner.succeed(chalk.green('✅ Cost estimation complete!'));
            
            console.log('\n💰 Deployment Cost Estimate:');
            console.log(`  Gas Estimate: ${estimate.gasEstimate}`);
            console.log(`  Fee Estimate: ${estimate.feeEstimate} ${estimate.currency}`);
            console.log(`  Network: ${network}`);
            
          } catch (error: any) {
            spinner.fail(chalk.red(`❌ Cost estimation failed: ${error.message}`));
            process.exit(1);
          }
          return;
        }
        
        // Show deployment info
        console.log('\n🚀 Deployment Information:');
        console.log(`  Project: ${projectInfo.name}`);
        console.log(`  Network: ${network}`);
        console.log(`  Directory: ${projectPath}`);
        
        // Warn for mainnet deployment
        if (network === 'mainnet') {
          console.log(chalk.yellow('\n⚠️  WARNING: You are about to deploy to MAINNET!'));
          console.log(chalk.yellow('This will use real SEI tokens and cannot be undone.'));
        }
        
        // Confirm deployment
        if (process.stdout.isTTY) {
          const { proceed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: `Deploy "${projectInfo.name}" to ${network}?`,
              default: network !== 'mainnet'
            }
          ]);
          
          if (!proceed) {
            console.log(chalk.yellow('🚫 Deployment cancelled.'));
            return;
          }
        }
        
        // Perform deployment
        const spinner = ora(`🚀 Deploying to ${network}...`).start();
        
        try {
          const result = await deploymentManager.deploy(projectInfo, network);
          
          spinner.succeed(chalk.green(`✅ Deployed to ${network}!`));
          
          console.log('\n📋 Deployment Results:');
          console.log(`  Network: ${result.network}`);
          console.log(`  Transaction: ${result.txHash}`);
          if (result.contractAddress) {
            console.log(`  Contract: ${result.contractAddress}`);
          }
          console.log(`  Status: ${result.status}`);
          console.log(`  Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
          
          // Save deployment info
          await saveDeploymentInfo(projectPath, result);
          
          // Show next steps
          console.log('\n🎉 Deployment Complete!');
          if (network === 'testnet') {
            console.log(chalk.cyan('  View on Sei Explorer: https://sei-explorer.com'));
          } else if (network === 'mainnet') {
            console.log(chalk.cyan('  View on Sei Explorer: https://www.seiscan.app'));
          }
          
        } catch (error: any) {
          spinner.fail(chalk.red(`❌ Deployment failed: ${error.message}`));
          
          if (options.verbose) {
            console.error('\n🔍 Error Details:');
            console.error(error.stack);
          }
          
          console.log('\n💡 Troubleshooting Tips:');
          console.log('  • Check your wallet has sufficient SEI balance');
          console.log('  • Verify your network configuration');
          console.log('  • Ensure all environment variables are set');
          console.log('  • Try running with --verbose for more details');
          
          process.exit(1);
        }
        
      } catch (error: any) {
        console.error(chalk.red(`❌ Deployment setup failed: ${error.message}`));
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  return deploy;
}

async function loadProjectInfo(projectPath: string, packageJson: any): Promise<ProjectInfo> {
  // Try to load existing deployment info
  const deploymentInfoPath = path.join(projectPath, '.sei-deployments.json');
  let deployments = [];
  
  if (await fs.pathExists(deploymentInfoPath)) {
    const deploymentData = await fs.readJson(deploymentInfoPath);
    deployments = deploymentData.deployments || [];
  }
  
  // Infer project config
  const dependencies = packageJson.dependencies || {};
  const seiPackages = Object.keys(dependencies)
    .filter(dep => dep.startsWith('@sei-code/'))
    .map(dep => dep.replace('@sei-code/', ''));
  
  return {
    name: packageJson.name,
    path: projectPath,
    config: {
      name: packageJson.name,
      description: packageJson.description || '',
      packages: seiPackages,
      features: [],
      template: 'custom',
      network: 'testnet'
    },
    lastModified: new Date().toISOString(),
    deployments
  };
}

async function saveDeploymentInfo(projectPath: string, deployment: any): Promise<void> {
  const deploymentInfoPath = path.join(projectPath, '.sei-deployments.json');
  
  let deploymentData: { deployments: any[] } = { deployments: [] };
  if (await fs.pathExists(deploymentInfoPath)) {
    deploymentData = await fs.readJson(deploymentInfoPath);
  }
  
  deploymentData.deployments = deploymentData.deployments || [];
  deploymentData.deployments.push(deployment);
  
  await fs.writeJson(deploymentInfoPath, deploymentData, { spaces: 2 });
}