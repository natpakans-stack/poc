import AdmZip from "adm-zip";
import { existsSync, mkdirSync, cpSync, rmSync } from "fs";
import { join, basename, extname } from "path";

const PROJECTS_DIR = join(import.meta.dir, "..", "projects");

export function setup(zipPath: string, projectName?: string): string {
  if (!existsSync(zipPath)) {
    throw new Error(`File not found: ${zipPath}`);
  }
  if (extname(zipPath).toLowerCase() !== ".zip") {
    throw new Error(`Not a zip file: ${zipPath}`);
  }

  // Derive project name from zip filename
  const name = projectName || basename(zipPath, ".zip").replace(/\s+/g, "-").toLowerCase();
  const projectDir = join(PROJECTS_DIR, name);

  if (existsSync(projectDir)) {
    throw new Error(`Project "${name}" already exists at ${projectDir}. Delete it first or use a different name.`);
  }

  // Create project structure
  const originalDir = join(projectDir, "_original");
  const workingDir = join(projectDir, "working");
  const backupDir = join(projectDir, "_backup");

  mkdirSync(originalDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  // Extract zip to _original
  console.log(`Extracting ${basename(zipPath)} ...`);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(originalDir, true);

  // Flatten if zip contains a single root folder
  const entries = Bun.spawnSync(["ls", originalDir]).stdout.toString().trim().split("\n");
  if (entries.length === 1) {
    const innerDir = join(originalDir, entries[0]);
    const stat = Bun.spawnSync(["test", "-d", innerDir]);
    if (stat.exitCode === 0) {
      // Move contents up one level
      const innerEntries = Bun.spawnSync(["ls", "-A", innerDir]).stdout.toString().trim().split("\n");
      for (const entry of innerEntries) {
        Bun.spawnSync(["mv", join(innerDir, entry), originalDir]);
      }
      Bun.spawnSync(["rmdir", innerDir]);
      console.log(`Flattened single root folder: ${entries[0]}`);
    }
  }

  // Copy _original → working and _backup (initial snapshot)
  cpSync(originalDir, workingDir, { recursive: true });
  cpSync(originalDir, backupDir, { recursive: true });

  console.log(`\nProject created: ${projectDir}`);
  console.log(`  _original/  ← READ-ONLY source`);
  console.log(`  working/    ← editable copy`);
  console.log(`  _backup/    ← undo storage\n`);

  return projectDir;
}

// CLI entry
if (import.meta.main) {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error("Usage: bun run src/setup.ts <path-to-zip> [project-name]");
    process.exit(1);
  }
  const projectName = process.argv[3];
  const projectDir = setup(zipPath, projectName);
  console.log(`Next: bun run src/analyze.ts ${projectDir}`);
}
