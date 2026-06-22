const SPREADSHEET_ID = "1STSzxIJnqEAFfvJcQVeRGEdwjQNtjqzPNFmeshO6x40";
const SHEET_NAME = "Participantes";
const PRINT_QUEUE_SHEET_NAME = "Fila Impressao";
const SYMPLA_API_BASE = "https://api.sympla.com.br/public/v1.5.1";
const TIMEZONE = "America/Fortaleza";

function doGet(event) {
  const params = (event && event.parameter) || {};
  const action = String(params.action || "lookup").trim();
  const callback = String(params.callback || "").trim();
  const lock = LockService.getScriptLock();
  let result;

  try {
    lock.waitLock(5000);
    result = handleAction(action, params);
  } catch (error) {
    result = {
      ok: false,
      found: false,
      error: error.message || "Erro ao consultar cadastro.",
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // The lock may not have been acquired.
    }
  }

  return createResponse(result, callback);
}

function handleAction(action, params) {
  if (action === "stats") {
    return getEventStats();
  }

  if (action === "syncSympla") {
    return syncSymplaParticipants();
  }

  if (action === "claimPrintJob") {
    return claimPrintJob(String(params.printer || "").trim());
  }

  if (action === "completePrintJob") {
    return completePrintJob(String(params.jobId || "").trim(), String(params.printer || "").trim());
  }

  if (action === "failPrintJob") {
    return failPrintJob(
      String(params.jobId || "").trim(),
      String(params.printer || "").trim(),
      String(params.error || "").trim(),
    );
  }

  if (action === "printQueueStats") {
    return getPrintQueueStats();
  }

  if (action === "printQueue") {
    return getPrintQueueSnapshot(Number(params.limit || 8));
  }

  return findParticipant(normalizeLookup(params.lookup || ""), {
    shouldConfirm: action === "confirm",
    company: String(params.company || "").trim(),
    badgeName: String(params.badgeName || "").trim(),
    enqueuePrint: action === "confirm",
  });
}

function createResponse(result, callback) {
  const json = JSON.stringify(result);

  if (callback) {
    return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }

  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function findParticipant(lookup, options) {
  if (!lookup) {
    return { found: false };
  }

  const shouldConfirm = Boolean(options && options.shouldConfirm);
  const shouldEnqueuePrint = Boolean(options && options.enqueuePrint);
  const companyFromForm = String((options && options.company) || "").trim();
  const badgeNameFromForm = String((options && options.badgeName) || "").trim();
  const sheet = getParticipantSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length < 1) {
    return { found: false, error: "A aba de participantes esta sem cabecalhos." };
  }

  const headers = normalizeHeaders(values[0]);
  const rows = values.slice(1);
  const indexes = getParticipantLookupIndexes(sheet, headers);
  const raffleNumbers = ensureUniqueRaffleNumbers(
    sheet,
    rows,
    indexes.sorteio,
    indexes.nome,
    indexes.email,
    indexes.cpf,
  );

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const email = normalizeEmail(row[indexes.email] || "");
    const cpf = normalizeCpf(row[indexes.cpf] || "");

    if (email !== lookup && cpf !== lookup) {
      continue;
    }

    const currentConfirmedAt = normalizeConfirmedAt(row[indexes.confirmadoEm] || "");
    const storedCompany = String(row[indexes.empresa] || "").trim();
    const company = shouldConfirm
      ? saveCompany(sheet, index, indexes.empresa, companyFromForm, storedCompany)
      : storedCompany;
    const confirmedAt = shouldConfirm
      ? confirmParticipant(sheet, index, indexes.confirmadoEm, currentConfirmedAt)
      : currentConfirmedAt;
    const symplaCheckinAt = shouldConfirm
      ? confirmSymplaIfPossible(sheet, index, row, indexes.symplaParticipantId, indexes.symplaCheckinAt)
      : String(row[indexes.symplaCheckinAt] || "").trim();
    const name = String(row[indexes.nome] || "").trim();
    const surname = String(row[indexes.sobrenome] || "").trim();
    const badgeNameSuggested = buildBadgeName(name, surname);
    const printJob =
      shouldEnqueuePrint && !currentConfirmedAt
        ? enqueuePrintJob({
            participantEmail: String(row[indexes.email] || "").trim(),
            participantCpf: String(row[indexes.cpf] || "").trim(),
            badgeName: badgeNameFromForm || badgeNameSuggested,
            company,
            raffleNumber: raffleNumbers[index],
          })
        : null;

    return {
      found: true,
      name,
      surname,
      email: String(row[indexes.email] || "").trim(),
      cpf: String(row[indexes.cpf] || "").trim(),
      company,
      number: raffleNumbers[index],
      confirmed: Boolean(confirmedAt),
      confirmedAt,
      symplaCheckinAt,
      printJob,
      badgeNameSuggested,
      alreadyConfirmed: Boolean(shouldConfirm && currentConfirmedAt),
    };
  }

  return { found: false };
}

function getParticipantSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];

  if (!sheet) {
    throw new Error("Nenhuma aba encontrada na planilha.");
  }

  return sheet;
}

function getParticipantLookupIndexes(sheet, headers) {
  const indexes = {
    nome: headers.indexOf("nome"),
    sobrenome: ensureColumn(sheet, headers, "sobrenome"),
    email: headers.indexOf("email"),
    cpf: headers.indexOf("cpf"),
    empresa: ensureColumn(sheet, headers, "empresa"),
    sorteio: ensureColumn(sheet, headers, "sorteio"),
    confirmadoEm: ensureColumn(sheet, headers, "confirmado_em"),
    symplaParticipantId: ensureColumn(sheet, headers, "sympla_participant_id"),
    symplaCheckinAt: ensureColumn(sheet, headers, "sympla_checkin_at"),
  };

  if ([indexes.nome, indexes.email, indexes.cpf].indexOf(-1) >= 0) {
    throw new Error("Cabecalhos esperados na aba Participantes: nome, email, cpf.");
  }

  return indexes;
}

function buildBadgeName(name, surname) {
  return [name, surname].filter(Boolean).join(" ").trim();
}

function confirmParticipant(sheet, rowIndex, confirmedAtIndex, currentConfirmedAt) {
  if (currentConfirmedAt) {
    return currentConfirmedAt;
  }

  const confirmedAt = formatDateTime(new Date());
  sheet.getRange(rowIndex + 2, confirmedAtIndex + 1).setValue(confirmedAt);
  return confirmedAt;
}

function saveCompany(sheet, rowIndex, companyIndex, companyFromForm, storedCompany) {
  if (!companyFromForm) {
    return storedCompany;
  }

  sheet.getRange(rowIndex + 2, companyIndex + 1).setValue(companyFromForm);
  return companyFromForm;
}

function enqueuePrintJob(job) {
  const sheet = getPrintQueueSheet();
  const headers = getPrintQueueHeaders(sheet);
  const jobId = Utilities.getUuid();
  const createdAt = formatDateTime(new Date());
  const row = [];
  const headerCount = Object.keys(headers).reduce(function (max, name) {
    return Math.max(max, headers[name] + 1);
  }, 0);

  row[headers.id] = jobId;
  row[headers.participante_email] = job.participantEmail || "";
  row[headers.participante_cpf] = job.participantCpf || "";
  row[headers.nome_cracha] = job.badgeName || "";
  row[headers.empresa] = job.company || "";
  row[headers.sorteio] = job.raffleNumber || "";
  row[headers.status] = "aguardando";
  row[headers.printer_name] = "";
  row[headers.criado_em] = createdAt;
  row[headers.imprimindo_em] = "";
  row[headers.impresso_em] = "";
  row[headers.erro] = "";

  sheet.appendRow(
    Array.from({ length: headerCount }, function (_, index) {
      return row[index] || "";
    }),
  );

  return {
    id: jobId,
    status: "aguardando",
    position: getPrintQueuePosition(jobId),
    createdAt,
  };
}

function getPrintQueueSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(PRINT_QUEUE_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(PRINT_QUEUE_SHEET_NAME);
    sheet.appendRow(getPrintQueueHeaderNames());
  }

  return sheet;
}

