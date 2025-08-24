import { parseEther } from 'viem';
import { 
  GOVERNANCE_PRECOMPILE_ABI,
  GOVERNANCE_PRECOMPILE_ADDRESS,
  getGovernancePrecompileEthersV6Contract
} from '@sei-js/precompiles';
import type { PrecompileConfig, ProposalInfo, VoteInfo } from './types';
import { VoteOption } from './types';
import type { BaseCapability } from '@sei-code/core';

export class GovernanceAgentCapability implements BaseCapability {
  public readonly name = 'governance_operations';
  public readonly description = 'Participate in Sei governance (voting, deposits, proposal tracking)';
  
  private config: PrecompileConfig;

  constructor(config: PrecompileConfig) {
    this.config = config;
  }

  async execute(params: {
    action: 'vote' | 'deposit' | 'get_proposals' | 'get_proposal' | 'get_vote' | 'voting_strategy';
    proposalId?: number;
    voteOption?: VoteOption;
    depositAmount?: string;
    voter?: string;
  }): Promise<any> {
    switch (params.action) {
      case 'vote':
        return this.vote(params.proposalId!, params.voteOption!);
      case 'deposit':
        return this.deposit(params.proposalId!, params.depositAmount!);
      case 'get_proposals':
        return this.getProposals();
      case 'get_proposal':
        return this.getProposal(params.proposalId!);
      case 'get_vote':
        return this.getVote(params.proposalId!, params.voter!);
      case 'voting_strategy':
        return this.getVotingStrategy(params.proposalId!);
      default:
        throw new Error(`Unknown governance action: ${params.action}`);
    }
  }

