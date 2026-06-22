# Substituicao Atomica de Participantes no Upload

Data: 2026-06-21

## Objetivo

Fazer cada novo upload CSV/XLSX substituir integralmente a base de participantes anterior e limpar os indicadores operacionais, sem risco de perder a base atual quando o arquivo novo for invalido.

## Fluxo

1. O servidor recebe e le o arquivo completo.
2. O parser valida formato, cabecalhos obrigatorios e existencia de registros utilizaveis.
3. Somente depois da validacao, o servidor abre uma transacao SQLite com bloqueio de escrita.
4. A transacao remove `fila_impressao`, remove `participantes` e reinicia a sequencia da tabela.
5. Os registros validados sao importados na mesma transacao.
6. A impressao e pausada e o identificador de lote de teste ativo e limpo.
7. O commit torna a nova base visivel de uma vez.

Se qualquer gravacao falhar, o rollback preserva participantes, fila e configuracoes operacionais anteriores.

## Backend

`import_participants` recebe uma conexao opcional para permitir que limpeza e importacao compartilhem a mesma transacao. A rota de upload usa uma nova operacao `replace_participants` que:

- recebe os registros ja validados;
- executa `BEGIN IMMEDIATE`;
- limpa fila, participantes e sequencia;
- importa os registros sem abrir outra conexao;
- define `impressao_ativa=false`;
- define `teste_impressao_lote_ativo=''`;
- retorna `replaced: true` com o resumo da importacao.

A tabela `configuracoes` e preservada, incluindo fonte SQLite e lista de balcoes.

## Interface

O modal informa de forma explicita que o upload substitui todos os participantes e limpa a fila. Antes do envio, o navegador solicita confirmacao com a mesma mensagem.

Durante o processamento, o texto permanece `Importando participantes...`. A mensagem final informa que a base foi substituida e apresenta processados, inseridos, atualizados e erros.

## Concorrencia

`BEGIN IMMEDIATE` impede que duas importacoes substituam a base simultaneamente. O worker pode concluir uma chamada ja iniciada, mas nenhuma fila antiga permanece depois do commit, e a impressao fica pausada.

## Testes

- arquivo invalido nao limpa a base existente;
- upload valido remove participantes e fila antigos;
- nova base contem somente os registros do arquivo;
- sequencia de participantes reinicia;
- impressao termina pausada e lote ativo vazio;
- configuracao de fonte e balcoes e preservada;
- falha de gravacao executa rollback da limpeza;
- interface exibe aviso e confirmacao de substituicao;
- Docker serve a nova interface e API retorna `replaced: true`.

## Estado Final Esperado

Apos um upload valido, indicadores, check-ins e fila refletem exclusivamente o novo arquivo. A impressao fica pausada ate o operador iniciar uma operacao ou teste.
