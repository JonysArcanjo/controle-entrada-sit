const SHEETS_ENDPOINT = "http://127.0.0.1:8020/api";
const PRINT_QUEUE_REFRESH_MS = 3000;
const APP_TIME_ZONE = "America/Fortaleza";

const els = {
  printQueueUpdatedAt: document.querySelector("#printQueueUpdatedAt"),
  printQueuePrintingList: document.querySelector("#printQueuePrintingList"),
  printQueueNextList: document.querySelector("#printQueueNextList"),
  printQueueWaitingList: document.querySelector("#printQueueWaitingList"),
};

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = `handlePublicQueue_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao carregar a fila."));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    const url = new URL(SHEETS_ENDPOINT, window.location.href);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set("_", Date.now());
    url.searchParams.set("callback", callbackName);
    script.src = url.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error("Nao foi possivel carregar a fila."));
    };

    document.body.appendChild(script);
  });
}

async function getPrintQueueStats() {
  const queue = await jsonp({ action: "printQueue", limit: 30 });

  if (!queue || !queue.ok) {
    throw new Error((queue && queue.error) || "Nao foi possivel carregar a fila.");
  }

  return queue;
}

function renderPrintQueueStats(stats) {
  els.printQueueUpdatedAt.textContent = `Atualizado ${
    stats.updatedAt || new Date().toLocaleTimeString("pt-BR", { timeZone: APP_TIME_ZONE })
  }`;
  renderPrintQueueList(stats.jobs || []);
}

function renderPrintQueueList(jobs) {
  const printingJobs = jobs.filter((job) => job.status === "imprimindo agora");
  const nextLimit = 3;
  const reservedJobs = jobs.filter((job) => job.status === "próximo da fila");
  const waitingJobs = jobs.filter((job) => job.status === "aguardando");
  const visibleNextJobs = reservedJobs.concat(waitingJobs).slice(0, nextLimit);
  const visibleNextIds = new Set(visibleNextJobs.map((job) => job.id));
  const remainingJobs = waitingJobs.filter((job) => !visibleNextIds.has(job.id)).slice(0, 15);

  els.printQueuePrintingList.innerHTML = printingJobs.length
    ? printingJobs.map((job) => renderPrintQueueRow(job, "printing")).join("")
    : renderQueueEmptyState("printer", "Nenhum crachá imprimindo agora.");
  els.printQueueNextList.innerHTML = visibleNextJobs.length
    ? visibleNextJobs.map((job) => renderPrintQueueRow(job, "next")).join("")
    : renderQueueEmptyState("clock", "Nenhum crachá aguardando.");
  els.printQueueWaitingList.innerHTML = remainingJobs.length
    ? remainingJobs.map((job) => renderPrintQueueRow(job, "waiting")).join("")
    : renderQueueEmptyState("users", "Fila de espera vazia.");
}

function renderPrintQueueRow(job, variant) {
  const badgeName = escapeHtml(job.badgeName || "Participante");
  const position = job.queuePosition || "-";
  const statusLabel = variant === "printing" ? "Imprimindo agora" : variant === "next" ? "Próximo da fila" : "Aguardando";
  const number = variant === "printing" ? "" : `#${position}`;
  const printerName = formatPrinterName(job.printer);
  const pickupText = escapeHtml(getQueuePickupText(job, variant, printerName).replace(/^ - /, ""));

  return `
    <article class="queue-item is-${variant}">
      ${number ? `<div class="queue-position">${number}</div>` : `<div class="queue-person-icon" aria-hidden="true"></div>`}
      <div class="queue-name">
        <strong>${badgeName}</strong>
        ${pickupText ? `<span class="queue-printer">${pickupText}</span>` : ""}
        ${variant === "next" ? "<span>Próximo atendimento</span>" : ""}
      </div>
      <div class="queue-meta">
        <div class="queue-pill is-${variant}">${statusLabel}</div>
      </div>
    </article>
  `;
}

function renderQueueEmptyState(icon, text) {
  return `
    <div class="empty-state public-queue-empty">
      <span class="public-empty-icon public-empty-icon-${icon}" aria-hidden="true"></span>
      <strong>${text}</strong>
    </div>
  `;
}

function getQueuePickupText(job, variant, printerName) {
  if (job.pickupText) {
    return ` - ${job.pickupText}`;
  }

  if (!printerName) {
    return variant === "waiting" ? "" : " - Aguardando seleção de balcão";
  }

  if (variant === "printing") {
    return ` - Retirar o crachá na impressora ${printerName}`;
  }

  if (job.printerPredicted) {
    return ` - Direcionado para ${printerName}`;
  }

  return ` - Próximo atendimento no ${printerName}`;
}

function formatPrinterName(printer) {
  const value = String(printer || "").trim();
  const match = value.match(/^(?:DOCKER[_\s-]*)?BALCAO[_\s-]*(\d+)$/i);

  if (match) {
    return `Balcão ${match[1].padStart(2, "0")}`;
  }

  return value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

async function loadPrintQueueStats() {
  try {
    renderPrintQueueStats(await getPrintQueueStats());
  } catch (error) {
    els.printQueueUpdatedAt.textContent = error.message || "Falha ao atualizar";
    console.error(error);
  }
}

loadPrintQueueStats();
window.setInterval(loadPrintQueueStats, PRINT_QUEUE_REFRESH_MS);
