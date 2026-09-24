import type { AuthConfig } from '../app.js';
import { canonicalInternalEmail } from '../boards/grants.js';
const fail = () => { throw new Error('Identity not eligible'); };
export function validateInternalIdentity(config: AuthConfig, claims: Record<string, unknown>, profile: Record<string, unknown>) {
  if (claims.iss !== config.issuer || typeof claims.sub !== 'string' || !claims.sub || profile.sub !== claims.sub ||
      profile.email_verified !== true || typeof profile.email !== 'string' || typeof profile.name !== 'string' || !profile.name.trim()) fail();
  const membership = profile[config.claim];
  if (!(typeof membership === 'string' ? config.internalValues.includes(membership) :
      Array.isArray(membership) && membership.some(v => typeof v === 'string' && config.internalValues.includes(v)))) fail();
  const email = profile.email as string; const canonicalEmail = canonicalInternalEmail(config, email);
  if (!canonicalEmail) fail();
  const role = config.roleClaim ? profile[config.roleClaim] : undefined;
  const roles = Array.isArray(role) ? role : [role];
  const canEdit = !config.roleClaim || roles.some(value => typeof value === 'string' && config.editorValues?.includes(value));
  return { issuer: config.issuer, subject: claims.sub as string, displayName: profile.name as string, email,
    canonicalEmail: canonicalEmail!, systemRole: canEdit ? 'member' as const : 'viewer' as const };
}
