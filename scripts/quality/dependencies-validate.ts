import fs from 'node:fs';
import path from 'node:path';

type Violation = {
  rule: string;
  message: string;
};

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const walkFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'dist-electron', 'release', 'coverage'].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.has(path.extname(fullPath))) {
      out.push(fullPath);
    }
  }
  return out;
};

const normalizePackageName = (specifier: string): string => {
  if (specifier.startsWith('@')) {
    const [scope, pkg] = specifier.split('/');
    return pkg ? `${scope}/${pkg}` : specifier;
  }
  const [pkg] = specifier.split('/');
  return pkg ?? specifier;
};

export const runDependencyValidation = (repoRoot: string): Violation[] => {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const dependencies = packageJson.dependencies ?? {};
  const devDependencies = packageJson.devDependencies ?? {};
  const violations: Violation[] = [];

  const criticalPinned = ['@playwright/mcp', 'chrome-devtools-mcp'];
  for (const dep of criticalPinned) {
    const version = devDependencies[dep] ?? dependencies[dep];
    if (!version) {
      violations.push({
        rule: 'missing-critical-dependency',
        message: `${dep} must be present and pinned.`,
      });
      continue;
    }
    if (/^[~^]/.test(version)) {
      violations.push({
        rule: 'unpinned-critical-dependency',
        message: `${dep} must be pinned to an exact version, found "${version}".`,
      });
    }
  }

  const duplicateCategorySets = [
    {
      id: 'schema-validation',
      names: ['zod', 'yup', 'joi', 'ajv'],
      maxAllowed: 1,
    },
    {
      id: 'state-management',
      names: ['zustand', 'redux', '@reduxjs/toolkit', 'mobx', 'recoil', 'jotai'],
      maxAllowed: 1,
    },
    {
      id: 'icon-libraries',
      names: [
        'lucide-react',
        'react-icons',
        '@heroicons/react',
        '@mui/icons-material',
        '@fortawesome/react-fontawesome',
        'phosphor-react',
      ],
      maxAllowed: 1,
    },
  ];

  const allDeps = { ...dependencies, ...devDependencies };
  const prohibitedPackages = [
    'posthog-js',
    'mixpanel-browser',
    '@segment/analytics-next',
    '@sentry/browser',
    '@sentry/electron',
  ];
  for (const pkg of prohibitedPackages) {
    if (pkg in allDeps) {
      violations.push({
        rule: 'prohibited-telemetry-dependency',
        message: `Prohibited telemetry/analytics dependency detected: ${pkg}`,
      });
    }
  }

  for (const category of duplicateCategorySets) {
    const present = category.names.filter((name) => name in allDeps);
    if (present.length > category.maxAllowed) {
      violations.push({
        rule: 'duplicate-dependency-category',
        message: `Multiple ${category.id} packages detected: ${present.join(', ')}`,
      });
    }
  }

  const importFiles = [
    ...walkFiles(path.join(repoRoot, 'src')),
    ...walkFiles(path.join(repoRoot, 'tests')),
    ...walkFiles(path.join(repoRoot, 'scripts')),
  ];
  const importUsage = new Set<string>();
  const importPattern =
    /(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;

  for (const filePath of importFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    let match: RegExpExecArray | null = importPattern.exec(content);
    while (match) {
      const [, esmImport, cjsImport] = match;
      const specifier = esmImport ?? cjsImport;
      if (!specifier || specifier.startsWith('.') || specifier.startsWith('/')) {
        match = importPattern.exec(content);
        continue;
      }
      importUsage.add(normalizePackageName(specifier));
      match = importPattern.exec(content);
    }
  }

  for (const [dep] of Object.entries(dependencies)) {
    if (!importUsage.has(dep)) {
      violations.push({
        rule: 'unused-runtime-dependency',
        message: `Runtime dependency "${dep}" appears unused by source imports.`,
      });
    }
  }

  return violations;
};

if (require.main === module) {
  const repoRoot = process.cwd();
  const violations = runDependencyValidation(repoRoot);
  if (violations.length > 0) {
    console.error('Dependency validation failed:');
    for (const violation of violations) {
      console.error(`- [${violation.rule}] ${violation.message}`);
    }
    process.exit(1);
  }

  console.log('Dependency validation passed.');
}
