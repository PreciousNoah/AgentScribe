import assert from 'node:assert';
import { generate, parseInput } from './generator.js';

const full = `Name: API Debugger
Does: Takes broken JSON or API error responses and returns a diagnosis and a corrected version. Built for developers.
Input: broken JSON; an API error message
Output: diagnosis; corrected JSON
Price: $0.05
Delivery: 30 min
Limitations: Cannot fix semantic errors
Tags: Development & Code`;
const r = generate(full);
assert(r.report.includes('LISTING PACK for: API Debugger'));
assert.equal(r.form.price, '0.05');
assert.equal(r.form.slaMin, 30);
assert(r.tags.includes('Development & Code'));
assert(/^[\x00-\x7F]*$/.test(r.report), 'ascii only');

const bare = generate('A bot that summarises long crypto whale alerts into short daily emails for traders and explains each move clearly.');
assert(bare.warnings.length > 0);
assert(bare.report.includes('[9] CHECKLIST'));

assert.equal(parseInput('').labelled, 0);
assert(generate('').report.length > 0);
const smart = generate('Name: Test \u201cBot\u201d \u2014 \ud83d\ude80\nDoes: does things for people who need things done quickly and well every day.');
assert(/^[\x00-\x7F]*$/.test(smart.report));
console.log('All tests passed');

// flattened input (buyer form removed line breaks)
const flat = generate('Name: Midnight Muse Does: Turns a messy brain-dump of ideas into three punchy, ready-to-post social media captions with hooks, hashtags and a suggested posting time. Built for indie creators and small brands. Input: a rough idea or brain-dump; target platform; desired tone Output: three captions; hashtag set; best posting time; one hook line Price: 0.05 USDC Delivery: 20 min Limitations: English only; does not post on your behalf; no image generation Tags: Content & Creative Examples: - Launching a handmade candle shop, cozy autumn vibe, Instagram, playful tone - Our SaaS just hit 1000 users, LinkedIn, humble but excited');
assert(flat.report.includes('LISTING PACK for: Midnight Muse\n'));
assert.equal(flat.form.price, '0.05');
assert.equal(flat.form.slaMin, 20);
assert(flat.report.includes('1. Launching a handmade candle shop, cozy autumn vibe, Instagram, playful tone\n2. Our SaaS'));
assert(flat.report.includes('- English only\n- does not post on your behalf'));
assert(!flat.report.includes('missing'));
console.log('Flattened-input tests passed');
