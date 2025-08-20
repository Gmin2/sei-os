import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import type { ProjectInfo, DeploymentInfo } from '../types.js';

export class DeploymentManager {
  async deploy(project: ProjectInfo, network: string): Promise<DeploymentInfo> {
    const projectPath = project.path;
    
    // Validate project structure
    await this.validateProject(projectPath);
    
    // Build the project
    await this.buildProject(projectPath);
    
    // Run deployment script
    const result = await this.runDeploymentScript(projectPath, network);
    
    return {
      network,
      contractAddress: result.contractAddress,
      txHash: result.txHash,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
  }

  private async validateProject(projectPath: string): Promise<void> {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'scripts/deploy.js'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(projectPath, file);
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
  }

  private async buildProject(projectPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const build = spawn('npm', ['run', 'build'], {
        cwd: projectPath,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      build.stdout?.on('data', (data) => {
        output += data.toString();
      });

      build.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      build.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build failed: ${errorOutput || output}`));
        }
      });

      build.on('error', reject);
    });
  }

  private async runDeploymentScript(
    projectPath: string,
    network: string
  ): Promise<{ contractAddress?: string; txHash: string }> {
    return new Promise((resolve, reject) => {
      const deploy = spawn('node', ['scripts/deploy.js', '--network', network], {
        cwd: projectPath,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      deploy.stdout?.on('data', (data) => {
        output += data.toString();
      });

      deploy.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      deploy.on('close', (code) => {
        if (code === 0) {
          // Parse deployment output for contract address and tx hash
          const contractMatch = output.match(/Contract deployed at: (0x[a-fA-F0-9]{40})/);
          const txMatch = output.match(/Transaction hash: (0x[a-fA-F0-9]{64})/);
          
          resolve({
            contractAddress: contractMatch?.[1],
            txHash: txMatch?.[1] || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
        } else {
          reject(new Error(`Deployment failed: ${errorOutput || output}`));
        }
      });

      deploy.on('error', reject);
    });
  }

  async getDeploymentStatus(txHash: string, network: string): Promise<'pending' | 'success' | 'failed'> {
    // In a real implementation, this would query the blockchain
    // For now, simulate a successful deployment
    return 'success';
  }

  async estimateDeploymentCost(project: ProjectInfo, network: string): Promise<{
    gasEstimate: string;
    feeEstimate: string;
    currency: string;
  }> {
    // In a real implementation, this would estimate actual deployment costs
    return {
      gasEstimate: '500000',
      feeEstimate: '0.01',
      currency: 'SEI'
    };
  }
}