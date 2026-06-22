# Check-in SAP Inside Track Fortaleza

Aplicacao mobile-first para entrada de evento. O participante informa email ou CPF, o sistema consulta a planilha, confirma a entrada, grava dados de controle e envia a etiqueta para uma fila central de impressao.

## Telas

- `index.html`: check-in do participante, com nome para cracha editavel, empresa opcional, confirmacao e envio para fila de impressao.
- `admin.html`: painel administrativo com sidebar, busca por email/CPF, nome para cracha editavel, empresa, confirmacao, reimpressao e controle da impressao.
- `fila.html`: tela publica para monitor/recepcao acompanhar `Imprimindo agora`, `Proximos da fila` e `Fila de espera`, sem controles administrativos.

## Como executar localmente

Na pasta do projeto:

```bash
python3 server.py
```

Acesse:

```text
http://localhost:8020/index.html
http://localhost:8020/admin.html
http://localhost:8020/fila.html
```

O servidor local cria/usa o banco SQLite `participantes.db` e habilita o upload de participantes no painel admin.

Se o navegador mostrar uma versao antiga, use `Cmd + Shift + R`. Os arquivos CSS/JS usam query string de cache, como `app.js?v=25`, `admin.js?v=40` e `fila.js?v=4`.

O fuso horario da aplicacao e `America/Fortaleza`.

## Como executar com Docker Compose

Na pasta do projeto:

```bash
docker compose up --build
```

Acesse:

```text
http://127.0.0.1:8020/index.html
http://127.0.0.1:8020/admin.html
http://127.0.0.1:8020/fila.html
```

O Compose publica a porta `8020` e monta `./participantes.db` em `/app/participantes.db`, mantendo os dados SQLite no arquivo local do projeto.
O app e o worker sobem com `TZ=America/Fortaleza`.

Para subir tambem o worker de impressao em modo simulado:

```bash
docker compose --profile worker up --build
```

O worker do Compose usa `print-worker.config.docker.json`, chama `http://app:8020/api` dentro da rede Docker e fica com `dryRun: true`. Para impressao real no macOS, prefira rodar o worker no host com `node scripts/print-worker.js print-worker.config.config.json`.

## Planilha

Planilha atual:

```text
https://docs.google.com/spreadsheets/d/1STSzxIJnqEAFfvJcQVeRGEdwjQNtjqzPNFmeshO6x40/edit?usp=sharing
```

A aba deve se chamar `Participantes`.

Cabecalhos minimos:

```text
nome | email | cpf
```

Colunas criadas/usadas automaticamente pelo Apps Script:

```text
empresa | sorteio | confirmado_em
```

Colunas criadas/usadas quando a integracao Sympla estiver ativa:

```text
sympla_participant_id | sympla_ticket_number | sympla_ticket_name | sympla_order_id | sympla_checkin_at
```

Aba criada para controle da fila de impressao:

```text
Fila Impressao
```

Colunas da fila:

```text
id | participante_email | participante_cpf | nome_cracha | empresa | sorteio | status | printer_name | criado_em | imprimindo_em | impresso_em | erro
```

Observacoes:

- Se existir uma coluna `numero` com telefone, ela e ignorada.
- `sorteio` recebe numeros unicos como `001`, `002`, `003`.
- `confirmado_em` guarda a data/hora da primeira confirmacao.
- `empresa` pode ser preenchida no check-in/admin e fica salva na planilha.
- `nome_cracha` recebe inicialmente a sugestao `Nome + Sobrenome`, mas pode ser editado no check-in publico ou admin; o valor editado e o que vai para a fila/impressao.
- Dados vindos da Sympla atualizam nome, email, CPF e metadados Sympla, preservando `sorteio` e `confirmado_em`.
- Toda etiqueta confirmada vai para `Fila Impressao` com status `aguardando`.

## Apps Script

1. No Google Sheets, abra `Extensoes > Apps Script`.
2. Cole todo o conteudo de `google-apps-script.js`.
3. Clique em `Salvar`.
4. Publique em `Implantar > Gerenciar implantacoes > lapis`.
5. Em `Versao`, escolha `Nova versao`.
6. Clique em `Implantar`.

Use a URL `/exec` gerada pelo Apps Script em:

- `app.js`
- `admin.js`

```js
const SHEETS_ENDPOINT = "SUA_URL_DO_APPS_SCRIPT";
```

## Upload de participantes

No painel admin (`admin.html`), use o botao:

```text
Upload participantes
```

O upload aceita arquivos `.csv` e `.xlsx` exportados do Sympla. O servidor valida as colunas obrigatorias, cria ou atualiza registros em `participantes.db` e mostra um resumo com processados, novos, atualizados e erros.

Colunas obrigatorias:

```text
Nome | Sobrenome | Email | Nº ingresso | Estado de pagamento
```

Tabela SQLite criada:

```text
participantes
```

Campos:

```text
id | ordem_inscricao | numero_ingresso | nome | sobrenome | tipo_ingresso | valor | data_compra | numero_pedido | email | estado_pagamento | checkin | data_checkin | cupom_desconto | identificador_parceiro | metodo_pagamento | utm_source | utm_medium | utm_campaign | utm_term | utm_content | user_agent | referrer | telefone | cidade | estado | empresa | modulo_sap_area | tamanho_polo_evento | temas_interesse | created_at
```

Duplicidades sao evitadas por `email` ou `numero_ingresso`. Quando um participante ja existe, os dados sao atualizados; quando nao existe, um novo registro e criado.

## Fonte de dados e fila de impressao

