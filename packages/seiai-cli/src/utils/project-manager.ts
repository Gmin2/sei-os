import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import type { ProjectInfo, ProjectConfig } from '../types.js';

export class ProjectManager {
  private projectConfigFile = 'sei-project.json';

  async findProjects(searchDir = process.cwd()): Promise<ProjectInfo[]> {
    const projects: ProjectInfo[] = [];
    
    try {
      const entries = await fs.readdir(searchDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(searchDir, entry.name);
          const configPath = path.join(projectPath, this.projectConfigFile);
          
          if (await fs.pathExists(configPath)) {
            try {
              const config = await fs.readJson(configPath);
              const packageJsonPath = path.join(projectPath, 'package.json');
              
              if (await fs.pathExists(packageJsonPath)) {
                const packageJson = await fs.readJson(packageJsonPath);
                
                projects.push({
                  name: packageJson.name || entry.name,
                  path: projectPath,
                  config,
                  packageJson,
                  lastModified: config.lastModified || new Date().toISOString()
                });
              }
            } catch (error) {
              // Skip invalid project configs
              continue;
            }
          }
        }
      }
    } catch (error) {
      // Handle permission errors or invalid directories
      return [];
    }
    
    return projects.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  async createProject(
    projectPath: string, 
    config: ProjectConfig,
    packageJson: any
  ): Promise<ProjectInfo> {
    const configPath = path.join(projectPath, this.projectConfigFile);
    
    const projectConfig: ProjectConfig = {
      ...config,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: '1.0.0'
    };

    await fs.writeJson(configPath, projectConfig, { spaces: 2 });
    
    return {
      name: packageJson.name,
      path: projectPath,
      config: projectConfig,
      packageJson,
      lastModified: projectConfig.lastModified || new Date().toISOString()
    };
  }

  async updateProject(projectPath: string, updates: Partial<ProjectConfig>): Promise<void> {
    const configPath = path.join(projectPath, this.projectConfigFile);
    
    if (!await fs.pathExists(configPath)) {
      throw new Error(`Project config not found: ${configPath}`);
    }
    
    const config = await fs.readJson(configPath);
    const updatedConfig = {
      ...config,
      ...updates,
      lastModified: new Date().toISOString()
    };
    
    await fs.writeJson(configPath, updatedConfig, { spaces: 2 });
  }

  async validateProject(projectPath: string): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if directory exists
    if (!await fs.pathExists(projectPath)) {
      return {
        valid: false,
        issues: ['Project directory does not exist'],
        suggestions: ['Make sure the project path is correct']
      };
    }

    // Check for essential files
    const essentialFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      this.projectConfigFile
    ];

    for (const file of essentialFiles) {
      const filePath = path.join(projectPath, file);
      if (!await fs.pathExists(filePath)) {
        issues.push(`Missing essential file: ${file}`);
      }
    }

    // Check package.json structure
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        
        if (!packageJson.dependencies) {
          issues.push('package.json missing dependencies');
        } else {
          const seiPackages = Object.keys(packageJson.dependencies)
            .filter(dep => dep.startsWith('@sei-code/'));
          
          if (seiPackages.length === 0) {
            issues.push('No @sei-code packages found in dependencies');
            suggestions.push('Add @sei-code packages to use the Sei agent framework');
          }
        }

        if (!packageJson.scripts) {
          issues.push('package.json missing scripts');
          suggestions.push('Add build, dev, and start scripts');
        } else {
          const requiredScripts = ['build', 'dev', 'start'];
          for (const script of requiredScripts) {
            if (!packageJson.scripts[script]) {
              issues.push(`Missing script: ${script}`);
            }
          }
        }
      } catch (error) {
        issues.push('Invalid package.json format');
      }
    }

    // Check TypeScript config
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    if (await fs.pathExists(tsConfigPath)) {
      try {
        const tsConfig = await fs.readJson(tsConfigPath);
        if (!tsConfig.compilerOptions) {
          issues.push('Invalid tsconfig.json - missing compilerOptions');
        }
      } catch (error) {
        issues.push('Invalid tsconfig.json format');
      }
    }

    // Check environment file
    const envExamplePath = path.join(projectPath, '.env.example');
    if (!await fs.pathExists(envExamplePath)) {
      suggestions.push('Add .env.example file with required environment variables');
    }

    // Check for README
    const readmePath = path.join(projectPath, 'README.md');
    if (!await fs.pathExists(readmePath)) {
      suggestions.push('Add README.md with project documentation');
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }

  async getProjectStats(projectPath: string): Promise<{
    fileCount: number;
    packageCount: number;
    lastModified: Date;
    size: string;
  }> {
    const stats = {
      fileCount: 0,
      packageCount: 0,
      lastModified: new Date(),
      size: '0 KB'
    };

    if (!await fs.pathExists(projectPath)) {
      return stats;
    }

    try {
      // Count files recursively
      const countFiles = async (dir: string): Promise<number> => {
        let count = 0;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }
          
          if (entry.isDirectory()) {
            count += await countFiles(path.join(dir, entry.name));
          } else {
            count++;
          }
        }
        
        return count;
      };

      stats.fileCount = await countFiles(projectPath);

      // Get package count
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        stats.packageCount = packageJson.dependencies ? 
          Object.keys(packageJson.dependencies).length : 0;
      }

      // Get last modified time
      const projectStat = await fs.stat(projectPath);
      stats.lastModified = projectStat.mtime;

      // Get directory size (approximate)
      const getDirSize = async (dir: string): Promise<number> => {
        let size = 0;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name === 'node_modules') continue;
          
          const entryPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            size += await getDirSize(entryPath);
          } else {
            const fileStat = await fs.stat(entryPath);
            size += fileStat.size;
          }
        }
        
        return size;
      };

      const sizeBytes = await getDirSize(projectPath);
      if (sizeBytes < 1024) {
        stats.size = `${sizeBytes} B`;
      } else if (sizeBytes < 1024 * 1024) {
        stats.size = `${Math.round(sizeBytes / 1024)} KB`;
      } else {
        stats.size = `${Math.round(sizeBytes / (1024 * 1024))} MB`;
      }

    } catch (error) {
      // Return default stats on error
    }

    return stats;
  }

  formatProjectInfo(project: ProjectInfo): void {
    console.log(chalk.bold(`📦 ${project.name}`));
    console.log(`   Path: ${chalk.cyan(project.path)}`);
    console.log(`   Template: ${chalk.gray(project.config.template || 'custom')}`);
    console.log(`   Packages: ${chalk.gray(project.config.packages?.join(', ') || 'none')}`);
    console.log(`   Network: ${chalk.gray(project.config.network || 'testnet')}`);
    console.log(`   Modified: ${chalk.gray(new Date(project.lastModified).toLocaleString())}`);
  }

  async cleanupProject(projectPath: string): Promise<void> {
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    const distPath = path.join(projectPath, 'dist');
    const buildPath = path.join(projectPath, 'build');
    
    const pathsToClean = [nodeModulesPath, distPath, buildPath];
    
    for (const pathToClean of pathsToClean) {
      if (await fs.pathExists(pathToClean)) {
        await fs.remove(pathToClean);
      }
    }
  }
}