import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { NaturalLanguageAnalyzer } from '../nlp/analyzer.js';
import { ProjectGenerator } from '../generator/project-generator.js';
import { ProjectManager } from '../utils/project-manager.js';
import type { CLIOptions, AnalyzedRequest } from '../types.js';

interface StudioSession {
  projects: Array<{
    name: string;
    path: string;
    description: string;
    created: Date;
  }>;
  currentProject?: string;
}

export function createStudioCommand(): Command {
  const studio = new Command('studio');
  
  studio
    .description('Launch interactive Sei AI Studio - Claude Code-style interface')
    .option('-v, --verbose', 'Verbose output', false)
    .option('--no-banner', 'Skip the welcome banner', false)
    .action(async (options: CLIOptions) => {
      try {
        await runStudio(options);
      } catch (error: any) {
        console.error(chalk.red(`❌ Studio error: ${error.message}`));
        if (options.verbose && error.stack) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      }
    });

  return studio;
}

async function runStudio(options: CLIOptions): Promise<void> {
  const analyzer = new NaturalLanguageAnalyzer();
  const generator = new ProjectGenerator();
  const projectManager = new ProjectManager();
  
  let session: StudioSession = {
    projects: []
  };

  if (!options.noBanner) {
    showWelcomeBanner();
  }

  console.log(chalk.gray('Type "help" for commands, "exit" to quit\n'));

  // Main interactive loop
  while (true) {
    try {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.blue('sei-ai-studio>'),
          prefix: '🤖',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Please enter a command or description';
            }
            return true;
          }
        }
      ]);

      const command = input.trim().toLowerCase();
      
      // Handle built-in commands
      if (command === 'exit' || command === 'quit') {
        console.log(chalk.yellow('👋 Thanks for using Sei AI Studio!'));
        break;
      }
      
      if (command === 'help') {
        showHelp();
        continue;
      }
      
      if (command === 'list' || command === 'projects') {
        listProjects(session);
        continue;
      }
      
      if (command === 'clear') {
        console.clear();
        if (!options.noBanner) {
          showWelcomeBanner();
        }
        continue;
      }

      if (command.startsWith('enhance ')) {
        await handleEnhanceCommand(command, analyzer, generator, options);
        continue;
      }

      if (command.startsWith('deploy ')) {
        await handleDeployCommand(command, options);
        continue;
      }

      // Try to analyze as a natural language generation request
      await handleGenerationRequest(input, analyzer, generator, session, options);
      
    } catch (error: any) {
      if (error.name === 'ExitPromptError') {
        console.log(chalk.yellow('\n👋 Thanks for using Sei AI Studio!'));
        break;
      }
      console.error(chalk.red(`❌ Error: ${error.message}`));
      if (options.verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
      console.log(chalk.gray('Type "help" for available commands\n'));
    }
  }
}

