import { test, expect } from './browser-fixtures.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);

test('@04-15-02 recovery CLI refuses unselected infrastructure before cluster access', async () => {
  const result = await execute(process.execPath, ['scripts/recovery-drill.mjs']).catch(error => error);
  expect(result.code).toBe(1);
  expect(result.stderr).toContain('RECOVERY_DRILL_FAILED: explicit local synthetic context');
  expect(result.stdout).not.toContain('RECOVERY_DRILL_PASS');
});

test('@04-15-02 local recovery contracts reject unsafe scope and missing measurements', async () => {
  const result = await execute(process.execPath, ['scripts/recovery-drill.mjs', '--self-test']);
  expect(result.stdout).toContain('LOCAL_RECOVERY_CONTRACTS_PASS');
  expect(result.stdout).not.toContain('LOCAL_RECOVERY_DRILL_PASS');
});
