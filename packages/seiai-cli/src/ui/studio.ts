import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import ora from 'ora';
import { NaturalLanguageAnalyzer } from '../nlp/analyzer.js';
import { ProjectGenerator } from '../generator/project-generator.js';
import { DeploymentManager } from '../deployment/deployment-manager.js';
import type { StudioSession, ProjectInfo, AnalyzedRequest, GenerationOptions } from '../types.js';

export class StudioInterface {
  private analyzer = new NaturalLanguageAnalyzer();
  private generator = new ProjectGenerator();
  private deployment = new DeploymentManager();
  private session: StudioSession;

  constructor() {
    this.session = {
      id: `session_${Date.now()}`,
      startTime: new Date().toISOString(),
      projects: [],
      currentProject: undefined
    };
  }

  async start(): Promise<void> {
    this.printWelcomeBanner();
    await this.mainLoop();
  }

  private printWelcomeBanner(): void {
    console.clear();
    
    const title = figlet.textSync('Sei AI Studio', {
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted'
    });
    
    const gradientTitle = gradient(['#932C23', '#FF6B35'])(title);
    console.log(gradientTitle);
    
    const subtitle = boxen(
      chalk.white('🤖 Build AI dApps with Natural Language\n') +
      chalk.gray('Powered by @sei-code packages for Sei blockchain'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: '#932C23',
        backgroundColor: '#0D1117',
        textAlignment: 'center'
      }
    );
    
    console.log(subtitle);
    
    const helpText = chalk.dim(
      '• Type your dApp idea in natural language\n' +
      '• Use "enhance <project>" to add features\n' +
      '• Use "deploy" to deploy to Sei network\n' +
      '• Use "list" to see your projects\n' +
      '• Use "exit" or Ctrl+C to quit'
    );
    
    console.log(helpText + '\n');
  }

  private async mainLoop(): Promise<void> {
    while (true) {
      try {
        const { input } = await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: chalk.cyan('> What would you like to build today?'),
            prefix: ''
          }
        ]);

        const trimmedInput = input.trim();
        if (!trimmedInput) continue;

        // Handle special commands
        if (await this.handleSpecialCommand(trimmedInput)) {
          continue;
        }