function showWelcomeBanner(): void {
  const title = figlet.textSync('Sei AI Studio', { 
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  
  const gradientTitle = gradient(['#932C23', '#FF6B35'])(title);
  console.log(gradientTitle);
  
  const banner = boxen(
    chalk.white.bold('🤖 Build AI dApps with Natural Language\n') +
    chalk.gray('Powered by @sei-code packages\n') +
    chalk.cyan('🚀 Ready to generate your next Sei application!'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'blue',
      backgroundColor: '#1a1a2e'
    }
  );
  
  console.log(banner);
}

function showHelp(): void {
  const helpText = `
${chalk.bold.blue('🤖 Sei AI Studio Commands:')}

${chalk.bold('Generation:')}
  ${chalk.cyan('Build a DeFi portfolio tracker')}    Generate a new dApp from description
  ${chalk.cyan('Create voting app with Telegram')}    Generate with specific integrations
  ${chalk.cyan('Make an NFT marketplace agent')}      Generate specialized applications

${chalk.bold('Project Management:')}
  ${chalk.cyan('list')} / ${chalk.cyan('projects')}                    Show generated projects
  ${chalk.cyan('enhance <project> <description>')}    Add features to existing project
  ${chalk.cyan('deploy <project> --network testnet')} Deploy project to Sei network

${chalk.bold('Utility:')}
  ${chalk.cyan('help')}                               Show this help message
  ${chalk.cyan('clear')}                              Clear the screen
  ${chalk.cyan('exit')} / ${chalk.cyan('quit')}                        Exit the studio

${chalk.bold('Examples:')}
  ${chalk.gray('🤖 sei-ai-studio>')} Build a governance voting dApp with Telegram notifications
  ${chalk.gray('🤖 sei-ai-studio>')} Create a DeFi bot that tracks portfolio and sends alerts
  ${chalk.gray('🤖 sei-ai-studio>')} Make an NFT trading agent with automated strategies
  ${chalk.gray('🤖 sei-ai-studio>')} enhance my-voting-app add price monitoring using oracle data

${chalk.bold('Tips:')}
  • Be specific about features you want (Telegram, analytics, etc.)
  • Mention integrations and data sources
  • Use "enhance" to add features to existing projects
  • All projects use Sei-optimized @sei-code packages
`;
  
  console.log(helpText);
}

function listProjects(session: StudioSession): void {
  if (session.projects.length === 0) {
    console.log(chalk.yellow('📂 No projects generated yet'));
    console.log(chalk.gray('Try: "Build a DeFi portfolio tracker"\n'));
    return;
  }

  console.log(chalk.bold.blue('📂 Generated Projects:'));
  session.projects.forEach((project, index) => {
    const age = new Date().getTime() - project.created.getTime();
    const ageStr = age < 60000 ? 'just now' : 
                   age < 3600000 ? `${Math.floor(age / 60000)}m ago` :
                   `${Math.floor(age / 3600000)}h ago`;
    
    console.log(`  ${index + 1}. ${chalk.bold(project.name)}`);
    console.log(`     ${chalk.gray(project.description)}`);
    console.log(`     ${chalk.cyan(project.path)} ${chalk.gray(`(${ageStr})`)}`);
  });
  console.log('');
}

async function handleGenerationRequest(
  input: string, 
  analyzer: NaturalLanguageAnalyzer,
  generator: ProjectGenerator,
  session: StudioSession,
  options: CLIOptions
): Promise<void> {
  const spinner = ora('🧠 Analyzing your request...').start();
  
  try {
    const analysis = analyzer.analyze(input);
    
    spinner.succeed(chalk.green(`✅ Analysis complete! (${analysis.confidence}% confidence)`));
    
    // Show analysis results
    console.log(chalk.bold('\n📋 Detected Requirements:'));
    console.log(`  Project Type: ${chalk.cyan(analysis.projectType)}`);
    console.log(`  Packages: ${chalk.cyan(analysis.packages.filter(p => p.required).map(p => p.name).join(', '))}`);
    
    if (analysis.features.length > 0) {
      console.log(`  Features: ${chalk.cyan(analysis.features.join(', '))}`);
    }
    
    if (analysis.integrations.length > 0) {
      console.log(`  Integrations: ${chalk.cyan(analysis.integrations.map(i => i.type).join(', '))}`);
    }

    // Generate project name and show preview
    const projectName = analyzer.generateProjectName(input, analysis.projectType);
    const outputDir = `./${projectName}`;
    
    console.log(`\n📦 Will generate: ${chalk.bold(projectName)}`);
    console.log(`📍 Location: ${chalk.gray(outputDir)}`);

    // Confirm generation
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Generate this project?',
        default: true
      }
    ]);

    if (!proceed) {
      console.log(chalk.yellow('❌ Generation cancelled\n'));
      return;
    }

    // Generate the project
    spinner.start('🏗️ Generating project...');
    
    const generationOptions = {
      projectName,
      outputDir,
      template: getTemplateForProjectType(analysis.projectType),
      packages: [...new Set(analysis.packages.map(p => p.name))],
      features: analysis.features,
      network: 'testnet' as const,
      integrations: analysis.integrations,
      skipInstall: false,
      dryRun: false
    };

    await generator.generateProject(generationOptions, analysis);
    
    spinner.succeed(chalk.green('✅ Project generated successfully!'));
    
    // Add to session
    session.projects.push({
      name: projectName,
      path: outputDir,
      description: analyzer.generateProjectDescription(input, analysis),
      created: new Date()
    });

    // Show success message
    console.log(chalk.bold('\n🎉 Your dApp is ready!'));
    console.log(`📍 Generated at: ${chalk.cyan(outputDir)}`);
    console.log('\n📖 Next steps:');
    console.log(chalk.cyan(`  cd ${outputDir}`));
    console.log(chalk.cyan('  cp .env.example .env  # Configure your environment'));
    console.log(chalk.cyan('  npm run dev          # Start development'));
    
    if (analysis.integrations.some(i => i.type === 'telegram')) {
      console.log(chalk.yellow('\n💡 Don\'t forget to set up your TELEGRAM_BOT_TOKEN in .env'));
    }
    
    console.log('');
    
  } catch (error: any) {
    spinner.fail(chalk.red('❌ Generation failed'));
    throw error;
  }
}

async function handleEnhanceCommand(
  command: string,
  analyzer: NaturalLanguageAnalyzer,
  generator: ProjectGenerator,
  options: CLIOptions
): Promise<void> {
  const parts = command.split(' ').slice(1);
  if (parts.length < 2) {
    console.log(chalk.red('❌ Usage: enhance <project-path> <description>'));
    console.log(chalk.gray('Example: enhance ./my-voting-app add price monitoring using oracle data'));
    return;
  }
  
  const projectPath = parts[0];
  const description = parts.slice(1).join(' ');
  
  console.log(chalk.yellow('🔧 Enhancement feature coming soon!'));
  console.log(chalk.gray(`Would enhance: ${projectPath}`));
  console.log(chalk.gray(`With: ${description}`));
}

async function handleDeployCommand(command: string, options: CLIOptions): Promise<void> {
  console.log(chalk.yellow('🚀 Deployment feature coming soon!'));
  console.log(chalk.gray('Will integrate with Sei testnet/mainnet deployment'));
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