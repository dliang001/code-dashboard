#!/usr/bin/env node
// Fixture: prints a line to stdout every 50ms until killed.
// Used by runner.lifecycle.test.ts to exercise spawn/stop.
let i = 0;
const timer = setInterval(() => {
  process.stdout.write(`tick ${i++}\n`);
}, 50);
process.on("SIGTERM", () => { clearInterval(timer); process.exit(0); });
process.on("SIGINT",  () => { clearInterval(timer); process.exit(0); });