        // Process as natural language dApp request
        await this.processNaturalLanguageRequest(trimmedInput);
        
      } catch (error: any) {
        if (error.name === 'ExitPromptError') {
          console.log(chalk.yellow('\n👋 Thanks for using Sei AI Studio!'));
          break;
        }
        console.error(chalk.red(`Error: ${error.message}`));
      }
    }
  }

  private async handleSpecialCommand(input: string): Promise<boolean> {
    const [command, ...args] = input.split(' ');
    
    switch (command.toLowerCase()) {
      case 'exit':
      case 'quit':
        console.log(chalk.yellow('\n👋 Thanks for using Sei AI Studio!'));
        process.exit(0);
        
      case 'help':
        this.printHelp();
        return true;
        
      case 'list':
        this.listProjects();
        return true;
        
      case 'clear':
        console.clear();
        this.printWelcomeBanner();
        return true;
        
      case 'deploy':
        await this.handleDeploy(args);
        return true;
        
      case 'enhance':
        await this.handleEnhance(args);
        return true;
        
      case 'cd':
        await this.handleChangeProject(args);
        return true;
        
      case 'status':
        this.showProjectStatus();
        return true;
    }
    
    return false;
  }

  private async processNaturalLanguageRequest(input: string): Promise<void> {
    const spinner = ora('🤖 Analyzing your request...').start();
    
    try {
      // Analyze the natural language input
      const analysis = this.analyzer.analyze(input);
      
      spinner.text = '📦 Detecting required packages...';
      await this.sleep(1000);
      
      spinner.text = '🏗️  Planning project structure...';
      await this.sleep(800);
      
      spinner.succeed(chalk.green('✅ Analysis complete!'));
      
      // Show analysis results
      this.displayAnalysis(analysis);
      
      // Ask for confirmation
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Generate this project?',
          default: true
        }
      ]);
      
      if (!proceed) {
        console.log(chalk.yellow('🚫 Project generation cancelled.'));
        return;
      }
      
      // Generate project name and get additional options
      const projectName = this.analyzer.generateProjectName(input, analysis.projectType);
      const options = await this.getGenerationOptions(projectName, analysis);
      
      // Generate the project
      await this.generateProject(options, analysis);
      
    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Failed to process request: ${error.message}`));
    }
  }

  private displayAnalysis(analysis: AnalyzedRequest): void {
    console.log('\n' + boxen(
      chalk.white.bold('📋 Project Analysis\n\n') +
      chalk.cyan('Intent: ') + chalk.white(analysis.intent) + '\n' +
      chalk.cyan('Type: ') + chalk.white(analysis.projectType) + '\n' +
      chalk.cyan('Confidence: ') + chalk.white(`${analysis.confidence}%`) + '\n\n' +
      chalk.cyan('Required Packages:\n') +
      analysis.packages
        .filter(p => p.required)
        .map(p => chalk.white(`  • ${p.name} - ${p.reason}`))
        .join('\n') + '\n\n' +
      (analysis.features.length > 0 ? 
        chalk.cyan('Features:\n') +
        analysis.features.map(f => chalk.white(`  • ${f}`)).join('\n') + '\n\n' : '') +
      (analysis.integrations.length > 0 ?
        chalk.cyan('Integrations:\n') +
        analysis.integrations.map(i => chalk.white(`  • ${i.type}`)).join('\n') : ''),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: '#932C23'
      }
    ));
  }

  private async getGenerationOptions(defaultName: string, analysis: AnalyzedRequest): Promise<GenerationOptions> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: defaultName,
        validate: (input: string) => {
          if (!input.trim()) return 'Project name is required';
          if (!/^[a-z0-9-]+$/.test(input)) return 'Use lowercase letters, numbers, and hyphens only';
          return true;
        }
      },
      {
        type: 'input',
        name: 'outputDir',
        message: 'Output directory:',
        default: `./${defaultName}`,
        validate: (input: string) => input.trim() ? true : 'Output directory is required'
      },
      {
        type: 'list',
        name: 'network',
        message: 'Target network:',
        choices: [
          { name: '🧪 Testnet (recommended for development)', value: 'testnet' },
          { name: '🌐 Mainnet (production)', value: 'mainnet' },
          { name: '🔧 Devnet (local development)', value: 'devnet' }
        ],
        default: 'testnet'
      },
      {
        type: 'checkbox',
        name: 'additionalPackages',
        message: 'Add optional packages:',
        choices: [
          { name: 'Analytics - Portfolio and performance tracking', value: 'analytics' },
          { name: 'Models - AI/LLM integration', value: 'models' },
          { name: 'X402 - Payment and subscription management', value: 'x402' }
        ].filter(choice => !analysis.packages.find(p => p.name === choice.value))
      },
      {
        type: 'confirm',
        name: 'skipInstall',
        message: 'Skip npm install?',
        default: false
      }
    ]);

    return {
      projectName: answers.projectName,
      outputDir: answers.outputDir,
      template: this.getTemplateForProjectType(analysis.projectType),
      packages: [
        ...analysis.packages.map(p => p.name),
        ...answers.additionalPackages
      ],
      features: analysis.features,
      network: answers.network,
      integrations: analysis.integrations,
      skipInstall: answers.skipInstall
    };
  }

  private getTemplateForProjectType(projectType: string): string {
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

  private async generateProject(options: GenerationOptions, analysis: AnalyzedRequest): Promise<void> {
    const spinner = ora('🏗️  Generating project structure...').start();
    
    try {
      await this.generator.generateProject(options, analysis);
      
      const projectInfo: ProjectInfo = {
        name: options.projectName,
        path: options.outputDir,
        config: {
          name: options.projectName,
          description: this.analyzer.generateProjectDescription('', analysis),
          packages: options.packages,
          features: options.features,
          template: options.template as any,
          network: options.network
        },
        lastModified: new Date().toISOString(),
        deployments: []
      };
      
      this.session.projects.push(projectInfo);
      this.session.currentProject = options.projectName;
      
      spinner.succeed(chalk.green(`✅ Generated: ${options.projectName}/`));
      
      this.printNextSteps(options);
      
    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Generation failed: ${error.message}`));
    }
  }

  private printNextSteps(options: GenerationOptions): void {
    console.log('\n' + boxen(
      chalk.white.bold('🚀 Next Steps\n\n') +
      chalk.cyan('1. Navigate to your project:\n') +
      chalk.white(`   cd ${options.outputDir}\n\n`) +
      (!options.skipInstall ? '' : 
        chalk.cyan('2. Install dependencies:\n') +
        chalk.white('   npm install\n\n')) +
      chalk.cyan('3. Start development:\n') +
      chalk.white('   npm run dev\n\n') +
      chalk.cyan('4. Deploy to Sei:\n') +
      chalk.white('   seiai deploy --network testnet\n\n') +
      chalk.dim('Type "help" for more commands'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: '#932C23'
      }
    ));
  }

  private printHelp(): void {
    console.log('\n' + boxen(
      chalk.white.bold('🤖 Sei AI Studio Commands\n\n') +
      chalk.cyan('Natural Language:\n') +
      chalk.white('  "I want to build a voting app for Sei"\n') +
      chalk.white('  "Create a DeFi bot with Telegram notifications"\n') +
      chalk.white('  "Build an NFT marketplace with analytics"\n\n') +
      chalk.cyan('Commands:\n') +
      chalk.white('  help          - Show this help\n') +
      chalk.white('  list          - List your projects\n') +
      chalk.white('  deploy        - Deploy current project\n') +
      chalk.white('  enhance       - Add features to a project\n') +
      chalk.white('  cd <project>  - Switch to a project\n') +
      chalk.white('  status        - Show current project status\n') +
      chalk.white('  clear         - Clear screen\n') +
      chalk.white('  exit          - Exit studio\n'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: '#932C23'
      }
    ));
  }

  private listProjects(): void {
    if (this.session.projects.length === 0) {
      console.log(chalk.yellow('\n📂 No projects yet. Create one by describing what you want to build!'));
      return;
    }

    console.log('\n' + boxen(
      chalk.white.bold('📂 Your Projects\n\n') +
      this.session.projects.map((project, index) => {
        const isCurrent = project.name === this.session.currentProject;
        const indicator = isCurrent ? chalk.green('→ ') : '  ';
        const name = isCurrent ? chalk.green.bold(project.name) : chalk.white(project.name);
        const template = chalk.dim(`(${project.config.template})`);
        const lastModified = chalk.dim(new Date(project.lastModified).toLocaleDateString());
        return `${indicator}${name} ${template} - ${lastModified}`;
      }).join('\n'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: '#932C23'
      }
    ));
  }

  private async handleDeploy(args: string[]): Promise<void> {
    if (!this.session.currentProject) {
      console.log(chalk.yellow('⚠️  No current project. Use "cd <project>" to select one.'));
      return;
    }

    const project = this.session.projects.find(p => p.name === this.session.currentProject);
    if (!project) {
      console.log(chalk.red('❌ Current project not found.'));
      return;
    }

    const network = args[0] || 'testnet';
    const spinner = ora(`🚀 Deploying ${project.name} to ${network}...`).start();

    try {
      const result = await this.deployment.deploy(project, network);
      if (!project.deployments) {
        project.deployments = [];
      }
      project.deployments.push(result);
      
      spinner.succeed(chalk.green(`✅ Deployed to ${network}!`));
      console.log(chalk.dim(`Contract: ${result.contractAddress}`));
      console.log(chalk.dim(`Tx: ${result.txHash}`));
      
    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Deployment failed: ${error.message}`));
    }
  }

  private async handleEnhance(args: string[]): Promise<void> {
    const enhancement = args.join(' ');
    if (!enhancement) {
      console.log(chalk.yellow('⚠️  Specify what to enhance: seiai enhance "add price alerts"'));
      return;
    }

    if (!this.session.currentProject) {
      console.log(chalk.yellow('⚠️  No current project. Use "cd <project>" to select one.'));
      return;
    }

    const spinner = ora('🔧 Analyzing enhancement request...').start();
    
    try {
      const analysis = this.analyzer.analyze(enhancement);
      analysis.intent = 'enhance'; // Override intent
      
      spinner.succeed(chalk.green('✅ Enhancement analysis complete!'));
      
      this.displayAnalysis(analysis);
      
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Apply these enhancements?',
          default: true
        }
      ]);
      
      if (proceed) {
        const project = this.session.projects.find(p => p.name === this.session.currentProject);
        if (project) {
          await this.generator.enhanceProject(project, analysis);
          console.log(chalk.green('✅ Project enhanced successfully!'));
        }
      }
      
    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Enhancement failed: ${error.message}`));
    }
  }

  private async handleChangeProject(args: string[]): Promise<void> {
    const projectName = args[0];
    if (!projectName) {
      this.listProjects();
      return;
    }

    const project = this.session.projects.find(p => p.name === projectName);
    if (!project) {
      console.log(chalk.red(`❌ Project "${projectName}" not found.`));
      this.listProjects();
      return;
    }

    this.session.currentProject = projectName;
    console.log(chalk.green(`✅ Switched to ${projectName}`));
  }

  private showProjectStatus(): void {
    if (!this.session.currentProject) {
      console.log(chalk.yellow('⚠️  No current project selected.'));
      return;
    }

    const project = this.session.projects.find(p => p.name === this.session.currentProject);
    if (!project) {
      console.log(chalk.red('❌ Current project not found.'));
      return;
    }

    console.log('\n' + boxen(
      chalk.white.bold(`📊 ${project.name} Status\n\n`) +
      chalk.cyan('Template: ') + chalk.white(project.config.template) + '\n' +
      chalk.cyan('Network: ') + chalk.white(project.config.network) + '\n' +
      chalk.cyan('Packages: ') + chalk.white(project.config.packages.join(', ')) + '\n' +
      chalk.cyan('Features: ') + chalk.white(project.config.features.join(', ')) + '\n' +
      chalk.cyan('Last Modified: ') + chalk.white(new Date(project.lastModified).toLocaleString()) + '\n' +
      chalk.cyan('Deployments: ') + chalk.white((project.deployments?.length || 0).toString()),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: '#932C23'
      }
    ));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}