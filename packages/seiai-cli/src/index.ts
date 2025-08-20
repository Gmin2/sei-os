#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import { createStudioCommand } from './commands/studio.js';
import { createGenerateCommand } from './commands/generate.js';
import { createEnhanceCommand } from './commands/enhance.js';
import { createDeployCommand } from './commands/deploy.js';

const program = new Command();

// Package info
const packageJson = {
  name: 'seiai',
  version: '1.0.0',
  description: 'Claude Code-style CLI for generating Sei AI dApps'
};

// Configure main program
program
  .name('seiai')
  .description('🤖 Sei AI Studio - Build AI dApps with Natural Language')
  .version(packageJson.version, '-v, --version', 'Display version number');

// Add global options
program
  .option('--no-color', 'Disable colored output')
  .option('--config <file>', 'Specify config file');

// Add commands
program.addCommand(createStudioCommand());
program.addCommand(createGenerateCommand());
program.addCommand(createEnhanceCommand());
program.addCommand(createDeployCommand());

// Default action (show help with banner)
program.action(() => {
  showWelcomeBanner();
  program.help();
});

// Error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error: any) {
  if (error.code === 'commander.version') {
    console.log(packageJson.version);
    process.exit(0);
  }
  
  if (error.code === 'commander.help') {
    process.exit(0);
  }
  
  if (error.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  
  console.error(chalk.red(`❌ Error: ${error.message}`));
  process.exit(1);
}

function showWelcomeBanner(): void {
  const title = figlet.textSync('seiai', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted'
  });
  
  console.log(chalk.hex('#932C23')(title));
  
  const subtitle = boxen(
    chalk.white.bold('🤖 Sei AI Studio\n') +
    chalk.gray('Build AI dApps for Sei blockchain with natural language\n\n') +
    chalk.cyan('Examples:\n') +
    chalk.white('  seiai studio') + chalk.dim('                    # Launch interactive studio') + '\n' +
    chalk.white('  seiai generate "voting app"') + chalk.dim('       # Generate from description') + '\n' +
    chalk.white('  seiai enhance ./my-app "add NFT"') + chalk.dim('  # Add features to existing app') + '\n' +
    chalk.white('  seiai deploy --network testnet') + chalk.dim('   # Deploy to Sei network'),
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: 'round',
      borderColor: '#932C23',
      textAlignment: 'left'
    }
  );
  
  console.log(subtitle);
}