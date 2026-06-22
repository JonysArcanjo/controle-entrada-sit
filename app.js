const SHEETS_ENDPOINT =
  "http://127.0.0.1:8020/api";
const APP_TIME_ZONE = "America/Fortaleza";

const demoParticipants = [
  {
    name: "Ana Beatriz Silva",
    number: "001",
    email: "ana@example.com",
    cpf: "12345678909",
  },
  {
    name: "Carlos Henrique Souza",
    number: "002",
    email: "carlos@example.com",
    cpf: "98765432100",
  },
];

const form = document.querySelector("#checkinForm");
const input = document.querySelector("#lookupInput");
const badgeNameInput = document.querySelector("#badgeNameInput");
const companyInput = document.querySelector("#companyInput");
const submitButton = document.querySelector("#submitButton");
const messageArea = document.querySelector("#messageArea");
const resultCard = document.querySelector("#resultCard");
const participantName = document.querySelector("#participantName");
const participantCompany = document.querySelector("#participantCompany");
const participantNumber = document.querySelector("#participantNumber");
const labelName = document.querySelector("#labelName");
const labelCompany = document.querySelector("#labelCompany");
const labelNumber = document.querySelector("#labelNumber");
const printButton = document.querySelector("#printButton");
const connectionStatus = document.querySelector("#connectionStatus");

let currentParticipant = null;
let currentLookup = "";

