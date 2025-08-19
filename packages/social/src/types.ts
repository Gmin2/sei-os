import type { SeiAgent } from '@sei-code/core';

export interface SocialMessage {
  id: string;
  from: {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  text: string;
  timestamp: Date;
  platform: 'telegram' | 'discord' | 'twitter';
  chatId?: string;
  replyToMessageId?: string;
}

export interface SocialCommand {
  command: string;
  description: string;
  handler: (message: SocialMessage, args: string[]) => Promise<string>;
  requiresWallet?: boolean;
  adminOnly?: boolean;
}

export interface TelegramConfig {
  token: string;
  agent: SeiAgent;
  allowedUsers?: string[];
  adminUsers?: string[];
  enableInlineMode?: boolean;
}

export interface SocialPlatformConfig {
  platform: 'telegram' | 'discord' | 'twitter';
  credentials: any;
  agent: SeiAgent;
  commands?: SocialCommand[];
}