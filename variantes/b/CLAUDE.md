# CLAUDE.md

App de agenda de eventos de meetup (eventos, inscrições, importação de inscritos por CSV, relatório). TypeScript, estado em memória.

## Comandos

- `pnpm test` dentro da pasta do projeto roda a suíte (Vitest). Rode antes de dar algo como pronto.

## Convenções

- Erros: sempre `ErroDominio` (`src/erros.ts`) com `codigo` em `SCREAMING_SNAKE`, por exemplo `INSCRICAO_DUPLICADA`. Nunca `throw new Error(...)` em regra de negócio.
- Dinheiro: sempre `Centavos` (inteiro, `src/dinheiro.ts`). Nada de float. Ao dividir ou aplicar percentual, arredonde o valor final para baixo (`Math.floor`).
- Tempo: nunca `new Date()` em `src/`. Use `relogio.agora()` de `src/relogio.ts`, para os testes conseguirem fixar a hora.
- Auditoria: toda mutação de inscrição (criar, cancelar, qualquer nova) chama `registrarAuditoria(acao, dados)`. Ações no formato `inscricao.<verbo>`.
- `src/legado/` é congelado: não edite. Código novo de relatório vai em `src/relatorios/`.

## Testes

- Um arquivo de teste por módulo em `test/`. Teste de regra nova cobre o caminho de erro, com o `codigo` esperado.
- Fixe a hora com `vi.spyOn(relogio, "agora")`. Chame `resetarDados()` no `beforeEach`.

## Estilo

- Português nos nomes de domínio e mensagens de erro. Imports relativos com extensão `.js`.
- Sem dependências novas: o projeto só usa `vitest`.
