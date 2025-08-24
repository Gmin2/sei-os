interface NotificationConfig {
  telegramToken: string;
  chatId: string;
  enableWebhooks: boolean;
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

  async sendTradeNotification(trade: any): Promise<void> {
    const emoji = trade.success ? '✅' : '❌';
    const message = `
${emoji} **Trade ${trade.success ? 'Executed' : 'Failed'}**

**Action:** ${trade.action?.toUpperCase() || 'Unknown'}
**Asset:** ${trade.asset || 'Unknown'}
**Amount:** ${trade.executedAmount || trade.amount || 'Unknown'}
**Price:** ${trade.executedPrice || 'Unknown'}
**Slippage:** ${trade.slippage ? trade.slippage.toFixed(3) + '%' : 'N/A'}
**Gas:** ${trade.gasUsed || 'Unknown'}
**TX:** \`${trade.transactionHash || 'N/A'}\`
    `.trim();

    await this.sendNotification(message);
  }

  async sendRiskAlert(violations: any[]): Promise<void> {
    if (violations.length === 0) return;

    const highSeverity = violations.filter(v => v.severity === 'high');
    const emoji = highSeverity.length > 0 ? '🚨' : '⚠️';
    
    let message = `${emoji} **Risk Alert**\n\n`;
    
    for (const violation of violations) {
      const severityEmoji = violation.severity === 'high' ? '🔴' : 
                           violation.severity === 'medium' ? '🟡' : '🟢';
      
      message += `${severityEmoji} **${violation.type.replace('_', ' ').toUpperCase()}**\n`;
      message += `${violation.message}\n`;
      message += `Current: ${violation.currentValue?.toFixed?.(2) || violation.currentValue}\n`;
      message += `Threshold: ${violation.threshold?.toFixed?.(2) || violation.threshold}\n\n`;
    }

    if (highSeverity.length > 0) {
      message += '🛑 **Automatic protective actions may be triggered**';
    }

    await this.sendNotification(message);
  }

  async sendPortfolioUpdate(summary: any): Promise<void> {
    const changeEmoji = summary.dailyChange >= 0 ? '📈' : '📉';
    
    const message = `
📊 **Portfolio Update**

**Total Value:** ${summary.totalValueUSD} USD
**24h Change:** ${changeEmoji} ${summary.dailyChange?.toFixed(2) || '0.00'}%
**Assets:** ${summary.assets?.length || 0}

**Top Holdings:**
${summary.assets?.slice(0, 3).map(asset => 
  `• ${asset.symbol}: ${asset.valueUSD} USD (${asset.allocation?.toFixed(1) || '0'}%)`
).join('\n') || 'No assets found'}

**Performance:**
• Weekly: ${summary.performance?.weekly?.toFixed(2) || '0.00'}%
• Monthly: ${summary.performance?.monthly?.toFixed(2) || '0.00'}%
    `.trim();

    await this.sendNotification(message);
  }

  async sendYieldOpportunity(opportunity: any): Promise<void> {
    const riskEmoji = opportunity.riskLevel === 'low' ? '🟢' : 
                      opportunity.riskLevel === 'medium' ? '🟡' : '🔴';

    const message = `
🌾 **Yield Opportunity**

**Protocol:** ${opportunity.protocol}
**Asset:** ${opportunity.asset}
**APY:** ${opportunity.apy}%
**Risk:** ${riskEmoji} ${opportunity.riskLevel.toUpperCase()}
${opportunity.lockupPeriod ? `**Lockup:** ${opportunity.lockupPeriod}` : ''}
${opportunity.minimumAmount ? `**Minimum:** ${opportunity.minimumAmount}` : ''}

Consider this opportunity for yield optimization.
    `.trim();

    await this.sendNotification(message);
  }

  async sendArbitrageOpportunity(opportunity: any): Promise<void> {
    const message = `
⚡ **Arbitrage Opportunity**

**Asset:** ${opportunity.asset}
**Profit:** ${opportunity.profitPercentage?.toFixed(2) || '0.00'}%
**Volume:** ${opportunity.volume}
**Buy:** ${opportunity.buyExchange} @ ${opportunity.buyPrice}
**Sell:** ${opportunity.sellExchange} @ ${opportunity.sellPrice}

Quick action recommended for this arbitrage opportunity.
    `.trim();

    await this.sendNotification(message);
  }

  async sendRebalanceNotification(result: any): Promise<void> {
    const message = `
⚖️ **Portfolio Rebalanced**

**Transactions:** ${result.transactions?.length || 0}
**Total Gas:** ${result.totalGasCost} wei
**Strategy:** ${result.strategy || 'Default'}

**New Allocation:**
${Object.entries(result.newAllocation || {}).map(([asset, allocation]) => 
  `• ${asset}: ${allocation}%`
).join('\n')}

Portfolio successfully rebalanced according to target allocation.
    `.trim();

    await this.sendNotification(message);
  }

  async sendDailyReport(data: {
    portfolioValue: string;
    dailyChange: number;
    trades: number;
    pnl: number;
    topPerformer?: string;
    worstPerformer?: string;
  }): Promise<void> {
    const changeEmoji = data.dailyChange >= 0 ? '📈' : '📉';
    const pnlEmoji = data.pnl >= 0 ? '💰' : '💸';

    const message = `
📈 **Daily Portfolio Report**

**Portfolio Value:** ${data.portfolioValue} USD
**24h Change:** ${changeEmoji} ${data.dailyChange.toFixed(2)}%
**Trades Executed:** ${data.trades}
**P&L:** ${pnlEmoji} ${data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}%

${data.topPerformer ? `🏆 **Best:** ${data.topPerformer}` : ''}
${data.worstPerformer ? `📉 **Worst:** ${data.worstPerformer}` : ''}

Have a great trading day! 🚀
    `.trim();

    await this.sendNotification(message);
  }

  async sendWeeklyReport(data: {
    weeklyReturn: number;
    totalTrades: number;
    successRate: number;
    bestTrade: any;
    worstTrade: any;
    recommendations: string[];
  }): Promise<void> {
    const returnEmoji = data.weeklyReturn >= 0 ? '📈' : '📉';

    let message = `
📊 **Weekly Portfolio Report**

**Weekly Return:** ${returnEmoji} ${data.weeklyReturn >= 0 ? '+' : ''}${data.weeklyReturn.toFixed(2)}%
**Total Trades:** ${data.totalTrades}
**Success Rate:** ${data.successRate.toFixed(1)}%

**Best Trade:** ${data.bestTrade?.asset || 'N/A'} (${data.bestTrade?.profit || '0'}%)
**Worst Trade:** ${data.worstTrade?.asset || 'N/A'} (${data.worstTrade?.loss || '0'}%)

**Recommendations:**
${data.recommendations.map(rec => `• ${rec}`).join('\n')}
    `.trim();

    await this.sendNotification(message);
  }

  async sendSystemStatus(status: {
    uptime: string;
    lastUpdate: string;
    activeTrades: number;
    systemHealth: 'healthy' | 'degraded' | 'critical';
    warnings?: string[];
  }): Promise<void> {
    const healthEmoji = status.systemHealth === 'healthy' ? '🟢' : 
                       status.systemHealth === 'degraded' ? '🟡' : '🔴';

    let message = `
🤖 **System Status**

**Health:** ${healthEmoji} ${status.systemHealth.toUpperCase()}
**Uptime:** ${status.uptime}
**Last Update:** ${status.lastUpdate}
**Active Trades:** ${status.activeTrades}

${status.warnings?.length ? `**Warnings:**\n${status.warnings.map(w => `⚠️ ${w}`).join('\n')}` : '✅ No warnings'}
    `.trim();

    await this.sendNotification(message);
  }

  async sendMaintenanceNotification(message: string, duration?: string): Promise<void> {
    const maintenanceMessage = `
🔧 **Maintenance Notification**

${message}

${duration ? `**Estimated Duration:** ${duration}` : ''}

The DeFi agent will continue monitoring but trading may be temporarily suspended.
    `.trim();

    await this.sendNotification(maintenanceMessage);
  }

  // Webhook functionality for external integrations
  async sendWebhook(eventType: string, data: any): Promise<boolean> {
    if (!this.config.enableWebhooks || !process.env.WEBHOOK_URL) {
      return false;
    }

    try {
      const response = await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Type': eventType
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          eventType,
          data
        })
      });

      return response.ok;
    } catch (error) {
      console.error(`Webhook delivery failed: ${error.message}`);
      return false;
    }
  }
}