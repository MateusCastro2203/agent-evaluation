# Rodando com promptfoo

Este capítulo mostra como rodar o experimento no seu computador e o que acontece em cada execução.

> **Nota sobre versões.** Comandos, flags e números abaixo são os do repositório (`package.json`, `src/claude.ts`, `evals/promptfooconfig.yaml`) no dia em que este ebook foi gerado. As flags do `claude -p` mudam entre versões do Claude Code: se algo daqui divergir do código, vale o código.

## O que você precisa

- **Node.js** na versão LTS atual e **pnpm**.
- **Claude Code** instalado e com login feito (`claude`, uma vez, no terminal). O repositório usa a sua assinatura normal do Claude Code. **Não precisa de chave de API**, e este ebook não recomenda usar uma.
- **git**: o repositório usa o git do seu computador para medir o que o agente mudou.
- **macOS**: o sandbox que isola o agente e a correção foi testado só no macOS. Em Linux, o Claude Code e o sandbox-runtime têm suporte próprio, mas este repositório não foi testado lá.

Sem assinatura? Dá para ler o resultado de um run gravado, offline, com `pnpm relatorio:ensaio` (abaixo).

## Os comandos

```bash
pnpm install            # instala as dependências
pnpm test               # camada 1: testes do medidor, offline, sem agente
pnpm eval:rapido        # fumaça: 1 tarefa, 1 repetição, A e B (2 execuções reais)
pnpm eval               # o run completo: 32 execuções reais
pnpm relatorio          # lê resultados/ultimo.json e gera resultados/relatorio.html
pnpm ensaio:gravar      # grava o último run como ensaio (sem caminhos pessoais)
pnpm relatorio:ensaio   # mesmo relatório sobre o run gravado (offline)
```

Uma ordem que funciona:

1. `pnpm test` primeiro. Se ele falhar, o problema está no medidor, não no agente (veja "Duas camadas", abaixo).
2. `pnpm eval:rapido` para confirmar que o login e o Claude Code respondem. São 2 execuções reais.
3. `pnpm eval` para o run de verdade: 2 variantes × 8 tarefas × 2 repetições = 32 execuções, modelo `sonnet`, 4 em paralelo. No notebook do palestrante, o ensaio levou **3 min 28 s** de relógio (cada execução, de 12 s a 42 s). No seu computador, o tempo depende do modelo, da concorrência e da sua cota.
4. `pnpm relatorio` e abra `resultados/relatorio.html` no navegador. O capítulo 5 explica como ler.

**O `pnpm eval` sai com código 100 quando alguma execução não passou.** É o comportamento do promptfoo, não um erro: o JSON em `resultados/ultimo.json` é gravado do mesmo jeito. Quem decide o veredito é o `pnpm relatorio`.

O run gravado no ensaio de 2026-10-27 fica em `resultados/ensaio/` (o JSON, o relatório e as notas em `NOTAS.md`). Ele serve de plano B ao vivo e de modo offline para quem não tem assinatura: `pnpm relatorio:ensaio` não chama nenhum modelo e grava `resultados/ensaio/relatorio.html`, ao lado do JSON, sem tocar no relatório do run ao vivo. Para gravar um ensaio seu, rode `pnpm eval` e logo depois `pnpm ensaio:gravar`: ele copia `resultados/ultimo.json` para `resultados/ensaio/resultado.json` trocando a pasta do projeto por `.`, o seu home por `~` e as pastas temporárias por `<tmp>`, e gera o relatório.

## O que acontece em uma execução

Cada uma das 32 execuções passa por três etapas.

### 1. Cópia limpa

O repositório cria uma pasta temporária nova (em `/tmp/medindo-agentes/`, fora de qualquer repositório e fora do `$TMPDIR`), copia o laboratório para ela (sem `node_modules`) e coloca o `CLAUDE.md` se a variante for B. Depois registra esse estado inicial num git **do host**: o diretório do git fica ao lado da cópia, não dentro dela (`--git-dir` e `--work-tree`). Tudo o que o agente fizer depois é comparado com esse estado.

