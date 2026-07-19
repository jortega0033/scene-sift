import fs from 'node:fs';
import path from 'node:path';

type Violation = {
  rule: string;
  file: string;
  message: string;
};

const TEXTUAL_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html']);

const REQUIRED_TOKENS = [
  '--background',
  '--foreground',
  '--card',
  '--border',
  '--muted',
  '--focus-ring',
  '--radius-sm',
  '--radius-md',
  '--control-height',
  '--sidebar-width',
  '--space-1',
  '--space-2',
  '--space-3',
  '--font-size-xs',
  '--font-size-mono-path',
  '--font-size-dot',
  '--font-size-sm',
  '--font-size-base',
  '--tracking-label',
  '--tracking-heading',
  '--tracking-brand',
  '--layout-content-max',
  '--z-overlay',
  '--motion-fast',
  '--icon-size-sm',
];

const PROHIBITED_ICON_DEPENDENCIES = [
  'react-icons',
  '@heroicons/react',
  '@mui/icons-material',
  '@fortawesome/react-fontawesome',
  'phosphor-react',
  'ionicons',
  'remixicon',
];

const walkFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'dist-electron', 'release', 'coverage'].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(fullPath));
    } else if (TEXTUAL_EXTENSIONS.has(path.extname(fullPath))) {
      out.push(fullPath);
    }
  }
  return out;
};

const normalize = (input: string): string => input.replaceAll('\\', '/');

export const runDesignValidation = (repoRoot: string): Violation[] => {
  const violations: Violation[] = [];

  const globalsPath = path.join(repoRoot, 'src/renderer/styles/globals.css');
  if (!fs.existsSync(globalsPath)) {
    violations.push({
      rule: 'missing-globals',
      file: 'src/renderer/styles/globals.css',
      message: 'Global design token stylesheet is missing.',
    });
    return violations;
  }

  const globals = fs.readFileSync(globalsPath, 'utf8');
  for (const token of REQUIRED_TOKENS) {
    if (!globals.includes(token)) {
      violations.push({
        rule: 'required-token-missing',
        file: 'src/renderer/styles/globals.css',
        message: `Required token ${token} is missing.`,
      });
    }
  }

  const files = [
    ...walkFiles(path.join(repoRoot, 'src/renderer')),
    ...walkFiles(path.join(repoRoot, 'src/shared')),
  ];

  for (const absPath of files) {
    const relPath = normalize(path.relative(repoRoot, absPath));
    const content = fs.readFileSync(absPath, 'utf8');

    if (/linear-gradient|radial-gradient|conic-gradient/i.test(content)) {
      violations.push({
        rule: 'gradient-prohibited',
        file: relPath,
        message: 'Gradients are prohibited by the monochrome baseline.',
      });
    }

    if (
      /(fonts\.googleapis\.com|use\.typekit\.net|@import\s+url\(['"]?https?:\/\/)/i.test(content)
    ) {
      violations.push({
        rule: 'remote-font-prohibited',
        file: relPath,
        message: 'Remote font loading is prohibited.',
      });
    }

    if (/#(?:[0-9a-fA-F]{3,8})\b/.test(content)) {
      violations.push({
        rule: 'raw-hex-color',
        file: relPath,
        message: 'Raw hex colors are prohibited; use design tokens.',
      });
    }

    if (/\b(rgb|rgba|hsl|hsla)\((?!var\()/i.test(content)) {
      violations.push({
        rule: 'raw-color-function',
        file: relPath,
        message: 'Raw color functions are prohibited outside token definitions.',
      });
    }

    if (/\b[mp][trblxy]?-\[\d+px\]/.test(content)) {
      violations.push({
        rule: 'arbitrary-spacing-value',
        file: relPath,
        message: 'Arbitrary pixel spacing values are prohibited; use spacing tokens/scale.',
      });
    }

    if (/\btext-\[\d/.test(content)) {
      violations.push({
        rule: 'arbitrary-font-size',
        file: relPath,
        message:
          'Arbitrary pixel font sizes are prohibited; use Tailwind font-size utilities (text-label, text-mono-path, text-dot, or scale).',
      });
    }

    if (/\btracking-\[/.test(content)) {
      violations.push({
        rule: 'arbitrary-tracking',
        file: relPath,
        message:
          'Arbitrary tracking values are prohibited; use tracking-label, tracking-heading, or tracking-brand.',
      });
    }
  }

  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const allDependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };

  for (const dep of PROHIBITED_ICON_DEPENDENCIES) {
    if (dep in allDependencies) {
      violations.push({
        rule: 'duplicate-icon-system',
        file: 'package.json',
        message: `Prohibited icon dependency detected: ${dep}`,
      });
    }
  }

  const componentDir = path.join(repoRoot, 'src/renderer/components');
  if (fs.existsSync(componentDir)) {
    const componentFiles = walkFiles(componentDir)
      .map((file) => path.basename(file))
      .filter((name) => /Button.*\.tsx$/.test(name));
    if (componentFiles.length > 1) {
      violations.push({
        rule: 'duplicate-button-components',
        file: 'src/renderer/components',
        message: `Multiple button component families detected: ${componentFiles.join(', ')}`,
      });
    }
  }

  return violations;
};

if (require.main === module) {
  const repoRoot = process.cwd();
  const violations = runDesignValidation(repoRoot);
  if (violations.length > 0) {
    console.error('Design validation failed:');
    for (const violation of violations) {
      console.error(`- [${violation.rule}] ${violation.file}: ${violation.message}`);
    }
    process.exit(1);
  }

  console.log('Design validation passed.');
}
