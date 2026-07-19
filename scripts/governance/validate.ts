import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { z } from 'zod';
import { evaluateChangeSet, loadGateConfig } from './gate';

const REQUIRED_FILES = [
  '.github/copilot-instructions.md',
  'AGENTS.md',
  'LOOP.md',
  'STATE.md',
  'gate.yaml',
  'loop-constraints.md',
  'loop-budget.md',
  'loop-run-log.md',
  '.vscode/mcp.json',
  '.github/pull_request_template.md',
  '.github/workflows/validate.yml',
  '.github/workflows/governance.yml',
  '.github/workflows/security.yml',
  '.github/workflows/agent-evidence.yml',
  'docs/governance/AI_GOVERNANCE.md',
  'docs/governance/DEVELOPMENT_AGENT_POLICY.md',
  'docs/governance/RUNTIME_AI_POLICY.md',
  'docs/governance/AI_RISK_REGISTER.md',
  'docs/governance/AI_SYSTEM_CARD.md',
  'docs/governance/MODEL_REGISTRY.md',
  'docs/governance/MODEL_ROUTING_POLICY.md',
  'docs/governance/PROMPT_REGISTRY.md',
  'docs/governance/DATA_GOVERNANCE.md',
  'docs/governance/HUMAN_OVERSIGHT.md',
  'docs/governance/EVALUATION_PLAN.md',
  'docs/governance/INCIDENT_RESPONSE.md',
  'docs/governance/COPYRIGHT_AND_CONTENT_POLICY.md',
  'docs/governance/REGULATORY_APPLICABILITY.md',
  'docs/governance/THIRD_PARTY_AGENT_ATTRIBUTION.md',
  'docs/governance/GOVERNANCE_DECISIONS.md',
  'docs/governance/model-registry.json',
  'docs/governance/prompt-registry.json',
  'docs/architecture/ARCHITECTURE.md',
  'docs/design/DESIGN_PRINCIPLES.md',
  'docs/design/DESIGN_SYSTEM.md',
  'docs/design/COMPONENT_INVENTORY.md',
  'docs/design/VISUAL_CHANGE_POLICY.md',
  'docs/design/UI_COPY_GUIDELINES.md',
  'docs/baseline/BASELINE_REPORT.md',
  'docs/baseline/baseline.json',
  'docs/quality/DEPENDENCY_POLICY.md',
  'docs/quality/QUALITY_GATES.md',
  'docs/quality/TECHNICAL_DEBT.md',
  'docs/governance/GOVERNANCE_REALITY_CHECK.md',
  'docs/governance/ADVERSARIAL_TEST_RESULTS.md',
  'docs/governance/FEATURE_READINESS_GATE.md',
];

const REQUIRED_AGENT_FILES = [
  '.github/agents/scenesift-orchestrator.md',
  '.github/agents/scenesift-architect.md',
  '.github/agents/electron-security-reviewer.md',
  '.github/agents/media-pipeline-engineer.md',
  '.github/agents/desktop-ux-reviewer.md',
  '.github/agents/data-privacy-reviewer.md',
  '.github/agents/ai-governance-reviewer.md',
  '.github/agents/verification-agent.md',
];

const REQUIRED_INSTRUCTION_FILES = [
  '.github/instructions/electron-main.instructions.md',
  '.github/instructions/electron-preload-ipc.instructions.md',
  '.github/instructions/renderer.instructions.md',
  '.github/instructions/media-pipeline.instructions.md',
  '.github/instructions/database.instructions.md',
  '.github/instructions/runtime-ai.instructions.md',
  '.github/instructions/tests.instructions.md',
  '.github/instructions/documentation.instructions.md',
];

const REQUIRED_PROMPT_FILES = [
  '.github/prompts/governed-feature.prompt.md',
  '.github/prompts/security-review.prompt.md',
  '.github/prompts/verification.prompt.md',
  '.github/prompts/incident-review.prompt.md',
  '.github/prompts/release-readiness.prompt.md',
];

const REQUIRED_SCRIPT_EVIDENCE = [
  'pnpm governance:validate',
  'pnpm typecheck',
  'pnpm lint',
  'pnpm test',
  'pnpm build',
  'pnpm package:dir',
  'pnpm test:e2e',
  'pnpm architecture:validate',
  'pnpm design:validate',
  'pnpm dependencies:validate',
  'pnpm validate',
  'pnpm validate:full',
];

const modelRegistrySchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  owner: z.string(),
  models: z.array(
    z.object({
      id: z.string(),
      provider: z.string(),
      allowedUse: z.array(z.string()).min(1),
      forbiddenUse: z.array(z.string()).min(1),
      riskCeiling: z.number().min(0).max(4),
      verificationMode: z.enum(['same-model-with-independent-agent', 'different-model-family']),
      status: z.enum(['active', 'restricted', 'disabled']),
    }),
  ),
});

const promptRegistrySchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  prompts: z.array(
    z.object({
      id: z.string(),
      owner: z.string(),
      purpose: z.string(),
      inputPolicy: z.string(),
      outputPolicy: z.string(),
      injectionDefenses: z.array(z.string()).min(1),
      status: z.enum(['active', 'deprecated', 'disabled']),
    }),
  ),
});