Por que o git fica fora: se a cópia fosse um repositório, o agente poderia mexer no `.git` (um `config` com filtro, um hook) e fazer o git do host rodar código dele na hora de medir. Com o git fora, nada do que o agente escreve na cópia vira configuração do git.

As dependências do laboratório (só o Vitest e os tipos do Node) ficam numa pasta própria, `.lab-deps`, instalada uma vez e **somente leitura**. O `node_modules` da cópia só tem links para ela. Antes e depois da correção, o repositório confere um hash dessa pasta (conteúdo, permissões e links): se o agente conseguir mudar uma dependência, a execução vira `erro_agente` em vez de contar como resultado.

A cópia limpa garante que uma execução não contamina a outra e que A e B partem exatamente do mesmo código. A única diferença entre as variantes é o `CLAUDE.md`.

### 2. O agente

Na cópia, o repositório roda o Claude Code em modo **headless**: sem tela interativa, com o prompt da tarefa como argumento e o resultado em JSON. A chamada (função `argumentosClaude` em `src/claude.ts`) usa:

- `-p <prompt>` e `--output-format json`;
- `--model sonnet` (fixado em `evals/promptfooconfig.yaml`);
- `--max-turns 30`, e um timeout de 10 minutos por execução, aplicado pelo próprio repositório (ele mata o grupo de processos inteiro);
- `--permission-mode dontAsk` com uma lista fechada em `--allowedTools`: ler e editar só dentro da cópia (`Read(./**)`, `Edit(./**)`), rodar `pnpm test` e `pnpm vitest`, e os comandos de leitura `ls`, `cat`, `grep`, `head` e `wc`. O que não está na lista é recusado, sem perguntar a ninguém;
- `--disallowedTools` com `WebFetch`, `WebSearch`, a edição do `node_modules`, a leitura do projeto (onde estão os testes escondidos e as soluções) e a leitura do seu `~/.claude`;
- um **sandbox do sistema operacional** (o Seatbelt, no macOS), configurado por `--settings`: todo comando Bash, inclusive o código que o `pnpm test` roda, só escreve na cópia e no `$TMPDIR`, não lê o seu home nem as outras cópias, e não tem rede. O sandbox falha alto se não estiver disponível e não oferece a saída "rodar fora do sandbox";
- `--setting-sources project`, para não carregar a sua configuração pessoal (veja "Isolamento", abaixo);
- `--strict-mcp-config`, sem `--mcp-config`: nenhum servidor MCP;
- `--no-session-persistence`, para as execuções não deixarem sessões salvas na sua máquina.

O processo também roda sem as variáveis de ambiente de uma sessão do Claude Code que esteja aberta (`CLAUDECODE`, `CLAUDE_CODE_*`). O login vem do mesmo lugar de sempre.

**Nunca use `--permission-mode bypassPermissions` nem `--dangerously-skip-permissions` para rodar esta eval.** São 32 execuções sem ninguém olhando: com as permissões desligadas, um agente que decide "limpar" arquivos ou instalar algo faz isso na sua máquina, não só na cópia.

Do JSON final, o repositório lê `is_error`, `num_turns`, `duration_ms`, `total_cost_usd` e os campos de `usage`: tokens de entrada e de saída, e, separados, os de cache (leitura + criação). Se o processo estourar o timeout, ou o JSON vier inválido, a execução vira `erro_agente` em vez de derrubar o run.

Confira as flags com `claude --help` e na página "Run Claude Code programmatically" da documentação antes de mudar qualquer coisa: elas mudam entre versões.

### 3. A correção

Quando o agente termina, o repositório:

1. lista os arquivos alterados em relação ao estado inicial, com o git do host, incluindo arquivos novos e apagados;
2. procura entradas suspeitas na cópia: qualquer link simbólico, qualquer `.git`, FIFO ou dispositivo. Se achar, a execução vira `fora_do_escopo` e nem é corrigida;
3. compara a lista de alterados com `permitidos` da tarefa. `package.json`, configuração do Vitest ou do Vite e qualquer coisa dentro de um `.git` são sempre fora do escopo;
4. monta uma pasta **nova**, que o agente nunca viu: o laboratório intacto, mais os arquivos que ele mudou (só arquivos comuns), mais o teste escondido por cima de `test/oculto.test.ts`;
5. roda só o teste escondido, com a configuração fixa do Vitest (capítulo 3), dentro de outro sandbox (o `srt`, do pacote `@anthropic-ai/sandbox-runtime`): sem rede, escrevendo só na pasta corrigida;
6. decide o desfecho: `erro_agente`, senão `fora_do_escopo`, senão `passou` ou `falhou`.

