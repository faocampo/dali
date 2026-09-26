import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectSelectedBackup, restoreBackup, verifyRestore } from './storage/restore.js';

/** Import-safe offline CLI. It never starts a service or opens ingress. */
export async function runOperator(args: string[], output: (value: string) => void = console.log): Promise<number> {
  try {
    const [command, ...rest] = args; const flags = new Map<string, string>();
    const allowed = command === 'inspect' ? ['--backup', '--expected-manifest-digest'] : command === 'verify' ? ['--destination'] : command === 'restore' ?
      ['--backup', '--destination', '--source-database', '--maintenance-confirmed', '--writer-fenced', '--fence-evidence', '--expected-manifest-digest'] : [];
    if (!allowed.length) throw new Error('Invalid command');
    for (let i = 0; i < rest.length; i++) {
      const key = rest[i]!; if (!allowed.includes(key) || flags.has(key)) throw new Error('Invalid option');
      if (key === '--maintenance-confirmed') flags.set(key, 'true');
      else { const value = rest[++i]; if (!value || value.startsWith('--')) throw new Error('Missing option value'); flags.set(key, value); }
    }
    const required = (name: string) => { const value = flags.get(name); if (!value) throw new Error('Missing option'); return value; };
    if (command === 'inspect') output(JSON.stringify(await inspectSelectedBackup(required('--backup'), flags.get('--expected-manifest-digest'))));
    else if (command === 'verify') output(JSON.stringify(await verifyRestore(required('--destination'))));
    else {
      const method = required('--writer-fenced'); if (method !== 'writer-stopped' && method !== 'storage-fenced') throw new Error('Invalid fencing method');
      output(JSON.stringify(await restoreBackup({ backup: required('--backup'), destination: required('--destination'), sourceDatabase: required('--source-database'),
        expectedManifestDigest: required('--expected-manifest-digest'), maintenanceConfirmed: flags.get('--maintenance-confirmed') === 'true',
        fencing: { method, evidence: required('--fence-evidence') } })));
    }
    return 0;
  } catch { output(JSON.stringify({ error: 'OPERATOR_VERIFICATION_FAILED', ingress: 'closed' })); return 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runOperator(process.argv.slice(2));
