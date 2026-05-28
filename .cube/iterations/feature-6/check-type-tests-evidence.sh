#!/bin/bash
cd "$(dirname "$0")"
node -e "
const fs = require('fs');
if (!fs.existsSync('test-map.yaml')) { console.log('SKIP: no test-map.yaml'); process.exit(0); }
const raw = fs.readFileSync('test-map.yaml', 'utf8');
const inTypeTests = [];
let inSection = false;
for (const line of raw.split('\n')) {
  if (/^type_tests:/.test(line)) { inSection = true; continue; }
  if (inSection && /^\S/.test(line) && !/^type_tests:/.test(line)) { inSection = false; }
  if (inSection) { const m = line.match(/^\s+-?\s*type:\s+(\S+)/); if (m) inTypeTests.push(m[1]); }
}
if (!inTypeTests.length) { console.log('SKIP: no type_tests declared'); process.exit(0); }
if (!fs.existsSync('test-report.md')) { process.stderr.write('FAIL: test-report.md not found\n'); process.exit(1); }
const report = fs.readFileSync('test-report.md', 'utf8');
const missing = inTypeTests.filter(t => !report.includes(t));
if (missing.length) { process.stderr.write('FAIL: missing type evidence in Standards Evidence: ' + missing.join(', ') + '\n'); process.exit(1); }
console.log('OK: ' + inTypeTests.join(', '));
"
