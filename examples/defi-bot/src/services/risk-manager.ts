interface RiskConfig {
  maxPositionSize: number; // Maximum position size as percentage of portfolio
  stopLossPercentage: number; // Stop loss trigger percentage
  takeProfitPercentage: number; // Take profit trigger percentage
  maxDailyLoss: number; // Maximum daily loss percentage
}

interface RiskViolation {
  type: 'position_size' | 'daily_loss' | 'concentration' | 'volatility';
  severity: 'low' | 'medium' | 'high';
  message: string;
  currentValue: number;
  threshold: number;
  autoAction?: {
    type: 'stop_loss' | 'reduce_exposure' | 'halt_trading';
    asset?: string;
    amount?: string;
    percentage?: number;
  };
}

interface RiskCheck {
  approved: boolean;
  reason?: string;
  riskScore: number; // 0-100
  violations: RiskViolation[];
}

export class RiskManager {
  private config: RiskConfig;
  private dailyPnL: Map<string, number[]> = new Map(); // Track daily P&L
  private positionSizes: Map<string, Record<string, number>> = new Map(); // Track position sizes

  constructor(config: RiskConfig) {
    this.config = config;
  }

  async validateTrade(tradeParams: any): Promise<RiskCheck> {
    try {
      const violations: RiskViolation[] = [];
      let riskScore = 0;

      // Check position size limits
      const positionRisk = await this.checkPositionSize(tradeParams);
      if (positionRisk.violation) {
        violations.push(positionRisk.violation);
        riskScore += 30;
      }

      // Check daily loss limits
      const dailyLossRisk = await this.checkDailyLoss();
      if (dailyLossRisk.violation) {
        violations.push(dailyLossRisk.violation);
        riskScore += 40;
      }

      // Check portfolio concentration
      const concentrationRisk = await this.checkConcentration(tradeParams);
      if (concentrationRisk.violation) {
        violations.push(concentrationRisk.violation);
        riskScore += 25;
      }

      // Check market volatility
      const volatilityRisk = await this.checkVolatility(tradeParams.asset);
      if (volatilityRisk.violation) {
        violations.push(volatilityRisk.violation);
        riskScore += 20;
      }

      const approved = violations.filter(v => v.severity === 'high').length === 0;
      const reason = approved ? undefined : `Risk violations: ${violations.map(v => v.type).join(', ')}`;

      return {
        approved,
        reason,
        riskScore: Math.min(100, riskScore),
        violations
      };

    } catch (error) {
      return {
        approved: false,
        reason: `Risk validation failed: ${error.message}`,
        riskScore: 100,
        violations: []
      };
    }
  }

  async validateRebalance(): Promise<RiskCheck> {
    try {
      const violations: RiskViolation[] = [];

      // Check if daily loss limit would prevent rebalancing
      const dailyLossCheck = await this.checkDailyLoss();
      if (dailyLossCheck.violation && dailyLossCheck.violation.severity === 'high') {
        violations.push({
          type: 'daily_loss',
          severity: 'high',
          message: 'Rebalancing blocked due to daily loss limits',
          currentValue: dailyLossCheck.currentLoss,
          threshold: this.config.maxDailyLoss
        });
      }

      return {
        approved: violations.length === 0,
        reason: violations.length > 0 ? 'Rebalancing blocked by risk limits' : undefined,
        riskScore: violations.length > 0 ? 80 : 20,
        violations
      };

    } catch (error) {
      return {
        approved: false,
        reason: `Rebalance validation failed: ${error.message}`,
        riskScore: 100,
        violations: []
      };
    }
  }

  async checkRiskLimits(): Promise<{
    violations: RiskViolation[];
    riskScore: number;
  }> {
    const violations: RiskViolation[] = [];
    let riskScore = 0;

    // Check daily P&L
    const dailyLossCheck = await this.checkDailyLoss();
    if (dailyLossCheck.violation) {
      violations.push(dailyLossCheck.violation);
      riskScore += 40;
    }

    // Check position concentrations
    const concentrationCheck = await this.checkOverallConcentration();
    if (concentrationCheck.violation) {
      violations.push(concentrationCheck.violation);
      riskScore += 35;
    }

    // Check volatility exposure
    const volatilityCheck = await this.checkVolatilityExposure();
    if (volatilityCheck.violation) {
      violations.push(volatilityCheck.violation);
      riskScore += 25;
    }

    return {
      violations,
      riskScore: Math.min(100, riskScore)
    };
  }

