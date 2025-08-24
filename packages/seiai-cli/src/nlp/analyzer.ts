import type { AnalyzedRequest, PackageRequirement, Integration } from '../types.js';

export class NaturalLanguageAnalyzer {
  private packageKeywords = new Map<string, string[]>([
    ['core', ['agent', 'framework', 'base', 'foundation']],
    ['wallets', ['wallet', 'connect', 'sign', 'transaction', 'balance', 'metamask', 'sei-global']],
    ['precompiles', ['bank', 'staking', 'oracle', 'distribution', 'governance', 'precompile', 'native', 'vote', 'voting', 'proposal', 'dao', 'delegate', 'validator']],
    ['transactions', ['send', 'transfer', 'execute', 'broadcast', 'transaction', 'tx']],
    ['nft', ['nft', 'token', 'erc721', 'erc1155', 'collectible', 'marketplace', 'mint', 'trade']],
    ['analytics', ['analytics', 'data', 'metrics', 'statistics', 'performance', 'tracking', 'monitor']],
    ['social', ['telegram', 'discord', 'twitter', 'bot', 'notification', 'social', 'chat']],
    ['models', ['ai', 'llm', 'gemini', 'claude', 'openai', 'gpt', 'model', 'chat', 'intelligent']],
    ['x402', ['payment', 'pay', 'subscription', 'monetize', 'revenue', 'billing', 'x402']]
  ]);

  private projectTypeKeywords = new Map<string, string[]>([
    ['voting', ['voting', 'vote', 'governance', 'proposal', 'dao', 'election', 'poll']],
    ['defi', ['defi', 'trading', 'swap', 'liquidity', 'yield', 'farming', 'lending', 'borrowing', 'dex']],
    ['social', ['social', 'chat', 'community', 'forum', 'messaging', 'notification']],
    ['nft', ['nft', 'collectible', 'art', 'marketplace', 'trading', 'mint', 'gallery']],
    ['analytics', ['analytics', 'dashboard', 'tracking', 'monitoring', 'metrics', 'reporting']],
    ['governance', ['governance', 'voting', 'proposal', 'dao', 'consensus']]
  ]);

  private integrationKeywords = new Map<string, string[]>([
    ['telegram', ['telegram', 'telegram bot', 'tg', 'telegram notifications']],
    ['discord', ['discord', 'discord bot', 'discord notifications']],
    ['twitter', ['twitter', 'tweet', 'social media', 'x']],
    ['webhook', ['webhook', 'callback', 'api callback', 'notification endpoint']],
    ['api', ['api', 'rest api', 'graphql', 'endpoint']]
  ]);

  private featureKeywords = new Map<string, string[]>([
    ['real-time notifications', ['notification', 'alert', 'real-time', 'instant', 'push']],
    ['price monitoring', ['price', 'oracle', 'monitoring', 'alert', 'threshold']],
    ['automated trading', ['automated', 'trading', 'bot', 'strategy', 'execution']],
    ['portfolio tracking', ['portfolio', 'tracking', 'balance', 'holdings', 'assets']],
    ['governance participation', ['governance', 'voting', 'proposal', 'participation']],
    ['nft marketplace', ['marketplace', 'trading', 'buy', 'sell', 'auction']],
    ['staking rewards', ['staking', 'rewards', 'delegate', 'validator', 'yield']],
    ['payment processing', ['payment', 'billing', 'subscription', 'monetization']],
    ['data analytics', ['analytics', 'data', 'insights', 'metrics', 'reporting']],
    ['social integration', ['social', 'community', 'sharing', 'collaboration']]
  ]);

