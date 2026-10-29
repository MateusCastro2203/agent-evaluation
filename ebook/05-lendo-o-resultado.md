# Lendo o resultado

O run terminou e o relatório está aberto. A tentação é olhar quantas vezes A deu certo, quantas vezes B deu certo, e declarar um vencedor. Este capítulo é sobre não fazer isso.

## O relatório, de cima para baixo

O `pnpm eval` gera o relatório sozinho quando termina: imprime uma tabela no terminal e grava `resultados/relatorio.html`. Para ver o do ensaio sem rodar nada, use `pnpm relatorio:ensaio` e abra `resultados/ensaio/relatorio.html`.

A página tem duas partes. Em cima, linguagem simples. Embaixo, em "Detalhes técnicos", os nomes que você vai achar nos livros e nos artigos.

**1. O título.** Uma de três frases: "Com CLAUDE.md foi melhor", "Sem CLAUDE.md foi melhor" ou "Ainda não dá para saber". Logo abaixo, uma linha diz o porquê, por exemplo: "a margem de erro das duas se cruza".

**2. As duas linhas grandes.** Uma por variante, assim: "Sem CLAUDE.md (A): 12 de 16 deram certo · 75%, margem de erro: 51% a 90%". Embaixo, uma régua de 0% a 100%. Em cada linha, o tracinho é o resultado do run, e a faixa colorida é a margem de erro (o intervalo de confiança, no jargão). Leia sempre o número **com** a faixa.

**3. Os números lado a lado.** Uma tabela com as métricas do capítulo 2, com nomes do dia a dia:

- "Deram certo" e "Margem de erro";
- "Resolve sempre?": tarefas que deram certo nas 2 tentativas (pass^k);
- "Mexeu onde não devia" (fora do escopo);
- "Erro do agente": rede, login, limite; não entra na conta;
- "Voltas com as ferramentas" (turnos, mediana), "Tempo por execução" (mediana) e "Custo estimado do run".

**Mediana** é o valor do meio quando você põe tudo em ordem. O relatório usa a mediana, e não a média, porque algumas execuções gastam muito mais que as outras e puxariam a média para cima.

**4. Tarefa por tarefa.** Quantas deram certo em cada uma das 8 tarefas, por variante. As tarefas 03 a 07 dependem de uma regra da casa; 01, 02 e 08 são de controle (capítulo 3).

**5. Detalhes técnicos.** O veredito técnico, o nome da conta da margem de erro (intervalo de Wilson, 95% de confiança), quantas execuções seriam precisas para separar A de B, o piso pelo teste z, o n de cada variante, pass^k e os tokens. O fim deste capítulo explica cada um.

## Antes de concluir: confira duas coisas

1. **Quantas execuções entraram na conta.** As duas linhas devem dizer "de 16". Se aparecer menos, houve erro do agente (capítulo 2): essas execuções ficam fora da conta. Se uma variante teve muitos erros, o run não está equilibrado. Investigue antes de concluir qualquer coisa.
2. **Onde está a diferença.** Na tabela tarefa por tarefa, o ganho está nas tarefas de regra da casa (03 a 07) ou nas de controle?

## Quando dá para dizer quem ganhou

Cada variante tem a sua faixa: a margem de erro. A regra para ler qualquer relatório cabe em duas linhas:

- **As faixas se cruzam:** ainda não dá para saber quem é melhor.
- **As faixas se separam:** agora dá. Se a faixa de B fica toda acima da de A, B é melhor. Se fica toda abaixo, A é melhor.

É a mesma ideia do "empate técnico" da pesquisa eleitoral. Dois candidatos parecem longe, mas as margens se cruzam, e ninguém pode dizer quem está na frente. Com mais entrevistas, as margens estreitam, e aí dá.

**"Ainda não dá para saber" não é empate.** Empate seria "as duas são iguais". "Ainda não dá para saber" (inconclusivo, no jargão) é "não tenho dado para dizer". São conclusões diferentes, e a segunda tem uma ação clara: rodar mais.

## O resultado do experimento

O ensaio gravado em 2026-10-27 (`resultados/ensaio/`, modelo `sonnet`, 2 repetições) e um run de teste do palestrante em 2026-10-29 deram **o mesmo placar**:

