interface NotificationConfig {
  telegramToken: string;
  chatId: string;
}

export class NotificationService {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  async sendNotification(message: string, metadata?: any): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.telegramToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
      }

      console.log('📱 Notification sent:', message.substring(0, 50) + '...');
    } catch (error) {
      console.error('❌ Failed to send notification:', error.message);
      throw error;
    }
  }

  async sendAlert(title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    const emoji = priority === 'high' ? '🚨' : priority === 'medium' ? '⚠️' : 'ℹ️';
    const alertMessage = `${emoji} **${title}**\n\n${message}`;
    await this.sendNotification(alertMessage);
  }

  async sendVoteConfirmation(proposalId: string, vote: string, txHash: string): Promise<void> {
    const message = `
✅ **Vote Submitted Successfully**

**Proposal:** #${proposalId}
**Vote:** ${vote.toUpperCase()}
**Transaction:** \`${txHash}\`

Your vote has been recorded on the Sei blockchain.
    `.trim();

    await this.sendNotification(message);
  }

  async sendProposalSummary(proposals: any[]): Promise<void> {
    if (proposals.length === 0) {
      await this.sendNotification('📭 No active proposals at the moment.');
      return;
    }

    let message = `📊 **Governance Summary** (${proposals.length} active proposals)\n\n`;
    
    for (const proposal of proposals.slice(0, 10)) {
      const timeRemaining = this.formatTimeRemaining(proposal.votingEndTime);
      message += `**#${proposal.id}** ${proposal.title}\n`;
      message += `Status: ${proposal.status} | Ends: ${timeRemaining}\n\n`;
    }

    if (proposals.length > 10) {
      message += `\n... and ${proposals.length - 10} more proposals`;
    }

    await this.sendNotification(message);
  }

  private formatTimeRemaining(endTime: string): string {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Ended';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else {
      return `${hours}h`;
    }
  }
}