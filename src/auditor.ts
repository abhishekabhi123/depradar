import { exec } from "child_process";
import * as semver from "semver";

export interface OutdatedPackage {
  name: string;
  current: string;
  latest: string;
  updateType: "major" | "minor" | "patch";
}

export interface Vulnerability {
  name: string;
  severity: "low" | "moderate" | "high" | "critical";
  isDirect: boolean;
  fixAvailable: boolean;
  effects: string[];
}

export interface AuditSummary {
  vulnerabilities: Vulnerability[];
  totals: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
    total: number;
  };
}

function runCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve) => {
    // Use bash -i to load the user's shell environment so npm is found in PATH
    const bashCommand = `bash -i -c "${command.replace(/"/g, '\\"')}"`;

    exec(bashCommand, { cwd, shell: "/bin/bash" }, (error, stdout, stderr) => {
      if (error) {
        console.warn(
          `Command '${command}' exited with code ${error.code}:`,
          stderr,
        );
      }
      // Still resolve with stdout, as some commands like "npm outdated" return exit code 1 when packages are outdated
      resolve(stdout);
    });
  });
}

export async function installDependencies(rootPath: string): Promise<void> {
  try {
    await runCommand("npm install --legacy-peer-deps 2>&1 || true", rootPath);
  } catch (error) {
    // Continue anyway - outdated/audit might still work with partial installs
  }
}

export async function getOutdatedPackages(
  rootPath: string,
): Promise<OutdatedPackage[]> {
  try {
    const stdOut = await runCommand("npm outdated --json", rootPath);
    if (!stdOut.trim()) {
      return [];
    }

    const raw = JSON.parse(stdOut);
    const result: OutdatedPackage[] = [];

    for (const [name, info] of Object.entries(raw) as any) {
      const current = info.current;
      const latest = info.latest;

      const diff = semver.diff(current, latest);
      const updateType = (
        diff === "major" ? "major" : diff === "minor" ? "minor" : "patch"
      ) as "major" | "minor" | "patch";

      result.push({ name, current, latest, updateType });
    }

    return result;
  } catch (error) {
    console.error("Error getting outdated packages:", error);
    return [];
  }
}

export async function getVulnerabilities(
  rootPath: string,
): Promise<AuditSummary> {
  try {
    const stdout = await runCommand("npm audit --json", rootPath);
    if (!stdout.trim()) {
      return {
        vulnerabilities: [],
        totals: { low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
      };
    }
    const raw = JSON.parse(stdout);
    const vulns: Vulnerability[] = [];

    for (const [name, info] of Object.entries(
      raw.vulnerabilities ?? {},
    ) as any) {
      vulns.push({
        name,
        severity: info.severity,
        isDirect: info.isDirect,
        fixAvailable: !!info.fixAvailable,
        effects: info.effects,
      });
    }
    return {
      vulnerabilities: vulns,
      totals: raw.metadata?.vulnerabilities ?? {
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0,
      },
    };
  } catch (error) {
    console.error("Error getting vulnerabilities:", error);
    return {
      vulnerabilities: [],
      totals: { low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    };
  }
}
