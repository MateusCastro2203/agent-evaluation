# Melhorando o agente

Medir só vale se vira decisão. Este capítulo é sobre como usar a eval para melhorar o agente que você usa, e como montar a eval no seu próprio projeto. As duas primeiras seções servem para qualquer pessoa. O roteiro de adaptação e o desafio extra são para quem vai mexer no repositório.

## Uma mudança por vez

Pense numa receita de bolo. Se você troca o forno **e** a farinha no mesmo dia e o bolo fica melhor, não sabe qual dos dois ajudou. O ciclo é o mesmo de um teste A/B de produto:

1. rode a eval **antes** da mudança (a linha de base);
2. mude **uma** coisa;
3. rode a eval **de novo**, com repetições;
4. compare as margens de erro (o intervalo de confiança), não só a taxa.

"Uma coisa" pode ser:

- o `CLAUDE.md`;
- uma skill nova;
- um hook;
- o modelo;
- o prompt da tarefa.

Se você mudar o modelo **e** o `CLAUDE.md` juntos e o resultado melhorar, você não sabe qual dos dois ganhou. Pode até ser que um ajudou muito e o outro atrapalhou um pouco. O experimento da palestra muda só uma coisa: a existência do `CLAUDE.md`.

Uma dica prática: commite a configuração do agente junto com o resultado da eval. Daqui a um mês, você sabe qual versão gerou qual número.

## Onde cada regra mora

O Claude Code oferece três lugares para pôr uma regra. Em uma linha cada:

- **`CLAUDE.md`:** um texto com as regras do projeto, que o agente lê no começo de toda conversa.
- **Skill:** um "manual" sobre um assunto, que o agente só abre quando a tarefa pede.
- **Hook:** um script seu que roda automaticamente antes ou depois de cada ação do agente, e pode bloquear a ação.

Eles se comportam de modo diferente.

| | Quando entra | Bom para | Cuidado |
|---|---|---|---|
| `CLAUDE.md` | em **toda** sessão | convenções do repo, comando de teste, pastas proibidas | é contexto, **não obrigação** |
| Skill | só quando é usada | procedimento longo, material de referência | descrição ruim, nunca é chamada |
| Hook | antes ou depois de cada ferramenta | regra que **precisa** valer sempre | é código: teste como código |

- **`CLAUDE.md`.** A documentação do Claude Code ("How Claude remembers your project") diz que o conteúdo do `CLAUDE.md` é tratado como contexto, não como configuração obrigatória. O modelo tende a seguir, mas pode não seguir. Para bloquear uma ação de verdade, a mesma documentação indica um hook `PreToolUse`.
- **Skill.** Pela documentação ("Extend Claude with skills"), só a descrição da skill fica no contexto o tempo todo; o corpo entra quando ela é usada. Material de referência longo custa quase nada até ser necessário. Em compensação, se a descrição for ruim, o agente não percebe que deveria usá-la.
- **Hook.** Um script que o Claude Code roda antes ou depois de cada chamada de ferramenta. Pela documentação ("Hooks reference"), um hook `PreToolUse` que sai com código 2 bloqueia a chamada, não importa o que o modelo queira. É a única das três que é determinística.

A regra que resume a tabela: **regra que não pode falhar não mora no prompt. Mora no hook, no teste ou no CI.**

Cada linha dessa tabela é uma variante B possível no repositório. Troque o `CLAUDE.md` por uma skill com as mesmas convenções, ou por um hook que bloqueia edição em `src/legado/`, e rode de novo. A pergunta deixa de ser "qual é melhor?" em abstrato e passa a ser "qual é melhor nestas tarefas, com esta margem de erro?".

## Falha vira tarefa nova

O conjunto de tarefas não é fixo. Ele cresce com o uso:

1. o agente erra algo no dia a dia;
2. você escreve uma **tarefa** com o prompt real que levou ao erro;
3. e um **teste escondido** que prova o comportamento certo;
4. confere que a tarefa falha no app intacto e passa com a solução de referência;
5. a tarefa entra no conjunto e **não sai mais**.

É a lição 7 do caso real (capítulo 7): o erro de terça vira tarefa na quarta.

### A catraca

Catraca é um mecanismo que só gira para um lado. Aplicada à eval:

