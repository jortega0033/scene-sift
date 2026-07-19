import fs from 'node:fs';
import path from 'node:path';

type Violation = {
  rule: string;
  file: string;
  message: string;
};

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const isSourceFile = (filePath: string): boolean => SOURCE_EXTENSIONS.has(path.extname(filePath));

const walkFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'dist-electron', 'release', 'coverage'].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(fullPath));
    } else if (isSourceFile(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
};

const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const normalize = (input: string): string => input.replaceAll('\\', '/');

const getLayer = (
  relPath: string,
): 'renderer' | 'main' | 'preload' | 'shared' | 'database' | 'other' => {
  if (relPath.startsWith('src/renderer/')) return 'renderer';
  if (relPath.startsWith('src/main/')) return 'main';
  if (relPath.startsWith('src/preload/')) return 'preload';
  if (relPath.startsWith('src/shared/')) return 'shared';
  if (relPath.startsWith('src/database/')) return 'database';
  return 'other';
};

const resolveLayerFromSpecifier = (
  specifier: string,
): 'renderer' | 'main' | 'preload' | 'shared' | 'database' | 'node' | 'electron' | 'other' => {
  if (specifier === 'electron' || specifier.startsWith('electron/')) return 'electron';
  if (specifier.startsWith('node:')) return 'node';
  if (specifier.startsWith('@renderer/')) return 'renderer';
  if (specifier.startsWith('@main/')) return 'main';
  if (specifier.startsWith('@shared/')) return 'shared';
  if (specifier.startsWith('@database/')) return 'database';
  if (specifier.startsWith('@preload/')) return 'preload';
  return 'other';
};

const readImports = (content: string): string[] => {
  const imports: string[] = [];
  let match: RegExpExecArray | null = importPattern.exec(content);
  while (match) {
    const [, staticImport, dynamicImport] = match;
    const specifier = staticImport ?? dynamicImport;
    if (specifier) {
      imports.push(specifier);
    }
    match = importPattern.exec(content);
  }
  return imports;
};

const APPROVED_NATIVE_EXECUTION_PATHS = [
  'src/main/services/ffmpeg/',
  'src/main/services/process/runCommand.ts',
];

export const runArchitectureValidation = (repoRoot: string): Violation[] => {
  const violations: Violation[] = [];
  const sourceRoot = path.join(repoRoot, 'src');
  const topLevelSourceDirs = fs
    .readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const allowedTopLevelDirs = new Set([
    'main',
    'preload',
    'renderer',
    'shared',
    'database',
    'assets',
  ]);
  for (const dirName of topLevelSourceDirs) {
    if (!allowedTopLevelDirs.has(dirName)) {
      violations.push({
        rule: 'unapproved-architecture-layer',
        file: `src/${dirName}`,
        message: 'New source layer detected without approved architecture baseline update.',
      });
    }
  }

  const files = walkFiles(sourceRoot);

  for (const absPath of files) {
    const relPath = normalize(path.relative(repoRoot, absPath));
    const layer = getLayer(relPath);
    const content = fs.readFileSync(absPath, 'utf8');
    const imports = readImports(content);

    for (const specifier of imports) {
      const targetLayer = resolveLayerFromSpecifier(specifier);

      if (layer === 'renderer') {
        if (
          targetLayer === 'main' ||
          targetLayer === 'database' ||
          targetLayer === 'electron' ||
          targetLayer === 'node'
        ) {
          violations.push({
            rule: 'renderer-privileged-import',
            file: relPath,
            message: `Renderer imports privileged module "${specifier}".`,
          });
        }
      }

      if (layer === 'shared') {
        if (
          targetLayer === 'renderer' ||
          targetLayer === 'main' ||
          targetLayer === 'preload' ||
          targetLayer === 'electron' ||
          targetLayer === 'node'
        ) {
          violations.push({
            rule: 'shared-layer-leak',
            file: relPath,
            message: `Shared layer imports non-shared module "${specifier}".`,
          });
        }
      }

      if (layer === 'main' && targetLayer === 'renderer') {
        violations.push({
          rule: 'main-imports-renderer',
          file: relPath,
          message: `Main process imports renderer module "${specifier}".`,
        });
      }

      if (layer === 'preload' && targetLayer === 'renderer') {
        violations.push({
          rule: 'preload-imports-renderer',
          file: relPath,
          message: `Preload imports renderer module "${specifier}".`,
        });
      }
    }

    if (
      relPath.startsWith('src/renderer/') &&
      relPath !== 'src/renderer/main.tsx' &&
      content.includes('@renderer/qa/')
    ) {
      violations.push({
        rule: 'qa-adapter-leak',
        file: relPath,
        message: 'Only src/renderer/main.tsx may import @renderer/qa adapters.',
      });
    }

    if (
      relPath === 'src/renderer/main.tsx' &&
      content.includes('@renderer/qa/') &&
      !content.includes('@renderer/qa/installBridge')
    ) {
      violations.push({
        rule: 'qa-adapter-entrypoint-contract',
        file: relPath,
        message: 'Renderer entrypoint imports non-approved QA adapter.',
      });
    }

    if (relPath.startsWith('src/main/') && /\b(spawn|exec|execFile|execa)\s*\(/.test(content)) {
      const approved = APPROVED_NATIVE_EXECUTION_PATHS.some(
        (p) => relPath === p || relPath.startsWith(p),
      );
      if (!approved) {
        violations.push({
          rule: 'native-exec-boundary',
          file: relPath,
          message: 'Native process execution is only allowed in approved process/ffmpeg services.',
        });
      }
    }

    if (
      !(relPath.startsWith('src/main/services/database/') || relPath.startsWith('src/database/')) &&
      /better-sqlite3|new\s+Database\s*\(/.test(content)
    ) {
      violations.push({
        rule: 'database-boundary',
        file: relPath,
        message: 'Direct SQLite usage is restricted to database service layer.',
      });
    }
  }

  const ipcHandlerFile = path.join(repoRoot, 'src/main/ipc/registerIpcHandlers.ts');
  if (fs.existsSync(ipcHandlerFile)) {
    const ipcContents = fs.readFileSync(ipcHandlerFile, 'utf8');
    if (!ipcContents.includes('IPC_CHANNELS.')) {
      violations.push({
        rule: 'ipc-contract-enforcement',
        file: 'src/main/ipc/registerIpcHandlers.ts',
        message: 'IPC handler registration must use shared IPC_CHANNELS contract.',
      });
    }
  }

  const visualSpecsRoot = path.join(repoRoot, 'tests/visual');
  const visualSpecNames = fs.existsSync(visualSpecsRoot)
    ? walkFiles(visualSpecsRoot).map((file) => path.basename(file).toLowerCase())
    : [];
  const pageFiles = files.filter((file) => /Page\.tsx$/.test(file));
  for (const absPath of pageFiles) {
    const relPath = normalize(path.relative(repoRoot, absPath));
    const pageName = path
      .basename(absPath)
      .replace(/Page\.tsx$/, '')
      .toLowerCase();
    const hasVisualCoverage = visualSpecNames.some((specName) => specName.includes(pageName));
    if (!hasVisualCoverage) {
      violations.push({
        rule: 'missing-visual-page-coverage',
        file: relPath,
        message: `Page ${path.basename(absPath)} has no matching visual spec in tests/visual.`,
      });
    }
  }

  return violations;
};

if (require.main === module) {
  const repoRoot = process.cwd();
  const violations = runArchitectureValidation(repoRoot);
  if (violations.length > 0) {
    console.error('Architecture validation failed:');
    for (const violation of violations) {
      console.error(`- [${violation.rule}] ${violation.file}: ${violation.message}`);
    }
    process.exit(1);
  }

  console.log('Architecture validation passed.');
}
