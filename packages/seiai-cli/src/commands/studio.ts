import { Command } from 'commander';
import { StudioInterface } from '../ui/studio.js';

export function createStudioCommand(): Command {
  const studio = new Command('studio');
  
  studio
    .description('Launch interactive Sei AI Studio (Claude Code-style interface)')
    .action(async () => {
      const ui = new StudioInterface();
      await ui.start();
    });

  return studio;
}