- o conjunto de tarefas **só cresce**;
- o portão só quebra com evidência de piora (faixas que se separam, capítulo 5).

O portão roda no CI (integração contínua: o processo que roda os testes automaticamente a cada push ou PR) e não olha a taxa crua ("não pode cair abaixo da última vez"). Com poucas execuções, a taxa oscila de uma rodada para outra só por ruído, e um portão assim ficaria vermelho sem o agente ter piorado.

## Adapte ao seu projeto

O laboratório é pequeno de propósito. A eval que importa é a do **seu** repositório. Um roteiro para montar as primeiras 5 tarefas:

**1. Escolha a pergunta.** O que você quer saber? "Meu `CLAUDE.md` ajuda?", "Vale trocar de modelo?", "Esse hook atrapalha?". A pergunta define as variantes A e B. Mude uma coisa só.

**2. Junte 5 pedidos reais.** Procure no histórico do time: issues fechadas, PRs pequenos, pedidos que você fez ao agente na última semana. Prefira tarefas que um dev resolve em minutos, não em horas: cada execução precisa caber em poucos minutos, e você vai rodar várias.

**3. Misture regra da casa e controle.** Pelo menos 3 tarefas devem depender de algo que só a sua mudança ensina (a regra do `CLAUDE.md`, o procedimento da skill). Pelo menos 2 devem ser controle, sem relação com a mudança. Se B ganhar também nos controles, desconfie.

**4. Escreva o prompt como issue.** Diga o que a pessoa quer, não como o projeto faz. Não cite a regra da casa no prompt: se citar, A e B empatam.

**5. Escreva o teste escondido.** Ele é o critério de feito. Teste o comportamento e a regra da casa, não um detalhe que o prompt não pediu (lembre do código de erro da tarefa 03, no capítulo 3). Se o seu projeto não tem teste, comece por aqui: escrever o teste da tarefa é o primeiro entregável.

**6. Defina `permitidos`.** Liste os arquivos e pastas que a tarefa pode tocar. Inclua a pasta de testes, se o agente puder escrever testes.

**7. Prove que a tarefa é honesta.** Ela tem que falhar no código intacto e passar com uma solução de referência que você escreve. Guarde a solução em `solucao/`.

**8. Troque o laboratório pelo seu repo.** Este passo é o mais técnico. No `agent-evaluation`, são estas as mudanças:

- **De onde vem a cópia:** a constante `LAB` em `src/copia.ts` aponta para `laboratorio/`. Troque pelo caminho do seu projeto (ou copie o projeto para dentro de `laboratorio/`). A cópia continua sendo feita numa pasta temporária: o agente nunca trabalha no seu checkout.
- **As tarefas:** ponha as suas em `tarefas/NN-nome/` (`tarefa.json`, `oculto.test.ts`, `solucao/`) e a sua mudança em `variantes/b/`.
- **Os termos proibidos nos prompts:** o teste em `test/tarefas.test.ts` tem uma regex (expressão regular, um padrão de texto) com as palavras que nenhum prompt pode conter (hoje, `ErroDominio`, `relogio`, `Math.floor`, auditoria, `src/relatorios`, legado, `CLAUDE.md`). Troque pelos nomes das regras do **seu** projeto, para o teste continuar impedindo que o prompt entregue a resposta.
- **As dependências:** a cópia precisa delas para rodar os testes. O repositório instala uma vez, em `.lab-deps`, a lista fixa de `prepararDependencias` em `src/copia.ts` (hoje só `vitest` e `@types/node`, nas versões da raiz), deixa a pasta somente leitura, confere um hash dela antes e depois da correção e monta na cópia um `node_modules` com links para ela. Troque essa lista pelas dependências do seu projeto e mantenha as duas garantias: somente leitura e hash conferido.
- **Stack que não é Node:** o executor do teste escondido é Vitest, com a configuração fixa em `src/vitest-oculto.config.mjs`. Se o seu projeto é Python, Go, Java etc., troque esse executor pelo equivalente do seu stack (por exemplo, rodar só o arquivo do teste escondido com o runner da linguagem), mantendo as duas garantias: o teste entra por último, numa pasta corrigida nova, depois que o agente termina, e a configuração do runner vem de fora da cópia.

