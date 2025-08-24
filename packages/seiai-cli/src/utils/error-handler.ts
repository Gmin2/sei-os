import chalk from 'chalk';

export class SeiAIError extends Error {
  public code: string;
  public context?: any;

  constructor(message: string, code: string = 'UNKNOWN', context?: any) {
    super(message);
    this.name = 'SeiAIError';
    this.code = code;
    this.context = context;
  }
}

export class ValidationError extends SeiAIError {
  constructor(message: string, context?: any) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class GenerationError extends SeiAIError {
  constructor(message: string, context?: any) {
    super(message, 'GENERATION_ERROR', context);
    this.name = 'GenerationError';
  }
}

export class AnalysisError extends SeiAIError {
  constructor(message: string, context?: any) {
    super(message, 'ANALYSIS_ERROR', context);
    this.name = 'AnalysisError';
  }
}

export class FileSystemError extends SeiAIError {
  constructor(message: string, context?: any) {
    super(message, 'FILESYSTEM_ERROR', context);
    this.name = 'FileSystemError';
  }
}

export class NetworkError extends SeiAIError {
  constructor(message: string, context?: any) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'NetworkError';
  }
}

export function handleError(error: Error, verbose: boolean = false): void {
  if (error instanceof SeiAIError) {
    console.error(chalk.red(`❌ ${error.name}: ${error.message}`));
    
    if (error.context && verbose) {
      console.error(chalk.gray('Context:'), error.context);
    }
    
    // Provide specific help for different error types
    switch (error.code) {
      case 'VALIDATION_ERROR':
        console.log(chalk.yellow('\n💡 Validation Tips:'));
        console.log(chalk.yellow('  • Check your input format and requirements'));
        console.log(chalk.yellow('  • Use --verbose for more detailed error information'));
        break;
        
      case 'GENERATION_ERROR':
        console.log(chalk.yellow('\n💡 Generation Tips:'));
        console.log(chalk.yellow('  • Try with --skip-install if dependency issues occur'));
        console.log(chalk.yellow('  • Ensure you have sufficient disk space'));
        console.log(chalk.yellow('  • Check file permissions in the output directory'));
        break;
        
      case 'ANALYSIS_ERROR':
        console.log(chalk.yellow('\n💡 Analysis Tips:'));
        console.log(chalk.yellow('  • Provide more detailed descriptions'));
        console.log(chalk.yellow('  • Be specific about features and integrations'));
        console.log(chalk.yellow('  • Use technical terms related to blockchain and dApps'));
        break;
        
      case 'FILESYSTEM_ERROR':
        console.log(chalk.yellow('\n💡 File System Tips:'));
        console.log(chalk.yellow('  • Check file and directory permissions'));
        console.log(chalk.yellow('  • Ensure output directory doesn\'t already exist'));
        console.log(chalk.yellow('  • Verify you have write access to the target location'));
        break;
        
      case 'NETWORK_ERROR':
        console.log(chalk.yellow('\n💡 Network Tips:'));
        console.log(chalk.yellow('  • Check your internet connection'));
        console.log(chalk.yellow('  • Try again with --skip-install to avoid dependency downloads'));
        console.log(chalk.yellow('  • Configure proxy settings if behind a corporate firewall'));
        break;
    }
  } else {
    console.error(chalk.red(`❌ Unexpected error: ${error.message}`));
  }

  if (verbose && error.stack) {
    console.error(chalk.gray('\nStack trace:'));
    console.error(chalk.gray(error.stack));
  }

  console.log(chalk.gray('\nFor more help, run: seiai --help'));
}

export function createProgressSpinner(message: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;
  let interval: NodeJS.Timeout | null = null;

  const start = () => {
    if (interval) return;
    
    process.stdout.write(`\r${chalk.cyan(frames[0])} ${message}`);
    interval = setInterval(() => {
      index = (index + 1) % frames.length;
      process.stdout.write(`\r${chalk.cyan(frames[index])} ${message}`);
    }, 80);
  };

  const succeed = (successMessage?: string) => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    process.stdout.write(`\r${chalk.green('✅')} ${successMessage || message}\n`);
  };

  const fail = (errorMessage?: string) => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    process.stdout.write(`\r${chalk.red('❌')} ${errorMessage || `Failed: ${message}`}\n`);
  };

  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    process.stdout.write('\r');
  };

  return { start, succeed, fail, stop };
}

export function validateProjectName(name: string): string | true {
  if (!name || name.trim().length === 0) {
    return 'Project name cannot be empty';
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return 'Project name must be at least 2 characters long';
  }

  if (trimmedName.length > 100) {
    return 'Project name must be less than 100 characters';
  }

  if (!/^[a-zA-Z0-9-_\.]+$/.test(trimmedName)) {
    return 'Project name can only contain letters, numbers, hyphens, underscores, and dots';
  }

  if (trimmedName.startsWith('.') || trimmedName.endsWith('.')) {
    return 'Project name cannot start or end with a dot';
  }

  if (trimmedName.startsWith('-') || trimmedName.endsWith('-')) {
    return 'Project name cannot start or end with a hyphen';
  }

  const reservedNames = ['node_modules', 'package', 'package.json', 'src', 'dist', 'build'];
  if (reservedNames.includes(trimmedName.toLowerCase())) {
    return `Project name "${trimmedName}" is reserved and cannot be used`;
  }

  return true;
}

export function validateDescription(description: string): string | true {
  if (!description || description.trim().length === 0) {
    return 'Description cannot be empty';
  }

  const trimmedDescription = description.trim();

  if (trimmedDescription.length < 10) {
    return 'Description must be at least 10 characters long. Please provide more details.';
  }

  if (trimmedDescription.length > 1000) {
    return 'Description must be less than 1000 characters';
  }

  // Check for minimum meaningful content
  const words = trimmedDescription.split(/\s+/).filter(word => word.length > 2);
  if (words.length < 3) {
    return 'Description needs more meaningful words. Please provide more details about what you want to build.';
  }

  return true;
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[;&|`$()]/g, '') // Remove shell injection characters
    .trim();
}

export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}