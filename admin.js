const SHEETS_ENDPOINT = "/api";
const PARTICIPANTS_UPLOAD_ENDPOINT = "/admin/upload-participantes";
const PRINT_QUEUE_REFRESH_MS = 3000;
const PRINT_TEST_REFRESH_MS = 1000;
const APP_TIME_ZONE = "America/Fortaleza";

const demoStats = {
  ok: true,
  total: 20,
  confirmed: 8,
  pending: 12,
  confirmedRate: 40,
  pendingRate: 60,
  hourly: [0, 0, 0, 0, 0, 0, 1, 1, 0, 2, 3, 5, 4, 6, 7, 8, 6, 4, 3, 2, 1, 0, 0, 0],
  companies: [
    { name: "Acme Corp", count: 6, rate: 30 },
    { name: "Global Solutions", count: 4, rate: 20 },
    { name: "Tech Innovators", count: 3, rate: 15 },
    { name: "Sem empresa", count: 7, rate: 35 },
  ],
  recent: [
    {
      name: "Mariana Carvalho",
      email: "mariana.carvalho34@contato.com",
      number: "014",
      time: "15:42",
    },
  ],
  updatedAt: "15:42",
};

const els = {
  adminSidebarButtons: document.querySelectorAll("[data-admin-view]"),
  adminPanels: document.querySelectorAll("[data-admin-panel]"),
  confirmedCount: document.querySelector("#confirmedCount"),
  pendingCount: document.querySelector("#pendingCount"),
  totalCount: document.querySelector("#totalCount"),
  confirmedRate: document.querySelector("#confirmedRate"),
  pendingRate: document.querySelector("#pendingRate"),
  confirmedBar: document.querySelector("#confirmedBar"),
  pendingBar: document.querySelector("#pendingBar"),
  updatedAt: document.querySelector("#updatedAt"),
  googleSheetsSourceButton: document.querySelector("#googleSheetsSourceButton"),
  sqliteSourceButton: document.querySelector("#sqliteSourceButton"),
  dataSourceStatus: document.querySelector("#dataSourceStatus"),
  systemStatusUpdatedAt: document.querySelector("#systemStatusUpdatedAt"),
  systemVersion: document.querySelector("#systemVersion"),
  systemBuildTime: document.querySelector("#systemBuildTime"),
  systemDataSource: document.querySelector("#systemDataSource"),
  systemAdminAuth: document.querySelector("#systemAdminAuth"),
  systemDatabase: document.querySelector("#systemDatabase"),
  systemPrintingStatus: document.querySelector("#systemPrintingStatus"),
  simulatedWorkerStatus: document.querySelector("#simulatedWorkerStatus"),
  systemLastBackup: document.querySelector("#systemLastBackup"),
  createBackupButton: document.querySelector("#createBackupButton"),
  createBackupStatus: document.querySelector("#createBackupStatus"),
  enableSimulatedWorkerButton: document.querySelector("#enableSimulatedWorkerButton"),
  disableSimulatedWorkerButton: document.querySelector("#disableSimulatedWorkerButton"),
  uploadParticipantsButton: document.querySelector("#uploadParticipantsButton"),
  uploadParticipantsStatus: document.querySelector("#uploadParticipantsStatus"),
  uploadParticipantsModal: document.querySelector("#uploadParticipantsModal"),
  closeUploadParticipantsModal: document.querySelector("#closeUploadParticipantsModal"),
  uploadParticipantsForm: document.querySelector("#uploadParticipantsForm"),
  participantsFileInput: document.querySelector("#participantsFileInput"),
  participantsFileName: document.querySelector("#participantsFileName"),
  submitParticipantsUpload: document.querySelector("#submitParticipantsUpload"),
  uploadParticipantsMessage: document.querySelector("#uploadParticipantsMessage"),
  clearDashboardButton: document.querySelector("#clearDashboardButton"),
  clearDashboardStatus: document.querySelector("#clearDashboardStatus"),
  hourlyChart: document.querySelector("#hourlyChart"),
  companyList: document.querySelector("#companyList"),
  recentList: document.querySelector("#recentList"),
  refreshButton: document.querySelector("#refreshButton"),
  printQueueUpdatedAt: document.querySelector("#printQueueUpdatedAt"),
  queueControls: document.querySelector(".queue-controls"),
  startPrintingButton: document.querySelector("#startPrintingButton"),
  stopPrintingButton: document.querySelector("#stopPrintingButton"),
  printingControlStatus: document.querySelector("#printingControlStatus"),
  queueWaitingCount: document.querySelector("#queueWaitingCount"),
  queuePrintingCount: document.querySelector("#queuePrintingCount"),
  queuePrintedCount: document.querySelector("#queuePrintedCount"),
  queueErrorCount: document.querySelector("#queueErrorCount"),
  printQueuePrintingList: document.querySelector("#printQueuePrintingList"),
  printQueueNextList: document.querySelector("#printQueueNextList"),
  printQueueWaitingList: document.querySelector("#printQueueWaitingList"),
  printTestUpdatedAt: document.querySelector("#printTestUpdatedAt"),
  printTestPendingCount: document.querySelector("#printTestPendingCount"),
  printTestPrinterCount: document.querySelector("#printTestPrinterCount"),
  printTestQuantity: document.querySelector("#printTestQuantity"),
  printTestDelaySeconds: document.querySelector("#printTestDelaySeconds"),
  startPrintTestButton: document.querySelector("#startPrintTestButton"),
  printTestMessage: document.querySelector("#printTestMessage"),
  printTestStatusText: document.querySelector("#printTestStatusText"),
  printTestProgressText: document.querySelector("#printTestProgressText"),
  printTestProgressBar: document.querySelector("#printTestProgressBar"),
  printTestWaitingCount: document.querySelector("#printTestWaitingCount"),
  printTestPrintingCount: document.querySelector("#printTestPrintingCount"),
  printTestPrintedCount: document.querySelector("#printTestPrintedCount"),
  printTestErrorCount: document.querySelector("#printTestErrorCount"),
  participantSearchForm: document.querySelector("#participantSearchForm"),
  participantSearchInput: document.querySelector("#participantSearchInput"),
  participantCheckinCard: document.querySelector("#participantCheckinCard"),
  adminParticipantName: document.querySelector("#adminParticipantName"),
  adminParticipantEmail: document.querySelector("#adminParticipantEmail"),
  adminParticipantCompany: document.querySelector("#adminParticipantCompany"),
  adminBadgeNameInput: document.querySelector("#adminBadgeNameInput"),
  adminCompanyInput: document.querySelector("#adminCompanyInput"),
  adminRaffleNumber: document.querySelector("#adminRaffleNumber"),
  adminConfirmedAt: document.querySelector("#adminConfirmedAt"),
  adminPreviewName: document.querySelector("#adminPreviewName"),
  adminPreviewCompany: document.querySelector("#adminPreviewCompany"),
  adminPreviewNumber: document.querySelector("#adminPreviewNumber"),
  adminConfirmButton: document.querySelector("#adminConfirmButton"),
  participantAdminMessage: document.querySelector("#participantAdminMessage"),
  labelName: document.querySelector("#labelName"),
  labelCompany: document.querySelector("#labelCompany"),
  labelNumber: document.querySelector("#labelNumber"),
};

