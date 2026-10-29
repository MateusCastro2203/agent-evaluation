---
marp: true
theme: mentoria
paginate: true
lang: pt-BR
title: Como medir os seus agentes de IA
---

<!-- _class: capa -->
<!-- _paginate: false -->

Palestra · **Medindo agentes**

# Como medir os seus agentes de IA

Do "parece que melhorou" para a eval

*Mateus Castro · AI Engineer na Creditas*

<!--
[00:00–00:15] Antes de falar qualquer coisa: abrir o terminal na pasta do repo, com o login do Claude Code já feito (sem chave de API). Apresentar a partir de `palestra/apresentacao.html` no navegador, em tela cheia (tecla f); seta ou espaço avançam slide e clique (fragmento); tecla p abre a visão do apresentador com estas notas.
Só o título: "Hoje a pergunta é: como saber se o seu agente de código está bom?" e avançar.
-->

---

<!-- _class: sobre -->

## Quem é Mateus Castro?

<div class="sobre-grade">
<img class="foto" src="img/mateus.jpg" alt="Foto de Mateus Castro">
<div class="card destaque-card">

**AI Engineer na Creditas, com foco em soluções de IA.**

Gol, Smiles, Neon, Dotz…

</div>
<div class="card lista-card">

- Formado em Ciência da Computação e pós em IA
- Amante de esportes e carros
- Casado com a Liz e pai da Éden

</div>
<img class="qr" src="img/qr-links.svg" alt="QR code para os links do Mateus">
</div>

<!--
[00:15–00:45] Apresentação rápida, 30 s no máximo. Uma frase por bloco: onde trabalha e com o quê; por onde já passou; quem é fora do código.
O QR leva para a página de links, onde ficam o repositório, o ebook e os slides. "Não precisa fotografar agora: ele volta no último slide."
Não se demorar aqui: o run dispara no slide 4.
-->

---

<!-- _class: pergunta -->

<p class="selo">Mão para cima</p>

## Quem aqui mede se o agente de código está melhorando?

- Não meço
- No feeling
- Tenho métrica

<!--
[00:45–01:15] Slide único, sem cliques: as três opções já estão na tela. Perguntar: "Quem aqui mede hoje se o agente de código está melhorando?". Depois, opção por opção: "Quem não mede?" (mãos), "Quem vai no feeling?" (mãos), "Quem tem uma métrica?" (mãos). Contar por alto. Esperar no máximo 20 s no total.
Se quase ninguém tem métrica (o esperado): "Normal. É para isso que a gente está aqui." Se muita gente tem: "Ótimo, então vocês vão poder me dizer no fim se a minha é melhor que a de vocês."
Levantar a mão junto no "no feeling": o palestrante também já fez.
-->

---

## A aposta de hoje

<div class="dupla">
<div>

### Variante A
O repo **sem** `CLAUDE.md`

</div>
<div>

### Variante B
O mesmo repo **com** `CLAUDE.md`

</div>
</div>

<div class="numeros">
<div>

```bash
pnpm eval
```

</div>
<div><span class="grande" style="font-size:96px">32</span><div class="grande-legenda">execuções, agora</div></div>
</div>

<!--
[01:15–02:15] Rodar `pnpm eval` AGORA, ao vivo. Deixar o terminal num monitor ou minimizado; não voltar nele até o minuto 22. No ensaio (sonnet, concorrência 4), as 32 execuções levaram ~3 min 28 s: o run termina muito antes da revelação, e o resultado fica esperando.
De onde vem o 32: 2 variantes × 8 tarefas × 2 repetições = 32 execuções do Claude Code, rodando enquanto eu falo. Vou mudar UMA coisa no repositório: um `CLAUDE.md` com as convenções do projeto.
Fala: "Eu escrevi um CLAUDE.md para este projeto. Acho que ele ajuda. Mas 'acho' não é medida. Então o agente vai trabalhar 32 vezes enquanto eu falo, e no minuto 22 a gente vê."
Plano B se o run falhar (rede, login, cota): no minuto 22 usar `pnpm relatorio:ensaio`, que lê o run gravado no ensaio. Dizer isso em voz alta só se precisar.
-->

---

