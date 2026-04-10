// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

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

    const panel = vscode.window.createWebviewPanel(
      "depRadar",
      "Dep Radar",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      },
    );

    panel.webview.html = getWebViewContent(deps, devDeps);
  });

  context.subscriptions.push(disposable);
}
function getWebViewContent(deps: number, devDeps: number): string {
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
        </style>
    </head>
    <body>
        <h2>📦 Dependency Overview</h2>
        <div class="card">
            <div class="stat">
                <span>Total Dependencies</span>
                <span class="stat-value">${total}</span>
            </div>
            <div class="stat">
                <span>Production</span>
                <span class="stat-value">${deps}</span>
            </div>
            <div class="stat">
                <span>Dev Dependencies</span>
                <span class="stat-value">${devDeps}</span>
            </div>
        </div>
    </body>
    </html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