function getRepoRoot(): string {
  return process.cwd();
}

function fileExists(repoRoot: string, filePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, filePath));
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', 'dist', 'dist-electron', 'release', '.turbo'].includes(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function assertInstructionFrontmatter(repoRoot: string, relPath: string): string[] {
  const filePath = path.join(repoRoot, relPath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const errors: string[] = [];
  const hasFrontmatter = raw.startsWith('---\n');
  if (!hasFrontmatter) {
    errors.push(`${relPath}: missing frontmatter`);
    return errors;
  }

  const closeIndex = raw.indexOf('\n---\n', 4);
  if (closeIndex === -1) {
    errors.push(`${relPath}: invalid frontmatter terminator`);
    return errors;
  }

  const frontmatter = raw.slice(4, closeIndex);
  if (!/applyTo:\s*["'][^"']+["']/.test(frontmatter)) {
    errors.push(`${relPath}: missing applyTo pattern`);
  }

  return errors;
}

function main() {
  const repoRoot = getRepoRoot();
  const failures: string[] = [];

  for (const file of [
    ...REQUIRED_FILES,
    ...REQUIRED_AGENT_FILES,
    ...REQUIRED_INSTRUCTION_FILES,
    ...REQUIRED_PROMPT_FILES,
  ]) {
    if (!fileExists(repoRoot, file)) {
      failures.push(`Missing required governance file: ${file}`);
    }
  }

  for (const instruction of REQUIRED_INSTRUCTION_FILES) {
    if (fileExists(repoRoot, instruction)) {
      failures.push(...assertInstructionFrontmatter(repoRoot, instruction));
    }
  }

  const gateConfig = loadGateConfig(repoRoot);
  if (gateConfig.version < 1) {
    failures.push('gate.yaml version must be >= 1');
  }

  const allFiles = walkFiles(repoRoot);
  const contentMap: Record<string, string> = {};
  const candidatePaths: string[] = [];
  for (const absFilePath of allFiles) {
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(absFilePath)) {
      continue;
    }
    const rel = path.relative(repoRoot, absFilePath).replaceAll('\\', '/');
    const executablePath =
      rel.startsWith('src/') ||
      (rel.startsWith('scripts/') && !rel.startsWith('scripts/governance/'));
    if (!executablePath) {
      continue;
    }
    const content = fs.readFileSync(absFilePath, 'utf8');
    contentMap[rel] = content;
    candidatePaths.push(rel);
  }

  const assessment = evaluateChangeSet(gateConfig, candidatePaths, [], contentMap);
  for (const hit of assessment.forbiddenPatternsHit) {
    failures.push(`Forbidden pattern (${hit.id}) in ${hit.filePath}: ${hit.description}`);
  }

  const prTemplatePath = path.join(repoRoot, '.github/pull_request_template.md');
  if (fs.existsSync(prTemplatePath)) {
    const prTemplate = fs.readFileSync(prTemplatePath, 'utf8');
    for (const requiredLine of REQUIRED_SCRIPT_EVIDENCE) {
      if (!prTemplate.includes(requiredLine)) {
        failures.push(`PR template missing required evidence line: ${requiredLine}`);
      }

      const packageJsonPath = path.join(repoRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
          scripts?: Record<string, string>;
        };
        const scripts = packageJson.scripts ?? {};
        const validateScript = scripts.validate ?? '';
        const validateFullScript = scripts['validate:full'] ?? '';

        const requiredValidateSteps = [
          'pnpm governance:validate',
          'pnpm architecture:validate',
          'pnpm design:validate',
          'pnpm dependencies:validate',
          'pnpm typecheck',
          'pnpm lint',
          'pnpm test',
          'pnpm build',
        ];
        for (const step of requiredValidateSteps) {
          if (!validateScript.includes(step)) {
            failures.push(`validate script is missing required step: ${step}`);
          }
        }

        const requiredValidateFullSteps = [
          'pnpm validate',
          'pnpm test:e2e',
          'pnpm test:visual',
          'pnpm test:electron',
          'pnpm package:dir',
        ];
        for (const step of requiredValidateFullSteps) {
          if (!validateFullScript.includes(step)) {
            failures.push(`validate:full script is missing required step: ${step}`);
          }
        }
      }
    }
  }

  const modelRegistryPath = path.join(repoRoot, 'docs/governance/model-registry.json');
  if (fs.existsSync(modelRegistryPath)) {
    const modelRegistry = JSON.parse(fs.readFileSync(modelRegistryPath, 'utf8'));
    const parsed = modelRegistrySchema.safeParse(modelRegistry);
    if (!parsed.success) {
      failures.push(
        `model-registry.json invalid: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
  }

  const promptRegistryPath = path.join(repoRoot, 'docs/governance/prompt-registry.json');
  if (fs.existsSync(promptRegistryPath)) {
    const promptRegistry = JSON.parse(fs.readFileSync(promptRegistryPath, 'utf8'));
    const parsed = promptRegistrySchema.safeParse(promptRegistry);
    if (!parsed.success) {
      failures.push(
        `prompt-registry.json invalid: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('Governance validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Governance validation passed.');
}

main();