> **Segurança antes de rodar no seu projeto.**
>
> - Rode só em cópia descartável, nunca no seu checkout de trabalho.
> - Mantenha o sandbox: sem rede, escrita só dentro da cópia. Nunca troque por `bypassPermissions` ou `--dangerously-skip-permissions`.
> - Depois de apontar para o seu repositório, confira o sandbox de novo (capítulo 4).
> - `pnpm test`, ou o comando de teste do seu stack, roda o que os scripts do seu projeto mandarem, dezenas de vezes e sem supervisão. Leia esses scripts antes.

**9. Rode pequeno, depois grande.** Primeiro `pnpm eval:rapido`, para ver se tudo encaixa. Depois o run completo. Leia o relatório como no capítulo 5 e use a estimativa de execuções necessárias para decidir se vale rodar mais.

Cinco tarefas com duas repetições são 10 execuções por variante. Isso raramente separa A de B, mas já mostra onde o agente erra, e cada erro vira uma tarefa nova.

## Para quem quer ir fundo: medir outro agente

Este é um desafio extra. O método não é específico do Claude Code. No repositório, a parte que chama o agente fica isolada atrás de uma interface, a `RodarAgente` (em `src/claude.ts`):

```ts
export interface SaidaAgente {
  ok: boolean; erro?: string;
  turnos: number; duracaoMs: number; custoUsd: number;
  tokensEntrada: number; tokensSaida: number; tokensCache: number;
}
export type RodarAgente = (args: {
  pasta: string; prompt: string; modelo: string; maxTurnos: number; timeoutMs: number;
}) => Promise<SaidaAgente>;
```

Tarefas, cópia limpa, teste escondido, escopo e relatório não sabem qual agente rodou. Para medir outro agente, você implementa **outra** `RodarAgente`. O desafio fica descrito aqui, não implementado no repositório.

Um exemplo é o **Codex CLI**, da OpenAI. A documentação dele ("Non-interactive mode") descreve o `codex exec`, que roda o agente sem a interface interativa, para scripts e CI. Pontos que a documentação descreve e que interessam aqui:

- por padrão, o `codex exec` roda com sandbox somente leitura; para o agente poder editar a cópia, é preciso `--sandbox workspace-write`;
- com `--json`, a saída vira uma sequência de eventos JSON (um por linha), com eventos como `turn.completed`, `turn.failed` e `error`;
- `--ignore-user-config` faz o run não carregar o arquivo de configuração do usuário (`$CODEX_HOME/config.toml`), o equivalente ao isolamento que o repositório faz com o Claude Code;
- o `codex exec` exige rodar dentro de um repositório git. A cópia limpa deste repositório **não** é um (o git que mede o diff fica fora dela, de propósito). A documentação permite pular essa checagem com `--skip-git-repo-check` "se você tiver certeza de que o ambiente é seguro": aqui o ambiente é uma cópia descartável, mas decida isso conscientemente, e não crie um `.git` dentro da cópia, que vira `fora_do_escopo`;
- ele reaproveita o login já salvo da CLI.

O roteiro do desafio:

1. criar um `rodarCodex: RodarAgente` que inicia o processo `codex exec` com a cópia descartável como diretório de trabalho (`cwd`), o prompt da tarefa, `--json` e `--sandbox workspace-write`. Não use o modo sem sandbox (`danger-full-access`) nem a aprovação automática de tudo: o agente roda sem supervisão;
2. ler os eventos da saída e preencher a `SaidaAgente` com o que der; o que a CLI não informar (por exemplo, custo) fica zero, e o relatório deve deixar isso claro;
3. tratar timeout e evento de erro como `ok: false`, para virar `erro_agente`;
4. repetir a verificação de isolamento do capítulo 4 (a variante A não pode receber a sua configuração pessoal);
5. confirmar as flags na documentação atual e no `codex exec --help` antes de rodar, porque elas mudam entre versões.

Isso não é um benchmark de qual ferramenta é melhor. Comparar agentes diferentes muda muita coisa de uma vez (modelo, ferramentas, prompt de sistema). O uso honesto é o mesmo de sempre: medir a configuração que você usa e ver se uma mudança nela ajuda.