<!-- _class: pergunta -->

<p class="selo">Façam a aposta</p>

## O `CLAUDE.md` vai fazer diferença?

- B ganha
- Empate
- A ganha


<!--
[02:15–03:00] Slide único, sem cliques: as opções já estão na tela. Perguntar e pedir mãos em cada opção: "Quem acha que o B, com CLAUDE.md, ganha?" / "Quem acha que dá empate?" / "Quem acha que o A ganha?". Contar por alto e GUARDAR a proporção (ex.: "uns 70% no B, uns 20% no empate"): ela volta no slide 18. No máximo 20 s.
Se ninguém aposta no A: "Ninguém no A? Guardem isso." Se muita gente aposta no empate: "Tem gente desconfiada. Bom sinal."
Fechar dizendo: "a resposta sai no fim da palestra, no relatório ao vivo".
-->

---

## "Parece que melhorou"

<div class="fluxo">
<div>mudou o <code>CLAUDE.md</code></div>
<div class="seta">→</div>
<div>pediu <strong>uma</strong> tarefa</div>
<div class="seta">→</div>
<div>deu certo</div>
<div class="seta">→</div>
<div class="destaque">"melhorou!"</div>
</div>

<p class="punch" data-marpit-fragment>Daria certo <strong>antes</strong> da mudança também?</p>

<!--
[03:00–04:45] Todo mundo já fez: mudou o prompt, o CLAUDE.md ou o modelo; pediu UMA tarefa; deu certo; "melhorou!".
O que ficou de fora (falar, não está no slide): a tarefa era fácil ou difícil? E se você pedisse de novo? Quanto custou, quantos turnos? Ele mexeu onde não devia? E, a mais esquecida (clique): daria certo ANTES da mudança também?
Pergunta opcional, se a sala estiver fria: "Quem aqui já trocou de modelo ou de configuração do agente porque 'sentiu' que estava melhor?" (quase todo mundo levanta a mão; o palestrante também).
Ponto: vibe check não é inútil, é o ponto de partida. O problema é parar nele.
Transição: "O agente não é determinístico: uma execução é uma amostra, não um resultado. Então quanto diz uma execução? Chutem."
-->

---

<!-- _class: pergunta -->

<p class="selo">Chute antes de eu mostrar</p>

## 1 de 1 é 100%. Confiam?

<!--
[04:45–05:15] Slide único, sem cliques. Perguntar: "Passou 1 de 1. É 100%. Quem confia?" Esperar as mãos (até 15 s). Se muita gente confia: "Vamos ver o que a conta diz." Se ninguém confia: "Desconfiança saudável. Quanto, então?"
Avançar para o slide seguinte com a resposta.
-->

---

## 1 de 1 → o que a conta diz

<div class="barras">
<div>
<p class="rotulo">1 de 1 → taxa real entre <b>21% e 100%</b></p>
<div class="escala"><div class="iv" style="left:20.7%; width:79.3%; background: var(--azul)"></div><div class="pt" style="left:99.4%"></div></div>
</div>
<div>
<p class="rotulo">16 de 16 → entre <b>81% e 100%</b></p>
<div class="escala"><div class="iv" style="left:80.6%; width:19.4%; background: var(--acento)"></div><div class="pt" style="left:99.4%"></div></div>
</div>
<div class="eixo"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
</div>

<p class="fonte">Intervalo de Wilson, 95% · Wilson (1927)</p>

<!--
[05:15–07:00] Slide único, sem cliques: as duas barras já estão na tela. A barra de 1 de 1 vai de 21% a 100%: "Com uma execução, a taxa real pode ser 21%." A de 16 de 16 vai de 81% a 100%: "Mesmo o '100%' de 16 execuções não prova 100%."
Os números são conta, não opinião: intervalo de Wilson 95% para 1/1 e 16/16 (o mesmo cálculo que o relatório usa; dá para conferir em `src/metricas.ts`). A gente volta nele no minuto 25 (slide 20).
Transição: "Se uma execução não basta, o que eu meço, e quantas vezes?"
-->

---

<!-- _class: tabela -->

## As métricas de um agente de código

