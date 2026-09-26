#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

export function validateResources(resources) {
  return resources;
}

async function selfTest() {
  const deployment = JSON.parse(await readFile(new URL('../deploy/kubernetes/base/deployment.yaml', import.meta.url), 'utf8'));
  const mutated = structuredClone(deployment);
  mutated.spec.replicas = 2;
  await test('rejects multiple writers', () => {
    assert.throws(() => validateResources([mutated]), /single writer/, 'rejects multiple writers');
  });
}

if (process.argv.includes('--self-test')) await selfTest();