| | Sem `CLAUDE.md` (A) | Com `CLAUDE.md` (B) |
|---|---|---|
| Deram certo | 12 de 16 (75%) | 16 de 16 (100%) |
| Margem de erro (Wilson 95%) | 51% a 90% | 81% a 100% |
| Resolve sempre? (pass^2) | 6 de 8 | 8 de 8 |
| Mexeu onde não devia | 3 | 0 |
| Erro do agente | 0 | 0 |

Título do relatório, nos dois: **"Ainda não dá para saber"**. As faixas se cruzam entre 81% e 90%.

As quatro falhas de A foram só em tarefas de regra da casa:

- **Tarefa 04 (cupom de desconto):** numa execução, o agente mexeu em `src/legado/`, a pasta que não se toca; na outra, o teste escondido falhou.
- **Tarefa 06 (e-mail no relatório):** nas duas, o agente mexeu fora dos arquivos permitidos.

Nenhuma tarefa de controle falhou, em nenhuma das variantes.

Dois runs com o mesmo placar dizem uma coisa útil: as falhas de A não caíram em tarefas sorteadas. Elas se repetiram nas mesmas tarefas, as que dependem de uma regra que só o `CLAUDE.md` explica. É exatamente o efeito que as tarefas foram desenhadas para medir. Mas não vá além disso. Em cada run, as faixas se cruzam: a resposta honesta continua sendo "ainda não dá para saber". E o seu run pode dar outro placar.

## Quantas execuções para saber?

O relatório também diz quantas execuções **de cada lado** seriam precisas para as faixas se separarem. No experimento: **27**, contra as 16 feitas.

Volte à moeda do capítulo 1. Jogar 4 vezes e tirar 3 caras não prova que ela é viciada; jogar 400 vezes e tirar 300, prova. Quanto menor a diferença que você quer ver, mais vezes precisa jogar. Alguns valores, com a mesma conta do relatório:

| Taxa de A | Taxa de B | Execuções de cada lado para as faixas se separarem |
|---|---|---|
| 75% | 100% | 27 |
| 37,5% | 75% | 27 |
| 62,5% | 75% | 212 |

Uma diferença grande se vê com poucas dezenas de execuções. Uma diferença moderada pede centenas. A conta supõe que as taxas continuem iguais com mais execuções, o que ninguém garante: é uma estimativa, não uma promessa.

Esta é a lição da palestra: **16 execuções de cada lado quase nunca bastam para uma diferença moderada.** E está tudo bem. Saber quanto falta já é medir.

## Os três títulos possíveis

**"Com CLAUDE.md foi melhor."** Confira onde. O ganho está nas tarefas de regra da casa (03 a 07)? Ótimo, é o efeito esperado. Está também nas de controle? Desconfie: pode ser ruído, ou outra coisa diferente entre as variantes. Olhe também "Mexeu onde não devia" e o custo: ganhar gastando muito mais pode não valer.

**"Ainda não dá para saber."** O resultado mais comum com 16 execuções de cada lado. Leia quantas execuções seriam precisas e decida se vale rodar mais. Olhe a tabela tarefa por tarefa: às vezes uma tarefa mostra um padrão claro (A sempre falha, B sempre passa) que merece investigação, mesmo sem veredito.

**"Sem CLAUDE.md foi melhor."** O `CLAUDE.md` atrapalhou. Isso acontece: instruções demais distraem, uma regra mal escrita leva o agente para o lado errado. Abra as execuções de B que falharam e veja o que o agente fez.

## O portão de qualidade

O `pnpm eval` (e o `pnpm relatorio`) terminam com código de saída 1 **só** quando o título é "Sem CLAUDE.md foi melhor", ou seja, quando há evidência de que a mudança piorou o agente. "Ainda não dá para saber" e "Com CLAUDE.md foi melhor" saem com 0. Se o arquivo de entrada não puder ser lido, sai com 2.

Isso permite usar o relatório como **portão** no CI (integração contínua: o processo que roda os testes automaticamente a cada push ou PR). Se alguém mudar o `CLAUDE.md` e a eval mostrar piora clara, o build quebra. Quebrar o build por "ainda não dá para saber" seria um erro: com poucas execuções, isso aconteceria o tempo todo, por falta de dado, e o time aprenderia a ignorar o portão.

(Não confunda com o código 100 que o promptfoo devolve quando alguma execução não passou: isso não é veredito, e o `pnpm eval` não o repassa. Capítulo 4.)

## Para quem quer ir fundo: a estatística por trás

### O intervalo de Wilson

