# Caso real: agentes KTLO na Creditas

Na Creditas, um time construiu agentes que resolvem chamados operacionais de suporte, o trabalho de *keep the lights on* (KTLO): o que mantém a operação rodando no dia a dia. Medir esses agentes ensinou mais sobre eval do que qualquer benchmark (um conjunto público de tarefas usado para comparar modelos).

Este capítulo traz só as lições. Ele não traz números internos, nomes de sistemas, de parceiros ou de pessoas, nem dados de clientes. As lições valem para qualquer agente, inclusive o agente de código que você usa.

## 1. Desfecho explícito por execução

Toda execução do agente termina com um rótulo: **resolvido**, **assistido**, **escalado** ou **falta informação**.

"Funcionou?" não é uma pergunta que se responde olhando um painel. "Assistido", por exemplo, quer dizer que o agente fez o diagnóstico, mas um humano executou a correção. Contar isso como "resolvido" infla o número. Contar como "falha" esconde o valor que o agente entregou. Por isso é um rótulo próprio.

No repositório desta palestra, a mesma ideia aparece como `passou`, `falhou`, `fora_do_escopo` e `erro_agente` (capítulo 2).

## 2. Desfecho mal definido distorce a métrica

Quando um caso que está **fora do escopo** do agente é contado como falha, a taxa de sucesso cai. E ninguém sabe se o agente piorou ou se simplesmente entrou outro tipo de caso.

Se a composição do denominador muda, a taxa muda sem o agente mudar. A lição: defina o desfecho **antes** de olhar o número.

## 3. O custo varia muito entre execuções

Algumas execuções custavam muito mais que a média, por causa do número de turnos. A média escondia isso; por isso olhar mediana e cauda importa mais que olhar a média.

A primeira tentativa de controle foi pôr no prompt algo como "pare depois de N chamadas". **Não segurou**: o modelo não conta as próprias voltas. O teto de orçamento virou um **hook**: um script que roda fora do modelo, a cada ação, e bloqueia a execução quando o limite é atingido. Ele é determinístico: faz sempre a mesma coisa.

É o mesmo princípio do capítulo 6: regra que não pode falhar não mora no prompt.

## 4. Eval em duas camadas

A eval ficou com duas camadas:

- uma **determinística** (que dá sempre o mesmo resultado), que roda a cada commit e testa a lógica do agente sem chamar o modelo;
- uma com o **modelo real**, que roda contra um **gabarito curado por humano**.

O gabarito **nasce vazio**. A pessoa escreve a resposta esperada sem olhar o que o agente respondeu. Se você copia a resposta do agente para o gabarito, é como deixar o aluno escrever o gabarito da própria prova: você mede o agente contra ele mesmo, e herda os vícios dele.

O repositório desta palestra repete as duas camadas: `pnpm test` (o medidor, com agente falso) e `pnpm eval` (o Claude Code de verdade), capítulo 4.

## 5. Matriz-catraca

A cobertura da eval é uma matriz: **rota × desfecho**. Cada rota (um tipo de chamado que o agente atende) cruzada com cada desfecho possível é uma célula. Cada célula deveria ter pelo menos um caso de eval.

A lista de células **sem cobertura** só pode **encolher**. Um teste quebra se alguém tirar cobertura. É a catraca do capítulo 6, aplicada à cobertura da eval.

## 6. IA como juiz: rejeitada ali

Usar outro modelo para dar nota ao trabalho do agente (IA como juiz, ou *LLM-as-judge*, capítulo 2) foi considerado e rejeitado naquele contexto. A razão: um juiz que varia avaliando um agente que varia **soma incerteza** (variância, no jargão). Cada número da eval passa a ter duas fontes de ruído em vez de uma.

O critério ficou em código e no gabarito humano.

Isso é ponto de discussão, não regra universal. Há tarefas em que o juiz ajuda: critérios que um teste não pega, como clareza de texto ou qualidade de uma descrição de PR. Nesses casos, meça o juiz também, contra rótulos humanos. Os vieses conhecidos de juízes (preferir a resposta numa certa posição, preferir respostas longas, preferir respostas parecidas com as próprias) estão documentados em Zheng et al. (2023). Para o agente de código, a regra prática é: se dá para verificar com código, verifique com código.

## 7. Falha em produção vira caso de eval

"O caso que surpreendeu na terça é um teste na quarta." Toda falha observada em produção vira um caso novo no conjunto de eval.

E um aprendizado só vira regra da casa (no prompt, na documentação, num hook) depois de aparecer em **dois ou mais** casos. Isso evita transformar uma exceção em regra para todo mundo.

No repositório, é o ciclo "falha vira tarefa nova" do capítulo 6.
