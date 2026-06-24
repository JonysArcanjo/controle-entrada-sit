# Admin Backup Download Design

Data: 2026-06-24

## Objetivo

Permitir que um operador autenticado baixe pelo painel admin uma copia do banco SQLite atual ou o backup SQLite mais recente, sem acessar a VPS por terminal.

## Escopo

- Adicionar links de download no card `Status do sistema`.
- Criar rotas protegidas por Basic Auth para baixar:
  - `participantes.db` atual;
  - ultimo arquivo `participantes-*.db` encontrado em `BACKUP_DIR`.
- Manter restore fora do escopo desta entrega.
- Manter check-in publico, fila publica e API publica sem mudancas.

## Comportamento

- Quando `ADMIN_PASSWORD` estiver definido, downloads exigem as mesmas credenciais do `admin.html`.
- Sem banco atual, a rota do banco atual retorna `404`.
- Sem backups, a rota do ultimo backup retorna `404`.
- Os arquivos sao entregues como `application/octet-stream` com `Content-Disposition: attachment`.
- A interface mostra dois links discretos: `Baixar banco atual` e `Baixar ultimo backup`.

## Testes

- Teste de autenticacao confirma que as rotas de download exigem admin auth.
- Teste de servidor confirma selecao do banco atual e do ultimo backup.
- Teste estatico confirma links no card de status.

## Fora Do Escopo

- Restaurar backups pelo navegador.
- Listar historico completo de backups.
- Compactar arquivos antes do download.