| Métrica | Pergunta |
|---|---|
| **Sucesso** | resolveu? |
| Custo / tokens | quanto gastou? |
| Turnos | quantas voltas deu? |
| Tempo | quanto demorou? |
| **Fora do escopo** | mexeu onde não devia? |
| **Consistência** | resolve **sempre**? |

<!--
[07:00–09:00] Ir linha por linha, devagar. Para quem é júnior: "turno" = uma ida e volta entre o modelo e uma ferramenta (ler arquivo, editar, rodar teste).
Como o repo mede cada uma: sucesso = teste escondido passou (critério de feito); custo/tokens = `usage` e `total_cost_usd` do `claude -p`; turnos = `num_turns`; tempo = `duration_ms`; fora do escopo = diff fora dos arquivos permitidos; consistência = pass^k (passou em todas as repetições).
Fora do escopo é separado de propósito: resolveu mexendo onde não devia não é sucesso.
Consistência = pass^k: passou em TODAS as k tentativas; no relatório, k = 2.
O `claude -p --output-format json` devolve esses campos no JSON final (doc "Run Claude Code programmatically"). A doc diz que o custo é estimativa do lado do cliente: com assinatura, leia o custo em US$ como "tamanho do esforço", não como fatura.
Tokens: o relatório mostra a mediana de entrada + saída separada da mediana de cache (leitura + criação), porque o cache domina a contagem e esconderia a diferença.
-->

---

## O conjunto de hoje: 8 tarefas

<div class="numeros">
<div><span class="grande">5</span><div class="grande-legenda">dependem de uma convenção<br>que só o <code>CLAUDE.md</code> explica</div></div>
<div><span class="grande" style="color: var(--azul)">3</span><div class="grande-legenda">controle:<br>não dependem</div></div>
</div>

<!--
[09:00–11:00] App de laboratório: agenda de meetups, sintético. O prompt é escrito como issue de verdade e não cita a convenção. Se o prompt dissesse "use ErroDominio", A e B empatariam e a gente não mediria nada.
As 8 tarefas (como uma issue → o que o teste escondido exige):
01 "A listagem de próximos eventos está devolvendo um a menos." → controle.
02 "Preciso de uma função que conte inscritos de um evento." → controle.
03 "Não deixe inscrever em evento lotado." → `ErroDominio` com código de lotação em SCREAMING_SNAKE.
04 "Aceite cupom de desconto percentual na inscrição." → `Centavos` inteiro, arredondado para baixo.
05 "Não deixe inscrever em evento que já aconteceu." → usar `relogio.agora()`.
06 "O relatório de inscrições precisa mostrar o e-mail." → código novo em `src/relatorios/`, `src/legado/` intocado.
07 "Quando lotar, coloque a pessoa numa lista de espera." → entrada na auditoria (`registrarAuditoria`).
08 "A importação de CSV quebra quando o nome tem vírgula entre aspas." → controle.
Por que ter controle: se B ganhar também nas tarefas de controle, desconfie (ruído ou outra causa). O efeito esperado do CLAUDE.md está nas tarefas 03–07.
-->

---

<!-- _class: codigo-grande -->

## Uma tarefa por dentro <span class="demo">03-evento-lotado</span>

> "…Não deixe inscrever em evento lotado…"

```ts
expect(erro).toBeInstanceOf(ErroDominio);
expect(codigo).toMatch(/^[A-Z][A-Z0-9_]*$/);
expect(codigo).toMatch(/LOTAD|CHEIO|CAPACIDADE|ESGOT|LIMITE|VAGA/);
expect(codigo).not.toBe("CAPACIDADE_INVALIDA");
```

