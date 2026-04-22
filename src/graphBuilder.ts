import { exec, ExecException } from "child_process";

export interface GraphNode {
  id: string;
  isDirect: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  links: GraphLink[];
  nodes: GraphNode[];
}

function runCommand(command: string, cwd: string): Promise<string> {
  const shellPath = process.env.SHELL || "/bin/bash";
  const shellCommand =
    process.platform === "win32"
      ? command
      : `${shellPath} -il -c ${JSON.stringify(command)}`;

  return new Promise((resolve) => {
    exec(
      shellCommand,
      {
        cwd,
        env: { ...process.env }, // ← inherit full VS Code process environment
        encoding: "utf8",
      },
      (error: ExecException | null, stdout: string, stderr: string) => {
        if (stderr && stderr.trim()) {
          console.warn(`Command '${command}' stderr:`, stderr.trim());
        }
        if (error) {
          console.warn(`Command '${command}' exited with code ${error.code}`);
        }
        resolve(stdout || stderr || "");
      },
    );
  });
}

function traverse(
  parentName: string,
  dependencies: Record<string, any>,
  links: GraphLink[],
  nodes: GraphNode[],
  visited: Set<string>,
  directPackages: Set<string>,
) {
  for (const [pkgName, pkgData] of Object.entries(dependencies)) {
    if (pkgData?.extraneous || pkgData?.missing) {
      continue;
    }

    links.push({ source: parentName, target: pkgName });

    if (visited.has(pkgName)) {
      continue;
    }
    visited.add(pkgName);
    nodes.push({ id: pkgName, isDirect: directPackages.has(pkgName) });

    if (pkgData.dependencies) {
      traverse(
        pkgName,
        pkgData.dependencies,
        links,
        nodes,
        visited,
        directPackages,
      );
    }
  }
}

export async function buildGraph(
  rootPath: string,
  directPackages: Set<string>,
): Promise<GraphData> {
  const stdOut = await runCommand("npm list --json --depth=2", rootPath);
  console.log("[graphBuilder] stdout length:", stdOut.length);
  console.log("[graphBuilder] first 500 chars:", stdOut.substring(0, 500));
  if (!stdOut.trim()) {
    return { nodes: [], links: [] };
  }
  let raw: any;
  try {
    raw = JSON.parse(stdOut);
  } catch (error) {
    console.error(
      "[graphBuilder] Failed to parse npm list output:",
      error,
      "stdout:",
      stdOut.substring(0, 1000),
    );
    return { nodes: [], links: [] };
  }

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const visited = new Set<string>();

  const rootName: string =
    typeof raw.name === "string" ? raw.name : "my-project";
  nodes.push({ id: rootName, isDirect: false });
  visited.add(rootName);

  const dependencies =
    typeof raw.dependencies === "object" && raw.dependencies !== null
      ? raw.dependencies
      : {};

  if (Object.keys(dependencies).length > 0) {
    traverse(rootName, dependencies, links, nodes, visited, directPackages);
  }
  return { nodes, links };
}
