import { existsSync, cpSync, rmSync } from "fs";
import { join } from "path";

export function createBackup(projectDir: string) {
  const workingDir = join(projectDir, "working");
  const backupDir = join(projectDir, "_backup");

  if (!existsSync(workingDir)) {
    throw new Error(`No working/ directory found in ${projectDir}`);
  }

  // Clear old backup, copy current working → _backup
  if (existsSync(backupDir)) rmSync(backupDir, { recursive: true });
  cpSync(workingDir, backupDir, { recursive: true });
  console.log("Backup created from working/");
}

export function undo(projectDir: string) {
  const workingDir = join(projectDir, "working");
  const backupDir = join(projectDir, "_backup");
  const tempDir = join(projectDir, "_temp_swap");

  if (!existsSync(backupDir) || !existsSync(workingDir)) {
    throw new Error("No backup available to undo.");
  }

  // Swap: working ↔ _backup
  cpSync(workingDir, tempDir, { recursive: true });
  rmSync(workingDir, { recursive: true });
  cpSync(backupDir, workingDir, { recursive: true });
  rmSync(backupDir, { recursive: true });
  cpSync(tempDir, backupDir, { recursive: true });
  rmSync(tempDir, { recursive: true });

  console.log("Undo complete. working/ ↔ _backup/ swapped.");
}

export function reset(projectDir: string) {
  const originalDir = join(projectDir, "_original");
  const workingDir = join(projectDir, "working");
  const backupDir = join(projectDir, "_backup");

  if (!existsSync(originalDir)) {
    throw new Error(`No _original/ directory found in ${projectDir}`);
  }

  // Backup current working before reset
  if (existsSync(workingDir)) {
    if (existsSync(backupDir)) rmSync(backupDir, { recursive: true });
    cpSync(workingDir, backupDir, { recursive: true });
    rmSync(workingDir, { recursive: true });
  }

  // Copy _original → working
  cpSync(originalDir, workingDir, { recursive: true });
  console.log("Reset complete. working/ restored from _original/");
  console.log("Previous working/ saved to _backup/ (undo available).");
}

// CLI entry
if (import.meta.main) {
  const action = process.argv[2];
  const projectDir = process.argv[3];

  if (!action || !projectDir) {
    console.error("Usage: bun run src/backup.ts <undo|reset> <project-dir>");
    process.exit(1);
  }

  if (action === "undo") undo(projectDir);
  else if (action === "reset") reset(projectDir);
  else console.error(`Unknown action: ${action}. Use "undo" or "reset".`);
}
