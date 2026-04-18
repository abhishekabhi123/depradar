# DepRadar

DepRadar is a Visual Studio Code extension that analyzes npm dependencies in a workspace. It helps you find unused packages, detect outdated dependencies, and surface security vulnerabilities so you can keep your project lean, up-to-date, and secure.

## Features

- 📦 Analyze production and development dependencies from `package.json`
- 🧹 Detect unused packages that are not referenced in source files
- 🔄 Find outdated packages with update type grouping (major/minor/patch)
- ⚠️ Show vulnerability counts for low, moderate, high, and critical issues
- 🌐 Render an interactive dependency graph for direct and transitive packages
- 🔁 Refresh data on demand with a one-click analyzer refresh command

## Usage

1. Open a workspace containing a `package.json` file.
2. Run the command: **DepRadar: Analyze Dependencies**.
3. Wait while DepRadar analyzes dependencies, outdated packages, vulnerabilities, and dependency graph data.
4. Use the dashboard to review unused packages, outdated packages, and vulnerability totals.
5. Switch to the Graph tab to explore direct and transitive package relationships.

## Command

- `depradar.analyze` — DepRadar: Analyze Dependencies

## Installation

Install the extension from the VS Code marketplace or build locally from this repository.

### Local development

```bash
npm install
npm run compile
```

Then launch the extension in VS Code using the extension development host.

## Requirements

- Node.js installed on your development machine
- A workspace with a `package.json` file
- Supported VS Code version: `^1.110.0`

## Development

Use the existing scripts in `package.json`:

- `npm run compile` — type check, lint, and build the extension
- `npm run watch` — run incremental watch for TypeScript and esbuild
- `npm run lint` — run ESLint on `src`
- `npm test` — run extension tests

## Notes

- DepRadar uses a shell wrapper to locate npm in the extension host environment.
- It ignores `@types/*` packages when reporting unused dependencies.
- For refresh operations, it installs dependencies with `--ignore-scripts --no-audit --legacy-peer-deps` to reduce install failures.

## Changelog

See `CHANGELOG.md` for release history.

## Contributing

Contributions are welcome. Please open issues or pull requests on the repository.

## License

This project uses the licensing terms defined by the repository owner.
