# Referências

Só fontes públicas, todas conferidas em 26/10/2026. As páginas de documentação mudam: se uma flag citada aqui não bater com a sua versão, vale a documentação atual.

## promptfoo

- "Javascript Provider": o contrato do provider próprio (`id`, `callApi`). https://www.promptfoo.dev/docs/providers/custom-api/
- "Command line": `promptfoo eval` e as flags `--repeat`, `-j`/`--max-concurrency`, `-n`/`--filter-first-n` e `-o`. https://www.promptfoo.dev/docs/usage/command-line/
- "LLM Rubric": asserção com modelo como juiz (`llm-rubric`). https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/

## Claude Code

- "Run Claude Code programmatically": modo headless (`-p`), `--output-format json` e os campos do JSON; o custo é estimativa do lado do cliente. https://code.claude.com/docs/en/headless
- "How Claude remembers your project": `CLAUDE.md` é contexto, não configuração obrigatória; para bloquear uma ação, hook `PreToolUse`. https://code.claude.com/docs/en/memory
- "Extend Claude with skills": a descrição da skill fica no contexto, o corpo entra quando ela é usada. https://code.claude.com/docs/en/skills
- "Hooks reference": hook `PreToolUse` que sai com código 2 bloqueia a chamada. https://code.claude.com/docs/en/hooks

## Codex CLI (desafio extra)

- "Non-interactive mode": `codex exec`, `--json`, `--sandbox workspace-write`, `--ignore-user-config`. https://learn.chatgpt.com/docs/non-interactive-mode

## Evals de agentes

- Anthropic (2026), "Demystifying evals for AI agents": pass^k como a chance de todas as k tentativas darem certo; avaliadores em código × avaliadores com modelo. https://www.anthropic.com/research/demystifying-evals-for-ai-agents
- Yao et al. (2024), "τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains": propõe a métrica pass^k para medir a confiabilidade do agente em várias tentativas. https://arxiv.org/abs/2406.12045
- Jimenez et al. (2023), "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?": issues reais do GitHub como tarefa para modelos que editam o código, o mesmo formato das tarefas deste repositório. https://arxiv.org/abs/2310.06770
- Zheng et al. (2023), "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena": vieses de posição, de verbosidade e de autopreferência em juízes. https://arxiv.org/abs/2306.05685

## Estatística

- Intervalo de Wilson (Wilson, 1927) e por que ele se comporta melhor que o intervalo "p ± z·√(p(1−p)/n)" com n pequeno ou taxa extrema: Wikipedia, "Binomial proportion confidence interval". https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval

A fórmula de tamanho de amostra do capítulo 5 é a aproximação normal para comparar duas proporções (1,96 para 95% de confiança bilateral, 0,84 para 80% de poder). `[sem fonte]`: não encontrei uma página pública verificada que traga exatamente esta forma.
