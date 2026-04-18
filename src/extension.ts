// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getUsedPackages } from "./scanner";
import {
  AuditSummary,
  getOutdatedPackages,
  getVulnerabilities,
  installDependencies,
  OutdatedPackage,
  Vulnerability,
} from "./auditor";
const SCRIPT_ONLY_PACKAGES = new Set([
  "nodemon",
  "ts-node",
  "concurrently",
  "cross-env",
  "rimraf",
  "prettier",
  "eslint",
  "jest",
  "vitest",
  "tsx",
  "tsc-alias",
  "typescript",
  "mocha",
  "chai",
  "supertest",
  "jest-mock",
  "prisma",
  "@prisma/client",
  "husky",
  "lint-staged",
  "dotenv-cli",
  "tsc-alias",
  "tsconfig-paths",
]);
import { buildGraph } from "./graphBuilder";
import { GraphData } from "./graphBuilder";
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "depradar.analyze",
    async () => {
      const workSpaceFolder = vscode.workspace.workspaceFolders;
      if (!workSpaceFolder) {
        vscode.window.showErrorMessage("No workspace opened!");
        return;
      }
      const rootPath = workSpaceFolder[0].uri.fsPath;

      const pkgPath = path.join(rootPath, "package.json");

      if (!fs.existsSync(pkgPath)) {
        vscode.window.showErrorMessage("package.json file does not exist!");
        return;
      }

      const rawPkg = fs.readFileSync(pkgPath, "utf-8");
      const pkgObject = JSON.parse(rawPkg);

      const deps = Object.keys(pkgObject.dependencies ?? {}).length;
      const devDeps = Object.keys(pkgObject.devDependencies ?? {}).length;

      const installedPackages = new Set([
        ...Object.keys(pkgObject.dependencies ?? {}),
        ...Object.keys(pkgObject.devDependencies ?? {}),
      ]);

      const usedPackages = getUsedPackages(rootPath);

      const unusedPackages = [...installedPackages].filter(
        (pkg) =>
          !usedPackages.has(pkg) &&
          !SCRIPT_ONLY_PACKAGES.has(pkg) &&
          !pkg.startsWith("@types/"),
      );

      const panel = vscode.window.createWebviewPanel(
        "depRadar",
        "Dep Radar",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
        },
      );

      // Show loading state immediately while npm commands execute
      panel.webview.html = getLoadingHTML();
      await installDependencies(rootPath);

      const [outdated, auditSummary] = await Promise.all([
        getOutdatedPackages(rootPath),
        getVulnerabilities(rootPath),
      ]);

      const graphData = await buildGraph(rootPath, installedPackages);
      panel.webview.html = getWebViewContent(
        deps,
        devDeps,
        unusedPackages,
        outdated,
        auditSummary,
        graphData,
      );

      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.command === "refresh") {
            await installDependencies(rootPath);

            const rawPkg = fs.readFileSync(pkgPath, "utf-8");
            const pkgObject = JSON.parse(rawPkg);

            const depKeys = Object.keys(pkgObject.dependencies ?? {});
            const devDepKeys = Object.keys(pkgObject.devDependencies ?? {});
            const freshDeps = depKeys.length;
            const freshDevDeps = devDepKeys.length;

            const freshInstalledPackages = new Set([...depKeys, ...devDepKeys]);
            const freshUsedPackages = getUsedPackages(rootPath);
            const freshUnusedPackages = [...freshInstalledPackages].filter(
              (pkg) =>
                !freshUsedPackages.has(pkg) &&
                !SCRIPT_ONLY_PACKAGES.has(pkg) &&
                !pkg.startsWith("@types/"),
            );

            const [outdated, auditSummary] = await Promise.all([
              getOutdatedPackages(rootPath),
              getVulnerabilities(rootPath),
            ]);

            // Update the entire HTML with fresh data
            panel.webview.html = getWebViewContent(
              freshDeps,
              freshDevDeps,
              freshUnusedPackages,
              outdated,
              auditSummary,
              graphData,
            );

            // Send completion signal to hide loading state
            panel.webview.postMessage({
              command: "refreshComplete",
            });
          }
        },
        undefined,
        context.subscriptions,
      );
    },
  );

  context.subscriptions.push(disposable);
}

