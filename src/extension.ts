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

    vscode.window.showInformationMessage(
      `📦 ${deps} prod deps | 🛠️ ${devDeps} dev deps | Total: ${deps + devDeps}`,
    );
  });

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