  analyze(userInput: string): AnalyzedRequest {
    if (!userInput || userInput.trim().length === 0) {
      throw new Error('Input cannot be empty');
    }

    if (userInput.trim().length < 3) {
      throw new Error('Input too short - please provide a more detailed description');
    }

    const normalizedInput = userInput.toLowerCase().trim();
    
    try {
      // Determine intent
      const intent = this.determineIntent(normalizedInput);
      
      // Determine project type
      const projectType = this.determineProjectType(normalizedInput);
      
      // Identify required packages
      const packages = this.identifyPackages(normalizedInput, projectType);
      
      // Identify features
      const features = this.identifyFeatures(normalizedInput);
      
      // Identify integrations
      const integrations = this.identifyIntegrations(normalizedInput);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(normalizedInput, projectType, packages, features);

      // Validate results
      this.validateAnalysis(packages, features, confidence);

      return {
        intent,
        projectType,
        packages,
        features,
        integrations,
        confidence
      };
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private determineIntent(input: string): 'create' | 'enhance' | 'deploy' | 'analyze' {
    if (input.includes('create') || input.includes('build') || input.includes('generate') || input.includes('new')) {
      return 'create';
    }
    if (input.includes('add') || input.includes('enhance') || input.includes('improve') || input.includes('extend')) {
      return 'enhance';
    }
    if (input.includes('deploy') || input.includes('publish') || input.includes('launch')) {
      return 'deploy';
    }
    if (input.includes('analyze') || input.includes('explain') || input.includes('understand')) {
      return 'analyze';
    }
    return 'create'; // Default
  }

  private determineProjectType(input: string): 'voting' | 'defi' | 'social' | 'nft' | 'analytics' | 'governance' | 'custom' {
    let maxScore = 0;
    let bestType: any = 'custom';

    for (const [type, keywords] of this.projectTypeKeywords) {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (input.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        bestType = type;
      }
    }

    return maxScore > 0 ? bestType : 'custom';
  }

  private identifyPackages(input: string, projectType: string): PackageRequirement[] {
    const packages: PackageRequirement[] = [];
    
    // Always include core
    packages.push({
      name: 'core',
      required: true,
      reason: 'Required base framework for all Sei agents'
    });

    // Analyze input for specific package mentions
    for (const [packageName, keywords] of this.packageKeywords) {
      if (packageName === 'core') continue; // Already added
      
      const mentions = keywords.filter(keyword => input.includes(keyword));
      if (mentions.length > 0) {
        packages.push({
          name: packageName,
          required: true,
          reason: `Mentioned: ${mentions.join(', ')}`
        });
      }
    }

    // Add packages based on project type
    const typeBasedPackages = this.getPackagesForProjectType(projectType);
    for (const pkg of typeBasedPackages) {
      if (!packages.find(p => p.name === pkg.name)) {
        packages.push(pkg);
      }
    }

    return packages;
  }

  private getPackagesForProjectType(projectType: string): PackageRequirement[] {
    switch (projectType) {
      case 'voting':
      case 'governance':
        return [
          { name: 'precompiles', required: true, reason: 'Governance voting functionality via precompiles' },
          { name: 'wallets', required: true, reason: 'Wallet integration for voting' },
          { name: 'social', required: false, reason: 'Optional social notifications' },
          { name: 'models', required: false, reason: 'Optional AI-powered analysis' }
        ];
      
      case 'defi':
        return [
          { name: 'wallets', required: true, reason: 'DeFi wallet operations' },
          { name: 'precompiles', required: true, reason: 'Bank and Oracle precompiles' },
          { name: 'transactions', required: true, reason: 'DeFi transaction execution' },
          { name: 'analytics', required: false, reason: 'Portfolio analytics' }
        ];
      
      case 'social':
        return [
          { name: 'social', required: true, reason: 'Social platform integrations' },
          { name: 'models', required: true, reason: 'AI-powered responses' }
        ];
      
      case 'nft':
        return [
          { name: 'nft', required: true, reason: 'NFT operations and marketplace' },
          { name: 'wallets', required: true, reason: 'NFT wallet interactions' },
          { name: 'transactions', required: true, reason: 'NFT transaction execution' }
        ];
      
      case 'analytics':
        return [
          { name: 'analytics', required: true, reason: 'Data analysis capabilities' },
          { name: 'precompiles', required: true, reason: 'Blockchain data access' }
        ];
      
      default:
        return [
          { name: 'wallets', required: false, reason: 'Basic wallet functionality' }
        ];
    }
  }

  private identifyFeatures(input: string): string[] {
    const features: string[] = [];

    for (const [feature, keywords] of this.featureKeywords) {
      const mentions = keywords.filter(keyword => input.includes(keyword));
      if (mentions.length > 0) {
        features.push(feature);
      }
    }

    return features;
  }

  private identifyIntegrations(input: string): Integration[] {
    const integrations: Integration[] = [];

    for (const [type, keywords] of this.integrationKeywords) {
      const mentions = keywords.filter(keyword => input.includes(keyword));
      if (mentions.length > 0) {
        integrations.push({
          type: type as any,
          required: true,
          config: {}
        });
      }
    }

    return integrations;
  }

  private calculateConfidence(
    input: string, 
    projectType: string, 
    packages: PackageRequirement[], 
    features: string[]
  ): number {
    let score = 0;
    let maxScore = 100;

    // Project type confidence (30 points)
    if (projectType !== 'custom') {
      const typeKeywords = this.projectTypeKeywords.get(projectType) || [];
      const matches = typeKeywords.filter(keyword => input.includes(keyword)).length;
      score += Math.min(30, (matches / typeKeywords.length) * 30);
    }

    // Package detection confidence (40 points)
    const requiredPackages = packages.filter(p => p.required).length;
    if (requiredPackages > 1) { // More than just core
      score += Math.min(40, (requiredPackages - 1) * 8);
    }

    // Feature detection confidence (20 points)
    score += Math.min(20, features.length * 4);

    // Input length and clarity (10 points)
    const words = input.split(' ').filter(word => word.length > 0).length;
    if (words >= 5 && words <= 50) {
      score += 10;
    } else if (words > 50) {
      score += 5;
    } else if (words < 3) {
      score -= 20; // Penalty for very short input
    }

    // Bonus for specific technical terms
    const technicalTerms = ['blockchain', 'smart contract', 'dapp', 'web3', 'defi', 'nft'];
    const techMatches = technicalTerms.filter(term => input.includes(term)).length;
    score += Math.min(10, techMatches * 2);

    return Math.min(100, Math.max(10, score));
  }

  generateProjectName(input: string, projectType: string): string {
    const words = input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'app', 'dapp'].includes(word));

    const relevantWords = words.slice(0, 3);
    
    if (relevantWords.length === 0) {
      return `sei-${projectType}-app`;
    }

    return `sei-${relevantWords.join('-')}-${projectType === 'custom' ? 'app' : projectType}`;
  }

