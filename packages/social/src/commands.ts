import type { SocialCommand, SocialMessage } from './types';

/**
 * Advanced DeFi commands for social platforms
 */
export const DeFiCommands: SocialCommand[] = [
  {
    command: 'yield',
    description: 'Get yield optimization recommendations',
    handler: async (message, args) => {
      return `🎯 *Yield Optimization*

*Current Strategy:*
• Staking: 5,000 SEI (8.5% APY)
• Liquid: 1,000 SEI (0% APY)

*Recommendations:*
✅ Claim and compound rewards (+0.3% APY)
✅ Diversify across 2 more validators (+0.2% APY)
⚠️ Consider liquid staking options

*Potential APY:* 9.0% (+0.5%)
*Monthly Boost:* +2.1 SEI

Use /compound to auto-compound rewards.`;
    },
    requiresWallet: true
  },

  {
    command: 'compound',
    description: 'Auto-compound staking rewards',
    handler: async (message, args) => {
      return `🔄 *Auto-Compound Setup*

*Available Rewards:* 12.34 SEI

*Strategy Options:*
1️⃣ Claim & re-delegate to same validators
2️⃣ Claim & optimize validator selection
3️⃣ Set up recurring auto-compound

*Estimated Gas Cost:* 0.001 SEI
*Net Rewards:* 12.339 SEI

⚠️ *Demo Mode* - Connect wallet to enable auto-compounding.`;
    },
    requiresWallet: true
  },

  {
    command: 'governance',
    description: 'Check governance proposals',
    handler: async (message, args) => {
      return `🗳️ *Governance Overview*

*Active Proposals:*

**Proposal #42** - Network Upgrade v2.0
• Status: Voting (5 days left)
• Your vote: Not voted
• Current result: 67% Yes, 23% No

**Proposal #43** - Community Fund Allocation  
• Status: Deposit phase
• Required: 10,000 SEI
• Current: 7,500 SEI

Use /vote <proposal_id> <yes/no/abstain> to participate.`;
    }
  },

  {
    command: 'vote',
    description: 'Vote on governance proposals',
    handler: async (message, args) => {
      if (args.length < 2) {
        return `❌ Usage: /vote <proposal_id> <yes/no/abstain>
Example: /vote 42 yes`;
      }

      const proposalId = args[0];
      const vote = args[1].toLowerCase();

      if (!['yes', 'no', 'abstain'].includes(vote)) {
        return '❌ Vote must be: yes, no, or abstain';
      }

      return `🗳️ *Voting on Proposal #${proposalId}*

Your vote: **${vote.toUpperCase()}**

⚠️ *Demo Mode* - Connect wallet to cast real votes.

💡 *Tip:* Your voting power is based on your staked SEI amount.`;
    },
    requiresWallet: true
  },

  {
    command: 'risk',
    description: 'Analyze portfolio risk',
    handler: async (message, args) => {
      return `⚠️ *Risk Analysis*

*Risk Score:* 35/100 (Moderate)

*Risk Factors:*
🔸 Single validator concentration (25 points)
🔸 Low liquidity ratio (10 points)

*Recommendations:*
✅ Diversify to 3-5 validators
✅ Keep 10-20% liquid for opportunities
✅ Monitor validator performance

*Portfolio Health:* Good
*Next Review:* In 30 days`;
    },
    requiresWallet: true
  },

  {
    command: 'delegate',
    description: 'Delegate tokens to validators',
    handler: async (message, args) => {
      if (args.length < 2) {
        return `❌ Usage: /delegate <amount> [validator]
Example: /delegate 100 
Example: /delegate 100 seivaloper1abc...`;
      }

      const amount = args[0];
      const validator = args[1] || 'auto-select';

      return `🥩 *Delegation Request*

*Amount:* ${amount} SEI
*Validator:* ${validator === 'auto-select' ? 'Auto-selected optimal validator' : validator}

*Validator Info:*
• Commission: 5%
• Uptime: 99.2%
• APY: 8.5%

*Expected Annual Rewards:* ${(parseFloat(amount) * 0.085).toFixed(2)} SEI

⚠️ *Demo Mode* - Connect wallet to delegate.`;
    },
    requiresWallet: true
  }
];