function normalizeCpf(value) {
  return value.replace(/\D/g, "");
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function normalizeLookup(value) {
  const trimmed = value.trim();
  return trimmed.includes("@") ? normalizeEmail(trimmed) : normalizeCpf(trimmed);
}

function isValidLookup(value) {
  const trimmed = value.trim();

  if (trimmed.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  return normalizeCpf(trimmed).length === 11;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
}

function setSubmitLoadingText(text) {
  const loadingText = submitButton.querySelector(".button-loading");

  if (loadingText) {
    loadingText.textContent = text;
  }
}

function setMessage(text, type) {
  messageArea.textContent = text;
  messageArea.className = "message";

  if (type) {
    messageArea.classList.add(`is-${type}`);
  }
}

function clearResult() {
  currentParticipant = null;
  currentLookup = "";
  submitButton.hidden = false;
  resultCard.hidden = true;
  badgeNameInput.value = "";
  companyInput.value = "";
  participantName.textContent = "";
  participantCompany.textContent = "";
  participantCompany.hidden = true;
  participantNumber.textContent = "";
  labelName.textContent = "";
  labelCompany.textContent = "";
  labelNumber.textContent = "";
}

function getSuggestedBadgeName(participant) {
  return (
    participant.badgeNameSuggested ||
    [participant.name, participant.surname].filter(Boolean).join(" ").trim() ||
    participant.name ||
    ""
  );
}

function isSqliteEndpoint() {
  try {
    return new URL(SHEETS_ENDPOINT, window.location.href).pathname === "/api";
  } catch (error) {
    return false;
  }
}

function showParticipant(participant, options = {}) {
  if (options.prefillBadgeName) {
    badgeNameInput.value = getSuggestedBadgeName(participant);
  }

  if (options.prefillCompany) {
    companyInput.value = participant.company || "";
  }

  const displayName = badgeNameInput.value.trim() || participant.name;
  const displayCompany = companyInput.value.trim() || participant.company || "";

  currentParticipant = participant;
  participantName.textContent = displayName;
  participantCompany.textContent = displayCompany;
  participantCompany.hidden = !displayCompany;
  participantNumber.textContent = participant.number;
  labelName.textContent = displayName;
  labelCompany.textContent = displayCompany;
  labelNumber.textContent = participant.number;
  resultCard.hidden = false;
  printButton.textContent = participant.confirmed
    ? "Entrada ja confirmada"
    : "Confirmar entrada e enviar para impressao";
  printButton.disabled = Boolean(participant.confirmed);
}

function looksLikePhoneNumber(value) {
  return /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(String(value).trim());
}

function findDemoParticipant(lookup) {
  const participant = demoParticipants.find((item) => {
    return normalizeEmail(item.email) === lookup || normalizeCpf(item.cpf) === lookup;
  });

  return participant ? { ...participant, confirmed: false, confirmedAt: "" } : null;
}

async function findParticipant(lookup) {
  if (!SHEETS_ENDPOINT) {
    return findDemoParticipant(lookup);
  }

  const data = await getParticipantData(lookup);

  if (!data || !data.found) {
    return null;
  }

  if (looksLikePhoneNumber(data.number)) {
    throw new Error(
      "A fonte de dados ainda esta retornando telefone no campo de sorteio. Atualize a base SQLite.",
    );
  }

  return {
    name: data.name,
    surname: data.surname || "",
    badgeName: data.badgeName || "",
    badgeNameSuggested:
      data.badgeNameSuggested ||
      [data.name, data.surname].filter(Boolean).join(" ").trim() ||
      data.name,
    number: data.number,
    company: data.company || "",
    confirmed: Boolean(data.confirmed),
    confirmedAt: data.confirmedAt || "",
  };
}

async function confirmParticipant(lookup) {
  const company = companyInput.value.trim();
  const badgeName = badgeNameInput.value.trim();

  if (!SHEETS_ENDPOINT) {
    return {
      ...currentParticipant,
      company,
      confirmed: true,
      confirmedAt: new Date().toLocaleString("pt-BR", { timeZone: APP_TIME_ZONE }),
      printJob: {
        id: "demo",
        status: "aguardando",
        position: 1,
      },
      alreadyConfirmed: false,
    };
  }

  const data = await getParticipantData(lookup, "confirm", { company, badgeName });

  if (!data || !data.found) {
    throw new Error("Participante nao encontrado para confirmar entrada.");
  }

  if (looksLikePhoneNumber(data.number)) {
    throw new Error(
      "A fonte de dados ainda esta retornando telefone no campo de sorteio. Atualize a base SQLite.",
    );
  }

  return {
    name: data.name,
    surname: data.surname || "",
    badgeName: data.badgeName || "",
    badgeNameSuggested:
      data.badgeNameSuggested ||
      [data.name, data.surname].filter(Boolean).join(" ").trim() ||
      data.name,
    number: data.number,
    company: data.company || "",
    confirmed: Boolean(data.confirmed),
    confirmedAt: data.confirmedAt || "",
    printJob: data.printJob || null,
    alreadyConfirmed: Boolean(data.alreadyConfirmed),
  };
}

function getApiUrl(params = {}) {
  const base =
    SHEETS_ENDPOINT.startsWith("/") && window.location.protocol === "file:"
      ? "http://127.0.0.1:8020/api"
      : SHEETS_ENDPOINT;
  const url = new URL(base, window.location.href);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function getParticipantData(lookup, action = "lookup", extraParams = {}) {
  if (isSqliteEndpoint()) {
    return fetchParticipantFromSQLite(lookup, action, extraParams);
  }

  return getParticipantFromJsonp(lookup, action, extraParams);
}

async function fetchParticipantFromSQLite(lookup, action = "lookup", extraParams = {}) {
  const url = getApiUrl({ lookup, action, ...extraParams });
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error("Nao foi possivel consultar o SQLite local. Rode python3 server.py e abra http://127.0.0.1:8020/index.html.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    throw new Error("Resposta invalida da API SQLite local.");
  }

  if (data.ok === false) {
    throw new Error(data.error || "Falha ao consultar o SQLite local.");
  }

  return data;
}

async function updateConnectionStatus() {
  if (!SHEETS_ENDPOINT) {
    connectionStatus.textContent = "Demo";
    connectionStatus.classList.add("is-demo");
    return;
  }

  try {
    const url = getApiUrl({ action: "getFonteDadosAtiva" });
    const response = await fetch(url);
    const data = await response.json();
    connectionStatus.textContent =
      data && data.fonteDadosAtiva === "SQLITE" ? "SQLite" : "Sheets";
    connectionStatus.classList.add("is-ready");
  } catch (error) {
    connectionStatus.textContent = isSqliteEndpoint() ? "SQLite" : "Online";
    connectionStatus.classList.add("is-ready");
  }
}

function getParticipantFromJsonp(lookup, action = "lookup", extraParams = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `handleSheetLookup_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao consultar a fonte de dados."));
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

    const url = getApiUrl({ lookup, action, callback: callbackName, ...extraParams });

    script.src = url.toString();
    script.onerror = () => {
      cleanup();
      reject(
        new Error(
          "Nao foi possivel consultar a fonte de dados. Verifique se a URL configurada esta ativa.",
        ),
      );
    };

    document.body.appendChild(script);
  });
}

async function confirmCurrentParticipant() {
  if (!currentParticipant || !currentLookup) {
    return;
  }

  if (currentParticipant.confirmed) {
    setMessage("Reimpressao bloqueada nesta tela. Procure a organizacao.", "error");
    return;
  }

  if (!badgeNameInput.value.trim()) {
    setMessage("Digite o nome para o cracha para continuar.", "error");
    badgeNameInput.focus();
    return;
  }

  setLoading(true);
  setSubmitLoadingText("Enviando");
  printButton.disabled = true;
  printButton.textContent = "Enviando para fila...";

  try {
    const participant = await confirmParticipant(currentLookup);
    showParticipant(participant);
    const position = participant.printJob && participant.printJob.position;
    setMessage(
      position
        ? `Entrada confirmada. Etiqueta na fila de impressao. Posicao: ${position}.`
        : `Entrada confirmada em ${participant.confirmedAt}. Etiqueta enviada para impressao.`,
      "success",
    );
  } catch (error) {
    setMessage(error.message || "Nao foi possivel confirmar a entrada.", "error");
    printButton.textContent = "Confirmar entrada e enviar para impressao";
  } finally {
    setLoading(false);
    setSubmitLoadingText("Buscando");
    printButton.disabled = Boolean(currentParticipant && currentParticipant.confirmed);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const lookup = normalizeLookup(input.value);

  if (!lookup) {
    setMessage("Digite um e-mail ou CPF para continuar.", "error");
    input.focus();
    return;
  }

  if (!isValidLookup(input.value)) {
    setMessage("Digite um e-mail valido ou CPF com 11 digitos. Exemplo: 451.462.704-82.", "error");
    input.focus();
    input.select();
    return;
  }

  clearResult();
  setLoading(true);
  setSubmitLoadingText("Buscando");
  setMessage("Consultando cadastro...", null);

  try {
    const participant = await findParticipant(lookup);

    if (!participant) {
      setMessage("E-mail ou CPF nao cadastrado. Confira os dados e tente novamente.", "error");
      input.select();
      return;
    }

    currentLookup = lookup;
    showParticipant(participant, { prefillBadgeName: true, prefillCompany: true });
    submitButton.hidden = true;
    setMessage(
      participant.confirmed
        ? `Entrada ja confirmada em ${participant.confirmedAt}. Procure a organizacao para reimprimir.`
        : "Cadastro encontrado. Confira os dados e confirme a entrada para imprimir a etiqueta.",
      participant.confirmed ? "error" : "success",
    );
    if (!participant.confirmed) {
      badgeNameInput.focus();
      badgeNameInput.select();
    }
  } catch (error) {
    setMessage(error.message || "Erro ao consultar cadastro. Tente novamente.", "error");
  } finally {
    setLoading(false);
  }
});

printButton.addEventListener("click", async () => {
  await confirmCurrentParticipant();
});

badgeNameInput.addEventListener("input", () => {
  if (currentParticipant) {
    showParticipant(currentParticipant);
  }
});

companyInput.addEventListener("input", () => {
  if (currentParticipant) {
    showParticipant(currentParticipant);
  }
});

updateConnectionStatus();