  generateProjectDescription(input: string, analysis: AnalyzedRequest): string {
    const typeDescriptions = {
      voting: 'governance voting application',
      defi: 'DeFi application',
      social: 'social platform integration',
      nft: 'NFT marketplace application',
      analytics: 'blockchain analytics platform',
      governance: 'governance participation tool',
      custom: 'custom Sei application'
    };

    const baseDescription = `A ${typeDescriptions[analysis.projectType]} for Sei blockchain`;
    
    if (analysis.features.length > 0) {
      const featureList = analysis.features.slice(0, 3).join(', ');
      return `${baseDescription} featuring ${featureList}`;
    }

    if (analysis.integrations.length > 0) {
      const integrationList = analysis.integrations.map(i => i.type).join(', ');
      return `${baseDescription} with ${integrationList} integration`;
    }

    return `${baseDescription} generated from: "${input.slice(0, 100)}${input.length > 100 ? '...' : ''}"`;
  }

  private validateAnalysis(packages: PackageRequirement[], features: string[], confidence: number): void {
    if (packages.length === 0) {
      throw new Error('No packages identified - analysis failed');
    }

    if (confidence < 20) {
      throw new Error('Confidence too low - please provide a more detailed description');
    }

    // Ensure core package is always included
    if (!packages.find(p => p.name === 'core')) {
      packages.unshift({
        name: 'core',
        required: true,
        reason: 'Required base framework for all Sei agents'
      });
    }
  }

  getSuggestions(input: string): string[] {
    const suggestions: string[] = [];
    const normalizedInput = input.toLowerCase();

    // Suggest missing common combinations
    if (normalizedInput.includes('vote') || normalizedInput.includes('governance')) {
      if (!normalizedInput.includes('telegram') && !normalizedInput.includes('notification')) {
        suggestions.push('Add Telegram notifications for governance updates');
      }
      if (!normalizedInput.includes('analytics')) {
        suggestions.push('Add analytics to track voting patterns');
      }
    }

    if (normalizedInput.includes('defi') || normalizedInput.includes('trading')) {
      if (!normalizedInput.includes('analytics')) {
        suggestions.push('Add portfolio analytics and tracking');
      }
      if (!normalizedInput.includes('oracle')) {
        suggestions.push('Add price feeds using oracle precompiles');
      }
    }

    if (normalizedInput.includes('nft')) {
      if (!normalizedInput.includes('marketplace')) {
        suggestions.push('Add NFT marketplace functionality');
      }
    }

    return suggestions;
  }
}