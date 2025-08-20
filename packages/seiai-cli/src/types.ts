export interface ProjectConfig {
  name: string;
  description: string;
  packages: string[];
  features: string[];
  template: 'voting-app' | 'defi-app' | 'social-bot' | 'nft-trader' | 'custom';
  network: 'mainnet' | 'testnet' | 'devnet';
}

export interface AnalyzedRequest {
  intent: 'create' | 'enhance' | 'deploy' | 'analyze';
  projectType: 'voting' | 'defi' | 'social' | 'nft' | 'analytics' | 'governance' | 'custom';
  packages: PackageRequirement[];
  features: string[];
  integrations: Integration[];
  confidence: number;
}

export interface PackageRequirement {
  name: string;
  required: boolean;
  reason: string;
  features?: string[];
}

export interface Integration {
  type: 'telegram' | 'discord' | 'twitter' | 'webhook' | 'api';
  required: boolean;
  config?: Record<string, any>;
}

export interface GenerationOptions {
  projectName: string;
  outputDir: string;
  template: string;
  packages: string[];
  features: string[];
  network: 'mainnet' | 'testnet' | 'devnet';
  integrations: Integration[];
  skipInstall?: boolean;
  dryRun?: boolean;
}

export interface TemplateManifest {
  name: string;
  description: string;
  version: string;
  packages: string[];
  features: string[];
  integrations: string[];
  files: TemplateFile[];
}

export interface TemplateFile {
  path: string;
  template: boolean;
  variables?: string[];
}

export interface StudioSession {
  id: string;
  startTime: string;
  projects: ProjectInfo[];
  currentProject?: string;
}

export interface ProjectInfo {
  name: string;
  path: string;
  config: ProjectConfig;
  lastModified: string;
  deployments: DeploymentInfo[];
}

export interface DeploymentInfo {
  network: string;
  contractAddress?: string;
  txHash: string;
  timestamp: string;
  status: 'pending' | 'success' | 'failed';
}

export interface StudioConfig {
  defaultNetwork: string;
  defaultTemplate: string;
  apiKeys: {
    gemini?: string;
    claude?: string;
    openai?: string;
  };
  walletConfig: {
    type: 'sei-global' | 'metamask' | 'private-key';
    network: string;
  };
  enhancementRules: EnhancementRule[];
}

export interface EnhancementRule {
  trigger: RegExp;
  packages: string[];
  features: string[];
  priority: number;
}

export interface CLIOptions {
  network?: string;
  template?: string;
  packages?: string[];
  output?: string;
  skipInstall?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  config?: string;
}