let currentLookup = "";
let currentParticipant = null;
let currentAdminView = "checkin";
let currentPrintTestBatchId = "";
let printTestPollTimer = null;

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function setAdminView(view) {
  currentAdminView = view || "checkin";
  els.adminSidebarButtons.forEach((button) => {
    const isActive = button.dataset.adminView === currentAdminView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  els.adminPanels.forEach((panel) => {
    panel.hidden = panel.dataset.adminPanel !== currentAdminView;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (currentAdminView === "teste-impressao") {
    loadPrintTestInfo();
  }
}

function getStats() {
  if (!SHEETS_ENDPOINT) {
    return Promise.resolve(demoStats);
  }

  return jsonp({ action: "stats" });
}

async function getPrintQueueStats() {
  if (!SHEETS_ENDPOINT) {
    return Promise.resolve({
      ok: true,
      aguardando: 0,
      imprimindo: 0,
      impresso: 0,
      erro: 0,
      jobs: [],
    });
  }

  const queue = await jsonp({ action: "printQueue", limit: 20 });

  if (queue && queue.ok) {
    return queue;
  }

  const stats = await jsonp({ action: "printQueueStats" });
  return {
    ...(stats || {}),
    jobs: [],
  };
}

async function getPrintTestInfo() {
  return jsonp({ action: "printTestInfo" });
}

async function getSystemStatus() {
  return jsonp({ action: "version" });
}

async function createManualBackup() {
  return jsonp({ action: "createBackup" });
}

async function setSimulatedWorkerEnabled(enabled) {
  return jsonp({ action: "setSimulatedWorkerEnabled", enabled: String(Boolean(enabled)) });
}

async function startPrintTest(quantity, delaySeconds) {
  return jsonp({ action: "startPrintTest", quantity, delaySeconds });
}

async function getPrintTestStatus(batchId) {
  return jsonp({ action: "printTestStatus", batchId });
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = `handleAdminStats_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao carregar o painel."));
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
      reject(new Error("Nao foi possivel carregar os dados do painel."));
    };

    document.body.appendChild(script);
  });
}

function normalizeCpf(value) {
  return String(value).replace(/\D/g, "");
}

function normalizeLookup(value) {
  const trimmed = String(value).trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : normalizeCpf(trimmed);
}

function setAdminMessage(text, type) {
  els.participantAdminMessage.textContent = text;
  els.participantAdminMessage.className = "admin-message";

  if (type) {
    els.participantAdminMessage.classList.add(`is-${type}`);
  }
}

function setUploadMessage(text, type) {
  els.uploadParticipantsMessage.textContent = text;
  els.uploadParticipantsMessage.className = "admin-message";

  if (type) {
    els.uploadParticipantsMessage.classList.add(`is-${type}`);
  }
}

function setPrintTestMessage(text, type) {
  els.printTestMessage.textContent = text;
  els.printTestMessage.className = "admin-message";
  if (type) {
    els.printTestMessage.classList.add(`is-${type}`);
  }
}

function renderPrintTestInfo(info) {
  if (!info || !info.ok) {
    throw new Error((info && info.error) || "Não foi possível consultar o teste de impressão.");
  }
  const pending = Number(info.pending || 0);
  const quantity = Math.min(Math.max(Number(els.printTestQuantity.value || 1), 1), Math.max(pending, 1));
  els.printTestPendingCount.textContent = formatNumber(pending);
  els.printTestPrinterCount.textContent = formatNumber(info.printerCount);
  els.printTestQuantity.max = String(Math.max(pending, 1));
  els.printTestQuantity.value = String(quantity);
  els.printTestQuantity.disabled = pending === 0 || Boolean(info.activeBatchId);
  els.printTestDelaySeconds.disabled = pending === 0 || Boolean(info.activeBatchId);
  els.startPrintTestButton.disabled = !info.canStart;
  els.printTestUpdatedAt.textContent = new Date().toLocaleTimeString("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (info.activeBatchId) {
    currentPrintTestBatchId = info.activeBatchId;
    schedulePrintTestPoll(0);
  } else if (info.source !== "SQLITE") {
    setPrintTestMessage("Ative a fonte SQLite para executar o teste.", "error");
  } else if (info.activeQueue) {
    setPrintTestMessage("A fila precisa estar vazia antes de iniciar um teste.", "error");
  } else if (!pending) {
    setPrintTestMessage("Não há participantes pendentes disponíveis.", null);
  } else if (!currentPrintTestBatchId) {
    setPrintTestMessage(`Escolha uma quantidade entre 1 e ${pending}.`, null);
  }
}

function renderPrintTestStatus(status) {
  if (!status || !status.ok) {
    throw new Error((status && status.error) || "Não foi possível acompanhar o teste.");
  }
  els.printTestWaitingCount.textContent = formatNumber(status.aguardando);
  els.printTestPrintingCount.textContent = formatNumber(status.imprimindo);
  els.printTestPrintedCount.textContent = formatNumber(status.impresso);
  els.printTestErrorCount.textContent = formatNumber(status.erro);
  els.printTestProgressBar.style.width = `${Math.min(Number(status.progress || 0), 100)}%`;
  els.printTestProgressText.textContent = `${status.completedCount || 0} de ${status.total || 0} processadas`;
  els.printTestStatusText.textContent = status.completed
    ? status.erro
      ? "Teste concluído com erros"
      : "Teste concluído"
    : "Teste em andamento";

  if (status.completed) {
    stopPrintTestPolling();
    els.startPrintTestButton.disabled = true;
    els.printTestQuantity.disabled = true;
    setPrintTestMessage(
      status.erro
        ? `Lote concluído com ${status.erro} erro(s). A impressão foi pausada.`
        : `Lote concluído com ${status.impresso} etiqueta(s). A impressão foi pausada.`,
      status.erro ? "error" : "success",
    );
    loadStats();
    loadPrintQueueStats();
    window.setTimeout(loadPrintTestInfo, 300);
  }
}

function stopPrintTestPolling() {
  if (printTestPollTimer) {
    window.clearTimeout(printTestPollTimer);
    printTestPollTimer = null;
  }
}

function schedulePrintTestPoll(delay = PRINT_TEST_REFRESH_MS) {
  stopPrintTestPolling();
  if (!currentPrintTestBatchId) {
    return;
  }
  printTestPollTimer = window.setTimeout(pollPrintTestStatus, delay);
}

async function pollPrintTestStatus() {
  if (!currentPrintTestBatchId) {
    return;
  }
  try {
    const status = await getPrintTestStatus(currentPrintTestBatchId);
    renderPrintTestStatus(status);
    if (!status.completed) {
      schedulePrintTestPoll();
    }
  } catch (error) {
    setPrintTestMessage(error.message || "Falha ao acompanhar o teste.", "error");
    schedulePrintTestPoll();
  }
}

async function loadPrintTestInfo() {
  try {
    renderPrintTestInfo(await getPrintTestInfo());
  } catch (error) {
    setPrintTestMessage(error.message || "Falha ao consultar o teste.", "error");
    els.startPrintTestButton.disabled = true;
  }
}

function openUploadParticipantsModal() {
  els.uploadParticipantsModal.hidden = false;
  setUploadMessage("", null);
  els.participantsFileInput.value = "";
  els.participantsFileName.textContent = "Selecionar arquivo CSV/XLSX";
  window.setTimeout(() => els.participantsFileInput.focus(), 0);
}

function closeUploadParticipantsModal() {
  els.uploadParticipantsModal.hidden = true;
}

async function findParticipant(lookup) {
  return jsonp({ action: "lookup", lookup });
}

async function getFonteDadosAtiva() {
  return jsonp({ action: "getFonteDadosAtiva" });
}

async function setFonteDadosAtiva(fonte) {
  return jsonp({ action: "setFonteDadosAtiva", fonte });
}

async function limparIndicadores() {
  return jsonp({ action: "limparIndicadores" });
}

async function setPrintingEnabled(enabled) {
  return jsonp({ action: "setPrintingEnabled", enabled: String(Boolean(enabled)) });
}

async function uploadParticipants(file) {
  const formData = new FormData();
  formData.append("arquivo", file);

  let response;
  try {
    response = await fetch(PARTICIPANTS_UPLOAD_ENDPOINT, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw new Error("Servidor de upload indisponível. Abra o painel com python3 server.py.");
  }

  const responseText = await response.text();
  let result = null;

  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    result = null;
  }

  if (!response.ok || !result || !result.ok) {
    if (result && result.error) {
      throw new Error(result.error);
    }

    if (response.status === 404 || response.status === 501 || responseText.includes("<!DOCTYPE")) {
      throw new Error("A rota de upload não está ativa. Rode python3 server.py e acesse http://localhost:8020/admin.html.");
    }

    throw new Error(`Falha ao importar participantes. HTTP ${response.status}.`);
  }

  return result;
}

async function confirmParticipant(lookup) {
  return jsonp({
    action: "confirm",
    lookup,
    company: els.adminCompanyInput.value.trim(),
    badgeName: els.adminBadgeNameInput.value.trim(),
  });
}

async function reprintParticipant(lookup) {
  return jsonp({
    action: "reprintLabel",
    lookup,
    company: els.adminCompanyInput.value.trim(),
    badgeName: els.adminBadgeNameInput.value.trim(),
  });
}

function getSuggestedBadgeName(participant = {}) {
  return (
    participant.badgeNameSuggested ||
    [participant.name, participant.surname].filter(Boolean).join(" ").trim() ||
    participant.name ||
    ""
  );
}

function getCurrentBadgeName(participant = {}) {
  return participant.badgeName || getSuggestedBadgeName(participant) || "Participante";
}

function fillParticipantForm(participant, lookup) {
  currentLookup = lookup;
  currentParticipant = participant;
  els.adminParticipantName.textContent = participant.name || "Participante";
  els.adminParticipantEmail.textContent = participant.email || "Sem email";
  els.adminParticipantCompany.textContent = participant.company || "Empresa não informada";
  els.adminBadgeNameInput.value = getCurrentBadgeName(participant);
  els.adminCompanyInput.value = participant.company || "";
  els.adminParticipantCompany.hidden = false;
  els.adminRaffleNumber.textContent = participant.number || "000";
  els.adminConfirmedAt.textContent = participant.confirmedAt
    ? `Confirmado em ${participant.confirmedAt}`
    : "Sem confirmação";
  els.adminConfirmButton.textContent = participant.confirmed
    ? "Reimprimir etiqueta"
    : "Confirmar entrada e enviar para impressao";
  els.adminConfirmButton.disabled = false;
  updateAdminLabelPreview(participant);
  els.participantCheckinCard.hidden = false;
}

function updateAdminLabelPreview(participant = currentParticipant || {}) {
  const badgeName = els.adminBadgeNameInput.value.trim() || getCurrentBadgeName(participant);
  const company = els.adminCompanyInput.value.trim() || participant.company || "";

  els.adminPreviewName.textContent = badgeName;
  els.adminPreviewCompany.textContent = company;
  els.adminPreviewCompany.hidden = !company;
  els.adminPreviewNumber.textContent = participant.number || "000";
}

function fillPrintLabel(participant) {
  const badgeName = els.adminBadgeNameInput.value.trim() || getCurrentBadgeName(participant);
  const company = els.adminCompanyInput.value.trim() || participant.company || "";

  els.labelName.textContent = badgeName;
  els.labelCompany.textContent = company;
  els.labelNumber.textContent = participant.number || "000";
}

async function searchParticipant(rawLookup) {
  const lookup = normalizeLookup(rawLookup);

  if (!lookup) {
    setAdminMessage("Digite um email ou CPF para pesquisar.", "error");
    return;
  }

  setAdminMessage("Buscando participante...", null);

  try {
    const participant = await findParticipant(lookup);

    if (!participant || !participant.found) {
      els.participantCheckinCard.hidden = true;
      setAdminMessage("Participante nao encontrado.", "error");
      return;
    }

    fillParticipantForm(participant, lookup);
    setAdminMessage("Participante encontrado para check-in.", "success");
    document.querySelector("#participantAdmin").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setAdminMessage(error.message || "Nao foi possivel buscar participante.", "error");
  }
}

function renderStats(stats) {
  if (!stats || !stats.ok) {
    throw new Error((stats && stats.error) || "Nao foi possivel carregar o painel.");
  }

  els.confirmedCount.textContent = formatNumber(stats.confirmed);
  els.pendingCount.textContent = formatNumber(stats.pending);
  els.totalCount.textContent = formatNumber(stats.total);
  els.confirmedRate.textContent = `${stats.confirmedRate || 0}% do total`;
  els.pendingRate.textContent = `${stats.pendingRate || 0}% do total`;
  els.confirmedBar.style.width = `${Math.min(stats.confirmedRate || 0, 100)}%`;
  els.pendingBar.style.width = `${Math.min(stats.pendingRate || 0, 100)}%`;
  els.updatedAt.textContent = `Atualizado ${stats.updatedAt || "--:--"}`;

  renderHourlyChart(stats.hourly || []);
  renderCompanies(stats.companies || [], stats.total || 0);
  renderRecent(stats.recent || []);
}

function renderPrintQueueStats(stats) {
  if (!stats || !stats.ok) {
    throw new Error((stats && stats.error) || "Nao foi possivel carregar a fila.");
  }

  els.queueWaitingCount.textContent = formatNumber(stats.aguardando);
  els.queuePrintingCount.textContent = formatNumber(stats.imprimindo);
  els.queuePrintedCount.textContent = formatNumber(stats.impresso);
  els.queueErrorCount.textContent = formatNumber(stats.erro);
  els.printQueueUpdatedAt.textContent = `Atualizado ${
    stats.updatedAt ||
    new Date().toLocaleTimeString("pt-BR", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }`;
  renderPrintingControl(stats.printingEnabled !== false);
  renderSystemPrintingStatus(stats.printingEnabled !== false);
  renderPrintQueueList(stats.jobs || []);
}

function renderPrintingControl(isEnabled) {
  els.queueControls.classList.toggle("is-active", isEnabled);
  els.queueControls.classList.toggle("is-paused", !isEnabled);
  els.startPrintingButton.disabled = isEnabled;
  els.stopPrintingButton.disabled = !isEnabled;
  els.printingControlStatus.textContent = isEnabled
    ? "Impressao ativa"
    : "Impressao pausada";
}

function formatSystemDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderSystemPrintingStatus(isEnabled) {
  if (!els.systemPrintingStatus) {
    return;
  }

  els.systemPrintingStatus.textContent = isEnabled ? "Ativa" : "Pausada";
  els.systemPrintingStatus.classList.toggle("is-ok", isEnabled);
  els.systemPrintingStatus.classList.toggle("is-paused", !isEnabled);
}

function renderSimulatedWorkerControl(isEnabled) {
  if (!els.simulatedWorkerStatus) {
    return;
  }

  els.simulatedWorkerStatus.textContent = isEnabled ? "Ativa" : "Pausada";
  els.simulatedWorkerStatus.classList.toggle("is-ok", isEnabled);
  els.simulatedWorkerStatus.classList.toggle("is-paused", !isEnabled);
  els.enableSimulatedWorkerButton.disabled = isEnabled;
  els.disableSimulatedWorkerButton.disabled = !isEnabled;
}

function renderSystemStatus(status) {
  if (!status || !status.ok) {
    throw new Error((status && status.error) || "Nao foi possivel carregar o status.");
  }

  els.systemVersion.textContent = status.version || "dev";
  els.systemBuildTime.textContent = formatSystemDate(status.buildTime);
  els.systemDataSource.textContent = status.fonteDadosAtiva || "--";
  els.systemAdminAuth.textContent = status.adminAuthEnabled ? "Protegido" : "Aberto";
  els.systemDatabase.textContent = status.databaseExists ? "Encontrado" : "Ausente";
  renderSimulatedWorkerControl(status.simulatedWorkerEnabled !== false);
  els.systemLastBackup.textContent = status.lastBackup
    ? `${status.backupCount || 0} backup(s) - ${status.lastBackup.name}`
    : `${status.backupCount || 0} backup(s)`;
  els.systemStatusUpdatedAt.textContent = `Atualizado ${formatSystemDate(status.updatedAt)}`;
}

function renderHourlyChart(values) {
  const width = 320;
  const height = 150;
  const padding = 22;
  const maxValue = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / 23;
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return [x, y];
  });
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const grid = [0, 1, 2, 3]
    .map((item) => {
      const y = padding + item * 32;
      return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#e9edf6" />`;
    })
    .join("");

  els.hourlyChart.innerHTML = `
    ${grid}
    <polygon points="${area}" fill="rgba(47, 107, 255, 0.14)"></polygon>
    <polyline points="${line}" fill="none" stroke="#2f6bff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <text x="${padding}" y="146" fill="#68708a" font-size="10">00h</text>
    <text x="146" y="146" fill="#68708a" font-size="10">12h</text>
    <text x="276" y="146" fill="#68708a" font-size="10">23h</text>
  `;
}

function renderCompanies(companies, total) {
  if (!companies.length) {
    els.companyList.innerHTML = `<div class="empty-state">Nenhuma empresa registrada ainda.</div>`;
    return;
  }

  els.companyList.innerHTML = companies
    .map((company) => {
      const width = total ? Math.max((company.count / total) * 100, 4) : 0;
      return `
        <div class="company-row">
          <span>${company.name}</span>
          <div class="company-bar"><i style="width: ${width}%"></i></div>
          <span class="company-value">${company.count} (${company.rate}%)</span>
        </div>
      `;
    })
    .join("");
}

function getInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function renderPrintQueueList(jobs) {
  const printingJobs = jobs.filter((job) => job.status === "imprimindo agora");
  const nextLimit = 3;
  const reservedJobs = jobs.filter((job) => job.status === "próximo da fila");
  const waitingJobs = jobs.filter((job) => job.status === "aguardando");
  const visibleNextJobs = reservedJobs.concat(waitingJobs).slice(0, nextLimit);
  const visibleNextIds = new Set(visibleNextJobs.map((job) => job.id));
  const remainingJobs = waitingJobs.filter((job) => !visibleNextIds.has(job.id)).slice(0, 10);

  els.printQueuePrintingList.innerHTML = printingJobs.length
    ? printingJobs.map((job) => renderPrintQueueRow(job, "printing")).join("")
    : `<div class="empty-state">Nenhuma etiqueta imprimindo agora.</div>`;
  els.printQueueNextList.innerHTML = visibleNextJobs.length
    ? visibleNextJobs.map((job) => renderPrintQueueRow(job, "next")).join("")
    : `<div class="empty-state">Nenhuma etiqueta aguardando.</div>`;
  els.printQueueWaitingList.innerHTML = remainingJobs.length
    ? remainingJobs.map((job) => renderPrintQueueRow(job, "waiting")).join("")
    : `<div class="empty-state">Fila de espera vazia.</div>`;
}

function renderPrintQueueRow(job, variant) {
  const badgeName = job.badgeName || "Participante";
  const position = job.queuePosition || "-";
  const statusLabel = variant === "printing" ? "Imprimindo agora" : variant === "next" ? "Próximo da fila" : "Aguardando";
  const number = variant === "printing" ? "" : `#${position}`;
  const printerName = formatPrinterName(job.printer);
  const pickupText = getQueuePickupText(job, variant, printerName);

  return `
    <article class="queue-item is-${variant}">
      ${number ? `<div class="queue-position">${number}</div>` : `<div class="queue-person-icon" aria-hidden="true"></div>`}
      <div class="queue-name">
        <strong>${badgeName}</strong>
        ${pickupText ? `<span class="queue-printer">${pickupText.replace(/^ - /, "")}</span>` : ""}
        ${variant === "next" ? "<span>Próximo atendimento</span>" : ""}
      </div>
      <div class="queue-meta">
        <div class="queue-pill is-${variant}">${statusLabel}</div>
      </div>
    </article>
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

function renderRecent(recent) {
  if (!recent.length) {
    els.recentList.innerHTML = `<div class="empty-state">Nenhuma entrada confirmada ainda.</div>`;
    return;
  }

  els.recentList.innerHTML = recent
    .map(
      (item) => `
        <article class="recent-item" data-lookup="${item.email || ""}">
          <div class="avatar">${getInitials(item.name)}</div>
          <div>
            <button class="recent-name-button" type="button">${item.name}</button>
            <span>${item.email || "Sem email"} · Nº ${item.number}</span>
          </div>
          <div class="recent-meta">
            <span>${item.time || "--:--"}</span>
            <div class="pill">Confirmado</div>
          </div>
        </article>
      `,
    )
    .join("");
}

async function loadStats() {
  els.updatedAt.textContent = "Atualizando...";
  els.refreshButton.disabled = true;

  try {
    renderStats(await getStats());
  } catch (error) {
    els.updatedAt.textContent = error.message;
  } finally {
    els.refreshButton.disabled = false;
  }
}

async function loadPrintQueueStats() {
  try {
    renderPrintQueueStats(await getPrintQueueStats());
  } catch (error) {
    els.printQueueUpdatedAt.textContent = error.message || "Falha ao atualizar";
    console.error(error);
  }
}

async function loadFonteDadosAtiva() {
  try {
    const config = await getFonteDadosAtiva();
    if (!config || !config.ok) {
      throw new Error((config && config.error) || "Falha ao ler fonte ativa.");
    }
    renderDataSource(config.fonteDadosAtiva);
  } catch (error) {
    els.dataSourceStatus.textContent = error.message || "Falha ao verificar fonte.";
  }
}

async function loadSystemStatus() {
  if (!els.systemStatusUpdatedAt) {
    return;
  }

  try {
    renderSystemStatus(await getSystemStatus());
  } catch (error) {
    els.systemStatusUpdatedAt.textContent = error.message || "Falha ao atualizar";
  }
}

function renderDataSource(fonte) {
  const isSqlite = fonte === "SQLITE";
  els.sqliteSourceButton.classList.toggle("is-active", isSqlite);
  els.googleSheetsSourceButton.classList.toggle("is-active", !isSqlite);
  els.sqliteSourceButton.setAttribute("aria-pressed", String(isSqlite));
  els.googleSheetsSourceButton.setAttribute("aria-pressed", String(!isSqlite));
  els.dataSourceStatus.textContent = isSqlite
    ? "Fonte ativa: SQLite local"
    : "Fonte ativa: Google Sheets";
  els.uploadParticipantsButton.disabled = !isSqlite;
  els.uploadParticipantsStatus.textContent = isSqlite
    ? "Importe CSV/XLSX exportado do Sympla"
    : "Upload disponível quando SQLite estiver ativo";
}

els.refreshButton.addEventListener("click", () => {
  loadStats();
  loadPrintQueueStats();
  loadFonteDadosAtiva();
  loadSystemStatus();
  if (currentAdminView === "teste-impressao") {
    loadPrintTestInfo();
  }
});

window.addEventListener("focus", () => {
  loadStats();
  loadPrintQueueStats();
  loadSystemStatus();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadStats();
    loadPrintQueueStats();
    loadSystemStatus();
  }
});

async function changeDataSource(fonte) {
  els.sqliteSourceButton.disabled = true;
  els.googleSheetsSourceButton.disabled = true;
  els.dataSourceStatus.textContent =
    fonte === "SQLITE" ? "Ativando SQLite..." : "Ativando Google Sheets...";

  try {
    const result = await setFonteDadosAtiva(fonte);
    if (!result || !result.ok) {
      throw new Error((result && result.error) || "Falha ao alterar fonte de dados.");
    }
    renderDataSource(result.fonteDadosAtiva);
    loadStats();
    loadPrintQueueStats();
    loadSystemStatus();
  } catch (error) {
    els.dataSourceStatus.textContent = error.message || "Falha ao alterar fonte.";
  } finally {
    els.sqliteSourceButton.disabled = false;
    els.googleSheetsSourceButton.disabled = false;
  }
}

els.sqliteSourceButton.addEventListener("click", () => changeDataSource("SQLITE"));
els.googleSheetsSourceButton.addEventListener("click", () => changeDataSource("GOOGLE_SHEETS"));

async function changePrintingEnabled(enabled) {
  els.startPrintingButton.disabled = true;
  els.stopPrintingButton.disabled = true;
  els.printingControlStatus.textContent = enabled
    ? "Iniciando impressao..."
    : "Pausando impressao...";

  try {
    const result = await setPrintingEnabled(enabled);
    if (!result || !result.ok) {
      throw new Error((result && result.error) || "Falha ao alterar impressao.");
    }
    renderPrintingControl(result.printingEnabled);
    loadPrintQueueStats();
  } catch (error) {
    els.printingControlStatus.textContent = error.message || "Falha ao alterar impressao.";
    loadPrintQueueStats();
  }
}

els.startPrintingButton.addEventListener("click", () => changePrintingEnabled(true));
els.stopPrintingButton.addEventListener("click", () => changePrintingEnabled(false));

els.printTestQuantity.addEventListener("change", () => {
  const max = Number(els.printTestQuantity.max || 1);
  const value = Math.min(Math.max(Number(els.printTestQuantity.value || 1), 1), max);
  els.printTestQuantity.value = String(value);
});

els.printTestDelaySeconds.addEventListener("change", () => {
  const value = Math.min(Math.max(Number(els.printTestDelaySeconds.value || 3), 1), 10);
  els.printTestDelaySeconds.value = String(Math.round(value));
});

els.startPrintTestButton.addEventListener("click", async () => {
  const quantity = Number(els.printTestQuantity.value || 0);
  const delaySeconds = Math.min(
    Math.max(Math.round(Number(els.printTestDelaySeconds.value || 3)), 1),
    10,
  );
  if (!Number.isInteger(quantity) || quantity < 1) {
    setPrintTestMessage("Informe uma quantidade válida.", "error");
    return;
  }
  const confirmed = window.confirm(
    `Este teste confirmará ${quantity} participante(s) e simulará ${delaySeconds} segundo(s) por etiqueta. Continuar?`,
  );
  if (!confirmed) {
    return;
  }

  els.startPrintTestButton.disabled = true;
  els.printTestQuantity.disabled = true;
  els.printTestDelaySeconds.disabled = true;
  setPrintTestMessage("Criando lote e iniciando impressão...", null);
  try {
    const result = await startPrintTest(quantity, delaySeconds);
    if (!result || !result.ok) {
      throw new Error((result && result.error) || "Falha ao iniciar o teste.");
    }
    currentPrintTestBatchId = result.batchId;
    els.printTestStatusText.textContent = "Teste em andamento";
    setPrintTestMessage(
      `Lote iniciado com ${result.total} participante(s) e ${result.delaySeconds}s por etiqueta.`,
      "success",
    );
    schedulePrintTestPoll(0);
    loadStats();
    loadPrintQueueStats();
  } catch (error) {
    setPrintTestMessage(error.message || "Não foi possível iniciar o teste.", "error");
    loadPrintTestInfo();
  }
});

els.clearDashboardButton.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Isso remove os inscritos importados do SQLite e limpa toda a fila. Continuar?",
  );

  if (!confirmed) {
    return;
  }

  els.clearDashboardButton.disabled = true;
  els.clearDashboardStatus.textContent = "Limpando indicadores...";

  try {
    const result = await limparIndicadores();
    if (!result || !result.ok) {
      throw new Error((result && result.error) || "Falha ao limpar indicadores.");
    }

    els.clearDashboardStatus.textContent = "Indicadores limpos.";
    loadStats();
    loadPrintQueueStats();
  } catch (error) {
    els.clearDashboardStatus.textContent = error.message || "Falha ao limpar indicadores.";
  } finally {
    els.clearDashboardButton.disabled = false;
  }
});

els.uploadParticipantsButton.addEventListener("click", openUploadParticipantsModal);

els.closeUploadParticipantsModal.addEventListener("click", closeUploadParticipantsModal);

els.uploadParticipantsModal.addEventListener("click", (event) => {
  if (event.target === els.uploadParticipantsModal) {
    closeUploadParticipantsModal();
  }
});

els.participantsFileInput.addEventListener("change", () => {
  const file = els.participantsFileInput.files[0];
  els.participantsFileName.textContent = file ? file.name : "Selecionar arquivo CSV/XLSX";
});

els.createBackupButton.addEventListener("click", async () => {
  els.createBackupButton.disabled = true;
  els.createBackupStatus.textContent = "Criando backup...";

  try {
    const result = await createManualBackup();
    if (!result || !result.ok) {
      throw new Error((result && result.error) || "Falha ao criar backup.");
    }

    const backupName = result.backup && result.backup.name ? result.backup.name : "backup criado";
    els.createBackupStatus.textContent = `Backup criado: ${backupName}`;
    loadSystemStatus();
  } catch (error) {
    els.createBackupStatus.textContent = error.message || "Falha ao criar backup.";
  } finally {
    els.createBackupButton.disabled = false;
  }
});

async function changeSimulatedWorkerEnabled(enabled) {
  els.enableSimulatedWorkerButton.disabled = true;
  els.disableSimulatedWorkerButton.disabled = true;
  els.createBackupStatus.textContent = enabled
    ? "Ativando simulação VPS..."
    : "Pausando simulação VPS...";

  try {
    const result = await setSimulatedWorkerEnabled(enabled);
    if (!result || !result.ok) {
      throw new Error((result && result.error) || "Falha ao alterar simulação VPS.");
    }

    renderSimulatedWorkerControl(result.simulatedWorkerEnabled);
    els.createBackupStatus.textContent = result.simulatedWorkerEnabled
      ? "Simulação VPS ativa."
      : "Simulação VPS pausada. O worker do PC pode consumir a fila.";
    loadSystemStatus();
    loadPrintQueueStats();
  } catch (error) {
    els.createBackupStatus.textContent = error.message || "Falha ao alterar simulação VPS.";
    loadSystemStatus();
  }
}

els.enableSimulatedWorkerButton.addEventListener("click", () => changeSimulatedWorkerEnabled(true));
els.disableSimulatedWorkerButton.addEventListener("click", () => changeSimulatedWorkerEnabled(false));

els.adminBadgeNameInput.addEventListener("input", () => {
  updateAdminLabelPreview();
});

els.adminCompanyInput.addEventListener("input", () => {
  updateAdminLabelPreview();
});

els.uploadParticipantsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = els.participantsFileInput.files[0];
  if (!file) {
    setUploadMessage("Selecione um arquivo CSV ou XLSX.", "error");
    return;
  }

  els.submitParticipantsUpload.disabled = true;
  els.uploadParticipantsStatus.textContent = "Importando participantes...";
  setUploadMessage("Lendo arquivo e gravando participantes...", null);

  try {
    const result = await uploadParticipants(file);
    const message = `${result.processed} processados, ${result.inserted} novos, ${result.updated} atualizados, ${result.errors} erros.`;
    els.uploadParticipantsStatus.textContent = message;
    setUploadMessage(message, "success");
    els.uploadParticipantsButton.hidden = true;
    window.setTimeout(closeUploadParticipantsModal, 700);
    loadStats();
    loadPrintQueueStats();
  } catch (error) {
    const message = error.message || "Falha ao importar participantes.";
    els.uploadParticipantsStatus.textContent = message;
    setUploadMessage(message, "error");
  } finally {
    els.submitParticipantsUpload.disabled = false;
  }
});

els.participantSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchParticipant(els.participantSearchInput.value);
});

els.adminConfirmButton.addEventListener("click", async () => {
  if (!currentLookup) {
    setAdminMessage("Pesquise um participante antes de confirmar.", "error");
    return;
  }

  const isReprint = Boolean(currentParticipant && currentParticipant.confirmed);
  setAdminMessage(isReprint ? "Reenviando etiqueta para fila..." : "Confirmando entrada...", null);
  els.adminConfirmButton.disabled = true;

  try {
    const participant = isReprint
      ? await reprintParticipant(currentLookup)
      : await confirmParticipant(currentLookup);

    if (!participant || !participant.found) {
      setAdminMessage("Participante nao encontrado.", "error");
      return;
    }

    fillParticipantForm(participant, normalizeLookup(participant.email || currentLookup));
    const position = participant.printJob && participant.printJob.position;
    const message = position
      ? isReprint
        ? `Etiqueta reenviada para fila de impressao. Posicao: ${position}.`
        : `Etiqueta enviada para fila de impressao. Posicao: ${position}.`
      : participant.alreadyConfirmed
        ? `Entrada ja estava confirmada em ${participant.confirmedAt}. A etiqueta nao foi reenviada para a fila.`
        : `Entrada confirmada em ${participant.confirmedAt}.`;
    setAdminMessage(
      message,
      "success",
    );
    loadStats();
    loadPrintQueueStats();
    loadSystemStatus();
  } catch (error) {
    setAdminMessage(error.message || "Nao foi possivel concluir a acao.", "error");
    els.adminConfirmButton.disabled = false;
  }
});

els.recentList.addEventListener("click", (event) => {
  const item = event.target.closest(".recent-item");

  if (!item || !item.dataset.lookup) {
    return;
  }

  els.participantSearchInput.value = item.dataset.lookup;
  searchParticipant(item.dataset.lookup);
});

els.adminSidebarButtons.forEach((button) => {
  button.addEventListener("click", () => setAdminView(button.dataset.adminView));
});

setAdminView("checkin");
loadStats();
loadPrintQueueStats();
loadFonteDadosAtiva();
loadSystemStatus();
window.setInterval(loadPrintQueueStats, PRINT_QUEUE_REFRESH_MS);
window.setInterval(loadSystemStatus, PRINT_QUEUE_REFRESH_MS);
