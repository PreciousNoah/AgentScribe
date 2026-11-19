// AgentScribe engine: deterministic, no LLM, no network.
// Input: free text describing an agent (labelled lines work best).
// Output: plain-ASCII report + structured fields.

const ALIASES = {
  name: ['name', 'agent', 'agent name', 'title'],
  does: ['does', 'what it does', 'description', 'about', 'purpose', 'summary', 'what', 'overview'],
  input: ['input', 'inputs', 'requirements', 'requirement', 'buyer provides', 'buyer input', 'accepts', 'needs'],
  output: ['output', 'outputs', 'deliverable', 'deliverables', 'returns', 'delivers', 'result'],
  price: ['price', 'pricing', 'cost', 'fee'],
  delivery: ['delivery', 'delivery time', 'sla', 'turnaround', 'speed'],
  limits: ['limitations', 'limits', 'limitation', 'restrictions', 'not supported', 'cannot do'],
  tags: ['tags', 'category', 'categories'],
  features: ['features', 'capabilities', 'key features'],
  examples: ['examples', 'example', 'example prompts', 'sample input', 'samples'],
  audience: ['audience', 'for', 'who is it for', 'target users', 'users'],
};

const TAG_MAP = {
  'Development & Code': ['json', 'api', 'code', 'debug', 'developer', 'sdk', 'script', 'bug', 'error', 'documentation', 'docs', 'listing'],
  'Data & Analytics': ['data', 'csv', 'analytics', 'extract', 'report', 'parse', 'dashboard', 'statistics'],
  'DeFi & Trading': ['defi', 'trade', 'trading', 'token', 'swap', 'wallet', 'whale', 'crypto', 'onchain'],
  'Content & Creative': ['write', 'writing', 'content', 'copy', 'blog', 'image', 'creative', 'design', 'social', 'marketing'],
};

export function ascii(s) {
  return String(s)
    .replace(/\u20a6/g, 'NGN ').replace(/\u20ac/g, 'EUR ').replace(/\u00a3/g, 'GBP ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\x7F]/g, '');
}

function canon(label) {
  const l = label.trim().toLowerCase();
  for (const [k, list] of Object.entries(ALIASES)) if (list.includes(l)) return k;
  return null;
}

function splitItems(val, commaOk) {
  const strip = (x) => x.replace(/^\s*([-*]|\d+[.)])\s*/, '').trim();
  let items = val.split('\n').map(strip).filter(Boolean);
  if (items.length === 1 && /^-\s/.test(items[0].trim()) === false && /^\s*-\s/.test(val)) items = val.split(/\s+-\s+/).map(strip).filter(Boolean);
  if (items.length === 1) {
    const semi = items[0].split(';').map((x) => x.trim()).filter(Boolean);
    if (semi.length > 1) items = semi;
    else if (commaOk) items = items[0].split(',').map((x) => x.trim()).filter(Boolean);
  }
  return items;
}

export function parseInput(raw) {
  let text = ascii(raw || '').replace(/\r/g, '').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").trim();
  const f = {};
  let cur = null;
  let labelled = 0;
  const lineRe = /^\s*[-*]?\s*([A-Za-z][A-Za-z ]{1,24}?)\s*:\s*(.*)$/;
  // Some buyer forms flatten line breaks. If labels are not on their own lines,
  // split on Capitalised labels found mid-line.
  const labelLines = text.split('\n').filter((l) => { const m = l.match(lineRe); return m && canon(m[1]); }).length;
  if (labelLines <= 1) {
    const SAFE = ['name', 'agent name', 'does', 'what it does', 'description', 'input', 'inputs', 'output', 'outputs', 'price', 'pricing', 'delivery', 'delivery time', 'sla', 'limitations', 'limits', 'tags', 'features', 'examples', 'deliverable', 'deliverables', 'requirements', 'requirement'];
    const esc = (a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const byLen = (arr) => arr.slice().sort((a, b) => b.length - a.length);
    const safeAlt = byLen(SAFE).map(esc).join('|');
    text = text.replace(new RegExp('(^|\\s)(' + safeAlt + ')\\s*:', 'gi'), (m, sp, lab) => '\n' + lab + ':');
    const allAlt = byLen([...new Set(Object.values(ALIASES).flat())]).map((a) => esc(cap(a))).join('|');
    text = text.replace(new RegExp('(^|\\s)(' + allAlt + ')\\s*:', 'g'), (m, sp, lab) => '\n' + lab + ':');
    text = text.trim();
  }
  for (const line of text.split('\n')) {
    const m = line.match(lineRe);
    const key = m ? canon(m[1]) : null;
    if (key) {
      labelled++;
      if (['name', 'price', 'delivery'].includes(key) && f[key]) { cur = null; continue; }
      cur = key;
      f[cur] = (f[cur] ? f[cur] + '\n' : '') + m[2];
    } else if (cur) {
      f[cur] += '\n' + line;
    }
  }
  if (!labelled) {
    const wc = text.split(/\s+/).filter(Boolean).length;
    if (wc > 0 && wc <= 5 && !/[.!?]/.test(text)) f.name = text;
    else f.does = text;
    const pm = text.match(/(\d+(?:\.\d+)?)\s*(?:USDC|USDT|USD)\b/i) || text.match(/\$\s?(\d+(?:\.\d+)?)/);
    if (pm) f.price = pm[1] + ' USDC';
    const dm = text.match(/\b(\d+\s*(?:minutes?|mins?|hours?|hrs?))\b/i);
    if (dm) f.delivery = dm[1];
  }
  const out = { raw: text, labelled };
  for (const k of Object.keys(f)) f[k] = f[k].trim();
  out.name = (f.name || '').split('\n')[0].trim();
  out.does = (f.does || '').replace(/\s+/g, ' ');
  out.input = f.input ? splitItems(f.input, true) : [];
  out.output = f.output ? splitItems(f.output, true) : [];
  out.price = f.price || '';
  out.delivery = f.delivery || '';
  out.limits = f.limits ? splitItems(f.limits, false) : [];
  out.tags = f.tags ? splitItems(f.tags, true) : [];
  out.features = f.features ? splitItems(f.features, false) : [];
  out.examples = f.examples ? splitItems(f.examples, false) : [];
  out.audience = f.audience ? splitItems(f.audience, true) : [];
  return out;
}

function sentences(s) {
  return (s.replace(/\s+/g, ' ').match(/(?:[^.!?]|[.!?](?!\s|$))+[.!?]*/g) || []).map((x) => x.trim()).filter(Boolean);
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const low = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const endDot = (s) => (/[.!?]$/.test(s) ? s : s + '.');
function truncate(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 3);
  return cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length) + '...';
}

