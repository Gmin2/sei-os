import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { NaturalLanguageAnalyzer } from '../nlp/analyzer.js';
import { ProjectGenerator } from '../generator/project-generator.js';
import type { CLIOptions, ProjectInfo } from '../types.js';

export function createEnhanceCommand(): Command {
  const enhance = new Command('enhance');
  
  enhance
    .description('Enhance an existing Sei dApp with new features')
    .argument('<project>', 'Project directory to enhance')
    .argument('<description>', 'Natural language description of features to add')
    .option('-v, --verbose', 'Verbose output', false)
    .option('--dry-run', 'Show what would be added without making changes', false)
    .action(async (projectPath: string, description: string, options: CLIOptions) => {
      try {
        // Validate project directory
        if (!(await fs.pathExists(projectPath))) {
          throw new Error(`Project directory not found: ${projectPath}`);
        }
        
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (!(await fs.pathExists(packageJsonPath))) {
          throw new Error(`Not a valid project directory: ${projectPath} (missing package.json)`);
        }
        
        const spinner = ora('🔍 Analyzing enhancement request...').start();
        
        // Load existing project configuration
        const packageJson = await fs.readJson(packageJsonPath);
        const projectConfig = await loadProjectConfig(projectPath, packageJson);
        
        // Analyze enhancement description
        const analyzer = new NaturalLanguageAnalyzer();
        const analysis = analyzer.analyze(description);
        analysis.intent = 'enhance'; // Override intent
        
        spinner.succeed(chalk.green('✅ Enhancement analysis complete!'));
        
        if (options.verbose) {
          console.log('\n📋 Enhancement Analysis:');
          console.log(`  Current Packages: ${projectConfig.config.packages.join(', ')}`);
          console.log(`  New Packages: ${analysis.packages.filter(p => p.required).map(p => p.name).join(', ')}`);
          console.log(`  New Features: ${analysis.features.join(', ')}`);
          console.log(`  New Integrations: ${analysis.integrations.map(i => i.type).join(', ')}`);
        }
        
        // Show what will be added
        const newPackages = analysis.packages
          .filter(p => p.required && !projectConfig.config.packages.includes(p.name))
          .map(p => p.name);
        
        const newFeatures = analysis.features
          .filter(f => !projectConfig.config.features.includes(f));
        
        const newIntegrations = analysis.integrations
          .filter(i => !projectConfig.config.packages.includes('social') || i.type !== 'telegram');
        
        if (newPackages.length === 0 && newFeatures.length === 0 && newIntegrations.length === 0) {
          console.log(chalk.yellow('⚠️  No new enhancements detected. The project might already have these features.'));
          return;
        }
        
        console.log('\n🔧 Planned Enhancements:');
        if (newPackages.length > 0) {
          console.log(chalk.cyan('  New Packages:'));
          newPackages.forEach(pkg => console.log(chalk.white(`    + @sei-code/${pkg}`)));
        }
        if (newFeatures.length > 0) {
          console.log(chalk.cyan('  New Features:'));
          newFeatures.forEach(feature => console.log(chalk.white(`    + ${feature}`)));
        }
        if (newIntegrations.length > 0) {
          console.log(chalk.cyan('  New Integrations:'));
          newIntegrations.forEach(integration => console.log(chalk.white(`    + ${integration.type}`)));
        }
        
        if (options.dryRun) {
          console.log('\n🔍 Dry run complete - no changes made.');
          return;
        }
        
        // Confirm enhancement
        if (process.stdout.isTTY) {
          const { proceed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: 'Apply these enhancements to your project?',
              default: true
            }
          ]);
          
          if (!proceed) {
            console.log(chalk.yellow('🚫 Enhancement cancelled.'));
            return;
          }
        }
        
        // Apply enhancements
        spinner.start('🔧 Applying enhancements...');
        
        const generator = new ProjectGenerator();
        await generator.enhanceProject(projectConfig, analysis);
        
        spinner.succeed(chalk.green('✅ Project enhanced successfully!'));
        
        // Show next steps
        if (newPackages.length > 0) {
          console.log('\n📦 New packages added. Run:');
          console.log(chalk.cyan('  npm install'));
        }
        
        console.log('\n🚀 Next Steps:');
        console.log(chalk.cyan('  npm run build'));
        console.log(chalk.cyan('  npm run dev'));
        
      } catch (error: any) {
        console.error(chalk.red(`❌ Failed to enhance project: ${error.message}`));
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  return enhance;
}

async function loadProjectConfig(projectPath: string, packageJson: any): Promise<ProjectInfo> {
  // Try to load existing sei-agent config
  const configPath = path.join(projectPath, 'sei-agent.json');
  let config;
  
  if (await fs.pathExists(configPath)) {
    config = await fs.readJson(configPath);
  } else {
    // Infer config from package.json
    const dependencies = packageJson.dependencies || {};
    const seiPackages = Object.keys(dependencies)
      .filter(dep => dep.startsWith('@sei-code/'))
      .map(dep => dep.replace('@sei-code/', ''));
    
    config = {
      name: packageJson.name,
      description: packageJson.description || '',
      packages: seiPackages,
      features: [],
      template: inferTemplate(seiPackages),
      network: 'testnet'
    };
  }
  
  return {
    name: config.name,
    path: projectPath,
    config,
    lastModified: new Date().toISOString(),
    deployments: []
  };
}

function inferTemplate(packages: string[]): 'voting-app' | 'defi-app' | 'social-bot' | 'nft-trader' | 'custom' {
  if (packages.includes('governance')) return 'voting-app';
  if (packages.includes('nft')) return 'nft-trader';
  if (packages.includes('social')) return 'social-bot';
  if (packages.includes('precompiles') && packages.includes('analytics')) return 'defi-app';
  return 'custom';
}