<!--
[11:00–13:00] Arquivos reais de `tarefas/03-evento-lotado/`. Em cima, o trecho do `prompt` do `tarefa.json`; prompt inteiro: "Hoje dá para inscrever mais gente do que a capacidade do evento. Não deixe inscrever em evento lotado: quando o evento já tiver `capacidade` inscritos, `inscrever` deve recusar a nova inscrição." O agente só vê o prompt. O campo `permitidos` (`src/inscricoes.ts`, `test/**`) define o escopo.
Embaixo, as asserções do `oculto.test.ts` (o agente não vê; a última, no arquivo, tem a mensagem "CAPACIDADE_INVALIDA já existe e significa outra coisa"). O teste tem mais um caso: a vaga liberada por cancelamento pode ser ocupada.
Ler o critério de feito: não basta "lançar um erro". Tem que ser o erro do domínio (`ErroDominio`), com o código no formato da casa (SCREAMING_SNAKE). O prompt não diz qual código usar, então o teste não exige um nome exato: aceita qualquer nome razoável de lotação e só recusa reaproveitar `CAPACIDADE_INVALIDA`, que já existe e significa outra coisa. É exatamente o tipo de coisa que um dev novo no time erraria sem ler a documentação, e que o agente sem CLAUDE.md também tende a errar.
O teste nunca entra na pasta do agente: a correção roda numa pasta nova, com o app intacto + os arquivos que o agente mudou, e o teste escondido entra por último, por cima de qualquer arquivo com o mesmo nome. Se o agente "criar" um teste oculto falso para passar, não adianta.
-->

---

## Como uma execução roda

<div class="fluxo">
<div><b>1 · Cópia limpa</b>app numa pasta temporária</div>
<div class="seta">→</div>
<div><b>2 · Agente</b><code>claude -p</code> no sandbox</div>
<div class="seta">→</div>
<div><b>3 · Correção</b>pasta nova + teste escondido</div>
</div>

<p class="fonte">promptfoo, "Javascript Provider" · Claude Code docs, "Run Claude Code programmatically"</p>

<!--
[13:00–14:30] 1 · Cópia limpa: pasta temporária com o app. Variante B ganha o CLAUDE.md. O git que mede o diff fica FORA da cópia.
2 · Agente: `claude -p` headless, saída JSON, ferramentas numa lista fechada, sandbox do SO (sem rede, escrita só na cópia), limite de turnos e timeout.
3 · Correção: pasta NOVA: app intacto + o que o agente mudou + teste escondido. Vitest em sandbox; diff contra `permitidos`.
O promptfoo orquestra: um provider JS por variante, `repeat: 2`, concorrência 4, saída em JSON. Um script lê o JSON e calcula as métricas.
Termos: headless = o agente roda sem tela interativa, recebe o prompt por argumento e devolve o resultado (aqui, em JSON); provider = no promptfoo, o pedaço de código que "responde" a cada caso (aqui, roda o Claude Code numa cópia do repo); diff = a lista do que mudou nos arquivos em relação à cópia original (via git).
Flags reais (`src/claude.ts`): `-p <prompt> --output-format json --model sonnet --max-turns 30`, `--permission-mode dontAsk` com `--allowedTools` (ler/editar só `./**`, `pnpm test`, `pnpm vitest` e ls/cat/grep/head/wc) e `--disallowedTools` (WebFetch, WebSearch, deps do lab, o projeto, ~/.claude), sandbox do SO por `--settings`, `--setting-sources project`, `--strict-mcp-config`, `--no-session-persistence`. Timeout de 10 min por execução.
Isolamento importa: `--setting-sources project` deixa de fora o meu ~/.claude (CLAUDE.md pessoal, hooks, skills) e `--strict-mcp-config` deixa de fora os conectores MCP da conta. Se vazasse, A teria um CLAUDE.md escondido e o experimento estaria contaminado. Verificado antes do ensaio: A respondeu "nenhuma instrução", 0 servidores MCP nas duas variantes (`resultados/ensaio/ISOLAMENTO.md`). O que não dá para tirar: configurações gerenciadas pela organização chegam às duas variantes, igualmente.
Correção: o agente nunca vê a pasta corrigida; o Vitest dela roda no sandbox-runtime (`srt`), sem rede, e as deps do lab são somente leitura e conferidas por hash antes e depois.
Login: usa a assinatura normal do Claude Code. Não precisa de chave de API.
promptfoo aqui é o "orquestrador de casos": ele chama o provider, repete, paraleliza e grava o JSON. A métrica e o veredito ficam num script nosso, que calcula intervalo de confiança para A × B.
-->

---

## LLM-as-judge

<div class="dupla">
<div>

### Ajuda
critério que teste não pega

</div>
<div>

### Atrapalha
juiz variável **soma variância**

