import fs from 'node:fs';
import path from 'node:path';

type Baseline = {
  generatedAt: string;
  environment: {
    os: string;
    node: string;
    pnpm: string;
  };
  counts: Record<string, number>;
  bundle: Record<string, number>;
  notes: string[];
};

const walkFiles = (dir: string, includeExtensions?: Set<string>): string[] => {
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
      out.push(...walkFiles(fullPath, includeExtensions));
    } else if (!includeExtensions || includeExtensions.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
};

const fileSizeKb = (filePath: string): number => {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  return Math.round((fs.statSync(filePath).size / 1024) * 100) / 100;
};

const countMatches = (filePaths: string[], pattern: RegExp): number => {
  let total = 0;
  for (const filePath of filePaths) {
    const content = fs.readFileSync(filePath, 'utf8');
    total += (content.match(pattern) ?? []).length;
  }
  return total;
};

const nodeVersion = process.version;
const osName = process.platform;

const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const sourceFiles = walkFiles(path.join(process.cwd(), 'src'), new Set(['.ts', '.tsx']));
const testFiles = walkFiles(path.join(process.cwd(), 'tests'), new Set(['.ts', '.tsx']));
const componentFiles = walkFiles(
  path.join(process.cwd(), 'src/renderer/components'),
  new Set(['.tsx']),
);
const pageFiles = walkFiles(
  path.join(process.cwd(), 'src/renderer/features'),
  new Set(['.tsx']),
).filter((file) => file.endsWith('Page.tsx'));
const unitTestFiles = walkFiles(path.join(process.cwd(), 'tests'), new Set(['.ts', '.tsx'])).filter(
  (file) => !file.includes('/e2e/') && !file.includes('/visual/') && !file.includes('/electron/'),
);
const e2eTestFiles = walkFiles(path.join(process.cwd(), 'tests/e2e'), new Set(['.ts']));
const visualTestFiles = walkFiles(path.join(process.cwd(), 'tests/visual'), new Set(['.ts']));
const electronTestFiles = walkFiles(path.join(process.cwd(), 'tests/electron'), new Set(['.ts']));

const channelsPath = path.join(process.cwd(), 'src/shared/ipc/channels.ts');
const channelsCount = fs.existsSync(channelsPath)
  ? (fs.readFileSync(channelsPath, 'utf8').match(/:\s*['"`][A-Z0-9_.-]+['"`]/g) ?? []).length
  : 0;

const schemaPath = path.join(process.cwd(), 'src/database/schema.ts');
const dbTableCount = fs.existsSync(schemaPath)
  ? (fs.readFileSync(schemaPath, 'utf8').match(/sqliteTable\(/g) ?? []).length
  : 0;

const rendererAssetsDir = path.join(process.cwd(), 'dist/renderer/assets');
const assetFiles = fs.existsSync(rendererAssetsDir) ? fs.readdirSync(rendererAssetsDir) : [];
const rendererJsFile = assetFiles.find((name) => name.endsWith('.js'));
const rendererCssFile = assetFiles.find((name) => name.endsWith('.css'));

const baseline: Baseline = {
  generatedAt: new Date().toISOString(),
  environment: {
    os: osName,
    node: nodeVersion,
    pnpm: process.env.npm_config_user_agent?.includes('pnpm/')
      ? process.env.npm_config_user_agent
      : 'unknown',
  },
  counts: {
    sourceFiles: sourceFiles.length,
    testFiles: testFiles.length,
    components: componentFiles.length,
    pages: pageFiles.length,
    ipcChannels: channelsCount,
    databaseTables: dbTableCount,
    dependencies: Object.keys(packageJson.dependencies ?? {}).length,
    devDependencies: Object.keys(packageJson.devDependencies ?? {}).length,
    unitTests: countMatches(unitTestFiles, /\b(it|test)\(/g),
    e2eTests: countMatches(e2eTestFiles, /\btest\(/g),
    visualTests: countMatches(visualTestFiles, /\btest\(/g),
    electronSmokeTests: countMatches(electronTestFiles, /\btest\(/g),
  },
  bundle: {
    rendererJsKb: rendererJsFile ? fileSizeKb(path.join(rendererAssetsDir, rendererJsFile)) : 0,
    rendererCssKb: rendererCssFile ? fileSizeKb(path.join(rendererAssetsDir, rendererCssFile)) : 0,
  },
  notes: [
    'Generated from repository files. Git metadata unavailable in current non-git environment.',
    'pnpm user agent may be unavailable when script is run outside pnpm lifecycle.',
  ],
};

const baselineJsonPath = path.join(process.cwd(), 'docs/baseline/baseline.json');
fs.mkdirSync(path.dirname(baselineJsonPath), { recursive: true });
fs.writeFileSync(baselineJsonPath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');

console.log(`Baseline JSON written: ${baselineJsonPath}`);