  /**
   * Cast a vote on a governance proposal
   */
  async vote(proposalId: number, voteOption: VoteOption): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for voting');
    }

    try {
      const hash = await this.config.walletClient.writeContract({
        address: GOVERNANCE_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: GOVERNANCE_PRECOMPILE_ABI,
        functionName: 'vote',
        args: [BigInt(proposalId), voteOption],
        chain: null,
        account: this.config.walletClient.account!
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to vote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make a deposit to support a governance proposal
   */
  async deposit(proposalId: number, amount: string): Promise<string> {
    if (!this.config.walletClient) {
      throw new Error('Wallet client required for deposits');
    }

    try {
      const hash = await this.config.walletClient.writeContract({
        address: GOVERNANCE_PRECOMPILE_ADDRESS as `0x${string}`,
        abi: GOVERNANCE_PRECOMPILE_ABI,
        functionName: 'deposit',
        args: [BigInt(proposalId)],
        value: parseEther(amount),
        chain: null,
        account: this.config.walletClient.account!
      });

      return hash;
    } catch (error) {
      throw new Error(`Failed to deposit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all governance proposals (simplified - would need Cosmos SDK queries)
   */
  async getProposals(): Promise<ProposalInfo[]> {
    // This is a simplified implementation
    // In practice, you'd need to query the Cosmos SDK directly for proposal data
    // as the precompile only handles voting and deposits
    
    return [
      {
        id: 1,
        title: 'Sei Network Upgrade v2.0',
        description: 'Proposal to upgrade the Sei network to version 2.0 with improved performance and new features.',
        status: 'voting',
        votingStart: new Date(Date.now() - 86400000), // 1 day ago
        votingEnd: new Date(Date.now() + 6 * 86400000), // 6 days from now
        deposit: '10000'
      },
      {
        id: 2,
        title: 'Community Pool Funding for Developer Tools',
        description: 'Proposal to allocate 100,000 SEI from the community pool for developer tooling improvements.',
        status: 'deposit',
        votingStart: new Date(Date.now() + 172800000), // 2 days from now
        votingEnd: new Date(Date.now() + 8 * 86400000), // 8 days from now
        deposit: '5000'
      }
    ];
  }

  /**
   * Get specific proposal details
   */
  async getProposal(proposalId: number): Promise<ProposalInfo> {
    const proposals = await this.getProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    
    return proposal;
  }

  /**
   * Get vote information for a specific voter and proposal
   */
  async getVote(proposalId: number, voter: string): Promise<VoteInfo | null> {
    // This would need additional Cosmos SDK queries
    // The precompile doesn't provide vote query functionality
    
    // Simplified mock response
    return {
      proposalId,
      voter,
      option: VoteOption.YES,
      weight: '1000000'
    };
  }

  /**
   * Analyze proposal and suggest voting strategy
   */
  async getVotingStrategy(proposalId: number): Promise<{
    recommendation: VoteOption;
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
    riskFactors: string[];
    benefits: string[];
  }> {
    try {
      const proposal = await this.getProposal(proposalId);
      
      // Simplified analysis based on proposal content
      // In practice, this would involve more sophisticated analysis
      
      let recommendation = VoteOption.ABSTAIN;
      let confidence: 'low' | 'medium' | 'high' = 'medium';
      let reasoning = '';
      const riskFactors: string[] = [];
      const benefits: string[] = [];

      // Simple keyword-based analysis
      const description = proposal.description.toLowerCase();
      
      if (description.includes('upgrade') || description.includes('improvement')) {
        recommendation = VoteOption.YES;
        confidence = 'high';
        reasoning = 'Network upgrades typically benefit the ecosystem';
        benefits.push('Improved network performance', 'Enhanced features');
      } else if (description.includes('funding') || description.includes('community pool')) {
        recommendation = VoteOption.YES;
        confidence = 'medium';
        reasoning = 'Community funding can drive ecosystem growth';
        benefits.push('Developer ecosystem growth', 'Innovation incentives');
        riskFactors.push('Potential misuse of funds', 'Unclear ROI');
      } else if (description.includes('parameter') || description.includes('change')) {
        recommendation = VoteOption.ABSTAIN;
        confidence = 'low';
        reasoning = 'Parameter changes require careful analysis';
        riskFactors.push('Unintended consequences', 'Complex technical implications');
      }

      // Consider proposal status and timing
      if (proposal.status === 'deposit') {
        riskFactors.push('Proposal still in deposit phase');
      }

      const timeToVote = proposal.votingEnd.getTime() - Date.now();
      if (timeToVote < 86400000) { // Less than 1 day
        riskFactors.push('Limited time for community discussion');
      }

      return {
        recommendation,
        confidence,
        reasoning,
        riskFactors,
        benefits
      };
    } catch (error) {
      throw new Error(`Failed to analyze voting strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Monitor governance activity and provide alerts
   */
  async monitorGovernance(): Promise<{
    activeProposals: number;
    urgentVotes: ProposalInfo[];
    upcomingProposals: ProposalInfo[];
    alerts: string[];
  }> {
    try {
      const proposals = await this.getProposals();
      const now = Date.now();
      
      const activeProposals = proposals.filter(p => p.status === 'voting').length;
      
      const urgentVotes = proposals.filter(p => {
        const timeLeft = p.votingEnd.getTime() - now;
        return p.status === 'voting' && timeLeft < 86400000; // Less than 24 hours
      });
      
      const upcomingProposals = proposals.filter(p => {
        const timeToStart = p.votingStart.getTime() - now;
        return p.status === 'deposit' && timeToStart < 172800000; // Starting in less than 48 hours
      });

      const alerts: string[] = [];
      
      if (urgentVotes.length > 0) {
        alerts.push(`⚠️ ${urgentVotes.length} proposal(s) ending soon - vote needed!`);
      }
      
      if (upcomingProposals.length > 0) {
        alerts.push(`📅 ${upcomingProposals.length} new proposal(s) starting soon`);
      }
      
      if (activeProposals === 0) {
        alerts.push('✅ No active proposals requiring votes');
      }

      return {
        activeProposals,
        urgentVotes,
        upcomingProposals,
        alerts
      };
    } catch (error) {
      throw new Error(`Failed to monitor governance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Auto-vote based on predefined strategy
   */
  async autoVote(proposalId: number, strategy: 'conservative' | 'progressive' | 'community_first'): Promise<{
    voted: boolean;
    voteOption?: VoteOption;
    reason: string;
  }> {
    try {
      const analysis = await this.getVotingStrategy(proposalId);
      let shouldVote = false;
      let voteOption = VoteOption.ABSTAIN;
      let reason = 'No auto-vote action taken';

      switch (strategy) {
        case 'conservative':
          // Only vote YES on high-confidence upgrades
          if (analysis.confidence === 'high' && analysis.recommendation === VoteOption.YES) {
            shouldVote = true;
            voteOption = VoteOption.YES;
            reason = 'High-confidence beneficial proposal';
          } else {
            reason = 'Conservative strategy: abstaining on uncertain proposals';
          }
          break;

        case 'progressive':
          // Vote YES on most improvements, NO on risky changes
          if (analysis.recommendation !== VoteOption.ABSTAIN) {
            shouldVote = true;
            voteOption = analysis.recommendation;
            reason = `Progressive strategy: ${analysis.reasoning}`;
          }
          break;

        case 'community_first':
          // Focus on community and developer benefits
          if (analysis.benefits.some(b => b.includes('community') || b.includes('developer'))) {
            shouldVote = true;
            voteOption = VoteOption.YES;
            reason = 'Community-beneficial proposal';
          }
          break;
      }

      if (shouldVote) {
        await this.vote(proposalId, voteOption);
      }

      return {
        voted: shouldVote,
        voteOption: shouldVote ? voteOption : undefined,
        reason
      };
    } catch (error) {
      throw new Error(`Failed to auto-vote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}