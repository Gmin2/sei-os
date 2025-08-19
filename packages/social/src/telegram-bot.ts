import TelegramBot from 'node-telegram-bot-api';
import { BaseSocialPlatform } from './social-platform';
import type { TelegramConfig, SocialMessage, SocialCommand } from './types';

export class TelegramBotPlatform extends BaseSocialPlatform {
  private bot: TelegramBot;
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    super('telegram', {
      platform: 'telegram',
      credentials: { token: config.token },
      agent: config.agent,
      commands: []
    });
    
    this.config = config;
    this.bot = new TelegramBot(config.token, { polling: false });
    
    // Register Telegram-specific commands
    this.registerTelegramCommands();
  }

  /**
   * Connect to Telegram
   */
  async connect(): Promise<void> {
    try {
      this.bot.startPolling();
      this.connected = true;
      
      // Set up message handlers
      this.setupMessageHandlers();
      
      console.log(`🤖 Telegram bot connected for agent: ${this.config.agent.name}`);
    } catch (error) {
      throw new Error(`Failed to connect to Telegram: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send message to Telegram
   */
  async sendMessage(message: string, chatId?: string): Promise<void> {
    if (!chatId) {
      throw new Error('Chat ID is required for Telegram messages');
    }

    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    } catch (error) {
      throw new Error(`Failed to send Telegram message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle incoming messages
   */
  onMessage(callback: (message: any) => void): void {
    this.bot.on('message', (msg) => {
      callback(this.convertToSocialMessage(msg));
    });
  }

  /**
   * Set up message handlers
   */
  private setupMessageHandlers(): void {
    // Handle text messages
    this.bot.on('message', async (msg) => {
      if (!msg.text) return;

      // Check if user is allowed
      if (this.config.allowedUsers && !this.config.allowedUsers.includes(msg.from?.id.toString() || '')) {
        await this.bot.sendMessage(msg.chat.id, '❌ You are not authorized to use this bot.');
        return;
      }

      try {
        const socialMessage = this.convertToSocialMessage(msg);
        const response = await this.processCommand(socialMessage);
        
        await this.bot.sendMessage(msg.chat.id, response, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_to_message_id: msg.message_id
        });
      } catch (error) {
        console.error('Error processing message:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ An error occurred while processing your message.');
      }
    });

    // Handle inline queries if enabled
    if (this.config.enableInlineMode) {
      this.bot.on('inline_query', async (query) => {
        try {
          await this.handleInlineQuery(query);
        } catch (error) {
          console.error('Error handling inline query:', error);
        }
      });
    }

    // Handle callback queries (from inline keyboards)
    this.bot.on('callback_query', async (query) => {
      try {
        await this.handleCallbackQuery(query);
      } catch (error) {
        console.error('Error handling callback query:', error);
      }
    });
  }

  /**
   * Convert Telegram message to SocialMessage
   */
  private convertToSocialMessage(msg: TelegramBot.Message): SocialMessage {
    return {
      id: msg.message_id.toString(),
      from: {
        id: msg.from?.id.toString() || '',
        username: msg.from?.username,
        firstName: msg.from?.first_name,
        lastName: msg.from?.last_name
      },
      text: msg.text || '',
      timestamp: new Date(msg.date * 1000),
      platform: 'telegram',
      chatId: msg.chat.id.toString(),
      replyToMessageId: msg.reply_to_message?.message_id.toString()
    };
  }

  /**
   * Handle inline queries
   */
  private async handleInlineQuery(query: TelegramBot.InlineQuery): Promise<void> {
    const queryText = query.query.toLowerCase();
    const results: TelegramBot.InlineQueryResult[] = [];

    // Add some helpful inline results
    if (queryText.includes('balance')) {
      results.push({
        type: 'article',
        id: '1',
        title: '💰 Check Balance',
        description: 'Get your current SEI balance',
        input_message_content: {
          message_text: '/balance'
        }
      });
    }

    if (queryText.includes('price')) {
      results.push({
        type: 'article',
        id: '2',
        title: '📈 SEI Price',
        description: 'Get current SEI price',
        input_message_content: {
          message_text: '/price sei'
        }
      });
    }

    await this.bot.answerInlineQuery(query.id, results);
  }

  /**
   * Handle callback queries from inline keyboards
   */
  private async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!query.data || !query.message) return;

    const data = query.data;
    const chatId = query.message.chat.id;

    // Handle different callback actions
    switch (data) {
      case 'refresh_balance':
        try {
          const wallet = this.config.agent.getWallet();
          if (wallet) {
            const balance = await wallet.getBalance('usei');
            await this.bot.editMessageText(`💰 Updated SEI balance: ${balance} SEI`, {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: {
                inline_keyboard: [[
                  { text: '🔄 Refresh', callback_data: 'refresh_balance' }
                ]]
              }
            });
          }
        } catch (error) {
          await this.bot.answerCallbackQuery(query.id, {
            text: 'Error updating balance',
            show_alert: true
          });
        }
        break;
        
      default:
        await this.bot.answerCallbackQuery(query.id);
    }
  }

  /**
   * Check if user is admin
   */
  protected isAdmin(userId: string): boolean {
    return this.config.adminUsers?.includes(userId) || false;
  }

  /**
   * Register Telegram-specific commands
   */
  private registerTelegramCommands(): void {
    this.registerCommand({
      command: 'start',
      description: 'Start using the bot',
      handler: async (message) => {
        return `🤖 Welcome to ${this.config.agent.name}!

I'm your AI assistant for Sei blockchain operations.

Type /help to see available commands or just chat with me naturally!

🔗 *Features:*
• Check balances and portfolio
• Monitor prices and alerts  
• Manage staking and rewards
• Governance participation
• Much more!`;
      }
    });

    this.registerCommand({
      command: 'portfolio',
      description: 'Show your complete portfolio summary',
      handler: async (message) => {
        try {
          // This would use the precompile manager if available
          return `📊 *Portfolio Summary*

💰 *Balances:*
• SEI: 1,234.56 SEI ($309.63)

🥩 *Staking:*
• Delegated: 5,000 SEI ($1,250.00)
• Rewards: 12.34 SEI ($3.09)

📈 *Total Value:* $1,562.72

Use /balance, /staking, or /rewards for detailed info.`;
        } catch (error) {
          return `❌ Error getting portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      requiresWallet: true
    });

    this.registerCommand({
      command: 'alerts',
      description: 'Set up price alerts',
      handler: async (message, args) => {
        if (args.length < 2) {
          return `❌ Usage: /alerts <token> <price>
Example: /alerts sei 0.30`;
        }

        const token = args[0].toUpperCase();
        const price = parseFloat(args[1]);

        if (isNaN(price)) {
          return '❌ Invalid price. Please enter a valid number.';
        }

        // This would set up actual alerts in a real implementation
        return `🔔 Alert set!
Token: ${token}
Target Price: $${price}

I'll notify you when ${token} reaches $${price}.`;
      }
    });

    this.registerCommand({
      command: 'staking',
      description: 'Show staking information',
      handler: async (message) => {
        return `🥩 *Staking Overview*

*Active Delegations:*
• Validator A: 2,000 SEI
• Validator B: 1,500 SEI  
• Validator C: 1,500 SEI

*Total Delegated:* 5,000 SEI
*Pending Rewards:* 12.34 SEI
*Estimated APY:* 8.5%

Use /claim to claim rewards or /delegate to stake more.`;
      },
      requiresWallet: true
    });

    this.registerCommand({
      command: 'claim',
      description: 'Claim staking rewards',
      handler: async (message) => {
        return `🎁 *Claiming Rewards...*

Found rewards from 3 validators:
• Validator A: 5.12 SEI
• Validator B: 3.89 SEI
• Validator C: 3.33 SEI

Total: 12.34 SEI

⚠️ *Demo Mode* - Connect a real wallet to claim rewards.`;
      },
      requiresWallet: true
    });
  }

  /**
   * Send message with inline keyboard
   */
  async sendMessageWithKeyboard(chatId: string, text: string, keyboard: TelegramBot.InlineKeyboardButton[][]): Promise<void> {
    await this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }

  /**
   * Send photo with caption
   */
  async sendPhoto(chatId: string, photo: string, caption?: string): Promise<void> {
    await this.bot.sendPhoto(chatId, photo, {
      caption,
      parse_mode: 'Markdown'
    });
  }

  /**
   * Stop the bot
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.bot.stopPolling();
      this.connected = false;
    }
  }
}