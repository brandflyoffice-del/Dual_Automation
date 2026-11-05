// JS snippets embedded into n8n Code nodes. They use no require() because the n8n runner may block built-ins.

/** Pure-JS SHA-256 + HMAC (tested against node:crypto in n8n/test-helpers.mjs). */
export const SIGN_JS = String.raw`
const SHA_K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256Bytes(input) {
  const msg = input.slice();
  const bitLen = input.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
  for (let i = 3; i >= 0; i--) msg.push((hi >>> (i * 8)) & 255);
  for (let i = 3; i >= 0; i--) msg.push((lo >>> (i * 8)) & 255);
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  for (let o = 0; o < msg.length; o += 64) {
    const m = new Array(64);
    for (let i = 0; i < 16; i++) m[i] = ((msg[o + i * 4] << 24) | (msg[o + i * 4 + 1] << 16) | (msg[o + i * 4 + 2] << 8) | msg[o + i * 4 + 3]) >>> 0;
    for (let i = 16; i < 64; i++) {
      const a = m[i - 15], b = m[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      m[i] = (m[i - 16] + s0 + m[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA_K[i] + m[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = [];
  for (const v of H) for (let i = 3; i >= 0; i--) out.push((v >>> (i * 8)) & 255);
  return out;
}
function utf8Bytes(s) {
  const u = unescape(encodeURIComponent(String(s)));
  const a = [];
  for (let i = 0; i < u.length; i++) a.push(u.charCodeAt(i));
  return a;
}
function hmacHex(key, message) {
  let k = utf8Bytes(key);
  if (k.length > 64) k = sha256Bytes(k);
  while (k.length < 64) k.push(0);
  const inner = sha256Bytes(k.map(x => x ^ 0x36).concat(utf8Bytes(message)));
  return sha256Bytes(k.map(x => x ^ 0x5c).concat(inner)).map(x => ('0' + x.toString(16)).slice(-2)).join('');
}
function slotSig(secret, email, startIso) {
  return hmacHex(secret, String(email).toLowerCase() + '|' + startIso).slice(0, 32);
}
`;

/** Time label in a given IANA zone, e.g. "Tuesday, 4 November, 16:00 (America/New York)". */
export const FMT_JS = String.raw`
// "Tuesday 10 November, 10:30 AM (New York time)": the prospect's own local time with a plain zone name.
const TZ_NAME = { 'Asia/Kolkata': 'India', 'Asia/Calcutta': 'India', 'Asia/Dubai': 'UAE', 'Europe/London': 'UK', 'America/New_York': 'New York',
  'America/Chicago': 'Chicago', 'America/Denver': 'Denver', 'America/Phoenix': 'Arizona', 'America/Los_Angeles': 'California', 'Australia/Sydney': 'Sydney' };
function tzName(tz) { return TZ_NAME[tz] || String(tz).split('/').pop().replace(/_/g, ' '); }
function slotLabel(ms, tz) {
  const d = new Date(ms);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(d).replace(',', '');
  const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return day + ', ' + time + ' (' + tzName(tz) + ' time)';
}
function hourIn(ms, tz) {
  return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date(ms)), 10) % 24;
}
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
`;

/** Minimal standalone HTML page for the slot-link landing pages. */
export const PAGE_JS = String.raw`
function pageHtml(title, message, buttonHtml, extraScript) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escHtml(title) + '</title></head>'
    + '<body style="margin:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">'
    + '<div style="max-width:480px;margin:12vh auto;padding:0 16px"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(15,23,42,.08)">'
    + '<div style="font-weight:700;font-size:18px;color:#4f46e5;margin-bottom:12px">BrandFly</div>'
    + '<h1 style="font-size:20px;margin:0 0 10px">' + escHtml(title) + '</h1>'
    + '<div style="font-size:15px;line-height:1.55;color:#334155">' + message + '</div>'
    + (buttonHtml ? '<div style="margin-top:20px">' + buttonHtml + '</div>' : '')
    + '</div></div>' + (extraScript || '') + '</body></html>';
}
function pageButton(href, text) {
  return '<a href="' + escHtml(href) + '" style="display:inline-block;background:#4f46e5;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600">' + escHtml(text) + '</a>';
}
`;

