# Lendo o resultado

O run terminou e o relatório está aberto. A tentação é olhar a taxa de sucesso de A, a de B, e declarar um vencedor. Este capítulo é sobre não fazer isso.

## A ordem de leitura

O relatório (`pnpm relatorio`, que imprime uma tabela no terminal e grava `resultados/relatorio.html`) mostra, por variante, as métricas do capítulo 2, o veredito e uma tabela por tarefa. Leia nesta ordem:

1. **n por variante e quantos `erro_agente`.** O n da taxa conta só as execuções sem `erro_agente`. Se uma variante teve muitos erros de agente, o run não está equilibrado: investigue antes de concluir qualquer coisa.
2. **Taxa de sucesso com intervalo.** A taxa observada e a faixa de taxas compatíveis com ela.
3. **Veredito**, em português: B melhor, A melhor ou inconclusivo.
4. **pass^k**: quantas tarefas passaram em todas as repetições. O k é o maior número de repetições visto por tarefa no run (hoje, 2). A conta é conservadora: uma repetição com `erro_agente` conta como "não passou", e uma tarefa com menos de k repetições (run interrompido) não conta.
5. **Fora do escopo**: quantas execuções mexeram onde não deviam.
6. **Por tarefa**: o ganho, se houver, está nas tarefas de convenção (03 a 07) ou nas de controle (01, 02, 08)?

Mediana de tokens, turnos e duração, e o custo estimado, ajudam a desempatar e a entender o esforço. A mediana é usada em vez da média porque algumas execuções gastam muito mais que as outras, e a média seria puxada por elas. Os tokens aparecem em duas linhas: entrada + saída, e cache (leitura + criação). O cache é dezenas de vezes maior e, somado, esconderia qualquer diferença entre as variantes. As medianas usam só as execuções sem `erro_agente`; o custo total soma todas, inclusive as com erro, porque é o que o run gastou.

## O intervalo de Wilson

Um intervalo de confiança é a faixa de taxas "verdadeiras" que são compatíveis com o que você observou. Com 95% de confiança: se você repetisse o experimento muitas vezes, o intervalo calculado conteria a taxa verdadeira em cerca de 95% das vezes.

A conta mais conhecida para uma proporção é `p ± 1,96 · √(p(1−p)/n)`. Com n pequeno, ou com taxa perto de 0% ou de 100%, ela se comporta mal: o intervalo sai de [0, 1] ou fica com largura zero. Com 16 de 16, por exemplo, ela daria "100% ± 0", como se 16 execuções provassem perfeição. O **intervalo de Wilson** (Wilson, 1927) não tem esse problema e é a escolha comum para proporções com poucas amostras. É o que o repositório calcula, com z = 1,96 (95%).

### Um exemplo

Este exemplo é ilustrativo, não um resultado de run:

| Variante | Observado | Taxa | Intervalo de Wilson 95% |
|---|---|---|---|
| A | 6 de 16 | 37,5% | 18% a 61% |
| B | 12 de 16 | 75% | 51% a 90% |

A taxa de B é o dobro da de A. Mas os intervalos **se sobrepõem** entre 51% e 61%: existe uma taxa verdadeira, por exemplo 55%, compatível com as duas variantes. Pela regra do repositório, isso é **inconclusivo**.

## A regra do veredito

O repositório decide assim (função `decidir`, em `src/veredito.ts`):

- **B melhor** se o limite inferior de B passa do limite superior de A;
- **A melhor** se o limite inferior de A passa do limite superior de B;
- **inconclusivo** em qualquer outro caso, inclusive quando uma variante tem n = 0.

**Inconclusivo não é empate.** Empate seria "as duas são iguais". Inconclusivo é "não tenho dado para dizer". São conclusões diferentes, e a segunda tem uma ação clara: rodar mais.

Esse critério é conservador de propósito. Um teste z de duas proporções, aplicado às mesmas 6/16 e 12/16, daria uma diferença estatisticamente significativa (p ≈ 0,03). O repositório prefere não declarar vencedor cedo: exigir intervalos sem sobreposição é mais exigente, e um portão que declara vencedor com pouca evidência ensina o time a desconfiar dele.

## Por que 16 não bastam

O relatório também estima quantas execuções **por variante** seriam necessárias para separar A de B. São dois números, e o primeiro é o que manda.

**Execuções necessárias por variante (critério do veredito).** O relatório pega as taxas observadas de A e de B e pergunta: com quantas execuções por variante, mantidas essas taxas, os intervalos de Wilson 95% deixariam de se sobrepor? Ele testa n = 1, 2, 3… até achar (ou até 10.000, o teto da busca). É o mesmo critério do veredito, então é a resposta direta para "quanto falta para este relatório sair do inconclusivo". No código, o campo chama `execucoesNecessariasPorVariante` (em `src/veredito.ts`). Ele fica vazio ("não calculável") quando as duas taxas são iguais, quando uma variante não tem dado ou quando nem 10.000 bastam.