A lista de alterados vem do git do host (trecho de `src/copia.ts`, com as linhas quebradas para caber na página):

```ts
export async function arquivosAlterados(pasta: string): Promise<string[]> {
  const nulo = (s: string) => s.split("\0").filter(Boolean);
  const mudados = nulo(
    await git(pasta, "diff", "--name-only", "--no-renames", "-z", REF_INICIAL),
  );
  const novos = nulo(
    await git(pasta, "ls-files", "--others", "-z",
      `--exclude-from=${exclusoes(pasta)}`),
  );
  return [...new Set([...mudados, ...novos])]
    .filter((f) => f !== OCULTO)
    .sort();
}
```

Um detalhe que só apareceu rodando de verdade: `pnpm test` dentro da cópia cria um `pnpm-lock.yaml`. Sem tratar isso, todo agente que roda os testes (que é o que o `CLAUDE.md` pede) apareceria com um arquivo fora do escopo. As exclusões do git do host (o arquivo `exclusoes`, fora da cópia) escondem esse arquivo e o `node_modules` montado pelo repositório; um `.gitignore` criado pelo agente na cópia não esconde nada.

### Notas de método

Algumas consequências desse desenho, que valem saber antes de ler o resultado:

- **A cópia não é um repositório git.** Um comando `git` do agente (`git status`, `git diff`) falha. Se o agente rodar `git init`, cria um `.git` e a execução vira `fora_do_escopo`. As tarefas não pedem git, e no ensaio nenhuma execução criou um `.git`.
- **Qualquer link simbólico criado pelo agente vira `fora_do_escopo`**, mesmo um que aponte para dentro da cópia: a correção só aceita arquivos comuns.
- **Configuração gerenciada pela organização continua valendo.** Se a sua conta tem configurações gerenciadas (managed settings), elas chegam às duas variantes, igualmente, e nenhuma flag tira. O isolamento é "nada do seu usuário e nada de MCP", não "configuração zero".
- **A tarefa 06 mede só a convenção.** O prompt pede uma função de relatório sem dizer onde; a variante A não tem nenhum sinal de que ela deve ir em `src/relatorios/`. A diferença ali é o efeito do `CLAUDE.md`, por construção.
- **O `ensaio:gravar` limpa por texto.** Ele troca os caminhos por substituição de texto no JSON: qualquer trecho `/tmp` vira `<tmp>`, mesmo fora de um caminho, e um caminho escrito com barras escapadas passaria. Confira o JSON antes de publicar um ensaio seu.

## Onde entra o promptfoo

O promptfoo é o **orquestrador**: ele lê a lista de casos, chama um *provider* para cada um, repete, roda em paralelo e grava tudo num JSON. *Provider*, no promptfoo, é o pedaço de código que "responde" a cada caso. Normalmente é um modelo; aqui é um provider em TypeScript que roda as três etapas acima e devolve o desfecho.

No repositório:

- `evals/agente.ts` é o provider: recebe a variante e o modelo na configuração, expõe `id()` (`claude-code-a` ou `claude-code-b`) e `callApi`, que roda a tarefa e devolve `{ output: desfecho, metadata: { resultado } }`;
- `evals/casos.ts` gera um caso por tarefa, com uma asserção que passa quando o `output` é `passou`;
- `evals/promptfooconfig.yaml` declara os dois providers, 2 repetições e concorrência 4.

O trecho principal da configuração:

```yaml
providers:
  - id: file://agente.ts
    label: variante a
    config:
      variante: a
      modelo: sonnet
  - id: file://agente.ts
    label: variante b
    config:
      variante: b
      modelo: sonnet
tests: file://casos.ts
evaluateOptions:
  maxConcurrency: 4
  repeat: 2
```

