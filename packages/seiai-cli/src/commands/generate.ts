import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { NaturalLanguageAnalyzer } from '../nlp/analyzer.js';
import { ProjectGenerator } from '../generator/project-generator.js';
import type { CLIOptions } from '../types.js';

export function createGenerateCommand(): Command {
  const generate = new Command('generate');
  
  generate
    .description('Generate a Sei dApp from natural language description')
    .argument('<description>', 'Natural language description of the dApp you want to build')
    .option('-n, --network <network>', 'Target network (testnet, mainnet, devnet)', 'testnet')
    .option('-o, --output <dir>', 'Output directory')
    .option('-t, --template <template>', 'Template to use (voting-app, defi-app, social-bot, nft-trader)')
    .option('-p, --packages <packages>', 'Comma-separated list of additional packages to include')
    .option('--skip-install', 'Skip npm install', false)
    .option('--dry-run', 'Show what would be generated without creating files', false)
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (description: string, options: CLIOptions) => {
      let spinner: any;
      try {
        spinner = ora('🤖 Analyzing your description...').start();

        const analyzer = new NaturalLanguageAnalyzer();
        const analysis = analyzer.analyze(description);

        spinner.succeed(chalk.green(`✅ Analysis complete! (${analysis.confidence}% confidence)`));
        
        // Always show basic analysis results
        console.log('\n📋 Detected Requirements:');
        console.log(`  Project Type: ${chalk.cyan(analysis.projectType)}`);
        console.log(`  Packages: ${chalk.cyan(analysis.packages.filter(p => p.required).map(p => p.name).join(', '))}`);
        console.log(`  Features: ${chalk.cyan(analysis.features.join(', '))}`);

        if (options.verbose) {
          console.log('\n🔍 Detailed Analysis:');
          console.log(`  Intent: ${analysis.intent}`);
          console.log(`  Confidence: ${analysis.confidence}%`);
          console.log(`  Integrations: ${analysis.integrations.map(i => i.type).join(', ')}`);
        }
        
        // Generate project name if not specified
        const projectName = analyzer.generateProjectName(description, analysis.projectType);
        const outputDir = options.output || `./${projectName}`;

        console.log(`\n📦 Will generate: ${chalk.green(projectName)}`);
        console.log(`📍 Location: ${chalk.cyan(outputDir)}`);

        // Merge CLI options with analysis
        const packages = [
          ...analysis.packages.map(p => p.name),
          ...(options.packages ? options.packages : [])
        ];
        
        const generationOptions = {
          projectName,
          outputDir,
          template: options.template || getTemplateForProjectType(analysis.projectType),
          packages: [...new Set(packages)], // Remove duplicates
          features: analysis.features,
          network: (options.network as 'mainnet' | 'testnet' | 'devnet') || 'testnet',
          integrations: analysis.integrations,
          skipInstall: options.skipInstall || false,
          dryRun: options.dryRun || false
        };
        
        if (options.dryRun) {
          console.log('\n🔍 Dry Run - Would generate:');
          console.log(`  Project: ${generationOptions.projectName}`);
          console.log(`  Directory: ${generationOptions.outputDir}`);
          console.log(`  Template: ${generationOptions.template}`);
          console.log(`  Packages: ${generationOptions.packages.join(', ')}`);
          console.log(`  Features: ${generationOptions.features.join(', ')}`);
          console.log(`  Network: ${generationOptions.network}`);
          return;
        }
        
        // Confirm generation (unless non-interactive)
        if (process.stdout.isTTY) {
          const { proceed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: `Generate this project?`,
              default: true
            }
          ]);

          if (!proceed) {
            console.log(chalk.yellow('🚫 Generation cancelled.'));
            return;
          }
        }

        // Generate the project
        console.log('\n🏗️ Generating project...');

        const generator = new ProjectGenerator();
        await generator.generateProject(generationOptions, analysis);

        console.log(chalk.green(`\n✅ Project generated successfully!`));
        
        // Show next steps
        console.log('\n🚀 Next Steps:');
        console.log(chalk.cyan(`  cd ${outputDir}`));
        if (generationOptions.skipInstall) {
          console.log(chalk.cyan('  npm install'));
        }
        console.log(chalk.cyan('  npm run dev'));
        console.log(chalk.cyan('  seiai deploy --network testnet'));
        
      } catch (error: any) {
        console.error(chalk.red(`❌ Failed to generate project: ${error.message}`));
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  return generate;
}

function getTemplateForProjectType(projectType: string): string {
  switch (projectType) {
    case 'voting':
    case 'governance':
      return 'voting-app';
    case 'defi':
      return 'defi-app';
    case 'social':
      return 'social-bot';
    case 'nft':
      return 'nft-trader';
    default:
      return 'custom';
  }
}