# Centralizacao do Modal de Upload

Data: 2026-06-21

## Objetivo

Exibir o modal `Upload participantes` no centro horizontal e vertical da viewport, independentemente da altura do conteudo administrativo ou da posicao de rolagem.

## Layout

O backdrop permanece fixo e ocupa toda a viewport. Seu layout centraliza o modal nos dois eixos e aplica espacamento minimo de 20px nas bordas.

O modal mantem a largura atual, limitada pela viewport. Em telas com pouca altura, recebe altura maxima calculada a partir da viewport e rolagem vertical interna, evitando que titulo, seletor de arquivo ou botao fiquem inacessiveis.

## Comportamento

- abertura, fechamento pelo botao e fechamento ao clicar no backdrop permanecem inalterados;
- foco inicial no seletor de arquivo permanece inalterado;
- o fundo continua bloqueado visualmente pelo overlay;
- em desktop e mobile, o centro e calculado pela viewport, nao pelo documento.

## Implementacao

O ajuste fica restrito a `admin.css`, nas regras `.modal-backdrop` e `.upload-modal`. Nenhuma mudanca de API ou JavaScript e necessaria.

O cache bust de `admin.css` sera incrementado em `admin.html`.

## Testes

- teste estatico confirma backdrop fixo com centralizacao horizontal e vertical;
- teste estatico confirma altura maxima e overflow do modal;
- verificacao do HTML servido confirma a nova versao do CSS;
- inspecao visual confirma o modal centralizado em viewport desktop e mobile.

## Estado Final Esperado

Ao abrir o upload, o modal aparece no centro da tela e todos os controles continuam acessiveis mesmo em uma viewport baixa.
