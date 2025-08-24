interface AnalyticsConfig {
  network: 'testnet' | 'mainnet';
}

export class AnalyticsService {
  private config: AnalyticsConfig;
  private metrics: Map<string, any> = new Map();

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  async trackVote(data: {
    proposalId: string;
    vote: 'yes' | 'no' | 'abstain' | 'no_with_veto';
    votingPower: string;
    voterAddress: string;
    timestamp: string;
    txHash: string;
  }): Promise<void> {
    try {
      // Store vote data for analytics
      const key = `vote_${data.proposalId}_${data.voterAddress}`;
      this.metrics.set(key, data);

      // Update proposal analytics
      await this.updateProposalMetrics(data.proposalId, data);

      console.log(`📊 Vote tracked: ${data.vote} on proposal #${data.proposalId}`);
    } catch (error) {
      console.error(`Failed to track vote: ${error.message}`);
    }
  }

  async getVotingInsights(address: string): Promise<{
    totalVotes: number;
    votingPatterns: {
      yes: number;
      no: number;
      abstain: number;
      noWithVeto: number;
    };
    participationRate: number;
    averageVotingPower: string;
    recentActivity: Array<{
      proposalId: string;
      vote: string;
      timestamp: string;
    }>;
    recommendations: string[];
  }> {
    try {
      // Simulate analytics data
      const insights = {
        totalVotes: 23,
        votingPatterns: {
          yes: 18, // 78.3%
          no: 3,   // 13.0%
          abstain: 2, // 8.7%
          noWithVeto: 0 // 0%
        },
        participationRate: 85.2, // percentage of proposals voted on
        averageVotingPower: '125,000',
        recentActivity: [
          {
            proposalId: '125',
            vote: 'yes',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            proposalId: '124',
            vote: 'yes',
            timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        recommendations: [
          'Your voting pattern shows strong support for protocol improvements',
          'Consider participating in community discussions before voting',
          'High participation rate - keep up the governance engagement!'
        ]
      };

      return insights;
    } catch (error) {
      throw new Error(`Failed to generate voting insights: ${error.message}`);
    }
  }

  async getGovernanceHealth(): Promise<{
    overallHealth: number; // 0-100
    metrics: {
      participationRate: number;
      proposalPassRate: number;
      validatorParticipation: number;
      communityEngagement: number;
    };
    trends: {
      participationTrend: 'increasing' | 'decreasing' | 'stable';
      proposalQuality: 'improving' | 'declining' | 'stable';
    };
    alerts: Array<{
      type: 'warning' | 'info' | 'critical';
      message: string;
    }>;
  }> {
    try {
      const health = {
        overallHealth: 78,
        metrics: {
          participationRate: 67.5,
          proposalPassRate: 70.1,
          validatorParticipation: 89.3,
          communityEngagement: 45.2
        },
        trends: {
          participationTrend: 'stable' as const,
          proposalQuality: 'improving' as const
        },
        alerts: [
          {
            type: 'info' as const,
            message: 'Community engagement has increased by 12% this month'
          },
          {
            type: 'warning' as const,
            message: 'Proposal #125 has low participation with only 45% of voting power engaged'
          }
        ]
      };

      return health;
    } catch (error) {
      throw new Error(`Failed to assess governance health: ${error.message}`);
    }
  }

  async generateReport(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<{
    period: string;
    summary: {
      totalProposals: number;
      votesSubmitted: number;
      participationRate: number;
      averageResponseTime: number; // hours
    };
    achievements: string[];
    recommendations: string[];
    keyMetrics: Array<{
      metric: string;
      value: string;
      change: string;
      trend: 'up' | 'down' | 'stable';
    }>;
  }> {
    try {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[timeframe];

      const report = {
        period: `Last ${days} days`,
        summary: {
          totalProposals: timeframe === '7d' ? 2 : timeframe === '30d' ? 8 : 23,
          votesSubmitted: timeframe === '7d' ? 2 : timeframe === '30d' ? 7 : 20,
          participationRate: timeframe === '7d' ? 100 : timeframe === '30d' ? 87.5 : 87.0,
          averageResponseTime: timeframe === '7d' ? 6 : timeframe === '30d' ? 8 : 12
        },
        achievements: [
          `Voted on ${timeframe === '7d' ? '100%' : '87.5%'} of proposals`,
          'Maintained consistent voting pattern',
          'Active in governance discussions'
        ],
        recommendations: [
          'Consider engaging more with community before major votes',
          'Review validator voting patterns for alignment',
          'Monitor proposal outcomes for learning opportunities'
        ],
        keyMetrics: [
          {
            metric: 'Governance Score',
            value: '92/100',
            change: '+3',
            trend: 'up' as const
          },
          {
            metric: 'Response Time',
            value: `${timeframe === '7d' ? 6 : 8}h avg`,
            change: timeframe === '7d' ? '-2h' : '+1h',
            trend: timeframe === '7d' ? 'up' : 'down' as const
          },
          {
            metric: 'Voting Power',
            value: '125,000 SEI',
            change: '+5,000',
            trend: 'up' as const
          }
        ]
      };

      return report;
    } catch (error) {
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  private async updateProposalMetrics(proposalId: string, voteData: any): Promise<void> {
    const key = `proposal_metrics_${proposalId}`;
    const existing = this.metrics.get(key) || {
      proposalId,
      voteCount: 0,
      votingPowerTotal: 0,
      votes: { yes: 0, no: 0, abstain: 0, noWithVeto: 0 }
    };

    existing.voteCount += 1;
    existing.votingPowerTotal += parseFloat(voteData.votingPower.replace(/,/g, ''));
    existing.votes[voteData.vote] += 1;

    this.metrics.set(key, existing);
  }

  async getProposalMetrics(proposalId: string): Promise<{
    voteCount: number;
    votingPowerTotal: number;
    distribution: {
      yes: number;
      no: number;
      abstain: number;
      noWithVeto: number;
    };
    trends: {
      hourlyVotes: Array<{ hour: string; count: number }>;
      participationRate: number;
    };
  }> {
    const key = `proposal_metrics_${proposalId}`;
    const metrics = this.metrics.get(key) || {
      voteCount: 0,
      votingPowerTotal: 0,
      votes: { yes: 0, no: 0, abstain: 0, noWithVeto: 0 }
    };

    // Generate hourly voting trends (mock data)
    const hourlyVotes = [];
    const currentHour = new Date().getHours();
    for (let i = 23; i >= 0; i--) {
      const hour = (currentHour - i + 24) % 24;
      hourlyVotes.push({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count: Math.floor(Math.random() * 10) + 1
      });
    }

    return {
      voteCount: metrics.voteCount,
      votingPowerTotal: metrics.votingPowerTotal,
      distribution: metrics.votes,
      trends: {
        hourlyVotes,
        participationRate: 67.5 // Mock participation rate
      }
    };
  }
}