O painel admin tem um seletor de fonte:

```text
Google Sheets | SQLite
```

O navegador sempre chama a API local:

```text
http://127.0.0.1:8020/api
```

A API local decide a origem ativa:

- `SQLite`: le e grava em `participantes.db`.
- `Google Sheets`: repassa `lookup`, `confirm`, `stats`, `printQueue` e acoes do worker para o Apps Script configurado.

Ao selecionar SQLite, a API local grava em `configuracoes`:

```text
fonte_dados_ativa = SQLITE
leitura_google_sheets_ativa = false
leitura_sqlite_ativa = true
```

Ao selecionar Google Sheets:

```text
fonte_dados_ativa = GOOGLE_SHEETS
leitura_google_sheets_ativa = true
leitura_sqlite_ativa = false
```

Arquitetura:

- `server.py` serve os arquivos estaticos e expõe `/api`.
- `/api?action=lookup`, `/api?action=confirm`, `/api?action=stats` e endpoints da fila usam a fonte ativa.
- `admin.js`, `app.js` e `scripts/print-worker.js` usam `/api`, sem falar diretamente com a planilha.
- `scripts/print-worker.js` usa o endpoint configurado em `print-worker.config*.json`.
- `sqlite-schema.sql` contem o SQL principal das tabelas.
- A aplicacao sempre inicia com a impressao pausada (`impressao_ativa=false`); o operador deve clicar em `Iniciar` no admin para o worker consumir novos itens.

Tabela de fila:

```sql
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
  erro TEXT
);
```

Status usados:

```text
aguardando | próximo da fila | imprimindo agora | impresso | erro | cancelado
```

Fluxo da fila:

```text
ativarSQLite()
criarTabelaFilaSQLite()
lerRegistros()
adicionarItemFila()
obterProximoDaFila()
marcarComoProximoDaFila()
iniciarImpressao()
finalizarImpressao()
```

## Funcionalidades

- Busca por email ou CPF.
- CPF aceito com ou sem pontuacao, exemplo `451.462.704-82` ou `45146270482`.
- Nome para cracha obrigatorio no check-in principal e editavel no admin.
- A sugestao do nome do cracha e `Nome + Sobrenome`; se o nome for alterado, o valor alterado e usado na etiqueta e na fila.
- Empresa opcional no check-in e no admin, salva na planilha ao confirmar.
- Confirmacao de entrada idempotente: se ja estiver confirmado, preserva o horario original.
- Painel admin com confirmados, pendentes, total, grafico por hora, empresas e entradas recentes.
- Admin pode buscar participante por email/CPF, editar nome do cracha, preencher empresa, confirmar entrada e reimprimir etiqueta.
- O botao de confirmacao envia a etiqueta para a fila e mostra a posicao da etiqueta na fila.
- A etiqueta mostra o numero do sorteio dentro da area branca, abaixo da empresa quando houver empresa.

## Fila de impressao

O navegador nao imprime mais diretamente. A confirmacao cria um item na aba `Fila Impressao` e mostra a posicao da etiqueta na fila.

Status possiveis:

```text
aguardando | próximo da fila | imprimindo agora | impresso | erro | cancelado
```

O painel admin controla a impressao com botoes `Iniciar` e `Pausar`.
Ao iniciar a aplicacao, a impressao fica pausada por padrao.
A tela `fila.html` e apenas de acompanhamento publico e nao mostra botoes de controle nem indicadores administrativos.

## Worker local de impressao

O terminal de impressao deve rodar um worker local conectado as impressoras.

1. Copie o exemplo:

```bash
cp print-worker.config.example.json print-worker.config.json
```

2. Edite `print-worker.config.json`:

```json
{
  "endpoint": "https://script.google.com/macros/s/SUA_IMPLANTACAO/exec",
  "pollIntervalMs": 2500,
  "dryRun": true,
  "dryRunDelayMs": 1000,
  "printers": [
    {
      "name": "NOME_DA_IMPRESSORA_1",
      "enabled": true
    },
    {
      "name": "NOME_DA_IMPRESSORA_2",
      "enabled": true
    }
  ]
}
```

3. Rode:

```bash
node scripts/print-worker.js print-worker.config.json
```

O worker:

- consulta a fila a cada poucos segundos;
- usa as impressoras/balcoes ativos de forma paralela;
- marca o item como `imprimindo agora`;
- envia para a impressora pelo comando `lp`;
- marca como `impresso` ou `erro`.

No macOS, confirme os nomes das impressoras com:

```bash
lpstat -p
```

Para simular sem gastar etiqueta, deixe:

```json
"dryRun": true
```

Nesse modo o worker pega itens da fila, espera `dryRunDelayMs`, imprime no terminal o conteudo da etiqueta e marca o item como `impresso`.
Mesmo com worker ativo, ele so consome a fila quando a impressao estiver iniciada no admin.

## Teste de carga da fila

Use o arquivo de exemplo:

```text
load-test-participants.example.txt
```

Cada linha deve ter um email ou CPF existente na base ativa.

Rode:

```bash
node scripts/enqueue-load-test.js "http://127.0.0.1:8020/api" load-test-participants.example.txt 5
```

O ultimo argumento e a concorrencia. Comece com `5`, depois teste `10` ou `20`.
O script nao envia `badgeName`; a aplicacao usa a sugestao real `Nome + Sobrenome`.

Para testar consumo da fila com duas impressoras simuladas:

```bash
node scripts/print-worker.js print-worker.config.json
```

Com `dryRun: true`, as impressoras configuradas funcionam como simuladores paralelos.
