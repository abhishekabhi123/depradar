# Changelog

All notable changes to DepRadar are documented in this file.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

- Consolidated dependency analysis, outdated detection, vulnerability reporting, and graph rendering into a single dashboard.
- Added support for dynamic import scanning and additional npm edge cases.
- Improved package install refresh handling with safer npm install flags.

## [0.0.1] - 2026-04-18

- Initial release of DepRadar.
- Added `depradar.analyze` command.
- Added dependency overview, unused dependency detection, outdated package reporting, and vulnerability summary.
- Added interactive dependency graph visualization.

## [0.0.2] - 2026-04-22

### Fixed

- Fixed unused package false positives for CommonJS `require()` imports
- Fixed dependency graph not rendering on installed extension (CSP issue)
- Fixed dependency graph blank on first tab click
- Fixed graph refresh using stale data
- Improved file scanning to cover all project structures
- Fixed Windows path compatibility