  async generateRiskReport(): Promise<{
    overallRisk: 'low' | 'medium' | 'high';
    concentrationRisk: 'low' | 'medium' | 'high';
    dailyPnL: number;
    maxDrawdown: number;
    volatilityExposure: number;
    alerts: string[];
    recommendations: string[];
  }> {
    try {
      const riskCheck = await this.checkRiskLimits();
      const dailyPnL = await this.getCurrentDailyPnL();
      const maxDrawdown = await this.getMaxDrawdown();

      // Determine overall risk level
      let overallRisk: 'low' | 'medium' | 'high' = 'low';
      if (riskCheck.riskScore > 70) overallRisk = 'high';
      else if (riskCheck.riskScore > 40) overallRisk = 'medium';

      // Assess concentration risk
      const concentrationScore = await this.getConcentrationScore();
      let concentrationRisk: 'low' | 'medium' | 'high' = 'low';
      if (concentrationScore > 70) concentrationRisk = 'high';
      else if (concentrationScore > 40) concentrationRisk = 'medium';

      const alerts: string[] = [];
      const recommendations: string[] = [];

      // Generate alerts
      if (dailyPnL < -this.config.maxDailyLoss) {
        alerts.push(`Daily loss limit exceeded: ${dailyPnL.toFixed(2)}%`);
      }

      if (maxDrawdown > 15) {
        alerts.push(`High drawdown: ${maxDrawdown.toFixed(2)}%`);
        recommendations.push('Consider reducing position sizes');
      }

      if (concentrationRisk === 'high') {
        alerts.push('High concentration risk detected');
        recommendations.push('Diversify portfolio across more assets');
      }

      // General recommendations
      if (overallRisk === 'high') {
        recommendations.push('Reduce overall risk exposure');
        recommendations.push('Consider implementing stop-loss orders');
      }

      if (recommendations.length === 0) {
        recommendations.push('Portfolio risk levels are within acceptable ranges');
      }

      return {
        overallRisk,
        concentrationRisk,
        dailyPnL,
        maxDrawdown,
        volatilityExposure: 35.2, // Mock volatility exposure
        alerts,
        recommendations
      };

    } catch (error) {
      throw new Error(`Risk report generation failed: ${error.message}`);
    }
  }

  async assessYieldRisks(opportunities: any[]): Promise<{
    riskScores: Record<string, number>; // 0-1 scale
    recommendations: Array<{
      protocol: string;
      risk: 'low' | 'medium' | 'high';
      recommendation: string;
    }>;
  }> {
    const riskScores: Record<string, number> = {};
    const recommendations: Array<{ protocol: string; risk: 'low' | 'medium' | 'high'; recommendation: string }> = [];

    for (const opportunity of opportunities) {
      let riskScore = 0;

      // Assess protocol risk
      if (opportunity.protocol === 'Sei Staking') riskScore += 0.1; // Low risk
      else if (opportunity.protocol === 'Liquid Staking') riskScore += 0.2;
      else if (opportunity.protocol.includes('LP')) riskScore += 0.4; // Medium risk
      else if (opportunity.protocol.includes('Farming')) riskScore += 0.7; // High risk

      // Assess yield sustainability
      if (opportunity.apy > 50) riskScore += 0.3; // Very high yields are suspicious
      else if (opportunity.apy > 30) riskScore += 0.2;
      else if (opportunity.apy > 15) riskScore += 0.1;

      // Assess lockup risk
      if (opportunity.lockupPeriod && opportunity.lockupPeriod !== 'none') {
        riskScore += 0.15;
      }

      riskScore = Math.min(1, riskScore);
      riskScores[opportunity.protocol] = riskScore;

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (riskScore > 0.6) riskLevel = 'high';
      else if (riskScore > 0.3) riskLevel = 'medium';

      let recommendation = '';
      if (riskLevel === 'high') {
        recommendation = 'High risk - only suitable for small allocations';
      } else if (riskLevel === 'medium') {
        recommendation = 'Moderate risk - suitable for balanced portfolios';
      } else {
        recommendation = 'Low risk - suitable for conservative strategies';
      }

      recommendations.push({
        protocol: opportunity.protocol,
        risk: riskLevel,
        recommendation
      });
    }

    return { riskScores, recommendations };
  }