**Piso pelo teste z de duas proporções.** É a fórmula clássica de tamanho de amostra, com 95% de confiança e 80% de poder. **Poder** é a chance de o experimento detectar a diferença se ela existir de verdade. Com 80% de poder: se o `CLAUDE.md` ajuda mesmo, em 8 de cada 10 experimentos desse tamanho você veria a diferença.

```text
n ≈ (1,96 + 0,84)² · [pA(1−pA) + pB(1−pB)] / (pA − pB)²
```

O 1,96 vem dos 95% de confiança, e o 0,84, dos 80% de poder. No código, o campo chama `pisoTesteZPorVariante`. Como o teste z é menos exigente que "intervalos sem sobreposição", esse número costuma ficar abaixo do primeiro: com ele, o relatório ainda pode sair inconclusivo. Alguns valores:

| Taxa de A | Taxa de B | Critério do veredito (Wilson) | Piso (teste z) |
|---|---|---|---|
| 37,5% | 75% | 27 | 24 |
| 62,5% | 75% | 212 | 212 |
| 81,25% | 100% | 38 | 34 |

O n cresce com 1 / (diferença)². Uma diferença grande se vê com poucas dezenas de execuções; uma diferença moderada pede centenas. As duas contas supõem que as taxas observadas continuem iguais com mais execuções, o que ninguém garante: são estimativas, não promessas.

Esta é a lição da palestra: **16 execuções por variante quase nunca bastam para uma diferença moderada.** E está tudo bem. Saber quanto falta já é medir.

## Um exemplo real: o ensaio

O run gravado na véspera da palestra (`resultados/ensaio/`, modelo `sonnet`, 2 repetições) é um exemplo de resultado, não uma previsão do próximo run:

| | A (sem `CLAUDE.md`) | B (com `CLAUDE.md`) |
|---|---|---|
| passou | 13 de 16 (81%, Wilson 57% a 93%) | 16 de 16 (100%, Wilson 81% a 100%) |
| pass^2 | 6 de 8 | 8 de 8 |
| fora do escopo | 3 | 0 |
| erros do agente | 0 | 0 |

Veredito: **inconclusivo**. As barras se sobrepõem entre 81% e 93%, e o relatório estima 38 execuções por variante para elas se separarem (o piso pelo teste z é 34). As três falhas de A foram todas `fora_do_escopo`, nas tarefas de convenção: uma na 04 (mexeu em `src/legado/`, a pasta congelada) e duas na 06 (mexeu em `src/inscricoes.ts`, fora dos permitidos). É o efeito que as tarefas foram desenhadas para medir, mas 16 execuções por lado ainda não bastam para cravar. Rode `pnpm relatorio:ensaio` para ver o relatório completo. Se regravar o ensaio, atualize estes números.

## Os três desfechos

**B ganhou.** Confira onde. O ganho está nas tarefas de convenção (03 a 07)? Ótimo, é o efeito esperado. Está também nas de controle? Desconfie: pode ser ruído, ou outra coisa diferente entre as variantes. Olhe também o fora do escopo e o custo: ganhar em sucesso gastando muito mais pode não valer.

**Inconclusivo.** O resultado mais comum com 16 execuções por variante. Leia a estimativa de execuções necessárias e decida se vale rodar mais. Olhe a tabela por tarefa: às vezes uma tarefa específica mostra um padrão claro (A sempre falha, B sempre passa) que merece investigação, mesmo sem veredito global.

**A ganhou.** O `CLAUDE.md` atrapalhou. Isso acontece: instruções demais distraem, uma regra mal escrita leva o agente para o lado errado. Abra as execuções de B que falharam e veja o que o agente fez. Neste caso, e só neste, o portão do repositório sai com código 1.

## O portão de qualidade

`pnpm relatorio` termina com código de saída 1 **só** quando o veredito é "A melhor" (`codigoDeSaida`, em `src/relatorio.ts`), ou seja, quando há evidência de que a mudança piorou o agente. "Inconclusivo" e "B melhor" saem com 0. Se o arquivo de entrada não puder ser lido, sai com 2. (Não confunda com o `pnpm eval`, que sai com 100 quando alguma execução não passou: isso é do promptfoo e não é veredito.)

Isso permite pôr o relatório no CI (integração contínua, o pipeline que roda a cada push ou PR) como portão: se alguém mudar o `CLAUDE.md` e a eval mostrar piora clara, o build quebra. Quebrar o build por "inconclusivo" seria um erro: com poucas execuções, isso aconteceria o tempo todo por falta de dado, e o time aprenderia a ignorar o portão.
