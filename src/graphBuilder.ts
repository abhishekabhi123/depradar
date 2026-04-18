import { exec } from "child_process";

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
  return new Promise((resolve) => {
    // Use bash -i to load the user's shell environment so npm is found in PATH
    const bashCommand = `bash -i -c "${command.replace(/"/g, '\\"')}"`;

    exec(bashCommand, { cwd, shell: "/bin/bash" }, (error, stdout, stderr) => {
      if (error) {
        console.warn(
          `[graphBuilder] Command '${command}' exited with code ${error.code}:`,
          stderr,
        );
      }
      resolve(stdout ?? "");
    });
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
  if (!stdOut.trim()) {
    return { nodes: [], links: [] };
  }
  let raw: any;
  try {
    raw = JSON.parse(stdOut);
  } catch (error) {
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
