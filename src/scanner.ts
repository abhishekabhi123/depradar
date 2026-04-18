import { Project, SyntaxKind } from "ts-morph";
import * as path from "path";
import * as fs from "node:fs";

export function getUsedPackages(rootPath: string): Set<string> {
  const usedPackages = new Set<string>();
  const tsconfigJsonPath = path.join(rootPath, "tsconfig.json");
  const tsconfigJsPath = path.join(rootPath, "tsconfig.js");

  const project = new Project(
    fs.existsSync(tsconfigJsonPath)
      ? {
          tsConfigFilePath: tsconfigJsonPath,
          skipAddingFilesFromTsConfig: false,
        }
      : fs.existsSync(tsconfigJsPath)
        ? {
            tsConfigFilePath: tsconfigJsPath,
            skipAddingFilesFromTsConfig: false,
          }
        : {},
  );

  if (project.getSourceFiles().length === 0) {
    project.addSourceFilesAtPaths([
      path.join(rootPath, "src/**/*.{ts,tsx,js,jsx}"),
      path.join(rootPath, "*.{ts,tsx,js,jsx}"),
    ]);
  }

  for (const sourceFile of project.getSourceFiles()) {
    for (const imp of sourceFile.getImportDeclarations()) {
      const moduleName = imp.getModuleSpecifierValue();
      const packageName = extractPackageName(moduleName);
      if (packageName) {
        usedPackages.add(packageName);
      }
    }
    for (const call of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression,
    )) {
      const exp = call.getExpression().getText();
      if (exp === "require" || exp === "import") {
        const args = call.getArguments();
        if (args.length > 0) {
          const packageName = extractPackageName(
            args[0].getText().replace(/[""]/g, ""),
          );
          if (packageName) {
            usedPackages.add(packageName);
          }
        }
      }
    }
  }

  return usedPackages;
}

function extractPackageName(modulePath: string): string | null {
  if (
    modulePath.startsWith(".") ||
    modulePath.startsWith("/") ||
    modulePath.startsWith("file:") ||
    modulePath.startsWith("link:") ||
    modulePath.startsWith("workspace:") ||
    modulePath.startsWith("git+")
  ) {
    return null;
  }
  if (modulePath.startsWith("@")) {
    const parts = modulePath.split("/");
    return parts.slice(0, 2).join("/");
  }
  return modulePath.split("/")[0];
}
