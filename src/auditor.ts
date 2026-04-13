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
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderror) => {
      resolve(stdout);
    });
  });
}

export async function getOutdatedPackages(
  rootPath: string,
): Promise<OutdatedPackage[]> {
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
}