</div>
</div>

<p class="punch" data-marpit-fragment>Se dá para verificar com código, verifique com código.</p>

<p class="fonte">Zheng et al. (2023), "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" · promptfoo, "LLM Rubric"</p>

<!--
[14:30–16:00] Ajuda: critérios que teste não pega (clareza, estilo, mensagem de commit); rápido de escrever (`llm-rubric` no promptfoo); bom para triagem, antes do olho humano.
Atrapalha: vieses conhecidos (posição, verbosidade, preferir a si mesmo); juiz não determinístico avaliando agente não determinístico SOMA variância; precisa ser avaliado contra rótulo humano.
Hoje o critério de feito é 100% teste: nenhuma tarefa precisa de juiz.
Não é regra universal. Pergunta para a plateia (falar, não está no slide): "Que tarefa do seu dia a dia não dá para verificar com teste?" (ex.: "a documentação ficou clara?", "o PR está bem descrito?"). Ali o juiz pode valer, desde que você meça o juiz também.
No caso real, o juiz foi rejeitado: juiz variável avaliando agente variável soma variância.
Transição: "Isso aqui não é teoria de laboratório. Vou mostrar o que aprendemos fazendo isso em produção."
-->

---

## O que conta como "deu certo"

<div class="chips texto">
<span>resolvido</span>
<span>assistido</span>
<span>escalado</span>
<span>falta informação</span>
</div>

<p class="punch" data-marpit-fragment>Fora do escopo contado como falha <strong>derruba a taxa</strong>.</p>

<!--
[16:00–17:30] Contexto em uma frase: um time da Creditas construiu agentes que resolvem chamados operacionais de suporte (o "keep the lights on", KTLO). Não vou mostrar números internos nem nomes de sistemas: só o que aprendemos sobre medir.
Lição 1 · Desfecho explícito por execução: toda execução termina com um rótulo: resolvido, assistido, escalado ou falta informação. "Funcionou?" não é pergunta que se responde no painel.
"Assistido" = o agente diagnosticou, mas um humano executou. Contar isso como "resolvido" infla o número; contar como "falha" esconde valor. Por isso é um rótulo próprio.
Lição 2 (clique) · Desfecho mal definido distorce a métrica: caso fora do escopo do agente contado como falha derruba a taxa, e ninguém sabe se o agente piorou ou se entrou outro tipo de caso. Se o denominador muda de composição, a taxa muda sem o agente mudar. Defina o desfecho antes de olhar o número.
No repo de hoje: `passou`, `falhou`, `fora_do_escopo`, `erro_agente`.
-->

---

<!-- _class: lista -->

## Eval que só melhora

* Gabarito humano nasce **vazio**
* Buracos de cobertura só **encolhem**
* Falhou na terça, **teste na quarta**

<!--
[17:30–19:00] Um clique por linha (três cliques).
Lição 4 · Duas camadas: determinística a cada commit; modelo real contra gabarito curado por humano. O gabarito NASCE VAZIO, para não herdar o viés da resposta do agente: o humano escreve a resposta esperada sem olhar o que o agente respondeu. Se você copia a resposta do agente para o gabarito, você mede o agente contra ele mesmo.
Lição 5 · Matriz-catraca: rota × desfecho. A lista de células SEM cobertura só pode encolher; um teste quebra se alguém tirar cobertura. Catraca é um mecanismo que só gira para um lado. Aplicado a eval: o conjunto de casos cobertos só cresce.
Lição 7 · Falha vira caso: "Falhou na terça, teste na quarta: o erro do dia a dia vira tarefa nova com teste escondido, e o conjunto só cresce." Aprendizado visto em 2 ou mais casos vira regra; o "2 ou mais casos" evita transformar uma exceção em regra para todo mundo.
Transição: "Então, como eu uso isso para melhorar o MEU agente?"
-->

---

## Uma mudança por vez

<div class="fluxo">
<div><b>1</b>roda a eval<br>(linha de base)</div>
<div class="seta">→</div>
<div class="destaque"><b>2</b>muda <strong>uma</strong> coisa</div>
<div class="seta">→</div>
<div><b>3</b>roda de novo,<br>com repetições</div>
<div class="seta">→</div>
<div><b>4</b>compara<br>intervalos</div>
</div>