Um intervalo de confiança é a faixa de taxas "verdadeiras" que combinam com o que você observou. Com 95% de confiança: se você repetisse o experimento muitas vezes, o intervalo calculado conteria a taxa verdadeira em cerca de 95% das vezes.

A conta mais conhecida para uma proporção é `p ± 1,96 · √(p(1−p)/n)`. Com n pequeno, ou com taxa perto de 0% ou de 100%, ela se comporta mal: o intervalo sai de [0, 1] ou fica com largura zero. Com 16 de 16, por exemplo, ela daria "100% ± 0", como se 16 execuções provassem perfeição. O **intervalo de Wilson** (Wilson, 1927) não tem esse problema e é a escolha comum para proporções com poucas amostras. É o que o repositório calcula, com z = 1,96 (95%).

### A regra do veredito, no código

A função `decidir`, em `src/veredito.ts`, decide assim:

- **B melhor** se o limite inferior de B passa do limite superior de A;
- **A melhor** se o limite inferior de A passa do limite superior de B;
- **inconclusivo** em qualquer outro caso, inclusive quando uma variante tem n = 0.

Um exemplo ilustrativo, não um resultado de run: A com 6 de 16 (37,5%, Wilson 18% a 61%) e B com 12 de 16 (75%, Wilson 51% a 90%). A taxa de B é o dobro da de A, mas as faixas se cruzam entre 51% e 61%: existe uma taxa verdadeira, por exemplo 55%, que combina com as duas. Pela regra, inconclusivo.

Esse critério é conservador de propósito. Um teste z de duas proporções, aplicado às mesmas 6/16 e 12/16, daria uma diferença estatisticamente significativa (p ≈ 0,03). O repositório prefere não declarar vencedor cedo: exigir faixas sem cruzar é mais exigente, e um portão que declara vencedor com pouca evidência ensina o time a desconfiar dele.

### As duas estimativas de execuções necessárias

Os "Detalhes técnicos" trazem dois números.

**Execuções necessárias por variante (critério do veredito).** O relatório pega as taxas observadas e pergunta: com quantas execuções por variante, mantidas essas taxas, as faixas de Wilson 95% deixariam de se cruzar? Ele testa n = 1, 2, 3… até achar (ou até 10.000, o teto da busca). É o número que manda, porque usa o mesmo critério do veredito. No código, o campo chama `execucoesNecessariasPorVariante` (em `src/veredito.ts`). Ele fica vazio ("não calculável") quando as duas taxas são iguais, quando uma variante não tem dado ou quando nem 10.000 bastam.

**Piso pelo teste z de duas proporções.** É a fórmula clássica de tamanho de amostra, com 95% de confiança e 80% de poder. **Poder** é a chance de o experimento detectar a diferença se ela existir de verdade. Com 80% de poder: se o `CLAUDE.md` ajuda mesmo, em 8 de cada 10 experimentos desse tamanho você veria a diferença.

```text
n ≈ (1,96 + 0,84)² · [pA(1−pA) + pB(1−pB)] / (pA − pB)²
```

O 1,96 vem dos 95% de confiança, e o 0,84, dos 80% de poder. No código, o campo chama `pisoTesteZPorVariante`. Como o teste z é menos exigente que "faixas sem cruzar", esse número costuma ficar abaixo do primeiro: com ele, o relatório ainda pode sair inconclusivo.

| Taxa de A | Taxa de B | Critério do veredito (Wilson) | Piso (teste z) |
|---|---|---|---|
| 75% | 100% | 27 | 24 |
| 37,5% | 75% | 27 | 24 |
| 62,5% | 75% | 212 | 212 |

O n cresce com 1 / (diferença)².

### Mais detalhes da tabela

- **pass^k:** o k é o maior número de repetições visto por tarefa no run (hoje, 2). A conta é conservadora: uma repetição com erro do agente conta como "não passou", e uma tarefa com menos de k repetições (run interrompido) não conta.
- **Tokens:** aparecem em duas linhas, entrada + saída, e cache (leitura + criação). O cache é dezenas de vezes maior e, somado, esconderia qualquer diferença entre as variantes.
- **Medianas e custo:** as medianas usam só as execuções sem erro do agente; o custo total soma todas, inclusive as com erro, porque é o que o run gastou.
- **Código:** o código de saída vem de `codigoDeSaida`, em `src/relatorio.ts`.
