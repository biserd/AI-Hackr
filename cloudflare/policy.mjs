import ipaddr from 'ipaddr.js';

export class ServiceError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export const reject = (code, message, status = 400) => { throw new ServiceError(code, message, status); };
export const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex', ...headers } });
export function errorResponse(error) {
  if (!(error instanceof ServiceError)) console.error(JSON.stringify({event:'browser_request_failed',name:error.name,message:String(error.message).replace(/https?:\S+|Bearer \S+/g,'[redacted]').slice(0,250)}));
  return json({ success: false, error: { code: error.code ?? 'ENGINE_UNAVAILABLE', message: error instanceof ServiceError ? error.message : 'The browser service could not complete this request.' } }, error.status ?? 503, error.status===429?{'Retry-After':'10'}:{});
}
export function integer(value, fallback, max, label, min = 1) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) reject('LIMIT_EXCEEDED', `${label} must be an integer from ${min} to ${max}.`);
  return value;
}
export function publicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export async function validatePublicUrl(raw, resolve = resolvePublicHost) {
  if (typeof raw !== 'string' || raw.length > 2048) reject('TARGET_RESTRICTED', 'A public HTTP(S) URL of at most 2048 characters is required.', 403);
  let url; try { url = new URL(raw); } catch { reject('INVALID_INPUT', 'A valid public URL is required.'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !host.includes('.') && !ipaddr.isValid(host) || /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host) || url.port && !['80','443'].includes(url.port))
    reject('TARGET_RESTRICTED', 'Only public HTTP(S) URLs without credentials or custom ports are allowed.', 403);
  const addresses = ipaddr.isValid(host) ? [host] : await resolve(host);
  if (!addresses.length || addresses.some(address => !publicAddress(address))) reject('TARGET_RESTRICTED', 'Private and internal target addresses are not allowed.', 403);
  url.hash = ''; return url;
}
async function resolvePublicHost(host) {
  const results = await Promise.all(['A', 'AAAA'].map(async type => {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) reject('DNS_UNAVAILABLE', 'Target DNS validation is temporarily unavailable.', 503);
    const result = await r.json();
    return (result.Answer ?? []).filter(item => [1, 28].includes(item.type)).map(item => item.data);
  }));
  return results.flat();
}
export async function boundedJson(request, max = 65536) {
  if (!request.headers.get('content-type')?.includes('application/json')) reject('INVALID_INPUT', 'Send application/json.', 415);
  const text = await boundedText(request, max);
  let body; try { body = JSON.parse(text); } catch { reject('INVALID_INPUT', 'Invalid JSON request.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) reject('INVALID_INPUT', 'Send a JSON object.');
  return body;
}
export async function boundedText(message, max = 2 * 1024 * 1024) {
  if (Number(message.headers.get('content-length')) > max) reject('RESPONSE_TOO_LARGE', 'The response exceeds this workspace size limit.', 413);
  if (!message.body) return '';
  const reader = message.body.getReader(); const parts = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); reject('RESPONSE_TOO_LARGE', 'The response exceeds this workspace size limit.', 413); } parts.push(value); } }
  finally { reader.releaseLock(); }
  const all = new Uint8Array(size); let offset = 0; for (const part of parts) { all.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(all);
}
export function onlyKeys(body, keys) {
  for (const key of Object.keys(body)) if (!keys.includes(key)) reject('UNSUPPORTED_OPTION', `The ${key} option is not supported by this Cloudflare-backed API.`);
}
export async function credentialMatches(supplied, expected) {
  if (!supplied || !expected || expected.length < 32 || supplied.length > 256) return false;
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([supplied, expected].map(key => crypto.subtle.digest('SHA-256', encode.encode(key))));
  let difference = 0; const left = new Uint8Array(a), right = new Uint8Array(b);
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
export function bearer(headers) { return headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]; }