<!--
[19:00–20:30] Rode a eval ANTES (linha de base); mude UMA coisa; rode a eval de novo, com repetições; compare com intervalo, não com a média.
O que conta como "uma coisa": o CLAUDE.md, uma skill nova, um hook, o modelo, o prompt da tarefa. Mudou o modelo E o CLAUDE.md juntos? Você não sabe quem ganhou.
É o mesmo princípio de teste A/B de produto. O experimento de hoje muda só uma coisa: a existência do CLAUDE.md.
Dica prática: commite a configuração do agente junto com o resultado da eval. Assim, daqui a um mês você sabe qual versão gerou qual número.
-->

---

<!-- _class: tabela -->

## Onde cada regra mora

| | Entra |
|---|---|
| `CLAUDE.md` | **toda** sessão |
| Skill | só quando é usada |
| Hook | em toda ferramenta |

<p class="punch" data-marpit-fragment>Regra que não pode falhar mora no <strong>hook</strong>, no <strong>teste</strong> ou no <strong>CI</strong>.</p>

<p class="fonte">Claude Code docs: "How Claude remembers your project" · "Extend Claude with skills" · "Hooks reference"</p>

<!--
[20:30–22:00] CLAUDE.md: entra em TODA sessão; bom para convenções do repo, comando de teste, pastas proibidas; cuidado: é contexto, NÃO obrigação.
Skill: entra só quando é usada; boa para procedimento longo, material de referência; cuidado: descrição ruim = nunca é chamada.
Hook: roda antes/depois de cada ferramenta; para regra que PRECISA valer sempre; cuidado: é código, teste como código.
A própria doc do Claude Code diz que CLAUDE.md é tratado como contexto, não como configuração obrigatória; para bloquear uma ação, use um hook PreToolUse.
Skill: a doc diz que o corpo da skill só entra no contexto quando ela é usada, então referência longa custa quase nada até ser necessária.
Clique: regra que não pode falhar não mora no prompt. Mora no hook, no teste ou no CI.
Cada uma dessas mudanças é uma variante B possível no repo: troque o CLAUDE.md por uma skill ou um hook e rode de novo.
Transição: "Já deu tempo. Vamos ver o que o agente fez." Voltar para o terminal.
-->

---

## Ao vivo: o relatório

<iframe class="relatorio-ao-vivo" src="../resultados/relatorio.html" title="Relatório do run de hoje"></iframe>
<div class="relatorio-impresso card">O relatório do run de hoje (<code>resultados/relatorio.html</code>) aparece aqui na apresentação em HTML.</div>

<script>
// Recarrega o relatório toda vez que este slide aparece: o run termina no meio da palestra.
document.querySelectorAll("iframe.relatorio-ao-vivo").forEach((quadro) => {
  const slide = quadro.closest("svg") || quadro.closest("section");
  if (!slide) return;
  let ativo = false;
  new MutationObserver(() => {
    const agora = slide.classList.contains("bespoke-marp-active");
    if (agora && !ativo) quadro.src = "../resultados/relatorio.html?t=" + Date.now();
    ativo = agora;
  }).observe(slide, { attributes: true, attributeFilter: ["class"] });
});
</script>

<!--
[22:00–25:00] Primeiro, a volta da aposta (slide 5): "No começo, [a proporção que você guardou, ex.: uns 70%] apostou no B. Vamos ver." Não pedir mãos de novo; só lembrar.
Se o run ainda não terminou: mostrar o progresso do promptfoo e usar o ensaio. Se terminou: `pnpm relatorio` e abrir o HTML. Plano B: `pnpm relatorio:ensaio` (run gravado no ensaio).
Roteiro de leitura (nesta ordem; a ordem importa):
1. n real por variante e quantos erro_agente (contados à parte).
2. Taxa de sucesso de A e de B, com a barra do intervalo.
3. Veredito em português.
4. pass^k: quantas tarefas passaram nas duas repetições.
5. Fora do escopo.
6. Por tarefa: o ganho (se houver) está nas tarefas de convenção (03–07) ou nas de controle?
pass^2 em uma frase: "quantas das 8 tarefas passaram nas DUAS repetições; é a consistência."
Comparar com a aposta da plateia (slide 5) depois de ler o veredito.
O portão: "No repo, o portão só quebra o CI se A for melhor que B; inconclusivo passa."
Não comemorar nem lamentar ainda: os próximos slides explicam como ler.
Exemplo de resultado (o ensaio gravado, não o de hoje): A 12/16 (75%, 51% a 90%), B 16/16 (100%, 81% a 100%), pass^2 6/8 × 8/8, 3 fora do escopo (mexeram em `src/legado/` ou fora dos permitidos) e 1 teste escondido falhando, todos de A, 0 erro_agente → inconclusivo.
-->

