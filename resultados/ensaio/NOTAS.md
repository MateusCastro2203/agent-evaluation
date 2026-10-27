# Ensaio gravado (plano B)

- **Data:** 2026-10-27 (regravado a partir do repositório publicado; o ensaio anterior, de 2026-10-26, deu A 13/16 × B 16/16, também inconclusivo)
- **Modelo:** `sonnet` (fixado em `evals/promptfooconfig.yaml`, aparece no rodapé do relatório)
- **Concorrência:** 4 · **repeat:** 2 · 2 variantes × 8 tarefas × 2 repetições = 32 execuções
- **Tempo total (relógio):** 3 min 28 s medidos pelo promptfoo (3 min 33 s com a inicialização do `pnpm`). Meta era ≤ 35 min.
- **Duração por execução:** de 11,7 s a 41,6 s (mediana ~18 s).
- **Custo estimado (lista):** A US$ 1,42 · B US$ 1,45.

## Resultado

| | A (sem CLAUDE.md) | B (com CLAUDE.md) |
|---|---|---|
| passou | 12/16 (75%, Wilson 51% a 90%) | 16/16 (100%, Wilson 81% a 100%) |
| pass^2 | 6/8 | 8/8 |
| fora do escopo | 3 | 0 |
| erros do agente | 0 | 0 |

**Veredito: inconclusivo.** Os intervalos de Wilson 95% se sobrepõem (81% a 90%). O relatório diz que seriam necessárias 27 execuções por variante para os intervalos deixarem de se sobrepor nessas taxas (critério do veredito); o piso pelo teste z de duas proporções é 24.

## Falhas (todas da variante A, todas em tarefas de convenção)

- `04-cupom` (2 de 2): numa, `fora_do_escopo` (mexeu em `src/legado/relatorio.ts`, pasta congelada, regra só escrita no CLAUDE.md da B); na outra, o teste escondido falhou (`falhou`).
- `06-relatorio-email` (2 de 2): `fora_do_escopo` (mexeu em `src/relatorio.ts` numa e em `src/inscricoes.ts` na outra).

Nenhum `erro_agente`, nenhum erro de harness, nenhum run descartado.

## Isolamento (verificado no ensaio de 2026-10-26; o código do executor não mudou desde então)

- A: respondeu NENHUMA, sem o CLAUDE.md global do usuário, sem MCP, hooks ou skills do usuário. B: citou só o `CLAUDE.md` da cópia.
- **Vazamento achado e corrigido:** com as flags antigas, o init do Claude Code listava 47 servidores MCP (conectores da conta claude.ai, que `--setting-sources project` não controla) e até 734 tools, de forma instável entre execuções. Correção: `--strict-mcp-config` (sem `--mcp-config`) em `argumentosClaude`; depois disso, 0 servidores MCP e 25 tools (as nativas) nas duas variantes. Teste da Task 4 atualizado.
- Skills no init: só as embutidas do Claude Code (nenhuma do usuário). Plugins: só os `builtin`.
- Instruções da organização (managed settings) continuam chegando às duas variantes; são iguais para A e B e não vêm de arquivo CLAUDE.md.

## Observações

- A diferença A × B vem de violar convenções "escondidas" (pasta `src/legado/` congelada), exatamente o efeito que as tarefas foram desenhadas para medir. Com n = 16 por lado ainda não dá para cravar.
- Nenhum agente desistiu do Bash; o `git` do host (fora da cópia) mediu o escopo sem problema.
- `pnpm eval` sai com código 100 quando há execuções reprovadas (comportamento do promptfoo); o arquivo é gravado normalmente.
- **Limite do sanitizador (`pnpm ensaio:gravar`).** A limpeza dos caminhos é substituição de texto no JSON inteiro: a raiz do projeto vira `.`, o home vira `~`, e `/tmp`, `/private/tmp` e `/var/folders` viram `<tmp>`. Por isso qualquer trecho `/tmp` vira `<tmp>`, mesmo fora de um caminho, e um caminho com barras escapadas (por exemplo `\/Users\/...`) não é trocado. Neste ensaio, uma busca por `/Users`, `\/Users` e `private` no `resultado.json` não acha nada; confira o seu antes de publicar.
- `pnpm relatorio:ensaio` é só leitura/escrita de arquivo (`node:fs`, sem `fetch`; o HTML não carrega recurso externo), então funciona sem rede. Verificado por leitura do código, sem desligar o Wi-Fi.
