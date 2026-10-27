# agent-evaluation

Repositório da palestra **"Como medir os seus agentes de IA"**: do "parece que melhorou" para a eval.

Ele mede, de verdade, se um `CLAUDE.md` com as convenções do projeto deixa o Claude Code melhor num app pequeno de laboratório (uma agenda de meetups, sintética). São duas variantes:

- **A:** o app como está, **sem** `CLAUDE.md`;
- **B:** o mesmo app **com** o `CLAUDE.md` de `variantes/b/`.

Cada variante faz as mesmas 8 tarefas (`tarefas/`), escritas como issue. Cada tarefa tem um **teste escondido**, que o agente não vê, e uma lista de arquivos que ela pode alterar. O [promptfoo](https://www.promptfoo.dev/) orquestra as execuções. Um script do repo calcula as métricas (taxa de sucesso com intervalo de Wilson, pass^k, fora do escopo, tokens, turnos, duração e custo estimado) e dá o veredito: **B melhor**, **A melhor** ou **inconclusivo**.

Os slides, o guia de fala e o ebook da palestra também estão aqui (veja [Material](#material)).

## Pré-requisitos

- **Node.js** na versão LTS atual e **pnpm** (o campo `packageManager` do `package.json` fixa a versão).
- **Claude Code** instalado e com login feito: rode `claude` uma vez no terminal. O repo usa o seu login normal do Claude Code (`claude -p`). **Não precisa de chave de API.**
- **git**, que mede o que o agente mudou.
- **macOS.** O sandbox do sistema operacional que isola o agente e a correção foi testado só no macOS. O Claude Code e o sandbox-runtime têm suporte próprio para Linux, mas este repo **não foi testado em Linux**.
- Para `pnpm material`: Chrome, Edge ou Chromium (ou a variável `CHROME_PATH`). Para `pnpm checar-termos`: `pdftotext` (do pacote poppler).

Não tem assinatura do Claude Code? Dá para ler o resultado do run gravado, offline: `pnpm install` e depois `pnpm relatorio:ensaio`.

## Começo rápido

```bash
pnpm install             # dependências
pnpm test                # camada 1: testes do medidor com agente falso (offline, sem modelo)
pnpm eval:rapido         # fumaça: 1 tarefa × 1 repetição × A e B = 2 execuções reais
pnpm eval                # o run completo: 2 variantes × 8 tarefas × 2 repetições = 32 execuções reais
pnpm relatorio           # lê resultados/ultimo.json → tabela no terminal + resultados/relatorio.html
pnpm relatorio:ensaio    # o mesmo relatório sobre o run gravado (resultados/ensaio/), offline
pnpm ensaio:gravar       # grava o último run como ensaio, sem caminhos pessoais
pnpm material            # gera os slides (PDF + PPTX), o guia de fala e o ebook (PDF)
```

Para saber:

- **`pnpm eval` sai com código 100 quando alguma execução não passou.** É assim que o promptfoo funciona, não é um erro: o JSON é gravado do mesmo jeito. Quem dá o veredito é o `pnpm relatorio`.
- **`pnpm relatorio` sai com código 1 só quando o veredito é "A melhor"**, ou seja, quando há evidência de que a mudança piorou o agente. "Inconclusivo" e "B melhor" saem com 0, então dá para usar o relatório como portão no CI. Se não conseguir ler o arquivo de entrada, sai com 2. Para ler outro arquivo, passe o caminho: `pnpm relatorio caminho/resultado.json`.
- O relatório HTML é gravado **na mesma pasta do JSON de entrada**. O run ao vivo vai para `resultados/relatorio.html` e não sobrescreve o do ensaio (`resultados/ensaio/relatorio.html`).
- `pnpm eval:rapido` e `pnpm eval` sobrescrevem `resultados/ultimo.json`. Para guardar um run como ensaio, rode `pnpm ensaio:gravar` logo depois dele.
- `pnpm eval` e `pnpm eval:rapido` rodam com `PROMPTFOO_DISABLE_TELEMETRY=1`: o promptfoo não manda telemetria de uso durante o run.
- A configuração do run fica em `evals/promptfooconfig.yaml`: modelo `sonnet`, `repeat: 2`, `maxConcurrency: 4`. Cada execução tem limite de 30 turnos e timeout de 10 minutos (`src/executor.ts`).

### O run gravado (ensaio)

`resultados/ensaio/` tem um run completo de exemplo, com o JSON, o relatório e as notas ([`NOTAS.md`](resultados/ensaio/NOTAS.md) e [`ISOLAMENTO.md`](resultados/ensaio/ISOLAMENTO.md)). Com `sonnet`, concorrência 4 e 2 repetições, as 32 execuções levaram **3 min 17 s** de relógio.

| Variante | Passou | Taxa (Wilson 95%) |
|---|---|---|
| A | 13 de 16 | 81% (57% a 93%) |
| B | 16 de 16 | 100% (81% a 100%) |

O veredito foi **inconclusivo**, porque os intervalos se sobrepõem. O relatório estima **38 execuções por variante** para os intervalos deixarem de se sobrepor nessas taxas (o critério do veredito); o teste z de duas proporções dá um piso de 34. É um exemplo, não uma previsão: o seu run pode dar outro resultado. Se regravar o ensaio, atualize estes números.

## Como uma execução roda

1. **Cópia limpa.** O executor cria uma pasta nova em `/tmp/medindo-agentes/` com o laboratório (`laboratorio/`). Na variante B, ela também recebe o `CLAUDE.md`. O estado inicial fica registrado num git **do host**, fora da cópia, onde o agente não alcança.
2. **Agente.** `claude -p` roda dentro da cópia, sem tela interativa (headless), com saída JSON (`src/claude.ts`).
3. **Correção.** Roda numa pasta **nova**, que o agente nunca viu. Ela recebe o laboratório intacto, os arquivos que o agente mudou e, por último, o teste escondido. O Vitest roda com uma configuração fixa de fora da cópia, dentro de um sandbox (`srt`, do `@anthropic-ai/sandbox-runtime`). Os arquivos alterados são comparados com os permitidos da tarefa.
4. **Desfecho.** A ordem de decisão é esta:
   - `erro_agente`: timeout, login, limite de turnos, saída inválida ou dependências adulteradas;
   - senão, `fora_do_escopo`;
   - senão, `passou` ou `falhou`.

   `erro_agente` fica fora do n da taxa e é contado à parte.

### Isolamento e segurança

O agente roda com estas proteções (veja `argumentosClaude` em `src/claude.ts`):

- **`--permission-mode dontAsk` e uma lista fechada em `--allowedTools`.** O agente pode ler e editar só dentro da cópia, rodar `pnpm test` e `pnpm vitest`, e usar comandos de leitura (`ls`, `cat`, `grep`, `head`, `wc`). O resto é recusado sem perguntar.
- **`--disallowedTools`.** Bloqueia `WebFetch`, `WebSearch`, a edição do `node_modules`, a leitura do projeto (onde ficam os testes escondidos e as soluções) e a leitura do seu `~/.claude`.
- **Sandbox do SO, configurado por `--settings`.** Vale para todo comando Bash, inclusive o que o `pnpm test` roda. Esses comandos só escrevem na cópia e no `$TMPDIR`, não leem o seu home nem as outras cópias e não têm rede. Se o sandbox não estiver disponível, a execução falha em vez de rodar sem ele.
- **`--setting-sources project`.** A sua configuração global do Claude Code (`~/.claude/CLAUDE.md`, hooks, skills e plugins) **não** entra; o `CLAUDE.md` da cópia (variante B) entra. Sem isso, a variante A rodaria com o seu `CLAUDE.md` pessoal e o experimento ficaria contaminado.
- **`--strict-mcp-config`, sem `--mcp-config`.** Nenhum servidor MCP entra, nem os conectores da sua conta, que `--setting-sources` não controla.
- **`--no-session-persistence` e `--max-turns`.**
- **Dependências somente leitura.** As dependências do lab ficam em `.lab-deps`, somente leitura. O executor confere um hash delas antes e depois da correção.

O isolamento foi verificado de verdade antes do ensaio. A variante A respondeu que não recebeu nenhuma instrução de `CLAUDE.md` ou de memória, e as duas variantes rodaram com 0 servidores MCP e só as ferramentas nativas ([`ISOLAMENTO.md`](resultados/ensaio/ISOLAMENTO.md)).

> [!WARNING]
> **Rode só em cópia descartável.**
>
> - **Nunca aponte o agente para o seu checkout de trabalho.** O executor sempre trabalha numa cópia em `/tmp/medindo-agentes/`. Se você adaptar o repo, mantenha isso.
> - **Mantenha o sandbox.** Nunca troque por `--permission-mode bypassPermissions` ou `--dangerously-skip-permissions`: são dezenas de execuções sem ninguém olhando.
> - **Confira o sandbox de novo depois de trocar o laboratório pelo seu projeto.** Numa cópia, peça ao agente para escrever fora dela e para acessar a rede. As duas coisas têm que falhar.
> - **Leia os scripts do seu projeto antes de rodar a eval nele.** O `pnpm test` da cópia roda o que o `package.json` dela mandar.

### Notas de método

- **A cópia não é um repositório git.** O git que mede o diff fica fora dela, então os comandos `git` do agente falham. Se o agente rodar `git init`, ele cria um `.git` e a execução vira `fora_do_escopo`.
- **Qualquer link simbólico criado pelo agente vira `fora_do_escopo`**, mesmo um que aponte para dentro da cópia: a correção só aceita arquivos comuns. O mesmo vale para `.git`, FIFO e dispositivo. Mudanças em `package.json` ou na configuração do Vitest ou do Vite também são sempre fora do escopo.
- **A configuração gerenciada pela organização (managed settings) continua chegando às duas variantes**, igualmente. O isolamento tira o seu usuário e o MCP, mas não é "configuração zero".
- **A tarefa 06 mede só a convenção.** O prompt não diz onde a função de relatório deve ficar, e a variante A não tem nenhum sinal de que o lugar é `src/relatorios/`.
- **O `ensaio:gravar` limpa os caminhos por substituição de texto.** A raiz do projeto vira `.`, o home vira `~`, e `/tmp`, `/private/tmp` e `/var/folders` viram `<tmp>`. Por isso qualquer trecho `/tmp` vira `<tmp>`, mesmo fora de um caminho, e um caminho com barras escapadas não é trocado. Confira o JSON antes de publicar um ensaio seu.
- **O custo em US$ é a estimativa do próprio Claude Code** (`total_cost_usd`). Com assinatura, leia como o tamanho do esforço, não como fatura.

## Como adaptar ao seu projeto

O roteiro completo está no ebook, capítulo 6, seção ["Adapte ao seu projeto"](ebook/06-melhorando-o-agente.md#adapte-ao-seu-projeto). Em resumo:

1. Escolha a pergunta (o que muda entre A e B) e mude **uma** coisa só.
2. Junte pelo menos 5 pedidos reais: 3 que dependem da mudança e 2 de controle.
3. Para cada pedido, crie `tarefas/NN-nome/` com três itens:
   - `tarefa.json`, com o prompt escrito como issue (sem citar a convenção) e os `permitidos`;
   - `oculto.test.ts`;
   - `solucao/`.
4. Confira que toda tarefa falha no código intacto e passa com a solução. O `pnpm test` faz essa checagem.
5. Faça as trocas no código:
   - `LAB` em `src/copia.ts`;
   - a variante em `variantes/b/`;
   - os termos proibidos nos prompts, em `test/tarefas.test.ts`;
   - as dependências, em `prepararDependencias` (`src/copia.ts`).
6. Rode `pnpm eval:rapido`, depois `pnpm eval`, e leia o relatório como no capítulo 5.

## Desafio extra: medir outro agente (Codex)

A chamada ao agente fica atrás da interface `RodarAgente` (`src/claude.ts`). Tarefas, cópia, correção, escopo e relatório não sabem qual agente rodou. Para medir outro agente, implemente outra `RodarAgente`.

Um exemplo é o `codex exec`, o modo não interativo do Codex CLI:

- use a cópia descartável como diretório de trabalho;
- use `--json` e `--sandbox workspace-write`;
- use `--ignore-user-config`, para o isolamento;
- não use o modo sem sandbox nem a aprovação automática de tudo.

A cópia deste repo não é um repositório git, então seria preciso usar `--skip-git-repo-check`. A documentação só recomenda essa flag quando o ambiente é seguro. Confira as flags na [documentação do modo não interativo](https://learn.chatgpt.com/docs/non-interactive-mode) e no `codex exec --help`.

O roteiro está no ebook, capítulo 6. Este desafio não está implementado no repo.

## Material

- [`palestra/slides.md`](palestra/slides.md): os slides (Marp), com notas do apresentador. Viram `palestra/apresentacao.html` (a versão para apresentar: abre no navegador, sem internet, e mostra as respostas das perguntas um clique por vez; tecla `p` abre as notas), `palestra/apresentacao.pdf` e `palestra/apresentacao.pptx` (cada slide já completo).
- [`palestra/guia-de-fala.md`](palestra/guia-de-fala.md): o que dizer em cada slide, a revelação em três versões, o plano B e as perguntas prováveis. Vira `palestra/guia-de-fala.pdf`.
- [`ebook/ebook.pdf`](ebook/ebook.pdf): o ebook. Os capítulos ficam em `ebook/*.md`.

`pnpm material` regenera os PDFs e o PPTX. Com `REPO_URL` definido (por exemplo, `REPO_URL=https://github.com/<dono>/<repo>/blob/main`), os links relativos dos PDFs viram links do GitHub.

Repositório: <https://github.com/MateusCastro2203/agent-evaluation>

## Estrutura

```
laboratorio/        app de laboratório (o que o agente edita, sempre numa cópia)
tarefas/NN-nome/    tarefa.json, oculto.test.ts (teste escondido) e solucao/
variantes/b/        o CLAUDE.md da variante B
src/                executor, chamada ao claude, cópia e correção, métricas, veredito, relatório
evals/              provider e config do promptfoo
scripts/            relatorio, gravar-ensaio, material, checar-termos
test/               camada 1: testes do medidor (agente falso, offline)
resultados/ensaio/  run gravado de exemplo (o resto de resultados/ é ignorado pelo git)
palestra/ ebook/    material da palestra
```

## Checagem antes de publicar

`pnpm checar-termos` procura uma lista de termos que não podem ser publicados. Ele olha todos os arquivos que iriam para o repositório (os rastreados e os novos que o git não ignora) e o texto dos PDFs e PPTX. A lista fica **fora** do projeto, em `../.termos-internos.txt` (ou no caminho de `TERMOS_ARQUIVO`), com uma expressão por linha, e nunca é commitada. Se achar algo, o script sai com código 1 e lista `arquivo:linha`. Se algum PDF ou PPTX não puder ser lido (sem `pdftotext` ou `unzip`), ele sai com código 2, porque o texto desses arquivos não foi checado. Para pular esses arquivos de propósito, rode `CHECAR_SEM_PDF=1 pnpm checar-termos`: ele avisa quais ficaram de fora e sai com 0. As palavras liberadas por nome ("Creditas", "KTLO") só escondem uma ocorrência que caiba inteira dentro delas; um termo que contém uma delas continua sendo achado.

## Licença

- **Código** (tudo fora dos textos abaixo): [MIT](LICENSE).
- **Texto dos slides, do guia de fala e do ebook** (`palestra/slides.md`, `palestra/guia-de-fala.md`, `ebook/*.md` e os PDFs e o PPTX gerados deles): [CC BY 4.0](LICENSE-CONTEUDO). Pode copiar e adaptar, citando a fonte.

## Referências

As referências da palestra, com link, estão no último slide e no capítulo 9 do ebook ([`ebook/09-referencias.md`](ebook/09-referencias.md)).