---

<!-- _class: pergunta -->

<p class="selo">Chute antes de eu mostrar</p>

## B é o dobro de A. B ganhou?

<!--
[25:00–25:30] Slide único, sem cliques. EXEMPLO INVENTADO, não é o run de hoje. Perguntar: "A passou 6 de 16, B passou 12 de 16. B é o dobro. Quem acha que B ganhou?" (mãos; até 15 s). Se a maioria disse "ganhou": "É a resposta natural. E é exatamente o 'parece que melhorou'."
Avançar para o slide seguinte com a resposta.
-->

---

## 6 de 16 × 12 de 16: o que a conta diz

<div class="barras">
<div>
<p class="rotulo">A: 6 de 16 → 37,5% · <b>18% a 61%</b></p>
<div class="escala"><div class="iv" style="left:18.5%; width:42.9%; background: var(--azul)"></div><div class="pt" style="left:37.2%"></div></div>
</div>
<div>
<p class="rotulo">B: 12 de 16 → 75% · <b>51% a 90%</b></p>
<div class="escala"><div class="iv" style="left:50.5%; width:39.3%; background: var(--acento)"></div><div class="pt" style="left:74.7%"></div></div>
</div>
<div class="eixo"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
</div>

<p class="punch">As barras se sobrepõem: <strong>inconclusivo</strong>.</p>

<p class="fonte">Exemplo ilustrativo, não é o run de hoje · Wilson (1927); Wikipedia, "Binomial proportion confidence interval"</p>

<!--
[25:30–26:45] Slide único, sem cliques: barras e veredito já estão na tela. A: 37,5%, intervalo 18% a 61%. B: 75%, intervalo 51% a 90%. As barras se sobrepõem (51% a 61%): inconclusivo.
O intervalo é a faixa de taxas "verdadeiras" compatíveis com o que vimos, com 95% de confiança. O ponto preto é a taxa observada.
Wilson em vez da conta "p ± 1,96·√(p(1−p)/n)": com n pequeno ou taxa perto de 0% ou 100%, a conta simples dá intervalo que sai de [0, 1] ou tem largura zero (16/16 daria "100% ± 0"). Wilson não tem esse problema.
Regra do repo: se o limite inferior de B passa do limite superior de A, "B melhor"; o contrário, "A melhor"; senão, "inconclusivo". Inconclusivo não é empate: é "não tenho dado para dizer".
Não se sobrepor é um critério conservador de propósito (um teste z de duas proporções chamaria 6/16 × 12/16 de significativo, p≈0,03); o repo prefere não declarar vencedor cedo.
-->

---

<!-- _class: pergunta -->

<p class="selo">Chute antes de eu mostrar</p>

## Quantas execuções por variante para separar A de B?

- 5?
- 16?
- 40?
- 200?

<!--
[26:45–27:15] Slide único, sem cliques: as quatro opções já estão na tela. Perguntar e pedir mãos em cada uma ("quem diz 5? 16? 40? 200?"); até 20 s no total.
Avançar para o slide seguinte com a resposta.
-->

---

## Para separar A de B

<div style="text-align:center; margin-top:40px"><span class="grande">27</span><div class="grande-legenda">execuções por variante, no ensaio: A 12/16 × B 16/16</div></div>