O cache fica desligado pela linha de comando (`--no-cache`, nos scripts do `package.json`): na versão do promptfoo usada, a chave `cache: false` do arquivo não tinha efeito.

A página "Javascript Provider" da documentação do promptfoo descreve o contrato do provider (`id` e `callApi`). A página "Command line" descreve as flags que o `pnpm eval:rapido` usa: `--filter-first-n` para rodar só a primeira tarefa e `--repeat` para mudar o número de repetições, além de `-o` para gravar a saída.

O promptfoo não calcula o veredito. Ele não tem intervalo de confiança nem comparação A × B com essa regra. Isso fica num script do repositório (`scripts/relatorio.ts`), que lê o JSON do promptfoo e tira o desfecho de `metadata.resultado`, nunca do "passou/falhou" do promptfoo, que não distingue `erro_agente` de `falhou`. É o assunto do capítulo 5.

## Isolamento: a sua configuração não pode vazar

Este é o erro mais fácil de cometer e o mais difícil de perceber. O Claude Code lê configuração de vários lugares: do projeto, mas também do seu usuário (`~/.claude/CLAUDE.md`, hooks, skills globais, plugins) e dos conectores MCP da sua conta. Se você tem um `CLAUDE.md` pessoal, a variante A **não** roda "sem `CLAUDE.md`": ela roda com o seu. O experimento fica contaminado e você não fica sabendo.

O repositório restringe as fontes de configuração ao projeto (`--setting-sources project`), o que mantém o `CLAUDE.md` da cópia (variante B) e deixa de fora o seu usuário. Isso não bastou: medindo de verdade, o início de cada execução ainda listava 47 servidores MCP (os conectores da conta, que `--setting-sources` não controla) e um número instável de ferramentas. Com `--strict-mcp-config`, sem nenhum `--mcp-config`, ficaram 0 servidores MCP e só as 25 ferramentas nativas, nas duas variantes.

A verificação foi feita assim, antes do ensaio (`resultados/ensaio/ISOLAMENTO.md`): numa cópia de cada variante, com os mesmos argumentos do executor, pedir ao agente que liste literalmente todas as instruções de `CLAUDE.md` ou memória que recebeu, e ler o evento de início (`--output-format stream-json --verbose`). A variante A respondeu "NENHUMA"; a B citou só o `CLAUDE.md` da cópia. Se você adaptar o repositório, repita essa verificação na sua máquina.

> **Segurança: rode só numa cópia descartável.**
>
> - Nunca aponte o agente para o seu checkout de trabalho. Cada execução tem que rodar numa pasta temporária que pode ir para o lixo.
> - Mantenha o sandbox ligado: sem rede, escrita só dentro da cópia.
> - Se você trocar o laboratório pelo seu repositório, confira o sandbox de novo: peça ao agente, numa cópia, para escrever fora dela e para acessar a rede, e veja as duas coisas falharem.
> - Lembre que `pnpm test` roda o que o `package.json` mandar. O script `test` do seu projeto passa a ser executado dezenas de vezes, sem supervisão.

## Duas camadas de eval

O repositório tem duas camadas, com papéis diferentes.

**Camada 1: determinística.** São os testes do **medidor**, com um agente falso: um que não faz nada (deve dar `falhou`), um que aplica a solução de referência (`passou`), um que edita o código congelado (`fora_do_escopo`), um que devolve timeout (`erro_agente`, sem derrubar o run), um que planta um teste oculto falso (continua `falhou`). Roda offline, em segundos, a cada commit, com `pnpm test`. Ela prova que a régua mede certo.

**Camada 2: modelo real.** É o `pnpm eval`: o Claude Code de verdade nas 8 tarefas. Leva minutos e consome cota. Rode quando algo que você quer medir mudar: o prompt, o `CLAUDE.md`, o modelo, uma skill, um hook.

Sem a camada 1, um bug no medidor parece "o agente piorou". Com ela, quando a camada 2 muda de resultado, você sabe que foi o agente.
