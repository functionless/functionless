#!/usr/bin/env node

const { tsc } = require("../lib/tsc");

async function main() {
  await tsc(process.cwd(), {
    emit: false,
    checkTsErrors: false,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