function getPrintQueueHeaderNames() {
  return [
    "id",
    "participante_email",
    "participante_cpf",
    "nome_cracha",
    "empresa",
    "sorteio",
    "status",
    "printer_name",
    "criado_em",
    "imprimindo_em",
    "impresso_em",
    "erro",
  ];
}

function getPrintQueueHeaders(sheet) {
  const headers = normalizeHeaders(sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]);
  const indexes = {};

  getPrintQueueHeaderNames().forEach(function (name) {
    let index = headers.indexOf(name);

    if (index < 0) {
      index = headers.length;
      headers.push(name);
      sheet.getRange(1, index + 1).setValue(name);
    }

    indexes[name] = index;
  });

  return indexes;
}

function getPrintQueueRows(sheet) {
  if (sheet.getLastRow() < 2) {
    return [];
  }

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function getPrintQueuePosition(jobId) {
  const sheet = getPrintQueueSheet();
  const headers = getPrintQueueHeaders(sheet);
  const rows = getPrintQueueRows(sheet);
  let position = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (String(row[headers.status] || "").trim() === "aguardando") {
      position += 1;
    }

    if (String(row[headers.id] || "").trim() === jobId) {
      return position;
    }
  }

  return 0;
}

function claimPrintJob(printer) {
  if (!printer) {
    return { ok: false, error: "Informe o nome da impressora." };
  }

  const sheet = getPrintQueueSheet();
  const headers = getPrintQueueHeaders(sheet);
  const rows = getPrintQueueRows(sheet);
  const now = formatDateTime(new Date());

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (String(row[headers.status] || "").trim() !== "aguardando") {
      continue;
    }

    const sheetRow = index + 2;
    sheet.getRange(sheetRow, headers.status + 1).setValue("imprimindo");
    sheet.getRange(sheetRow, headers.printer_name + 1).setValue(printer);
    sheet.getRange(sheetRow, headers.imprimindo_em + 1).setValue(now);
    sheet.getRange(sheetRow, headers.erro + 1).setValue("");

    return {
      ok: true,
      job: {
        id: String(row[headers.id] || "").trim(),
        participantEmail: String(row[headers.participante_email] || "").trim(),
        participantCpf: String(row[headers.participante_cpf] || "").trim(),
        badgeName: String(row[headers.nome_cracha] || "").trim(),
        company: String(row[headers.empresa] || "").trim(),
        raffleNumber: String(row[headers.sorteio] || "").trim(),
        printer,
      },
    };
  }

  return { ok: true, job: null };
}

function completePrintJob(jobId, printer) {
  return updatePrintJobStatus(jobId, printer, "impresso", "");
}

function failPrintJob(jobId, printer, errorMessage) {
  return updatePrintJobStatus(jobId, printer, "erro", errorMessage || "Erro de impressao.");
}

function updatePrintJobStatus(jobId, printer, status, errorMessage) {
  if (!jobId) {
    return { ok: false, error: "Informe o id do job." };
  }

  const sheet = getPrintQueueSheet();
  const headers = getPrintQueueHeaders(sheet);
  const rows = getPrintQueueRows(sheet);
  const now = formatDateTime(new Date());

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (String(row[headers.id] || "").trim() !== jobId) {
      continue;
    }

    const sheetRow = index + 2;
    sheet.getRange(sheetRow, headers.status + 1).setValue(status);
    sheet.getRange(sheetRow, headers.printer_name + 1).setValue(printer || row[headers.printer_name] || "");

    if (status === "impresso") {
      sheet.getRange(sheetRow, headers.impresso_em + 1).setValue(now);
      sheet.getRange(sheetRow, headers.erro + 1).setValue("");
    }

    if (status === "erro") {
      sheet.getRange(sheetRow, headers.erro + 1).setValue(errorMessage);
    }

    return { ok: true, jobId, status };
  }

  return { ok: false, error: "Job nao encontrado." };
}

function getPrintQueueStats() {
  const sheet = getPrintQueueSheet();
  const headers = getPrintQueueHeaders(sheet);
  const rows = getPrintQueueRows(sheet);
  const stats = {
    ok: true,
    aguardando: 0,
    imprimindo: 0,
    impresso: 0,
    erro: 0,
    cancelado: 0,
  };

  rows.forEach(function (row) {
    const status = String(row[headers.status] || "").trim();

    if (stats[status] !== undefined) {
      stats[status] += 1;
    }
  });

  return stats;
}

