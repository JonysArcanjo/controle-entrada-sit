CREATE TABLE IF NOT EXISTS participantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participante_email TEXT,
  participante_cpf TEXT,
  nome_cracha TEXT,
  empresa TEXT,
  sorteio TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS fila_impressao (
  id TEXT PRIMARY KEY,
  participante_email TEXT,
  participante_cpf TEXT,
  nome_cracha TEXT NOT NULL,
  empresa TEXT,
  sorteio TEXT,
  status TEXT NOT NULL,
  printer_name TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  imprimindo_em TEXT,
  impresso_em TEXT,
  erro TEXT,
  lote_teste_id TEXT,
  atraso_simulado_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fila_status_criado
  ON fila_impressao(status, criado_em);

CREATE INDEX IF NOT EXISTS idx_fila_lote_teste
  ON fila_impressao(lote_teste_id);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO configuracoes (chave, valor, atualizado_em)
VALUES
  ('fonte_dados_ativa', 'SQLITE', CURRENT_TIMESTAMP),
  ('leitura_google_sheets_ativa', 'false', CURRENT_TIMESTAMP),
  ('leitura_sqlite_ativa', 'true', CURRENT_TIMESTAMP),
  ('impressao_ativa', 'false', CURRENT_TIMESTAMP),
  ('teste_impressao_lote_ativo', '', CURRENT_TIMESTAMP)
ON CONFLICT(chave) DO UPDATE SET
  valor = excluded.valor,
  atualizado_em = excluded.atualizado_em;
