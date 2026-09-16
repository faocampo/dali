import type { AuthConfig } from '../app.js';
const fail = () => { throw new Error('Identity not eligible'); };
export function validateInternalIdentity(config: AuthConfig, claims: Record<string, unknown>, profile: Record<string, unknown>) {
  if (claims.iss !== config.issuer || typeof claims.sub !== 'string' || !claims.sub || profile.sub !== claims.sub ||
      profile.email_verified !== true || typeof profile.email !== 'string' || typeof profile.name !== 'string' || !profile.name.trim()) fail();
  const membership = profile[config.claim];
  if (!(typeof membership === 'string' ? config.internalValues.includes(membership) :
      Array.isArray(membership) && membership.some(v => typeof v === 'string' && config.internalValues.includes(v)))) fail();
  const email = profile.email as string; const match = /^([^\s@]+)@([^\s@]+)$/.exec(email);
  if (!match || email.length > 254 || !config.domains.includes(match[2]!.toLowerCase())) fail();
  return { issuer: config.issuer, subject: claims.sub as string, displayName: profile.name as string, email,
    canonicalEmail: `${config.emailCaseFold ? match![1]!.toLowerCase() : match![1]}@${match![2]!.toLowerCase()}` };
}
