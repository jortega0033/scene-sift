import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export interface RiskRule {
  id: string;
  level: RiskLevel;
  description: string;
  paths: string[];
}

export interface GateConfig {
  version: number;
  killSwitch: {
    enabled: boolean;
    reason: string;
  };
  riskRules: RiskRule[];
  forbiddenAutonomousActions: string[];
  forbiddenPatterns: {
    id: string;
    pattern: string;
    description: string;
    severity: 'high' | 'critical';
  }[];
  requiredChecksByRisk: Record<string, string[]>;
}

export interface ChangeAssessment {
  maxRisk: RiskLevel;
  matchedRules: RiskRule[];
  requiredChecks: string[];
  forbiddenActionsHit: string[];
  forbiddenPatternsHit: {
    id: string;
    description: string;
    filePath: string;
  }[];
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__GLOBSTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__GLOBSTAR__/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function normalizePath(input: string): string {
  return input.replaceAll('\\', '/').replace(/^\.\/+/, '');
}

export function loadGateConfig(repoRoot: string): GateConfig {
  const gatePath = path.join(repoRoot, 'gate.yaml');
  const raw = fs.readFileSync(gatePath, 'utf8');
  const parsed = YAML.parse(raw) as GateConfig;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('gate.yaml is missing or invalid.');
  }

  return parsed;
}

export function evaluateChangeSet(
  config: GateConfig,
  changedPaths: string[],
  autonomousActionIds: string[],
  fileContents: Record<string, string>,
): ChangeAssessment {
  const normalizedPaths = changedPaths.map(normalizePath);
  const matchedRules: RiskRule[] = [];

  for (const rule of config.riskRules) {
    const regexes = rule.paths.map(globToRegExp);
    const matches = normalizedPaths.some((p) => regexes.some((re) => re.test(p)));
    if (matches) {
      matchedRules.push(rule);
    }
  }

  const maxRisk =
    matchedRules.length > 0
      ? matchedRules.reduce<RiskLevel>((acc, rule) => (rule.level > acc ? rule.level : acc), 0)
      : 0;

  const forbiddenActionsHit = autonomousActionIds.filter((action) =>
    config.forbiddenAutonomousActions.includes(action),
  );

  const forbiddenPatternsHit: ChangeAssessment['forbiddenPatternsHit'] = [];
  for (const [filePath, content] of Object.entries(fileContents)) {
    for (const patternRule of config.forbiddenPatterns) {
      const regex = new RegExp(patternRule.pattern, 'm');
      if (regex.test(content)) {
        forbiddenPatternsHit.push({
          id: patternRule.id,
          description: patternRule.description,
          filePath: normalizePath(filePath),
        });
      }
    }
  }

  const requiredChecks = config.requiredChecksByRisk[String(maxRisk)] ?? [];

  return {
    maxRisk,
    matchedRules,
    requiredChecks,
    forbiddenActionsHit,
    forbiddenPatternsHit,
  };
}
