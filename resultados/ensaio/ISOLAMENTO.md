# Isolamento verificado (Claude Code headless, `claude -p` com os argumentos do executor)

Medido pelo evento `init` (`--output-format stream-json --verbose`) e pela resposta ao prompt
"Liste literalmente todas as instruções de arquivos CLAUDE.md ou memória que você recebeu".

| | Variante A | Variante B |
|---|---|---|
| Resposta | "NENHUMA" (sem CLAUDE.md, sem memória) | só o CLAUDE.md da cópia da tarefa; memória: NENHUMA |
| CLAUDE.md do usuário | não carregado | não carregado |
| Servidores MCP | 0 | 0 |
| Tools | 25 (nativas) | 25 (nativas) |
| Skills | só as embutidas do Claude Code | só as embutidas |
| Plugins | só `builtin` | só `builtin` |
| Hooks do usuário | nenhum | nenhum |

Antes da correção (`--setting-sources project` sozinho), o init listava 47 servidores MCP (conectores
da conta) e de 133 a 734 tools, de forma instável. `--strict-mcp-config` resolveu.
As instruções da organização (managed settings) chegam igualmente às duas variantes.