function getLoadingHTML(): string {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dep Radar</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .loading-container {
                text-align: center;
            }
            .loading {
                font-size: 18px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 20px;
            }
            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid var(--vscode-panel-border);
                border-top: 4px solid var(--vscode-button-background);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="loading-container">
            <div class="spinner"></div>
            <div class="loading">🔍 Analyzing dependencies...</div>
        </div>
    </body>
    </html>`;
}

function getWebViewContent(
  deps: number,
  devDeps: number,
  unused: string[],
  outdated: OutdatedPackage[],
  auditSummary: AuditSummary,
  graphData: GraphData,
): string {
  const renderVulnRows = (vulns: Vulnerability[]) =>
    vulns
      .map(
        (v) => `
            <div class="stat">
                <div>
                    <span>${v.name}</span>
                    ${
                      v.isDirect
                        ? `<span class="tag-indirect">${v.fixAvailable ? "fix available" : "no fix yet"}</span>`
                        : `<span class="tag-indirect">via ${v.effects.join(", ") || "transitive"}</span>`
                    }
                </div>
                <span class="badge badge-${v.severity}">${v.severity}</span>
            </div>
        `,
      )
      .join("") ||
    '<p style="color: var(--vscode-descriptionForeground); font-size:12px;">None</p>';

  const directVulns = auditSummary.vulnerabilities.filter((v) => v.isDirect);
  const indirectFixable = auditSummary.vulnerabilities.filter(
    (v) => !v.isDirect && v.effects.length > 0,
  );
  const deepTransitive = auditSummary.vulnerabilities.filter(
    (v) => !v.isDirect && v.effects.length === 0,
  );
  const outdatedHTML = `
<h2>🔄 Outdated Packages (${outdated.length})</h2>
<div class="card">
    ${
      outdated.length === 0
        ? "<p>✅ All packages are up to date!</p>"
        : outdated
            .map(
              (pkg) => `
            <div class="stat">
                <div>
                    <span>${pkg.name}</span>
                    <span class="tag-indirect">${pkg.current} → ${pkg.latest}</span>
                </div>
                <span class="badge badge-${pkg.updateType}">
                    ${pkg.updateType}
                </span>
            </div>
        `,
            )
            .join("")
    }
</div>`;

  const vulnHTML = `
<h2>⚠️ Vulnerabilities (${auditSummary.totals.total})</h2>

<!-- Summary bar -->
<div class="card">
    <div class="stat">
        <span>Critical</span>
        <span class="badge badge-critical">${auditSummary.totals.critical}</span>
    </div>
    <div class="stat">
        <span>High</span>
        <span class="badge badge-high">${auditSummary.totals.high}</span>
    </div>
    <div class="stat">
        <span>Moderate</span>
        <span class="badge badge-moderate">${auditSummary.totals.moderate}</span>
    </div>
    <div class="stat">
        <span>Low</span>
        <span class="badge badge-low">${auditSummary.totals.low}</span>
    </div>
</div>

<!-- Section 1: Direct — you fix these -->
<div class="card">
    <div class="section-header">
        🔴 Fix directly — these are in your package.json
    </div>
    ${renderVulnRows(directVulns)}
</div>

<!-- Section 2: Indirect but fixable -->
<div class="card">
    <div class="section-header">
        🟡 Fix by updating a direct dep
    </div>
    <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 8px;">
        These are pulled in by your packages. Update the parent to fix them.
    </p>
    ${renderVulnRows(indirectFixable)}
</div>

<!-- Section 3: Deep transitive — nothing to do -->
<div class="card">
    <div class="section-header">
        ⚪ Deep transitive — no action needed
    </div>
    <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 8px;">
        These are deep indirect deps. They'll resolve on their own when upstream packages update.
    </p>
    ${renderVulnRows(deepTransitive)}
</div>`;
  const total = devDeps + deps;
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dep Radar</title>
        <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
                padding: 20px;
            }
            .card {
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
            }
            .stat {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .stat:last-child { border-bottom: none; }
            .stat-value {
                font-weight: bold;
                font-size: 1.2em;
            }
            h2 { margin-top: 0; }
            button {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            }
            button:hover {
                background: var(--vscode-button-hoverBackground);
            }
                .badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
}
    .badge-critical { background: var(--vscode-errorForeground); color: var(--vscode-editor-background); }
    .badge-high     { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); }
    .badge-moderate { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground); }
    .badge-low      { background: var(--vscode-inputValidation-infoBackground); color: var(--vscode-inputValidation-infoForeground); }
    .badge-major    { background: var(--vscode-errorForeground); color: var(--vscode-editor-background); }
    .badge-minor    { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground); }
    .badge-patch    { background: var(--vscode-editorHoverWidget-background); color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); }
    .tag-indirect   { font-size: 11px; color: var(--vscode-descriptionForeground); margin-left: 6px; }
    .badge-prerelease { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground); }
    .loading {
        text-align: center;
        padding: 20px;
        color: var(--vscode-descriptionForeground);
    }
    .loading::after {
        content: '';
        animation: dots 1.5s steps(4, end) infinite;
    }
    @keyframes dots {
        0%, 20% { content: ''; }
        40% { content: '.'; }
        60% { content: '..'; }
        80%, 100% { content: '...'; }
    }
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    body {
        display: flex;
        flex-direction: column;
        height: 100vh;
        margin: 0;
        padding: 0;
    }
    .tabs {
        padding: 20px 20px 0 20px;
        flex-shrink: 0;
    }
    #dashboard-view {
        flex: 1;
        overflow-y: auto;
        padding: 0 20px 20px 20px;
    }
    #graph-view {
        flex: 1;
        overflow: hidden;
        padding: 0 20px 20px 20px;
        display: flex;
        flex-direction: column;
    }
    #graph-view h2 {
        margin: 0 0 12px 0;
        flex-shrink: 0;
    }
    #graph-container {
        width: 100%;
        height: 100%;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        flex: 1;
    }
    #graph-container svg {
        cursor: grab;
    }
    #graph-container svg.grabbing {
        cursor: grabbing;
    }
        .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}
.tab {
    padding: 6px 16px;
    border-radius: 4px;
    border: 1px solid var(--vscode-panel-border);
    background: transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
}
.tab.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: transparent;
}
    .section-header {
    font-weight: bold;
    font-size: 13px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
        </style>
    </head>
    <body>
        <!-- Tab buttons -->
<div class="tabs">
    <button class="tab active" id="tab-dashboard" onclick="showTab('dashboard')">📊 Dashboard</button>
    <button class="tab" id="tab-graph" onclick="showTab('graph')">🌐 Graph</button>
</div>

<!-- Dashboard view with all content -->
<div id="dashboard-view">
    <h2>📦 Dependency Overview</h2>

    <div class="card">
        <div class="stat">
            <span>Total Dependencies</span>
            <span class="stat-value" id="total">${total}</span>
        </div>
        <div class="stat">
            <span>Production</span>
            <span class="stat-value" id="deps">${deps}</span>
        </div>
        <div class="stat">
            <span>Dev Dependencies</span>
            <span class="stat-value" id="devDeps">${devDeps}</span>
        </div>
    </div>

    <h2>🧹 Unused Dependencies</h2>
    <div class="card" id="unusedList">
        ${
          unused.length === 0
            ? "<p>✅ No unused dependencies found!</p>"
            : unused
                .map(
                  (pkg) => `
                <div class="stat">
                    <span>${pkg}</span>
                    <span style="color: var(--vscode-errorForeground)">unused</span>
                </div>
            `,
                )
                .join("")
        }
    </div>

    ${outdatedHTML}
    ${vulnHTML}

    <div id="loadingSpace"></div>
    <button id="refreshBtn">🔄 Refresh</button>
</div>

<!-- New graph view -->
<div id="graph-view" style="display:none;">
    <h2>🌐 Dependency Graph</h2>
    <div id="graph-container"></div>
</div>

        <script>
            const vsCode = acquireVsCodeApi();
            const refreshBtn = document.getElementById('refreshBtn');
            const loadingSpace = document.getElementById('loadingSpace');
            
            refreshBtn.addEventListener('click', () => {
                // Show loading and disable button
                refreshBtn.disabled = true;
                loadingSpace.innerHTML = '<div class="loading">Analyzing</div>';
                vsCode.postMessage({command: 'refresh'});
            });

            window.addEventListener('message', (event) => {
                const message = event.data;
                if (message.command === 'refreshComplete') {
                    // Hide loading and enable button
                    loadingSpace.innerHTML = '';
                    refreshBtn.disabled = false;
                }
            });
           function showTab(name) {
    // Show/hide views using flex layout
    document.getElementById('dashboard-view').style.display = 
        name === 'dashboard' ? 'block' : 'none';
    document.getElementById('graph-view').style.display = 
        name === 'graph' ? 'flex' : 'none';

    // Update active tab styles
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
    });
    document.getElementById('tab-' + name).classList.add('active');
}

// Graph data injected from extension
const graphData = ${JSON.stringify(graphData)};

function renderGraph() {
    const container = document.getElementById('graph-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear any existing SVG
    d3.select('#graph-container').selectAll('svg').remove();

    // Create SVG canvas
    const svg = d3.select('#graph-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Add zoom/pan behaviour
    const g = svg.append('g');
    const zoom = d3.zoom()
        .scaleExtent([0.5, 5])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    svg.call(zoom);

    // D3 force simulation — physics engine
    const simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links)
            .id(d => d.id)
            .distance(80))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

    // Draw links (lines)
    const link = g.append('g')
        .selectAll('line')
        .data(graphData.links)
        .join('line')
        .attr('stroke', 'var(--vscode-panel-border)')
        .attr('stroke-width', 1.5);

    // Draw nodes (circles)
    const node = g.append('g')
        .selectAll('circle')
        .data(graphData.nodes)
        .join('circle')
        .attr('r', d => d.isDirect ? 10 : 6)
        .attr('fill', d => d.isDirect
            ? 'var(--vscode-button-background)'   // your direct deps — highlighted
            : 'var(--vscode-descriptionForeground)') // transitive — subtle
        .call(d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x; d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            })
        );

    // Draw labels
    const label = g.append('g')
        .selectAll('text')
        .data(graphData.nodes)
        .join('text')
        .text(d => d.id)
        .attr('font-size', d => d.isDirect ? '11px' : '9px')
        .attr('fill', 'var(--vscode-foreground)')
        .attr('dx', 12)
        .attr('dy', 4)
        .attr('pointer-events', 'none');

    // Update positions each simulation tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        label
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });

    // Reset zoom to fit
    const bounds = g.node().getBBox();
    const fullWidth = bounds.width;
    const fullHeight = bounds.height;
    const midX = bounds.x + fullWidth / 2;
    const midY = bounds.y + fullHeight / 2;

    if (fullWidth > 0 && fullHeight > 0) {
        const scale = Math.min(width / fullWidth, height / fullHeight) * 0.75;
        const translate = [width / 2 - scale * midX, height / 2 - scale * midY];
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }
}

// Render when graph tab is opened
document.getElementById('tab-graph').addEventListener('click', () => {
    // Only render once
    setTimeout(() => {
        if (!document.querySelector('#graph-container svg')) {
            renderGraph();
        }
    }, 0);
});
        </script>
    </body>
    </html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