/**
 * Analytics and monitoring commands
 */
export const AnalyticsCommands: SocialCommand[] = [
  {
    command: 'chart',
    description: 'Show price chart for tokens',
    handler: async (message, args) => {
      const token = args[0] || 'sei';
      return `📊 *${token.toUpperCase()} Price Chart*

*Current:* $0.25 (+2.3% 24h)
*24h High:* $0.26
*24h Low:* $0.23
*Volume:* $12.5M

*7-Day Trend:* ↗️ Bullish
*Support:* $0.22
*Resistance:* $0.28

📈 Technical analysis suggests continued upward momentum.`;
    }
  },

  {
    command: 'compare',
    description: 'Compare portfolio performance',
    handler: async (message, args) => {
      return `📊 *Portfolio Performance*

*Your Portfolio vs Benchmarks:*

**30 Days:**
• Your Return: +12.3%
• SEI Price: +8.5%
• Staking Only: +2.1%
• Outperformance: +4.2%

**Key Drivers:**
✅ Optimal validator selection
✅ Timely reward claiming
✅ Price appreciation

*Ranking:* Top 15% of similar portfolios`;
    },
    requiresWallet: true
  },

  {
    command: 'validators',
    description: 'Compare validator performance',
    handler: async (message, args) => {
      return `🏆 *Top Validators*

**1. SeiValidator Pro**
• Commission: 3%
• Uptime: 99.8%
• APY: 8.7%
• Rank: #1

**2. Sei Staking Co**  
• Commission: 5%
• Uptime: 99.5%
• APY: 8.5%
• Rank: #2

**3. Community Validator**
• Commission: 2%
• Uptime: 98.9%
• APY: 8.6%
• Rank: #3

Use /delegate <amount> <validator> to stake with them.`;
    }
  }
];

/**
 * Utility commands
 */
export const UtilityCommands: SocialCommand[] = [
  {
    command: 'gas',
    description: 'Get current gas prices',
    handler: async (message, args) => {
      return `⛽ *Gas Prices*

*Current Gas Price:* 0.1 gwei
*Status:* 🟢 Low

*Estimated Costs:*
• Simple Transfer: 0.0001 SEI
• Staking Operation: 0.0003 SEI  
• Contract Interaction: 0.0005 SEI

*Recommendation:* Good time for transactions!`;
    }
  },

  {
    command: 'convert',
    description: 'Convert between units',
    handler: async (message, args) => {
      if (args.length < 3) {
        return `❌ Usage: /convert <amount> <from> <to>
Example: /convert 1000000 usei sei
Example: /convert 1 sei usd`;
      }

      const amount = parseFloat(args[0]);
      const from = args[1].toLowerCase();
      const to = args[2].toLowerCase();

      if (from === 'usei' && to === 'sei') {
        const result = amount / 1000000;
        return `💱 ${amount} uSEI = ${result} SEI`;
      } else if (from === 'sei' && to === 'usd') {
        const result = amount * 0.25; // Demo price
        return `💱 ${amount} SEI = $${result.toFixed(2)} USD`;
      }

      return `💱 Conversion: ${amount} ${from.toUpperCase()} → ${to.toUpperCase()}
Result: [Conversion would be calculated here]`;
    }
  },

  {
    command: 'notify',
    description: 'Set up notifications',
    handler: async (message, args) => {
      if (args.length < 1) {
        return `🔔 *Notification Settings*

*Active Alerts:*
• SEI price > $0.30
• Governance proposals
• Staking rewards > 1 SEI

*Available Types:*
• price <token> <threshold>
• governance <all/urgent>
• rewards <min_amount>

Example: /notify price sei 0.30`;
      }

      const type = args[0];
      return `🔔 *Notification Set*

Type: ${type}
Settings: ${args.slice(1).join(' ')}

You'll receive updates when conditions are met!`;
    }
  }
];

/**
 * Get all available commands
 */
export function getAllCommands(): SocialCommand[] {
  return [
    ...DeFiCommands,
    ...AnalyticsCommands,
    ...UtilityCommands
  ];
}