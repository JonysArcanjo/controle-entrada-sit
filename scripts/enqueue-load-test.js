#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const [endpoint, inputPath, concurrencyArg] = process.argv.slice(2);
const concurrency = Number(concurrencyArg || 5);

if (!endpoint || !inputPath) {
  console.error("Uso: node scripts/enqueue-load-test.js <endpoint> <arquivo-participantes> [concorrencia]");
  process.exit(1);
}

const participants = fs
  .readFileSync(path.resolve(inputPath), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

let cursor = 0;
let ok = 0;
let fail = 0;

async function enqueue(lookup) {
  const url = new URL(endpoint);
  url.searchParams.set("action", "confirm");
  url.searchParams.set("lookup", lookup);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.found) {
    throw new Error(data.error || "Participante nao encontrado");
  }

  return data;
}

async function worker(workerId) {
  while (cursor < participants.length) {
    const index = cursor;
    const lookup = participants[cursor];
    cursor += 1;

    try {
      const result = await enqueue(lookup);
      ok += 1;
      const position = result.printJob && result.printJob.position;
      console.log(`[worker ${workerId}] ok ${lookup} fila=${position || "-"}`);
    } catch (error) {
      fail += 1;
      console.error(`[worker ${workerId}] erro ${lookup}: ${error.message}`);
    }
  }
}

async function main() {
  console.log(`Enfileirando ${participants.length} participantes com concorrencia ${concurrency}.`);
  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1)));
  console.log(`Concluido. ok=${ok} erro=${fail}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