function getPrintQueueSnapshot(limit) {
  const sheet = getPrintQueueSheet();
  const headers = getPrintQueueHeaders(sheet);
  const rows = getPrintQueueRows(sheet);
  const stats = getPrintQueueStats();
  let waitingPosition = 0;
  const jobs = rows
    .map(function (row, index) {
      const status = String(row[headers.status] || "").trim();
      const queuePosition = status === "aguardando" ? (waitingPosition += 1) : 0;
      const participantEmail = String(row[headers.participante_email] || "").trim();
      const participantCpf = String(row[headers.participante_cpf] || "").trim();
      const badgeName = String(row[headers.nome_cracha] || "").trim();
      const printedAt = normalizeConfirmedAt(row[headers.impresso_em] || "");
      const printingAt = normalizeConfirmedAt(row[headers.imprimindo_em] || "");
      const createdAt = normalizeConfirmedAt(row[headers.criado_em] || "");
      const updatedAt = printedAt || printingAt || createdAt;

      return {
        id: String(row[headers.id] || "").trim(),
        badgeName: badgeName || "Participante",
        company: String(row[headers.empresa] || "").trim(),
        participantEmail,
        participantCpf,
        raffleNumber: String(row[headers.sorteio] || "").trim(),
        queuePosition,
        status,
        printer: String(row[headers.printer_name] || "").trim(),
        createdAt,
        printingAt,
        printedAt,
        updatedAt,
        time: updatedAt ? updatedAt.slice(11, 16) : "",
        rowNumber: index + 2,
      };
    })
    .filter(function (job) {
      return (job.status === "aguardando" || job.status === "imprimindo") && Boolean(job.id || job.badgeName);
    });

  jobs.sort(function (a, b) {
    const priority = {
      imprimindo: 0,
      aguardando: 1,
      erro: 2,
      impresso: 3,
      cancelado: 4,
    };
    const priorityA = priority[a.status] === undefined ? 9 : priority[a.status];
    const priorityB = priority[b.status] === undefined ? 9 : priority[b.status];

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (a.status === "aguardando" || a.status === "imprimindo") {
      return a.rowNumber - b.rowNumber;
    }

    return b.rowNumber - a.rowNumber;
  });

  stats.jobs = jobs.slice(0, Math.max(limit || 8, 1));
  stats.updatedAt = Utilities.formatDate(new Date(), TIMEZONE, "HH:mm:ss");

  return stats;
}

function syncSymplaParticipants() {
  const config = getSymplaConfig();
  const sheet = getParticipantSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? normalizeHeaders(values[0]) : [];
  const rows = values.slice(1);
  const indexes = getParticipantSyncIndexes(sheet, headers);
  const existingByEmail = {};
  const existingByCpf = {};

  rows.forEach(function (row, index) {
    const email = normalizeEmail(row[indexes.email] || "");
    const cpf = normalizeCpf(row[indexes.cpf] || "");

    if (email) {
      existingByEmail[email] = index + 2;
    }

    if (cpf) {
      existingByCpf[cpf] = index + 2;
    }
  });

  const participants = fetchAllSymplaParticipants(config);
  let created = 0;
  let updated = 0;

  participants.forEach(function (participant) {
    const mapped = mapSymplaParticipant(participant);
    const rowNumber = existingByEmail[mapped.email] || existingByCpf[mapped.cpf];

    if (rowNumber) {
      writeSymplaParticipant(sheet, indexes, rowNumber, mapped, false);
      updated += 1;
      return;
    }

    const nextRow = sheet.getLastRow() + 1;
    writeSymplaParticipant(sheet, indexes, nextRow, mapped, true);
    created += 1;

    if (mapped.email) {
      existingByEmail[mapped.email] = nextRow;
    }

    if (mapped.cpf) {
      existingByCpf[mapped.cpf] = nextRow;
    }
  });

  const refreshedValues = sheet.getDataRange().getValues();
  const refreshedHeaders = normalizeHeaders(refreshedValues[0]);
  const refreshedRows = refreshedValues.slice(1);
  const refreshedIndexes = getParticipantSyncIndexes(sheet, refreshedHeaders);
  ensureUniqueRaffleNumbers(
    sheet,
    refreshedRows,
    refreshedIndexes.sorteio,
    refreshedIndexes.nome,
    refreshedIndexes.email,
    refreshedIndexes.cpf,
  );

  return {
    ok: true,
    fetched: participants.length,
    created,
    updated,
    updatedAt: formatDateTime(new Date()),
  };
}