/**
 * Phone check for the lead's mobile number (Apify "Add mobile phone numbers"). Offline, numbering-plan level: the
 * number must have a known country code, the right length for that country and, for US/Canada, a real area code and
 * exchange (no 0/1 start, no N11, no fictional 555-01xx). Returns E.164 ("+14155550123") or null.
 * It cannot prove a number still rings; Apify supplies numbers verified when collected.
 */
export const PHONE_JS = String.raw`
const PHONE_DIAL = { us: '1', ca: '1', gb: '44', ae: '971', de: '49', fr: '33', es: '34', it: '39', nl: '31', be: '32', ch: '41', at: '43', se: '46', no: '47', dk: '45', fi: '358', ie: '353', pt: '351', pl: '48', au: '61', nz: '64', in: '91', sg: '65', za: '27', il: '972', sa: '966', qa: '974', lu: '352', cz: '420', gr: '30' };
// Digits after the country code (min, max) per numbering plan.
const PHONE_NSN = { '1': [10, 10], '44': [9, 10], '971': [8, 9], '49': [6, 13], '33': [9, 9], '34': [9, 9], '39': [6, 11], '31': [9, 9], '32': [8, 9], '41': [9, 9], '43': [4, 13], '46': [7, 10], '47': [8, 8], '45': [8, 8], '358': [5, 12], '353': [7, 9], '351': [9, 9], '48': [9, 9], '61': [9, 9], '64': [8, 10], '91': [10, 10], '65': [8, 8], '27': [9, 9], '972': [8, 9], '966': [9, 9], '974': [8, 8], '352': [4, 11], '420': [9, 9], '30': [10, 10] };
const PHONE_CODES = Object.keys(PHONE_NSN).sort((a, b) => b.length - a.length);
function cleanPhone(raw, countryCode) {
  let s = String(raw == null ? '' : raw).trim().replace(/\s*(?:ext\.?|extension|x|#)\s*\d{1,6}$/i, '');
  if (!s || /[a-wyz]/i.test(s)) return null;
  const intl = /^(\+|00)/.test(s);
  let d = s.replace(/\D/g, '');
  if (s.startsWith('00')) d = d.slice(2);
  let cc = null, nsn = '';
  if (intl) {
    cc = PHONE_CODES.find(c => d.startsWith(c)) || null;
    if (!cc) return d.length >= 8 && d.length <= 15 && !/^(\d)\1+$/.test(d) ? '+' + d : null; // a country we have no plan for
    nsn = d.slice(cc.length);
  } else {
    cc = PHONE_DIAL[String(countryCode || '').toLowerCase()] || null;
    if (!cc) return null;
    nsn = d;
    if (cc === '1' && nsn.length === 11 && nsn[0] === '1') nsn = nsn.slice(1);
    else if (nsn.startsWith(cc) && nsn.length > PHONE_NSN[cc][1]) nsn = nsn.slice(cc.length);
    if (cc !== '39' && nsn[0] === '0') nsn = nsn.slice(1); // national trunk prefix
  }
  if (cc !== '39' && nsn[0] === '0') nsn = nsn.slice(1); // "+44 (0)7700..." style
  const [min, max] = PHONE_NSN[cc];
  if (nsn.length < min || nsn.length > max) return null;
  if (/^(\d)\1+$/.test(nsn) || '01234567890123'.includes(nsn) || '98765432109876'.includes(nsn)) return null;
  if (cc === '1') {
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(nsn)) return null;
    const area = nsn.slice(0, 3), exch = nsn.slice(3, 6);
    if (/^[2-9]11$/.test(area) || /^[2-9]11$/.test(exch) || area[1] === '9') return null;
    if (exch === '555' && /^01\d\d$/.test(nsn.slice(6))) return null; // reserved for films and examples
  }
  return '+' + cc + nsn;
}
`;
