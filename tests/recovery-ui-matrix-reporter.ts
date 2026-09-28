// Require the three production projects specified by 04-16; additional projects are recorded.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

const required = ['prod', 'prod-firefox', 'prod-webkit'];
const categories = [
  ['loading', 'error', 'overflow', 'long-text'],
  ['empty', 'loading', 'error', 'populated', 'partial', 'overflow', 'zero-one-many', 'long-text'],
  ['empty', 'loading', 'error', 'populated', 'overflow', 'long-text'],
  ['empty', 'loading', 'error', 'populated', 'overflow', 'long-text'],
  ['loading', 'error', 'overflow', 'long-text'],
  ['empty', 'loading', 'error', 'populated', 'partial', 'overflow', 'zero-one-many', 'long-text'],
];
const expected = categories.flatMap((values, index) => values.map(value => `E${index + 1}/${value}`));
function sourceIdentity() {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  // Stable content identity includes existing user changes without claiming
  // that HEAD alone describes the tested tree. Planning updates are excluded.
  const paths = execFileSync('git', ['ls-files', '-z', 'src', 'server', 'tests', 'scripts', 'imgs', 'public', 'index.html', 'package.json', 'package-lock.json', 'playwright.config.ts', 'vite.config.ts', 'tsconfig*.json'], { encoding: 'utf8' }).split('\0').filter(Boolean).sort();
  const hash = createHash('sha256'); for (const path of paths) { hash.update(path); hash.update('\0'); hash.update(readFileSync(path)); }
  const modified = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...paths], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  return { revision, digest: hash.digest('hex'), modified };
}
export default class MatrixReporter implements Reporter {
  private identity?: ReturnType<typeof sourceIdentity>;
  private issues: string[] = [];
  private coverage = new Map<string, Set<string>>();
  private counts = new Map<string, number>();
  private skipped = 0;
  onBegin(config: FullConfig) {
    try { this.identity = sourceIdentity(); } catch (error) { this.issues.push(String(error)); }
    for (const project of required) if (!config.projects.some(value => value.name === project)) this.issues.push(`Missing required project ${project}`);
  }
  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'skipped') this.skipped++;
    if (!test.location.file.endsWith('recovery-ui-matrix.spec.ts')) return;
    const project = test.parent.project()!.name;
    this.counts.set(project, (this.counts.get(project) ?? 0) + 1);
    if (result.status !== 'passed' || result.retry !== 0) { this.issues.push(`${project}: ${test.title}: ${result.status}, retry ${result.retry}`); return; }
    const attachment = result.attachments.find(item => item.name === 'executed-ui-predicates');
    if (!attachment) { this.issues.push(`${project}: missing evidence for ${test.title}`); return; }
    try {
      const data = JSON.parse((attachment.body ?? readFileSync(attachment.path!)).toString());
      if (data.project !== project || data.revision !== this.identity?.revision || data.status !== 'passed') throw new Error('Evidence identity/status mismatch');
      const keys = this.coverage.get(project) ?? new Set<string>();
      for (const key of data.completed) { if (!expected.includes(key)) throw new Error(`Unknown predicate ${key}`); keys.add(key); }
      this.coverage.set(project, keys);
    } catch (error) { this.issues.push(`${project}: ${String(error)}`); }
  }
  async onEnd(result: FullResult): Promise<{ status: 'failed' } | void> {
    try { if (JSON.stringify(sourceIdentity()) !== JSON.stringify(this.identity)) this.issues.push('Source changed during matrix'); } catch (error) { this.issues.push(String(error)); }
    for (const project of required) {
      if (this.counts.get(project) !== 13) this.issues.push(`${project}: expected all 13 scenarios without retries; observed ${this.counts.get(project) ?? 0}`);
      for (const key of expected) if (!this.coverage.get(project)?.has(key)) this.issues.push(`${project}: missing passing ${key}`);
    }
    if (this.skipped) this.issues.push(`${this.skipped} required tests skipped`);
    mkdirSync('test-results', { recursive: true });
    const evidence = { status: result.status === 'passed' && this.issues.length === 0 ? 'passed' : 'failed', source: this.identity, projects: Object.fromEntries(required.map(project => [project, { scenarios: this.counts.get(project) ?? 0, predicates: [...(this.coverage.get(project) ?? [])].sort() }])), issues: this.issues };
    writeFileSync('test-results/recovery-ui-matrix-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
    if (result.status !== 'passed' || this.issues.length) {
      process.stderr.write(`Matrix acceptance unavailable:\n${this.issues.join('\n')}\n`); return { status: 'failed' };
    }
    process.stdout.write(`RECOVERY_UI_MATRIX_PASS: ${required.length} engines, ${expected.length} predicates each, source ${this.identity?.revision}, digest ${this.identity?.digest}\n`);
  }
}