function getParticipantSyncIndexes(sheet, headers) {
  return {
    nome: ensureColumn(sheet, headers, "nome"),
    sobrenome: ensureColumn(sheet, headers, "sobrenome"),
    email: ensureColumn(sheet, headers, "email"),
    cpf: ensureColumn(sheet, headers, "cpf"),
    empresa: ensureColumn(sheet, headers, "empresa"),
    sorteio: ensureColumn(sheet, headers, "sorteio"),
    confirmadoEm: ensureColumn(sheet, headers, "confirmado_em"),
    symplaParticipantId: ensureColumn(sheet, headers, "sympla_participant_id"),
    symplaTicketNumber: ensureColumn(sheet, headers, "sympla_ticket_number"),
    symplaTicketName: ensureColumn(sheet, headers, "sympla_ticket_name"),
    symplaOrderId: ensureColumn(sheet, headers, "sympla_order_id"),
    symplaCheckinAt: ensureColumn(sheet, headers, "sympla_checkin_at"),
  };
}

function writeSymplaParticipant(sheet, indexes, rowNumber, participant, isNewRow) {
  const existing = isNewRow
    ? []
    : sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

  setCellIfValue(sheet, rowNumber, indexes.nome, participant.name || existing[indexes.nome] || "");
  setCellIfValue(sheet, rowNumber, indexes.sobrenome, participant.surname || existing[indexes.sobrenome] || "");
  setCellIfValue(sheet, rowNumber, indexes.email, participant.email || existing[indexes.email] || "");
  setCellIfValue(sheet, rowNumber, indexes.cpf, participant.cpf || existing[indexes.cpf] || "");
  setCellIfValue(sheet, rowNumber, indexes.empresa, existing[indexes.empresa] || participant.company || "");
  setCellIfValue(sheet, rowNumber, indexes.symplaParticipantId, participant.id);
  setCellIfValue(sheet, rowNumber, indexes.symplaTicketNumber, participant.ticketNumber);
  setCellIfValue(sheet, rowNumber, indexes.symplaTicketName, participant.ticketName);
  setCellIfValue(sheet, rowNumber, indexes.symplaOrderId, participant.orderId);

  if (participant.checkinAt && !existing[indexes.symplaCheckinAt]) {
    setCellIfValue(sheet, rowNumber, indexes.symplaCheckinAt, participant.checkinAt);
  }
}

function setCellIfValue(sheet, rowNumber, columnIndex, value) {
  if (value === undefined || value === null) {
    return;
  }

  sheet.getRange(rowNumber, columnIndex + 1).setValue(value);
}

function fetchAllSymplaParticipants(config) {
  const participants = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const url =
      SYMPLA_API_BASE +
      "/events/" +
      encodeURIComponent(config.eventId) +
      "/participants?page_size=200&page=" +
      page;
    const response = fetchSympla(url, config.token, "get");
    const payload = JSON.parse(response.getContentText());

    (payload.data || []).forEach(function (participant) {
      participants.push(participant);
    });

    hasNext = Boolean(payload.pagination && payload.pagination.has_next);
    page += 1;
  }

  return participants;
}

function fetchSympla(url, token, method) {
  const response = UrlFetchApp.fetch(url, {
    method,
    muteHttpExceptions: true,
    headers: {
      S_TOKEN: token,
    },
  });
  const status = response.getResponseCode();

  if (status < 200 || status >= 300) {
    throw new Error("Erro Sympla " + status + ": " + response.getContentText());
  }

  return response;
}

function getSymplaConfig() {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty("SYMPLA_TOKEN");
  const eventId = properties.getProperty("SYMPLA_EVENT_ID");

  if (!token || !eventId) {
    throw new Error("Configure SYMPLA_TOKEN e SYMPLA_EVENT_ID nas Script Properties.");
  }

  return { token, eventId };
}