function parseSla(s) {
  const h = s.match(/(\d+)\s*(h|hr|hrs|hour|hours)\b/i);
  const m = s.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/i);
  if (!h && !m) return { hr: 0, min: 30, given: false };
  return { hr: h ? +h[1] : 0, min: m ? +m[1] : 0, given: true };
}

function parsePrice(s) {
  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]).toFixed(2) : '';
}

function suggestTags(text, given) {
  const l = text.toLowerCase();
  const key = (t) => t.toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9&]+/g, ' ').trim();
  const scored = Object.entries(TAG_MAP)
    .map(([tag, kws]) => [tag, kws.filter((k) => new RegExp('\\b' + k).test(l)).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
  const out = [];
  const seen = new Set();
  for (const t of [...given, ...scored]) {
    const k = key(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, 3);
}

function guessName(p) {
  return p.name || 'Your Agent';
}

export function generate(raw) {
  const p = parseInput(raw);
  const warn = [];
  const name = guessName(p);
  const allSents = sentences(p.does);
  const noteRe = /^(note|disclaimer|warning)\s*:/i;
  const noteSents = allSents.filter((x) => noteRe.test(x));
  const sents = allSents.filter((x) => !noteRe.test(x));
  const first = sents[0] ? endDot(cap(sents[0])) : '';
  const inW = p.input[0] ? low(p.input[0]) : 'content';
  const outW = p.output[0] ? low(p.output[0]) : 'a written result';
  const price = parsePrice(p.price);
  const sla = parseSla(p.delivery);
  const slaText = (sla.hr ? sla.hr + ' hr ' : '') + (sla.min ? sla.min + ' min' : '');
  const tags = suggestTags(p.raw, p.tags);

  // Warnings
  if (!p.name) warn.push('No agent name given. "' + name + '" is a placeholder; replace it.');
  if (p.does.split(' ').filter(Boolean).length < 15) warn.push('Description is short. Add what the agent does, for whom, and what makes it useful (15+ words).');
  if (!p.input.length) warn.push('No buyer input described. Buyers will not know what to send. Add "Input: ...".');
  if (!p.output.length) warn.push('No deliverable described. Add "Output: ...".');
  if (!price) warn.push('No numeric price found. Add "Price: 0.05".');
  if (/\b(NGN|EUR|GBP|naira|euros?|pounds?)\b/i.test(p.price)) warn.push('Price looks like it is not in USDC. CROO prices are in USDC; convert it before listing.');
  if (!sla.given) warn.push('No delivery time given. Defaulted to 30 min.');
  if (!p.limits.length) warn.push('No limitations given. Default ones are listed; edit them to match reality.');
  if (p.does.length > 600) warn.push('Description is very long for a store card. Use the short version.');

  // Short store description
  const shortParts = [first || (name !== 'Your Agent' ? name + '.' : '')];
  if (p.input.length) shortParts.push('You send: ' + p.input.slice(0, 3).join(', ') + '.');
  if (p.output.length) shortParts.push('You get: ' + p.output.slice(0, 3).join(', ') + '.');
  if (slaText) shortParts.push('Delivery within ' + slaText.trim() + '.');
  const shortDesc = truncate(shortParts.filter(Boolean).join(' '), 400);

  // Long description
  const longParts = [];
  if (sents.length) longParts.push(sents.map(endDot).map(cap).join(' '));
  if (p.audience.length) longParts.push('Built for ' + p.audience.join(', ') + '.');
  if (p.input.length) longParts.push('To order, provide ' + p.input.join(', ') + '.');
  if (p.output.length) longParts.push('You receive ' + p.output.join(', ') + '.');
  const longDesc = longParts.join('\n\n') || '(add a description to generate this section)';

  // Features
  let features = p.features.slice();
  if (!features.length) {
    features = sents.slice(1).map((s) => endDot(cap(s)));
    p.output.forEach((o) => features.push('Delivers ' + low(o)));
    if (!features.length && first) features.push(first);
    features.push('Plain-text delivery you can copy straight into your work');
    features.push('Payment held in escrow until delivery');
  }
  features = [...new Set(features)].slice(0, 8);

  // How to use
  const howTo = [
    'Open the agent on CROO and pick the service "' + name + '".',
    'Place an order' + (price ? ' (' + price + ' USDC)' : '') + '.',
    'In the requirements box, provide: ' + (p.input.length ? p.input.join('; ') : 'the details of your request') + '.',
    'Payment is locked in escrow while the agent works.',
    'Receive the deliverable' + (slaText ? ' within ' + slaText.trim() : '') + '. The order then completes and settles.',
  ];

  // Examples
  let examples = p.examples.slice();
  if (!examples.length) {
    examples = [
      'Please handle the following: <paste your ' + inW + ' here>',
      (first.replace(/\.$/, '') || 'Process my request') + '. My input: <' + inW + '>. Return ' + outW + '.',
      'Short sample: <one small ' + inW + ' example>. Keep the answer concise.',
    ];
    warn.push('Example prompts are templates. Replace them with a real sample input for best conversions.');
  }

  // Limitations
  const limits = (p.limits.length
    ? p.limits
    : [
        'Results are based only on what you submit in the order (default - edit if untrue).',
        'One order covers one request; no follow-up chat unless the listing says so (default - edit if untrue).',
        'Output is delivered as plain text (default - edit if untrue).',
      ]).concat(noteSents.map((x) => x.replace(noteRe, '').trim()).filter(Boolean).map((x) => cap(x)));

  // Service form fields
  let serviceName = name;
  if (name.length > 40) {
    serviceName = name.slice(0, 40).replace(/\s+\S*$/, '').trim() || name.slice(0, 40);
    warn.push('Agent name is long; service name shortened to "' + serviceName + '". Consider a shorter name.');
  }
  const form = {
    serviceName,
    price: price || '0.05',
    description: truncate(shortDesc, 300),
    slaHr: sla.hr,
    slaMin: sla.min,
    deliverableText: p.output.length
      ? 'A plain-text report containing ' + p.output.join(', ') + '.'
      : 'A plain-text report.',
    requirementsText: p.input.length
      ? 'Paste ' + p.input.join(', ') + ' as plain text.'
      : 'Paste the details of your request as plain text.',
  };

  const L = [];
  const hr = '-----';
  L.push('AGENTSCRIBE LISTING PACK for: ' + name, hr);
  L.push('[1] STORE DESCRIPTION (short)', shortDesc || '(missing)', '');
  L.push('[2] FULL DESCRIPTION', longDesc, '');
  L.push('[3] FEATURES', ...features.map((x) => '- ' + x), '');
  L.push('[4] HOW TO USE', ...howTo.map((x, i) => (i + 1) + '. ' + x), '');
  L.push('[5] EXAMPLE PROMPTS', ...examples.map((x, i) => (i + 1) + '. ' + x), '');
  L.push('[6] SERVICE DOCUMENTATION',
    'Service name: ' + form.serviceName,
    'Price: ' + form.price + ' USDC',
    'Delivery (SLA): ' + (slaText.trim() || '30 min'),
    'Requirements field: ' + form.requirementsText,
    'Deliverable field: ' + form.deliverableText,
    'Format: free text in, plain text out', '');
  L.push('[7] LIMITATIONS AND REQUIREMENTS', ...limits.map((x) => '- ' + x), '');
  L.push('[8] SUGGESTED TAGS', tags.length ? tags.join(', ') : '(none matched; pick manually)', '');
  L.push('[9] CHECKLIST BEFORE PUBLISHING',
    ...(warn.length ? warn.map((w) => '- ' + w) : ['- No issues found.']));

  return { report: ascii(L.join('\n')), form, warnings: warn, tags };
}
