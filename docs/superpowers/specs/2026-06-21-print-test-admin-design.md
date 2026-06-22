# Aba de Teste de Impressao

Data: 2026-06-21

## Objetivo

Adicionar ao painel administrativo uma aba lateral para executar testes de impressao com participantes carregados no SQLite. O teste deve reproduzir o fluxo real: confirmar participantes pendentes, criar etiquetas na fila, iniciar o worker, acompanhar o lote e pausar a impressao automaticamente ao terminar.

## Interface

A sidebar recebe a opcao `Teste de impressao` na categoria `Operacao`. O painel correspondente segue o visual existente e apresenta:

- total de participantes pendentes;
- quantidade de balcoes ativos;
- campo numerico com minimo 1 e maximo igual ao total pendente;
- botao `Iniciar teste`;
- aviso de que os participantes serao confirmados de verdade;
- progresso do lote com aguardando, imprimindo, impressos e erros;
- resultado final e tempo decorrido.

O botao fica desabilitado sem participantes pendentes, com fonte diferente de `SQLITE`, durante outro teste ou quando existir fila ativa.

## API e Persistencia

### `printTestInfo`

Retorna fonte ativa, quantidade de pendentes, balcoes ativos, fila ativa e eventual lote de teste em andamento.

### `startPrintTest`

Recebe `quantity`. Em uma transacao SQLite com bloqueio de escrita:

1. valida que a fonte ativa e `SQLITE`;
2. valida que nao existe fila ativa nem outro lote em andamento;
3. calcula os participantes pendentes disponiveis;
4. limita a quantidade solicitada ao intervalo entre 1 e o total pendente;
5. seleciona participantes por `ordem_inscricao` e, como desempate, `id`;
6. preenche `confirmado_em`, `nome_cracha` e `atualizado_em` sem apagar empresa existente;
7. cria uma etiqueta por participante com um mesmo `lote_teste_id`;
8. registra o lote ativo e habilita a impressao;
9. confirma a transacao e retorna o identificador e o total efetivo do lote.

Qualquer falha antes do commit desfaz confirmacoes e itens da fila.

### `printTestStatus`

Recebe `batchId` e agrega somente os itens do lote. Retorna total, aguardando, imprimindo, impressos, erros, cancelados, percentual e conclusao.

### Persistencia

`fila_impressao` recebe a coluna opcional `lote_teste_id TEXT` e um indice para consultas do lote. A configuracao guarda o identificador do lote ativo. Itens normais continuam com a coluna vazia.

## Ciclo Automatico

O worker continua chamando `claimPrintJob`, `completePrintJob` e `failPrintJob` sem conhecer a interface administrativa. Ao concluir ou falhar um item com `lote_teste_id`, o backend verifica se ainda existem itens ativos do mesmo lote.

Quando todos os itens estiverem em estado terminal (`impresso`, `erro` ou `cancelado`), o backend:

- define `impressao_ativa=false`;
- limpa a configuracao de lote ativo;
- preserva os itens para relatorio e consulta de resultado.

Esse fechamento ocorre no backend. Portanto, fechar a aba do navegador nao deixa a impressao ativa.

## Concorrencia e Seguranca

- O inicio usa `BEGIN IMMEDIATE` para serializar dois cliques concorrentes.
- O backend valida novamente todos os limites; nao confia no `max` do HTML.
- Um teste nao inicia com fila ativa, evitando misturar etiquetas operacionais e de teste.
- Um teste nao reutiliza participantes confirmados.
- A quantidade efetiva nunca supera os pendentes disponiveis no momento da transacao.
- A funcionalidade fica indisponivel para `GOOGLE_SHEETS` porque o lote atomico depende do SQLite local.

## Atualizacao da Tela

Ao abrir a aba, o frontend chama `printTestInfo`. Depois de iniciar, consulta `printTestStatus` a cada segundo. O polling para quando o lote termina, mas uma atualizacao manual pode recarregar o ultimo resultado.

Mensagens previstas:

- nenhum participante pendente;
- fila ocupada;
- teste ja em andamento;
- fonte SQLite obrigatoria;
- lote iniciado;
- lote concluido com sucesso;
- lote concluido com erros.

## Testes

### Backend

- limita a quantidade ao total pendente;
- seleciona pela ordem definida;
- confirma e enfileira atomicamente;
- rejeita fonte incorreta, fila ativa e teste concorrente;
- agrega apenas os itens do lote solicitado;
- pausa automaticamente quando todos os itens terminam ou falham;
- nao pausa antes do ultimo item terminal.

### Frontend

- sidebar e painel possuem os elementos esperados;
- quantidade respeita o total pendente;
- estados carregando, executando, concluido e erro sao renderizados;
- assets recebem cache bust atualizado.

### Integracao Docker

- iniciar um lote controlado com participantes pendentes;
- observar pico de tres itens em impressao;
- aguardar fila do lote chegar a zero;
- confirmar zero erros no cenario nominal;
- confirmar `printingEnabled=false` ao final;
- confirmar containers ativos e API saudavel.

## Estado Final Esperado

Ao concluir um teste, todos os participantes selecionados estao confirmados, suas etiquetas permanecem no historico como impressas ou com erro, nao existe item ativo daquele lote e a impressao esta pausada.