function mapSymplaParticipant(participant) {
  const firstName = String(participant.first_name || "").trim();
  const lastName = String(participant.last_name || "").trim();
  const fallbackName = String(participant.name || "").trim();
  const customFields = normalizeSymplaCustomFields(participant.custom_form);
  const splitFallback = splitFullName(fallbackName);

  return {
    id: participant.id,
    name: firstName || splitFallback.name,
    surname: lastName || splitFallback.surname,
    email: normalizeEmail(participant.email || ""),
    cpf: normalizeCpf(customFields.cpf || participant.cpf || ""),
    company: customFields.empresa || customFields.company || "",
    ticketNumber: participant.ticket_number || "",
    ticketName: participant.ticket_name || "",
    orderId: participant.order_id || "",
    checkinAt:
      participant.checkin && participant.checkin.check_in_date
        ? String(participant.checkin.check_in_date).trim()
        : "",
  };
}

function splitFullName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);

  return {
    name: parts.shift() || "",
    surname: parts.join(" "),
  };
}

function normalizeSymplaCustomFields(customForm) {
  const fields = {};

  if (!customForm) {
    return fields;
  }

  const forms = Array.isArray(customForm) ? customForm : [customForm];

  forms.forEach(function (field) {
    const name = normalizeCustomFieldName(field.name || "");
    const value = String(field.value || "").trim();

    if (name) {
      fields[name] = value;
    }
  });

  return fields;
}

function normalizeCustomFieldName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function confirmSymplaIfPossible(sheet, rowIndex, row, participantIdIndex, symplaCheckinAtIndex) {
  const currentSymplaCheckinAt = String(row[symplaCheckinAtIndex] || "").trim();

  if (currentSymplaCheckinAt) {
    return currentSymplaCheckinAt;
  }

  const participantId = String(row[participantIdIndex] || "").trim();

  if (!participantId) {
    return "";
  }

  try {
    const config = getSymplaConfig();
    const url =
      SYMPLA_API_BASE +
      "/events/" +
      encodeURIComponent(config.eventId) +
      "/participants/" +
      encodeURIComponent(participantId) +
      "/checkin";
    const response = fetchSympla(url, config.token, "post");
    const payload = JSON.parse(response.getContentText());
    const checkinAt =
      payload.data && payload.data.checkin && payload.data.checkin.check_in_date
        ? String(payload.data.checkin.check_in_date).trim()
        : formatDateTime(new Date());

    sheet.getRange(rowIndex + 2, symplaCheckinAtIndex + 1).setValue(checkinAt);
    return checkinAt;
  } catch (error) {
    return "";
  }
}

