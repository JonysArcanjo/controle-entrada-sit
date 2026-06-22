# Tempo Simulado por Lote de Impressao

Data: 2026-06-21

## Objetivo

Permitir que o operador escolha, na aba `Teste de impressao`, quanto tempo cada etiqueta simulada deve levar. O atraso deve afetar somente os jobs daquele lote e nao deve alterar a velocidade padrao de check-ins ou reimpressoes normais.

## Interface

O formulario do teste recebe o campo numerico `Tempo por etiqueta`, expresso em segundos:

- minimo: 1 segundo;
- maximo: 10 segundos;
- padrao: 3 segundos;
- passo: 1 segundo.

A confirmacao antes do inicio informa a quantidade de participantes e o tempo escolhido. Durante o processamento, a tela continua usando o progresso e os contadores existentes.

## API

`startPrintTest` recebe `delaySeconds` junto de `quantity`. O backend converte o valor para inteiro, limita ao intervalo de 1 a 10 e usa 3 quando o parametro estiver ausente ou invalido.

A resposta inclui `delaySeconds` para a interface confirmar a configuracao aplicada.

## Persistencia

`fila_impressao` recebe a coluna opcional `atraso_simulado_ms INTEGER`. Jobs normais deixam a coluna vazia. Cada job criado por `startPrintTest` recebe `delaySeconds * 1000`.

O valor tambem e retornado como `simulationDelayMs` no objeto de job entregue por `claimPrintJob`.

## Worker

Em modo `dryRun`, o worker usa `job.simulationDelayMs` quando for um inteiro positivo. Caso contrario, usa `dryRunDelayMs` da configuracao, hoje definido como 1000ms.

Em impressao real (`dryRun: false`), o novo campo e ignorado e o comando `lp` continua sem espera artificial.

## Compatibilidade e Seguranca

- Jobs existentes continuam validos porque a coluna e opcional.
- Check-ins, reimpressoes e jobs manuais continuam com o atraso global de 1 segundo no `dryRun`.
- O backend valida o limite mesmo que o HTML seja alterado.
- Atrasos acima de 10 segundos ou abaixo de 1 segundo sao limitados, evitando testes excessivamente longos ou instantaneos.

## Testes

- backend grava 3000ms por padrao;
- backend limita valores para 1000ms e 10000ms;
- API retorna o atraso aplicado;
- job da fila expoe `simulationDelayMs`;
- worker prefere o atraso do job em `dryRun`;
- worker preserva `dryRunDelayMs` para jobs normais;
- HTML e JavaScript exibem, validam e enviam o campo;
- teste Docker mede um pequeno lote com aproximadamente 3 segundos por rodada e confirma pausa automatica.

## Estado Final Esperado

O operador consegue simular visualmente a fila com duracao realista sem reduzir permanentemente a velocidade do worker. Ao terminar o lote, a impressao continua sendo pausada automaticamente.