  private async checkPositionSize(tradeParams: any): Promise<{
    violation?: RiskViolation;
    currentSize: number;
  }> {
    // Mock position size check - in reality would calculate actual position sizes
    const currentSize = 25; // 25% of portfolio
    const newSize = currentSize + (parseFloat(tradeParams.amount) / 10000 * 100); // Mock calculation

    if (newSize > this.config.maxPositionSize * 100) {
      return {
        violation: {
          type: 'position_size',
          severity: 'high',
          message: `Position size would exceed limit: ${newSize.toFixed(1)}% > ${this.config.maxPositionSize * 100}%`,
          currentValue: newSize,
          threshold: this.config.maxPositionSize * 100,
          autoAction: {
            type: 'reduce_exposure',
            asset: tradeParams.asset,
            percentage: 20
          }
        },
        currentSize: newSize
      };
    }

    return { currentSize: newSize };
  }

  private async checkDailyLoss(): Promise<{
    violation?: RiskViolation;
    currentLoss: number;
  }> {
    const currentLoss = await this.getCurrentDailyPnL();

    if (Math.abs(currentLoss) > this.config.maxDailyLoss) {
      return {
        violation: {
          type: 'daily_loss',
          severity: currentLoss < -this.config.maxDailyLoss * 2 ? 'high' : 'medium',
          message: `Daily loss limit exceeded: ${currentLoss.toFixed(2)}% > ${this.config.maxDailyLoss}%`,
          currentValue: Math.abs(currentLoss),
          threshold: this.config.maxDailyLoss,
          autoAction: currentLoss < -this.config.maxDailyLoss * 2 ? {
            type: 'halt_trading'
          } : undefined
        },
        currentLoss
      };
    }

    return { currentLoss };
  }

  private async checkConcentration(tradeParams: any): Promise<{
    violation?: RiskViolation;
    concentrationScore: number;
  }> {
    const concentrationScore = await this.getConcentrationScore();

    if (concentrationScore > 80) {
      return {
        violation: {
          type: 'concentration',
          severity: 'high',
          message: 'Portfolio concentration too high',
          currentValue: concentrationScore,
          threshold: 80
        },
        concentrationScore
      };
    }

    return { concentrationScore };
  }

  private async checkVolatility(asset: string): Promise<{
    violation?: RiskViolation;
    volatility: number;
  }> {
    // Mock volatility data
    const volatilityData: Record<string, number> = {
      SEI: 45.2,
      ATOM: 38.1,
      USDC: 2.1
    };

    const volatility = volatilityData[asset] || 30;

    if (volatility > 60) {
      return {
        violation: {
          type: 'volatility',
          severity: 'medium',
          message: `High volatility asset: ${asset} (${volatility.toFixed(1)}%)`,
          currentValue: volatility,
          threshold: 60
        },
        volatility
      };
    }

    return { volatility };
  }

  private async checkOverallConcentration(): Promise<{
    violation?: RiskViolation;
  }> {
    const concentrationScore = await this.getConcentrationScore();

    if (concentrationScore > 75) {
      return {
        violation: {
          type: 'concentration',
          severity: 'medium',
          message: 'Overall portfolio concentration is high',
          currentValue: concentrationScore,
          threshold: 75
        }
      };
    }

    return {};
  }

  private async checkVolatilityExposure(): Promise<{
    violation?: RiskViolation;
  }> {
    // Mock volatility exposure calculation
    const volatilityExposure = 65; // Mock value

    if (volatilityExposure > 70) {
      return {
        violation: {
          type: 'volatility',
          severity: 'medium',
          message: 'High volatility exposure across portfolio',
          currentValue: volatilityExposure,
          threshold: 70
        }
      };
    }

    return {};
  }

  private async getCurrentDailyPnL(): Promise<number> {
    // Mock daily P&L calculation
    // In reality, this would calculate actual portfolio performance for the day
    return -1.2; // -1.2% daily loss
  }

  private async getMaxDrawdown(): Promise<number> {
    // Mock max drawdown calculation
    return 8.5; // 8.5% max drawdown
  }

  private async getConcentrationScore(): Promise<number> {
    // Mock concentration score calculation
    // Higher score = more concentrated portfolio
    return 45; // 45/100 concentration score
  }

  updateDailyPnL(userAddress: string, pnl: number): void {
    const history = this.dailyPnL.get(userAddress) || [];
    
    // Add today's P&L
    history.push(pnl);
    
    // Keep only last 30 days
    if (history.length > 30) {
      history.splice(0, history.length - 30);
    }
    
    this.dailyPnL.set(userAddress, history);
  }

  updatePositionSize(userAddress: string, asset: string, size: number): void {
    const positions = this.positionSizes.get(userAddress) || {};
    positions[asset] = size;
    this.positionSizes.set(userAddress, positions);
  }
}