<!--
[27:15–29:00] Slide único, sem cliques. Resposta (do ENSAIO, não do run de hoje): com as taxas do ensaio mantidas (A 12/16 × B 16/16), 27 execuções por variante até os intervalos de Wilson pararem de se sobrepor (critério do veredito); o piso pelo teste z é 24. Dizer "do ensaio" em voz alta.
Se o relatório de hoje mostrou outro número em "execuções necessárias por variante (critério do veredito)" (campo execucoesNecessariasPorVariante), dizer: "no de hoje, deu [N]". Se as duas taxas forem iguais, o relatório diz "não calculável".
Quem chutou 16 chegou perto: "é o que a gente rodou hoje, e não bastou." Quem chutou 40: "um pouco a mais do que precisava."
Diferença pequena pede muitas execuções: 62,5% contra 75% pediria 212 por variante.
Fala de fechamento, qualquer desfecho: "Eu não sei ainda se o meu CLAUDE.md presta. Mas agora eu sei quanto eu preciso rodar para saber. Isso é medir."
-->

---

<!-- _class: lista -->

## Leve para casa

<div class="cols">
<div>

1. **Desfecho** antes do número
2. **Repita**: intervalo, não execução
3. Falha vira **tarefa nova**

<p class="mini">Repo + ebook (PDF). Roda com o login do Claude Code.</p>

</div>
<div style="text-align:center">

<img src="img/qr-links.svg" alt="QR code para os links do Mateus" style="width:320px; height:320px;">

<p class="mini">Repo, ebook e slides</p>

</div>
</div>

<!--
[29:00–31:00] Os cinco hábitos (três no slide, dois na fala): 1. defina o DESFECHO antes do número; 2. tarefas reais com TESTE ESCONDIDO e escopo; 3. REPITA: pass^k e intervalo, não uma execução; 4. UMA MUDANÇA por vez; 5. toda falha vira TAREFA NOVA.
O repo roda o experimento de hoje com o login do Claude Code. O ebook em PDF está dentro dele.
Deixar este slide parado enquanto as pessoas fotografam o QR, e voltar a ele durante as perguntas (31:00–40:00, ~9 min).
O QR é o mesmo do slide 2: a página de links do Mateus. PENDENTE antes da palestra: colocar o repositório publicado e o ebook nessa página.
Desafio para quem levar o repo: trocar o CLAUDE.md por uma skill ou um hook e rodar de novo; ou apontar as tarefas para o próprio projeto.
Perguntas prováveis (respostas no guia de fala): "funciona com Codex/Gemini CLI?" (sim, troca o runner; fica como desafio extra), "quanto custa rodar?" (usa a cota da assinatura; o relatório mostra o custo estimado), "e se meu projeto não tem teste?" (comece escrevendo o teste da tarefa: o critério de feito é o primeiro entregável).
-->

---

## Referências

<style scoped>
section { font-size: 20px; }
li { margin: 2px 0; }
</style>

- promptfoo, "Javascript Provider": https://www.promptfoo.dev/docs/providers/custom-api/
- promptfoo, "Command line" (`--repeat`, `-j`, `-o`): https://www.promptfoo.dev/docs/usage/command-line/
- promptfoo, "LLM Rubric": https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/
- Claude Code, "Run Claude Code programmatically": https://code.claude.com/docs/en/headless
- Claude Code, "How Claude remembers your project": https://code.claude.com/docs/en/memory
- Claude Code, "Extend Claude with skills": https://code.claude.com/docs/en/skills
- Claude Code, "Hooks reference": https://code.claude.com/docs/en/hooks
- Anthropic (2026), "Demystifying evals for AI agents": https://www.anthropic.com/research/demystifying-evals-for-ai-agents
- Yao et al. (2024), "τ-bench" (pass^k): https://arxiv.org/abs/2406.12045
- Jimenez et al. (2023), "SWE-bench": https://arxiv.org/abs/2310.06770
- Zheng et al. (2023), "Judging LLM-as-a-Judge": https://arxiv.org/abs/2306.05685
- Intervalo de Wilson: https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval

<!--
[apêndice, durante as perguntas] Slide de consulta: fica depois do QR e só aparece se alguém pedir as fontes (todas também estão no ebook, com link). Durante as perguntas, preferir o slide do QR.
SWE-bench aparece aqui como referência do mesmo formato: issues reais de GitHub como tarefa para agentes de código.
-->
