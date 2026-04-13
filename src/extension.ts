// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getUsedPackages } from "./scanner";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand("depradar.analyze", () => {
    // The code you place here will be executed every time your command is executed
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
      (pkg) => !usedPackages.has(pkg),
    );

    const panel = vscode.window.createWebviewPanel(
      "depRadar",
      "Dep Radar",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
      },
    );

    panel.webview.html = getWebViewContent(deps, devDeps, unusedPackages);
    panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === "refresh") {
          const rawPkg = fs.readFileSync(pkgPath, "utf-8");
          const pkgObject = JSON.parse(rawPkg);

          const freshDeps = Object.keys(pkgObject.dependencies ?? {}).length;
          const freshDevDeps = Object.keys(
            pkgObject.devDependencies ?? {},
          ).length;

          const freshInstalledPackages = new Set([
            ...Object.keys(pkgObject.dependencies ?? {}),
            ...Object.keys(pkgObject.devDependencies ?? {}),
          ]);

          const freshUsedPackages = getUsedPackages(rootPath);
          const freshUnusedPackages = [...freshInstalledPackages].filter(
            (pkg) => !freshUsedPackages.has(pkg),
          );

          panel.webview.postMessage({
            command: "refresh",
            deps: freshDeps,
            devDeps: freshDevDeps,
            total: freshDeps + freshDevDeps,
            unused: freshUnusedPackages,
          });
        }
      },
      undefined,
      context.subscriptions,
    );
  });
}
function getWebViewContent(
  deps: number,
  devDeps: number,
  unused: string[],
): string {
  const total = devDeps + deps;
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
        </style>
    </head>
    <body>
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

        <button id="refreshBtn">🔄 Refresh</button>

        <script>
            const vsCode = acquireVsCodeApi();
            document.getElementById('refreshBtn').addEventListener('click', () => {
                vsCode.postMessage({command: 'refresh'});
            });

            window.addEventListener('message', (event) => {
                const message = event.data;
                if (message.command === 'refresh') {
                    document.getElementById('total').textContent = message.total;
                    document.getElementById('deps').textContent = message.deps;
                    document.getElementById('devDeps').textContent = message.devDeps;
                    const unusedList = document.getElementById('unusedList');
                    if (message.unused.length === 0) {
                        unusedList.innerHTML = "<p>✅ No unused dependencies found!</p>";
                    } else {
                        unusedList.innerHTML = message.unused.map(pkg => \`
                            <div class="stat">
                                <span>\${pkg}</span>
                                <span style="color: var(--vscode-errorForeground)">unused</span>
                            </div>
                        \`).join('');
                    }
                }
            });
        </script>
    </body>
    </html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
