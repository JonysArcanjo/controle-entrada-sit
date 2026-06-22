#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { getDryRunDelay } = require("./print-worker-delay");

const projectRoot = path.resolve(__dirname, "..");
const requestedConfigPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : null;
const defaultConfigPath = path.join(projectRoot, "print-worker.config.json");
const fallbackConfigPath = path.join(projectRoot, "print-worker.config.config.json");
const configPath =
  requestedConfigPath ||
  (fs.existsSync(defaultConfigPath) ? defaultConfigPath : fallbackConfigPath);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeInvalidResponse(text) {
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : "";
  const visibleText = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  const summary = [title, visibleText].filter(Boolean).join(" - ");

  return summary.slice(0, 500);
}

async function callApi(params) {
  const url = new URL(config.endpoint);
  const timeoutMs = Number(config.requestTimeoutMs || 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  let response;

  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    const reason =
      error.name === "AbortError"
        ? `timeout apos ${timeoutMs}ms`
        : error.cause && error.cause.message
          ? error.cause.message
          : error.message;

    throw new Error(`falha ao chamar ${params.action}: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`falha ao chamar ${params.action}: HTTP ${response.status}`);
  }

  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch (error) {
    const preview = summarizeInvalidResponse(responseText);
    throw new Error(
      `falha ao ler resposta de ${params.action}: JSON invalido${preview ? ` (${preview})` : ""}`,
    );
  }
}

function renderLabel(job) {
  return [
    "SAP INSIDE TRACK FORTALEZA",
    "",
    String(job.badgeName || "Participante").toUpperCase(),
    job.company ? String(job.company).toUpperCase() : "",
    "",
    `SORTEIO No ${job.raffleNumber || "000"}`,
    "",
  ].join("\n");
}

function printJob(printerName, job) {
  if (config.dryRun) {
    const delay = getDryRunDelay(job, config);

    return sleep(delay).then(() => {
      console.log(`[${printerName}] dry-run\n${renderLabel(job)}`);
      return "dry-run";
    });
  }

  return new Promise((resolve, reject) => {
    const filePath = path.join(os.tmpdir(), `label-${job.id}.txt`);
    fs.writeFileSync(filePath, renderLabel(job), "utf8");

    execFile("lp", ["-d", printerName, filePath], (error, stdout, stderr) => {
      fs.rm(filePath, { force: true }, () => {});

      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }

      resolve(stdout.trim());
    });
  });
}

async function claimJob(printer) {
  try {
    const claimed = await callApi({
      action: "claimPrintJob",
      printer: printer.name,
    });

    if (!claimed.ok || !claimed.job) {
      return null;
    }

    return claimed.job;
  } catch (error) {
    console.error(`[${printer.name}] ${error.message}`);
    return null;
  }
}

async function printClaimedJob(printer, job) {
  console.log(`[${printer.name}] imprimindo ${job.id} - ${job.badgeName}`);

  try {
    await printJob(printer.name, job);
    await callApi({
      action: "completePrintJob",
      jobId: job.id,
      printer: printer.name,
    });
    console.log(`[${printer.name}] impresso ${job.id}`);
  } catch (error) {
    await callApi({
      action: "failPrintJob",
      jobId: job.id,
      printer: printer.name,
      error: error.message,
    });
    console.error(`[${printer.name}] erro ${job.id}: ${error.message}`);
  }
}

function getEnabledPrinters() {
  return config.printers.filter((printer) => printer.enabled);
}

async function syncPrintPrinters() {
  const printers = getEnabledPrinters().map((printer) => ({ name: printer.name }));

  try {
    await callApi({
      action: "syncPrintPrinters",
      printers: JSON.stringify(printers),
    });
  } catch (error) {
    console.error(`falha ao sincronizar balcoes: ${error.message}`);
  }
}

async function runPrinterLoop(printer) {
  while (true) {
    const job = await claimJob(printer);

    if (job) {
      await printClaimedJob(printer, job);
      continue;
    }

    await sleep(config.pollIntervalMs || 2500);
  }
}

async function main() {
  if (!config.endpoint || !Array.isArray(config.printers)) {
    throw new Error("Configure endpoint e printers em print-worker.config.json");
  }

  console.log(`Print worker iniciado.${config.dryRun ? " Modo dry-run ativo." : ""}`);
  await syncPrintPrinters();

  await Promise.all(getEnabledPrinters().map((printer) => runPrinterLoop(printer)));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