function getEventStats() {
  const sheet = getParticipantSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length < 1) {
    return { ok: false, error: "A aba de participantes esta sem cabecalhos." };
  }

  const headers = normalizeHeaders(values[0]);
  const rows = values.slice(1);
  const indexes = {
    nome: headers.indexOf("nome"),
    sobrenome: ensureColumn(sheet, headers, "sobrenome"),
    email: headers.indexOf("email"),
    cpf: headers.indexOf("cpf"),
    empresa: ensureColumn(sheet, headers, "empresa"),
    sorteio: ensureColumn(sheet, headers, "sorteio"),
    confirmadoEm: ensureColumn(sheet, headers, "confirmado_em"),
  };

  if ([indexes.nome, indexes.email, indexes.cpf].indexOf(-1) >= 0) {
    return {
      ok: false,
      error: "Cabecalhos esperados na aba Participantes: nome, email, cpf.",
    };
  }

  const raffleNumbers = ensureUniqueRaffleNumbers(
    sheet,
    rows,
    indexes.sorteio,
    indexes.nome,
    indexes.email,
    indexes.cpf,
  );
  const companies = {};
  const hourly = Array.from({ length: 24 }, function () {
    return 0;
  });
  const recent = [];
  let total = 0;
  let confirmed = 0;

  rows.forEach(function (row, index) {
    const name = buildBadgeName(
      String(row[indexes.nome] || "").trim(),
      String(row[indexes.sobrenome] || "").trim(),
    );
    const email = String(row[indexes.email] || "").trim();
    const cpf = String(row[indexes.cpf] || "").trim();
    const hasParticipant = Boolean(name || email || cpf);

    if (!hasParticipant) {
      return;
    }

    total += 1;

    const company = String(row[indexes.empresa] || "").trim() || "Sem empresa";
    companies[company] = (companies[company] || 0) + 1;

    const confirmedAt = normalizeConfirmedAt(row[indexes.confirmadoEm] || "");

    if (!confirmedAt) {
      return;
    }

    confirmed += 1;

    const hour = getConfirmedHour(confirmedAt);

    if (hour >= 0) {
      hourly[hour] += 1;
    }

    recent.push({
      name,
      email,
      company,
      number: raffleNumbers[index],
      confirmedAt,
      time: confirmedAt.slice(11, 16),
    });
  });

  recent.sort(function (a, b) {
    return b.confirmedAt.localeCompare(a.confirmedAt);
  });

  return {
    ok: true,
    total,
    confirmed,
    pending: Math.max(total - confirmed, 0),
    confirmedRate: total ? Math.round((confirmed / total) * 1000) / 10 : 0,
    pendingRate: total ? Math.round(((total - confirmed) / total) * 1000) / 10 : 0,
    companies: Object.keys(companies)
      .map(function (name) {
        return {
          name,
          count: companies[name],
          rate: total ? Math.round((companies[name] / total) * 1000) / 10 : 0,
        };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, 6),
    hourly,
    recent: recent.slice(0, 6),
    updatedAt: Utilities.formatDate(new Date(), TIMEZONE, "HH:mm"),
  };
}

function ensureUniqueRaffleNumbers(sheet, rows, raffleIndex, nameIndex, emailIndex, cpfIndex) {
  const usedNumbers = {};
  const raffleNumbers = [];
  let nextNumber = 1;

  rows.forEach(function (row, index) {
    const hasParticipant = Boolean(
      String(row[nameIndex] || "").trim() ||
        String(row[emailIndex] || "").trim() ||
        String(row[cpfIndex] || "").trim(),
    );

    if (!hasParticipant) {
      raffleNumbers[index] = "";
      return;
    }

    let raffleNumber = normalizeRaffleNumber(row[raffleIndex] || "");

    if (!raffleNumber || usedNumbers[raffleNumber]) {
      while (usedNumbers[formatRaffleNumber(nextNumber)]) {
        nextNumber += 1;
      }

      raffleNumber = formatRaffleNumber(nextNumber);
      sheet.getRange(index + 2, raffleIndex + 1).setValue(raffleNumber);
    }

    usedNumbers[raffleNumber] = true;
    raffleNumbers[index] = raffleNumber;
  });

  return raffleNumbers;
}

function ensureColumn(sheet, headers, name) {
  const existingIndex = headers.indexOf(name);

  if (existingIndex >= 0) {
    return existingIndex;
  }

  const nextColumn = headers.length + 1;
  sheet.getRange(1, nextColumn).setValue(name);
  headers.push(name);
  return nextColumn - 1;
}

function normalizeHeaders(headers) {
  return headers.map(function (header) {
    return String(header).trim().toLowerCase();
  });
}

function normalizeConfirmedAt(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return formatDateTime(value);
  }

  return String(value).trim();
}

function getConfirmedHour(confirmedAt) {
  const match = String(confirmedAt).match(/\s(\d{2}):\d{2}/);
  return match ? Number(match[1]) : -1;
}

function normalizeRaffleNumber(value) {
  const digits = String(value).replace(/\D/g, "");
  return digits ? formatRaffleNumber(Number(digits)) : "";
}

function formatRaffleNumber(value) {
  return String(value).padStart(3, "0");
}

function formatDateTime(value) {
  return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
}

function normalizeLookup(value) {
  const text = String(value).trim();
  return text.indexOf("@") >= 0 ? normalizeEmail(text) : normalizeCpf(text);
}

function normalizeEmail(value) {
  return String(value).trim().toLowerCase();
}

function normalizeCpf(value) {
  return String(value).replace(/\D/g, "");
}
