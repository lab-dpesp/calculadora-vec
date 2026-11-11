# Regras de negócio — Calculadora de Execução Penal

Registro central dos critérios, no mesmo modelo do cível. **Não é parecer
jurídico.** IDs são estáveis; nunca renumerar. Status:

- **A implementar** — critério decidido, ainda sem código;
- **Implementada** — no código e com teste (citar arquivo/função);
- **Premissa operacional** — hipótese explicitada ao usuário na tela/PDF;
- **Pendente de validação** — depende de decisão jurídica (Núcleo/EP) ou de
  conferência no texto oficial; o código implementa a opção indicada como
  *provisória* e mostra aviso.
- **Decidida pelo Núcleo; fontes a conferir** — posição de cálculo definida pelo
  Núcleo; a conferência das fontes oficiais permanece pendente e é indicada no
  resultado.

Toda mudança em `engine.js`, `regras.js` ou `datas.js` exige atualizar a linha
correspondente aqui no mesmo PR (`npm run verificar-regras`).

## Escopo do piloto

**Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente.**
Não altera as convenções D1–D3. Esta revisão implementa as decisões provisórias
de E13, E23, E27-A, E31, E33, E34/D6, D7, E37, E45 e E60/E61, além de manter E52 (conversão
para aplicar fração e contagem de período com indicação dos dias incluídos).
E37 exige os requisitos e só retira 1/8 com revogação reconhecida e datada;
E60/E61 mostram o requisito temporal e a condenação possivelmente impeditiva.
Prescrição executória e da falta grave (E80–E82), indulto e comutação (E70/E71)
ficam ocultos na tela, nas minutas e no relatório exportado; código e testes permanecem.
Desde #175, o núcleo também os omite por padrão, incluindo cortes históricos:
`opcoes.modulosProvisorios` permite inclusão explícita conforme a lista única em
`dados/modulos-provisorios.js`. E70/E71 e E80/E81 são módulos conjuntos; E82 é
independente. Motivos e status pendentes permanecem, sem mudança de critério jurídico.
Regras pendentes visíveis mostram o critério provisório e cenário comparável;
fatos decisivos ausentes são pedidos, e precedente vinculante segue PD-02.

## Registro de alterações sem mudança de critério jurídico

- #124: formato do Copilot v2 exige trecho literal e página por campo; respostas
  antigas são recusadas, e ausências ou contradições ficam para conferência manual.
  Só extração e rastreabilidade; nenhum critério jurídico foi alterado.
- #201: correção da leitura de rótulos em colunas e de marcações opcionais em branco
  nos relatórios SEEU; relatório sem "Fim do Relatório" é lido com aviso.
  Cinco PDFs fictícios cobrem o leitor. Sem mudança de critério jurídico, frações,
  prazos, convenções D1–D3 ou contrato `calcpen` v1.
- #202: o leitor SEEU organiza alertas provisórios de possível providência e de
  dado a conferir, sempre pela data do cálculo quando houver comparação temporal.
  Nenhum alerta altera o cálculo, as frações, D1–D3 ou o contrato `calcpen` v1.
- #179: inclusão de teste reproduzível de invariantes com entradas sintéticas;
  não altera critérios, prazos, frações ou convenções do motor.

---

## PD — Princípio de desempate (decisões jurídicas controvertidas)

Adotado para destravar decisões sem reunião; o Núcleo pode rever qualquer padrão por PR.

| ID | Regra |
|---|---|
| PD-01 | Onde houver controvérsia, o **padrão** é a tese mais favorável à defesa **com respaldo em tribunal superior** (STF ou STJ). A tese contrária aparece ao lado, como cenário, com o precedente que a sustenta. |
| PD-02 | Precedente **vinculante** (súmula vinculante, repercussão geral, recurso repetitivo, controle concentrado) prevalece sobre PD-01, mesmo quando desfavorável; a tese defensiva vencida aparece só como nota. |
| PD-03 | Questão afetada e ainda não julgada (vigilância V01–V06): padrão pelo PD-01 e aviso visível "tema pendente". |
| PD-04 | Questões **de fato** (como o SEEU conta dias: D1–D3) **não** se resolvem pelo PD: decidem os gabaritos (#1). |

Aplicação nesta versão:

| Regra | Padrão (PD) | Cenário ao lado |
|---|---|---|
| E23 (base após falta grave) | pena remanescente, inclusive para falta anterior a 2020 | — (Súmula 534 trata do reinício, não da base) |
| E31 (sucessão de leis) | comparação por condenação; aplicar a lei do fato ou a posterior mais favorável, sem combinar leis | — (STJ [Tema 1.354](docs/legislacao/PRECEDENTES.md#stj-tema-1354); guardar lei do fato, lei posterior e fundamento) |
| E33 (hediondo + reincidência apenas comum) | Era 2: 40% / 50% ([STF Tema 1.169](docs/legislacao/PRECEDENTES.md#stf-tema-1169), [STJ Tema 1.196](docs/legislacao/PRECEDENTES.md#stj-tema-1196)); Eras 3: 70% / 75% defensivos | Eras 3: 80% / 85% conforme texto legal; livramento avaliado à parte |
| E29 (remição não homologada) | considerar "se homologada", de forma condicional | somente remição já homologada |
| E100 (comutação concedida) | provisoriamente, frações posteriores à decisão sobre o remanescente comutado, sem alterar a data-base | comutação reduz o término, mas não altera a base de cálculo dos benefícios; revisão da Assessoria Criminal pendente |
| E45 (primário com maus antecedentes, LC) | mais de 1/3 | mais de 1/2, com STJ HC 19.023/RJ e STF HC 78.410/RJ visíveis |
| Era 3b, Título XII reincidente com violência | 20% (III) | 30% (IV) |
| D5 (hediondez em indulto) | data do fato | data do decreto |
| D6 (data-base da progressão seguinte) | data do último requisito preenchido; sem a data subjetiva, projeção condicionada ao requisito objetivo | decisão e transferência só como datas documentais |
| D7 ([Tema 1.457](docs/legislacao/PRECEDENTES.md#stj-tema-1457): descontinuidade da prisão) | primeira prisão, excluídos os dias em liberdade | retorno à prisão definitiva com detração da custódia cautelar anterior |
| P02 (condenação depurada como maus antecedentes) | **considera** (Tema 150/STF, PD-02) no desfavorável; **ignora** no favorável (o STF admite afastar condenações muito antigas) | — |
| P11 (1ª fase) | favorável: o **menor** entre 1/6 do mínimo e 1/8 do intervalo; desfavorável: o maior | — |
| P12 (confissão × reincidência) | compensação integral (Tema 585/STJ, PD-02) | preponderância só na multirreincidência, no desfavorável |
| P14 (várias majorantes da parte especial) | favorável: só a maior; desfavorável: cumuladas (fundamentação exigida, Súm. 443/STJ) | — |

## D — Decisões abertas (resolver antes/durante a Fase 1)

| ID | Questão | Opções | Provisório | Como decidir |
|---|---|---|---|---|
| D1 | Conversão da pena em dias para aplicar a fração | (a) 1 ano = 360, 1 mês = 30 (CNJ 2011); (b) 1 ano = 365, 1 mês = 30; (c) dias reais entre o início e o término pelo calendário | **(c)**, configurável | reproduzir 10+ atestados SEEU reais (ferramentas/casos). Adotar a que bater; registrar a divergência das demais |
| D2 | Data do benefício = data-base + dias da fração, com ou sem −1 | com −1 (como término, art. 10 CP) / sem −1 (como em manuais de VEC) | **sem −1** | gabaritos SEEU |
| D3 | Arredondamento de fração de dia | para cima / para baixo / manter fração e somar no fim | **para cima** (o requisito só se cumpre no dia completo) | gabaritos SEEU + Núcleo |
| D4 | Várias condenações com frações diferentes | soma das frações de cada pena (padrão SEEU) / fração única sobre o total | **soma das frações** (E30) | — |
| D5 | Hediondez para indulto/comutação | data do fato / data do decreto | **data do fato** + cenário (PD-01); fora do piloto | decisão provisória (IA), a revisar com a Assessoria Criminal; conferir orientação recente do STF e do STJ pela data do decreto |
| D6 | Data-base da progressão seguinte | último requisito objetivo/subjetivo preenchido / data da decisão / data da transferência | **data do último requisito** (PD-01); sem a data subjetiva, projeção condicionada ao objetivo | STJ [Tema 1.165](docs/legislacao/PRECEDENTES.md#stj-tema-1165); decisão e transferência são documentais |
| D7 | [Tema 1.457/STJ](docs/legislacao/PRECEDENTES.md#stj-tema-1457) (afetado em 26/06/2026; mérito pendente): data-base na descontinuidade da prisão | primeira prisão / retorno à prisão definitiva com detração da custódia cautelar | **primeira prisão** + cenário adverso (PD-01/PD-03) | acompanhar (V04); excluir liberdade e não duplicar a custódia cautelar |
| D8 | Método opcional TJSP/SAJ: fração aplicada ao saldo de cada condenação, com abatimento do tempo cumprido individualizado; data-base no último recolhimento/recaptura ou regressão, com saldo documentado | método observado em cálculos TJSP/SAJ (issue #80); sem validação jurídica independente | **Pendente de validação**; opção explícita, padrão atual preservado |

---

## Convenções de datas e tempo

Issue #177 (10/11/2026): somente linguagem e apresentação do resultado e das
pendências de importação, inclusive a frase do aviso E60 e a identificação da
origem do PDF. Nenhum critério, fração, prazo, vedação, convenção D1–D3, status
jurídico, versão da base ou campo do contrato foi alterado. `core/` e `dados/`
permanecem intactos; avisos e versões continuam no relatório.

#175 (10/11/2026): inclusão explícita dos módulos provisórios E70/E71 e E80–E82
no núcleo; sem a opção, seus campos e avisos são omitidos. Nenhuma mudança nos
cálculos de prescrição, cortes e indulto, nas frações, em D1–D3 ou na base jurídica.
O site e as integrações de tela preservam a ocultação do piloto.

Em 10/11/2026, E100 acrescenta o lançamento de comutação já concedida e sua
aplicação desde a decisão. A posição provisória (IA, issue #166) reduz a base
remanescente de progressão e livramento, sem mudar a data-base, com `CONFERIR` e
cenário sem alteração da base dos benefícios. Revisão da Assessoria Criminal e
gabaritos pendentes. Núcleo 0.6.0, base 2026.11.15; `calcpen` continua v1.
E102 acrescenta a convenção de triagem quando o término E50 já ocorreu e há
prisão ativa: avisa a data e os dias excedentes e suprime datas de benefícios,
sem alterar E50, frações, prazos, D1–D3 ou a base 2026.11.15. Núcleo 0.7.0;
`calcpen` continua v1.
Na integração com #167 e #168, natureza mantém E99, comutação usa E100 e a
hipótese explicativa do término SEEU usa E101. A atualização de versão em
`package.json` e o suporte a IDs de três dígitos nas verificações não mudam
critérios jurídicos ou D1–D3.
O incremento de versão em `package.json` é metadado; D1–D3 e a triagem dos
decretos E70/E71 não são alterados.

A revisão documental da issue #180 remove referências nominais a fontes externas,
sem alterar critério, fração, prazo, convenção D1–D3, status jurídico ou versão da base.

O pacote estático para publicação pela CTI (#84) altera apenas `package.json`
e o fluxo de publicação (comando `empacotar` e pasta `dist/`). É empacotamento:
nenhum critério, fração, prazo, convenção D1–D3, status jurídico ou versão da
base foi alterado.

O versionamento semântico do núcleo (#77) acrescenta `nucleoVersao` ao resultado
e exibe as versões do núcleo e da base (E95) na tela e no PDF. O verificador
também exige atualização de `CHANGELOG.md` para alterações em `core/` ou `dados/`.
São metadados e controle de publicação: nenhum critério, fração, prazo,
convenção D1–D3, status jurídico ou versão da base foi alterado.

A transferência de datas, regras e motor para `core/` e a criação do ponto de
entrada não alteram critérios, frações, prazos nem convenções de cálculo.

A tabela de padrões propostos de movimentos do pacote do processo (I14) serve
apenas para avisos de conferência; não altera critério, fração, prazo, convenção
D1–D3, status jurídico ou versão da base.

Para #165, E99/I17 acrescentam sugestão provisória de natureza pela lei, artigo e
vigência na data do fato. A sugestão pode preencher a natureza ausente e influir
nos benefícios que usam esse campo, mas não altera frações, prazos, vedações ou
as convenções de cálculo D1–D3; permanece marcada para conferência.

O contrato de saída `calcpen` acrescenta `versaoContrato: 1` e, para benefícios
sem data calculada, `motivoNaoCabe` e `fundamentoNaoCabe`, conforme
`ESPECIFICACAO-MOTOR.md`. Isso explicita a razão e os IDs das regras aplicáveis;
não altera datas, frações, prazos ou os critérios de cálculo.

A integração da detração cautelar no motor (`engine.js`, E27-A) soma as horas
comprovadas por data até a data do cálculo e converte o total em dias completos
de 24 horas, desprezando o restante somente no fim do período. Datas repetidas
ou sobrepostas a intervalos de detração não geram crédito duplicado. A revisão
em `regras.js` identifica essa mudança na base de regras (E95); permanecem
inalteradas as convenções E01–E06 e os padrões provisórios D1–D3. E27-A continua
pendente de validação, com aviso do Tema 1454/STF.

A decisão provisória de 06/11/2026 atualiza E23, E34/D6 e D7: saldo individual
por condenação após falta, data-base no último requisito e primeiro recolhimento
como padrão defensivo na prisão descontínua, com cenário de retorno e detração.
O aviso E23 explicita a incidência na pena remanescente e, com frações distintas,
mantém o rateio global apenas como estimativa.
Ela não altera D1–D3, as convenções de dias, o arredondamento ou o menos-1.
`regras.js` registra a revisão 2026.11.9 (E95).

E39 admite a remição em regime domiciliar a partir de 08/05/2026. Para remições
informadas com `regime: "domiciliar"`, o período é `periodo: {inicio, fim}`:
quando iniciado antes da vigência, os dias não são abatidos no cálculo principal
e a aplicação imediata da lei mais benéfica fica disponível como cenário
defensivo (PD-01). Períodos que cruzem a data devem ser separados quando os dias
remidos puderem ser atribuídos a cada parte. `regras.js` registra a revisão
2026.11.10 (E95).

Em 09/11/2026, D8 acrescenta, como opção provisória, o método observado em
cálculos TJSP/SAJ: fração por condenação sobre o saldo informado, data-base no
último recolhimento/recaptura e novo cálculo por saldo após regressão. Sem saldo
individual completo, o método não conclui uma data. O padrão atual e as
convenções D1–D3 permanecem inalterados; `dados/index.js` registra a revisão
2026.11.11 (E95).

Em 09/11/2026, E70/E71 acrescentam cortes históricos, triagem provisória por
decreto e preservação das datas da falta grave. Só hipóteses com critérios
estruturados podem indicar candidato; as demais ficam a conferir. A revisão
jurídica e os gabaritos seguem pendentes; chave do piloto desligada. A base passa
a 2026.11.12 e o pacote a 0.4.0; `calcpen` v1 permanece compatível.

Em 10/11/2026, I17 acrescenta sugestões provisórias de natureza por lei, artigo
e vigência nos leitores; os casos ambíguos não preenchem o campo. Não altera D1–D3,
as frações cadastradas, o cálculo nem o comparador. A revisão da Assessoria
Criminal permanece pendente; a base passa a 2026.11.13 e o pacote a 0.5.0;
`calcpen` v1 permanece compatível.

Em 10/11/2026, E80–E82 recebem cálculo provisório por crime, marcos guiados,
modulação do art. 109, bloqueio etário, recaptura e exigência de confirmação
documental. A revisão combinada com E99/I17 e E100 passa a base para 2026.11.15;
`calcpen` v1 não muda e o módulo segue oculto até revisão da Assessoria Criminal.

A página pública `/regras/` é gerada a partir deste documento pelo comando
`npm run gerar-pagina-regras` e incluída na publicação do site; seus arquivos
gerados não são versionados, evitando cópias divergentes. A identificação I15
permanece na conferência local, anterior à sugestão de natureza I17 (#178);
a renumeração e a verificação de IDs repetidos não mudam critérios jurídicos.
As alterações
em `package.json` acrescentam a geração e os testes dessa página, sem alterar
frações, datas, arredondamentos ou os critérios E01–E06 e D1–D3. A data exibida
na página identifica a última alteração do documento no Git, em horário de
Brasília; é um metadado de publicação, não a data do cálculo recebida pelo motor.

A integração da importação com a página de execução preserva os critérios deste
motor sem alterar frações ou datas. A conferência local fica em `importar.html`;
publicação e cache offline incluem os dois módulos. Os testes usam Node 22,
compatível com o PDF.js distribuído localmente (I01).

Em 07/11/2026, E33 passou a identificar como PD-03 o aviso para a fração de 50%
do Tema 1.196/STJ, sobrestado aguardando o julgamento do Tema 1.319/STF. O aviso
aparece na tela e no demonstrativo, sem alterar frações, requisitos ou datas de
cálculo. Os dados conferidos e os itens ainda a conferir estão em
[`docs/legislacao/PRECEDENTES.md`](docs/legislacao/PRECEDENTES.md).

Em 05/11/2026, `npm run diagnosticar:d1-d3` comparou 18 combinações com os
gabaritos atuais (relatório em `docs/DIAGNOSTICO-D1-D3.md`). Apenas 1 dos 9
gabaritos distingue combinações; o resultado não permite escolher uma convenção
nem justifica alterar os critérios. Mantêm-se os padrões provisórios D1–D3; nenhum
ID de regra ou versão da base foi alterado.

O esqueleto da página, do PWA, do tema, da persistência local dos dados de assinatura e da CI não cria nem altera critérios de cálculo. Mudanças em `engine.js`, `regras.js` ou `datas.js` continuam exigindo a atualização da regra correspondente nesta seção. O verificador compara esta seção sem considerar espaços; mudanças nele também devem registrar a ausência de alteração de critério.

A decisão provisória da MVT (05/11/2026) atualiza E13, E23, E27-A, E31, E33, E37, E45 e E60/E61, com avisos e situações condicionais; inclui ainda sobreposição de períodos na ferramenta E27-A. Não há alteração nos critérios ou padrões D1–D3, nem em `datas.js`.

A alteração em `engine.js` encaminha o objeto global ao factory para a integração da interface; o carregamento de `regras.js` no CommonJS permanece local. Esse ajuste não altera critérios nem a aritmética do cálculo.

As alterações de E37 e E60 em `engine.js` detalham requisitos ausentes e identificam condenação impeditiva em execução mista, sem alterar frações ou datas. E52 explicita na ferramenta rápida que a contagem de período exclui o primeiro dia e inclui o último.

E95 registra a versão da base no resultado; a versão em si não altera o cálculo.
A primeira base numerada é **2026.11.1**; as revisões **2026.11.2**, **2026.11.3**
e **2026.11.4** registram, respectivamente, E96, a separação de E31 por
`antecedenteViolento` e E97. A revisão **2026.11.5** registra a aplicação de D2
e D3 no motor, sem alterar os padrões provisórios. A revisão **2026.11.6**
registra as decisões de E23, E31, E33, E42 e E45. A revisão **2026.11.8**
registra E97 e E98 na classificação da conferência. A revisão **2026.11.10**
registra E39: remição domiciliar desde a vigência e cenário defensivo para os
períodos anteriores, sem aplicação retroativa silenciosa.
E42 não infere vedação de livramento das frações de progressão: os impedimentos
da Lei 15.358 dependem de enquadramento legal separado e só alcançam fatos novos.
`dados/index.js` é a fonte da versão e do histórico da base: cada mudança
de critério acrescenta uma entrada `{versao, regras: [IDs], descricao}` e
atualiza `versao`, sem apagar as revisões anteriores. O número N cresce dentro
do mês; no mês seguinte reinicia em 1. A versão da base não é a versão 1 do
formato `.calcpen` nem o hash de publicação do documento.

Em 07/11/2026, a issue #76 move as tabelas jurídicas para módulos UMD síncronos
em `dados/`, sem alterar frações, prazos, IDs, status, versão da base ou resultado
dos cálculos. `core/regras.js` consome as tabelas; `dados/index.js` mantém a versão
e o histórico. `core/index.js` permite fornecer outra base ao sistema hospedeiro.
O verificador compara os IDs dos módulos com o inventário desta seção.

E96 entra na versão **2026.11.2**: o fim registrado encerra a prisão, os dias
seguintes sem recolhimento são interrupção e as projeções dependem de prisão
ativa na data do cálculo. A interrupção por soltura não é tratada como fuga nem
gera pedido de data de recaptura.

E05: D2 subtrai um dia das datas de progressão, livramento e saída temporária
quando selecionado. D3 arredonda os requisitos de progressão e saída temporária
para cima, para baixo ou mantém as frações até a comparação com os créditos;
no livramento, preserva-se a exigência de "mais de" de E41/E43. A busca de
hipóteses do SEEU testa as combinações D1–D3; o término segue E03/E50.

A inclusão do teste de identidade visual no navegador, de seu workflow e do script `testar:navegador` com Playwright amplia a verificação da interface, sem alterar regras, frações, prazos ou convenções de cálculo.

A ampliação dos caminhos observados pelos workflows de teste e publicação e a padronização do Node em 22 são ajustes de CI; não alteram critérios, frações, prazos ou convenções de cálculo.

A inclusão de `ferramentas/testar-casos.js` em `npm test` executa os gabaritos
SEEU/TJSP de `ferramentas/casos/gabarito-*.json`, compara as datas com a
tolerância de cada caso e relata as diferenças nas opções D1–D4. As variantes
alternativas são diagnósticas; o bloqueio usa o cálculo padrão combinado (D4).
As divergências conhecidas permanecem justificadas em `esperadoFalhar`, cuja
marcação exige revisão quando o caso passa. Essa ampliação dos testes não altera
o motor, os padrões provisórios D1–D3, o critério D4 nem o status das regras
pendentes de validação.

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E01 | Datas em UTC, sem horário; `DD/MM/AAAA` na tela (`DDMMAAAA` também aceito), `AAAA-MM-DD` no JSON. Datas inválidas (31/04, mês 13) são recusadas, nunca "corrigidas" | — (convenção do cível N02/N03) | Implementada — `datas.js` (`parseDate`, `formatDateISO`, `formatDateBR`) e `engine.js` (`dataUTC`); `ferramentas/testar.js`, `ferramentas/testar-engine.js` |
| E02 | Pena informada em anos, meses e dias; nenhum campo negativo; meses ≥ 12 e dias ≥ 30 são aceitos mas normalizados só para exibição | — | Implementada — `datas.js` (`validateDuration`, `normalizeDuration`, `addDuration`) e `engine.js`; `ferramentas/testar.js`, `ferramentas/testar-engine.js` |
| E03 | Término da pena = data de início + pena pelo calendário comum − 1 dia (o dia do começo inclui-se no cômputo). Se o dia não existir no mês de destino, a soma avança para o dia 1º do mês seguinte | CP art. 10; convenção de aritmética de calendário a conferir nos gabaritos SEEU (issue #1) | Implementada — `datas.js` (`terminationDate`) e `engine.js`; `ferramentas/testar.js`, `ferramentas/testar-engine.js` |
| E04 | Conversão para dias: ver **D1** | — | Pendente de validação — opções implementadas em `datas.js` (`penaltyDays`); `ferramentas/testar.js` |
| E05 | Data do benefício: ver **D2/D3** | — | Pendente de validação — opções implementadas em `datas.js` (`benefitDate`, `roundDays`) e `engine.js`; `test/engine.test.js`, `test/saida-temporaria.test.js`, `ferramentas/testar.js` e `ferramentas/explicador.test.js` |
| E06 | Tudo o que é "tempo cumprido" (detração, remição, pena cumprida) é abatido em dias corridos | CP art. 42; LEP art. 128 | Implementada — `datas.js` (`differenceDays`, `differenceYMD`); `ferramentas/testar.js` |

A tabela de frações de `regras.js` aplica E31 considerando a era da data do fato
e as leis posteriores até a data do cálculo, recebida como parâmetro. A menor
fração é selecionada por condenação, sem combinar leis; o resultado registra a
lei da data do fato, a lei posterior mais favorável e o fundamento da escolha.
As vedações de livramento vêm de regras separadas (E42), nunca da linha de
progressão.
As datas são validadas em UTC (E01), com recusa de fatos anteriores ao escopo
(E91) e de cálculo anterior ao fato (E90). Não há mudança na aritmética de
`datas.js` nem nos padrões provisórios E02–E06 e D1–D3. Os comandos de `package.json`
passam a executar também os testes da tabela e, em `npm test`, os testes de
mutação das frações, sem introduzir outro critério de cálculo.

O cálculo de benefícios em `engine.js` arredonda os requisitos conforme D3 e
subtrai um dia das datas conforme D2, quando selecionados. No padrão, usa a
soma dos requisitos de cada condenação, arredondados para cima na progressão
(E30/D3), e o dia seguinte à fração total no livramento, por exigir "mais de"
(E41/E43). A falta grave
reinicia apenas a data-base da progressão; na fuga, usa-se a recaptura
(E22–E24). E23 usa a pena remanescente também para falta anterior a 23/01/2020;
o rateio do saldo entre condenações continua como premissa operacional a validar.
A progressão seguinte usa o saldo na data da
anterior (E34/D6).
Detração e remição homologada entram como créditos em dias corridos, abatida
a perda informada (E06/E26–E29); o livramento observa também os 12 meses sem
falta grave (E25/E44). Sem recaptura, não se projetam benefícios futuros nem
término (E21). Os testes de `test/engine.test.js` conferem os benefícios,
inclusive o exemplo E-EX1 em calendário e na opção de 360 dias. O resultado de cada
benefício sem data exibe o motivo fundamentado (E40–E42, E60). Na conferência, E97 classifica como divergência jurídica uma data válida do cálculo
oficial para livramento quando o motor, com dados suficientes, declara que o
benefício não cabe com fundamento E40–E42. Não há diferença em dias; a regra do
cálculo oficial só é indicada quando puder ser identificada. Dados incompletos não
recebem essa classificação.

O cálculo de prescrição em `engine.js` acrescenta os critérios provisórios
E80–E82, detalhados na seção "Prescrição (Fase 2)": prazo por condenação,
ajustes por reincidência e idade, pena restante na evasão, termo inicial
conforme o Tema 788 e prazo da falta grave. Datas de trânsito ausentes não
são presumidas. A linha do tempo da prescrição é separada da execução, e
os avisos mantêm explícito o status pendente de validação. Não há alteração
em `datas.js`, nas convenções D1–D3 nem nos critérios de progressão,
livramento e término.

O workflow `testar-calc-navegador.yml` passou a ter tempo-limite e cache do
navegador de testes, para que falhas de rede na instalação não prendam os
pull requests (#211, PR #212). É mudança só de infraestrutura de testes: não
há alteração em `datas.js`, nas convenções D1–D3 nem em critério de cálculo.

## Unificação e limites

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E10 | Penas de várias condenações são somadas (ou unificadas) para o cálculo | LEP art. 111 | Implementada (`engine.js`, `calcular`; `ferramentas/testar-engine.js`) |
| E11 | Limite de cumprimento: 40 anos para fatos a partir de 23/01/2020; 30 anos para fatos anteriores. O limite **não** é base de benefícios | CP art. 75 (Lei 13.964/2019); STF Súmula 715 | Implementada (`engine.js`, apenas no término; `ferramentas/testar-engine.js`) |
| E12 | Nova condenação no curso da execução: soma ao restante; **a data-base não muda** pela unificação | LEP art. 111, p.u.; STJ Tema 1006 | Implementada (`engine.js`, preservação da data-base; `ferramentas/testar-engine.js`) |
| E13 | Crime durante o período de prova, livramento ainda não revogado e penas não unificadas: a nova execução vinculada à condenação identificada começa no dia seguinte ao fim do período de prova. Prisão pelo novo fato permanece no histórico sem abatimento duplicado. Suspensão, revogação ou unificação exige a data da decisão e reconstrução; execuções com várias condenações não presumem uma data-base única | STJ [Tema 1.367](docs/legislacao/PRECEDENTES.md#stj-tema-1367) (REsps 2.205.262/RJ, 2.201.422/RJ e 2.200.477/RJ) | Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente |

## Data-base, interrupções e faltas

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E20 | Data-base inicial = data da prisão (início do cumprimento) | LEP art. 112 | Implementada (`engine.js`, `calcular`) |
| E21 | Fuga/evasão: o período fora não conta como pena cumprida; a contagem recomeça na recaptura | CP art. 113 (lógica); STJ (fuga = falta permanente até a recaptura) | Implementada (`engine.js`, `calcularBeneficios`); fuga sem recaptura não projeta benefícios nem término |
| E96 | O dia final informado da prisão é contado; o período seguinte até nova prisão ou a data do cálculo é interrupção. Sem prisão ativa na data do cálculo, progressão, livramento, saída temporária e término não são projetados até novo recolhimento | CP arts. 10 e 42; LEP art. 112; premissa operacional conforme os períodos de prisão informados | Premissa operacional (`engine.js`, interrupções derivadas dos períodos e aviso sem custódia ativa) |
| E22 | Falta grave interrompe o prazo da **progressão**; nova data-base = data do cometimento (fuga: recaptura) | STJ [Súmula 534](docs/legislacao/PRECEDENTES.md#a-conferir) (CONFERIR); Tema 709 | Implementada (`engine.js`, `calcularBeneficios`) |
| E23 | Após falta grave, aplica-se a fração de cada condenação ao saldo individual naquela data. Com frações iguais, usa-se o saldo global. Com frações diferentes e apenas saldo global, o rateio proporcional é mera estimativa, sem data conclusiva; saldos individuais podem ser informados por condenação e falta. Importação só reconhece saldo individual explicitamente identificado, com origem E93. Não há cenário automático de pena total | **Texto legal:** LEP arts. 111 e 112, § 6º. **Precedentes:** STJ [Súmula 534](docs/legislacao/PRECEDENTES.md#a-conferir) (CONFERIR) e Súmula 441; [Tema 1.354](docs/legislacao/PRECEDENTES.md#stj-tema-1354) (percentuais por condenação, sem definir distribuição do tempo cumprido) | **Posição defensiva provisória:** saldo individual informado; saldo global só conclui quando as frações são iguais. Aviso e estimativa proporcional nos demais casos. Revisão da Assessoria Criminal pendente |
| E24 | Falta grave **não** interrompe o prazo do livramento condicional nem de indulto/comutação | STJ Súmulas 441 e 535 | Implementada para LC (`engine.js`); indulto/comutação são Fase 2 |
| E25 | Livramento exige não ter cometido falta grave nos últimos 12 meses (fatos a partir de 23/01/2020): a calculadora mostra a data a partir da qual o requisito se cumpre | CP art. 83, III, "b" (Lei 13.964/2019) | Implementada (`engine.js`, `calcularBeneficios`) |
| E26 | Perda de dias remidos por falta grave: até 1/3, informada pelo usuário em dias (a calculadora não decide a fração) | LEP art. 127 | Implementada (`engine.js`, `calcularBeneficios`) |

## Detração e remição

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E27 | Detração: períodos de prisão provisória (início e fim, inclusivos) são somados e abatidos da pena; períodos sobrepostos são contados uma vez (avisar) | CP art. 42 | Implementada (`engine.js`, união inclusiva; `ferramentas/testar-engine.js`) |
| E27-A | Recolhimento domiciliar obrigatório noturno e em dias de folga: no critério provisório, somar as horas comprovadas, eliminar sobreposições quando os períodos forem informados e converter o total a cada 24 horas completas em um dia, desprezando o restante somente no fim. Dias excluídos não geram horas e datas repetidas/sobrepostas são contadas uma vez. Feriados nacionais (Leis 662/1949, 6.802/1980 e 14.759/2023) e o feriado estadual paulista de 9 de julho (Lei estadual 9.497/1997) são sugeridos automaticamente como dias de 24 horas, podendo ser retirados; feriados municipais são informados pelo usuário. A quantidade de datas com 24 horas é exibida em cenário separado, sem afirmar cabimento. Totais agregados pressupõem conferência prévia sem sobreposição. Monitoramento eletrônico não é requisito | STJ Tema 1.155 (REsp 1.977.135/SC); STF [Tema 1.454](docs/legislacao/PRECEDENTES.md#stf-tema-1454) (RE 1.598.180), mérito pendente | Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente |
| E28 | Remição é pena cumprida: soma ao tempo cumprido para progressão, LC e término. Entrada em dias já declarados/homologados; opcionalmente, calculadora auxiliar: trabalho 3:1; estudo 12 h:1 (em ≥ 3 dias); +1/3 na conclusão de nível de ensino; leitura 4 dias por obra, até 12 obras/ano | LEP arts. 126–128; Res. CNJ 391/2021 | Implementada para remições informadas em dias (`engine.js`, `calcular`; `ferramentas/testar-engine.js`). Calculadora auxiliar não incluída |
| E29 | Cada remição tem flag "homologada" e "data da homologação"; não homologada aparece em cenário separado ("se homologada") | LEP arts. 126–128; Res. CNJ 391/2021 | Implementada (`engine.js`, cenário nomeado e aviso; tela e demonstrativo impresso; `test/cenarios.test.js`) |
| E39 | Remição também no cumprimento em regime domiciliar. Registros `regime: "domiciliar"` informam `periodo: {inicio, fim}`. Se o período começa em ou após 08/05/2026, a remição segue o cálculo normal; se começa antes, não é abatida no cálculo principal e a aplicação imediata da lei mais benéfica aparece como cenário defensivo (PD-01), inclusive para períodos que cruzem a vigência. Separar períodos que cruzem a data quando os dias puderem ser atribuídos | LEP art. 126, § 9º (Lei 15.402/2026, arts. 1º e 3º); PD-01 | Implementada (`engine.js`, `calcularInterno`/`gerarCenarios`; testes E39 em `test/engine.test.js` e `test/cenarios.test.js`) |

## Progressão de regime

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E30 | Várias condenações: requisito = soma, para cada condenação, de (pena × fração aplicável àquela condenação); a data é contada da data-base, descontando detração e remição | D4 | Implementada (`engine.js`, `calcularBeneficios`) |
| E31 | Comparar **cada condenação separadamente**: considerar todas as redações posteriores ao fato até a data do cálculo, registrar a redação mais favorável e seu fundamento, sem combinar leis. Quando o resultado mudar, avisar qual redação foi aplicada. O campo `antecedenteViolento` permanece separado da reincidência; ausente/desconhecido mostra 25% como simulação defensiva condicionada e a data a 30%. Na Era 3B, violência fora do Título XII recebe 25% (primário) ou 30% (reincidente); Título XII é tratado separadamente: 1/6 (primário), 20% (reincidente, defensivo) e 30% (leitura adversa). | **Texto legal:** CF art. 5º, XL; LEP art. 112, redações das Leis 13.964/2019, 15.358/2026 e 15.402/2026. **Precedentes:** STJ, AgRg no HC 675.062/SP (6ª T.), HC 947.647/SP (5ª T.) e [AgRg no HC 766.551/MG](docs/legislacao/PRECEDENTES.md#a-conferir) (CONFERIR); STJ [Tema 1.354](docs/legislacao/PRECEDENTES.md#stj-tema-1354); STF RE 1.531.595 ([CONFERIR](docs/legislacao/PRECEDENTES.md#a-conferir)) | **Posição defensiva:** comparação individual, sem combinação; Título XII reincidente = 20%, com leitura adversa de 30%. **Status:** Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente |
| E32 | Natureza é informada por condenação: comum sem violência / com violência ou grave ameaça / hediondo ou equiparado / hediondo com resultado morte / tráfico privilegiado (não hediondo, § 5º) / feminicídio / comando de organização criminosa / milícia. Informar `antecedenteViolento` (`sim`, `nao` ou `desconhecido`) sobre a condenação anterior, sem substituir `reincidencia`. Marcar `tituloXII` para crimes do Título XII da Parte Especial do CP, inclusive quando também classificados como violentos | LEP art. 112; Lei 8.072/90; `docs/legislacao/LEP.md` | Implementada em `regras.js` |
| E33 | Distinguir 40% ([Tema 1.169/STF](docs/legislacao/PRECEDENTES.md#stf-tema-1169)), 50% ([Tema 1.196/STJ](docs/legislacao/PRECEDENTES.md#stj-tema-1196), sobrestado aguardando o [Tema 1.319/STF](docs/legislacao/PRECEDENTES.md#stf-tema-1319)) e 70%/75% desde 25/03/2026 como analogia defensiva para reincidência apenas por crime comum; mostrar 80%/85% como leitura legal alternativa. Para hediondo com morte e reincidência genérica, quando aplicada retroativamente a fração de 50%, exibir aviso de tema pendente PD-03 pelo sobrestamento do Tema 1.196/STJ até o julgamento do Tema 1.319/STF. No caso retroativo com morte, indicar pendência do Tema 1.319/STF quanto aos efeitos sobre outros benefícios | **Texto legal:** LEP art. 112, V, VII e VIII (Leis 13.964/2019 e 15.358/2026). **Precedentes:** STJ [Tema 1.084](docs/legislacao/PRECEDENTES.md#stj-tema-1084) e [Tema 1.196](docs/legislacao/PRECEDENTES.md#stj-tema-1196); STF [Temas 1.169](docs/legislacao/PRECEDENTES.md#stf-tema-1169) e [1.319](docs/legislacao/PRECEDENTES.md#stf-tema-1319) | **Posição defensiva:** progressão separada do livramento. **Status:** Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente |
| E34 | Progressão seguinte: fração sobre o **saldo** (pena − cumprido até a progressão anterior), a partir da data em que se completou o último requisito objetivo/subjetivo (D6). A data do requisito subjetivo pode ser informada; sem ela, a projeção fica condicionada à data objetiva. Data reconhecida pelo juízo prevalece quando anterior. Decisão e transferência são apenas datas documentais | STJ [Tema 1.165](docs/legislacao/PRECEDENTES.md#stj-tema-1165) | Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente — `engine.js`; testes E34/D6 |
| E35 | Progressão *per saltum* vedada: a calculadora nunca sugere fechado → aberto | STJ Súmula 491 | Implementada (`engine.js`, `calcularBeneficios`) |
| E36 | Exame criminológico: aviso de obrigatoriedade para fatos a partir de 11/04/2024 (Lei 14.843/2024); antes, facultativo e fundamentado. Não altera datas | LEP art. 112, § 1º; Súm. 439/STJ; SV 26 — Tema 1408/STF pendente | Premissa operacional |
| E37 | Progressão especial da mulher gestante/mãe/responsável por criança ou PcD: 1/8 só altera a fração da progressão, desde 20/12/2018 inclusive para fato anterior, com os requisitos legais confirmados. Registrar separadamente fato histórico, notícia e decisão; somente revogação reconhecida e datada retira o 1/8. Organização criminosa exige a hipótese legal própria; associação para o tráfico e associação criminosa não se equiparam automaticamente | LEP art. 112, §§ 3º–4º; Lei 13.769/2018; STJ [Tema 1.374](docs/legislacao/PRECEDENTES.md#stj-tema-1374); CF art. 5º, XL | Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente; opção provisória, aviso e eventos em `engine.js`/`index.html`; testes `test/e37.test.js` |
| E38 | Requisito subjetivo (bom comportamento) não é calculado; aparece como lembrete | LEP art. 112, § 1º | Premissa operacional |

### Tabela de frações por era (`dados/fracoes-progressao.js`)

Cada hipótese de progressão vira uma linha em `dados/fracoes-progressao.js` com `{id, era, natureza, reincidencia, fracao, fonte, vigencia, status}`. `core/regras.js` lê essa tabela e `menorFracao` retorna a linha selecionada, avisos e comparação das leis; as frações de LC e suas vedações ficam em dados separados (E41/E42/E45).
**Texto conferido em 04/11/2026** no art. 112 consolidado da Câmara dos Deputados
(transcrição em [`docs/legislacao/LEP.md`](docs/legislacao/LEP.md)), com as notas de
redação de cada inciso. Falta só a conferência no DOU/Planalto na revisão humana.

**Era 1 — fatos até 22/01/2020**

| ID | Hipótese | Fração | Fonte | Status |
|---|---|---|---|---|
| E31-ERA1-COMUM | comum (qualquer) | 1/6 | LEP art. 112 (red. original/Lei 10.792/2003) | Implementada |
| E31-ERA1-HEDIONDO-PRIMARIO | hediondo/equiparado, fatos de 29/03/2007 a 22/01/2020, primário | 2/5 | Lei 8.072/90, art. 2º, § 2º (Lei 11.464/2007) | Implementada |
| E31-ERA1-HEDIONDO-REINCIDENTE | hediondo/equiparado, idem, reincidente | 3/5 | idem | Implementada |
| E31-ERA1-HEDIONDO-ANTES-2007 | hediondo, fatos de 26/07/1990 a 28/03/2007 | 1/6 | STF HC 82.959; SV 26; STJ Súm. 471 | Implementada |

**Era 2 — fatos de 23/01/2020 a 24/03/2026 (Lei 13.964/2019)**

| ID | Hipótese | Fração | Inciso/fonte | Status |
|---|---|---|---|---|
| E31-ERA2-COMUM-PRIMARIO | primário, sem violência | 16% | I | Implementada |
| E31-ERA2-COMUM-REINCIDENTE | reincidente, sem violência | 20% | II | Implementada |
| E31-ERA2-VIOLENCIA-PRIMARIO | primário, com violência ou grave ameaça | 25% | III | Implementada |
| E31-ERA2-VIOLENCIA-REINCIDENTE-ANTECEDENTE-NAO | reincidente em crime violento, antecedente sem violência/grave ameaça (genérico ou específico) | 25% | III, por analogia favorável; STJ, AgRg no HC 675.062/SP (6ª T.) e HC 947.647/SP (5ª T., 05/12/2024) | Pendente de validação |
| E31-ERA2-VIOLENCIA-REINCIDENTE | reincidente em crime violento, antecedente com violência/grave ameaça (genérico ou específico) | 30% | IV | Pendente de validação |
| E31-ERA2-HEDIONDO-PRIMARIO-GENERICO | hediondo, primário (ou reincidente genérico — Tema 1084) | 40% | V | Implementada |
| E31-ERA2-HEDIONDO-MORTE-PRIMARIO-GENERICO | hediondo com morte, primário (ou reincidente genérico — Tema 1196) | 50% | VI, a; Lei 13.964/2019; `docs/legislacao/LEP.md` | Implementada |
| E31-ERA2-COMANDO-ORCRIM | comando de orcrim para hediondo | 50% | VI, b; Lei 13.964/2019; `docs/legislacao/LEP.md` | Implementada; sem vedação automática de LC |
| E31-ERA2-MILICIA | milícia | 50% | VI, c; Lei 13.964/2019; `docs/legislacao/LEP.md` | Implementada |
| E31-ERA2-FEMINICIDIO-PRIMARIO | feminicídio, primário (fatos de **10/10/2024 a 24/03/2026**) | 55% | VI-A (Lei 14.994/2024, DOU 10/10/2024; revogado pela Lei 15.358/2026); `docs/legislacao/LEP.md` | Implementada |
| E31-ERA2-HEDIONDO-ESPECIFICO | hediondo, reincidente específico | 60% | VII; Lei 13.964/2019; `docs/legislacao/LEP.md` | Implementada |
| E31-ERA2-HEDIONDO-MORTE-ESPECIFICO | hediondo com morte, reincidente específico | 70% | VIII; Lei 13.964/2019; `docs/legislacao/LEP.md` | Implementada |

**Era 3A — fatos de 25/03/2026 a 07/05/2026 (Lei 15.358/2026)**

| ID | Hipótese | Fração PR | Texto legal | Precedente qualificado | Posição defensiva | Status |
|---|---|---:|---|---|---|---|
| E31-ERA3A-COMUM-PRIMARIO | primário, sem violência | 16% | LEP art. 112, I (Lei 13.964/2019) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-COMUM-REINCIDENTE | reincidente, sem violência | 20% | LEP art. 112, II (Lei 13.964/2019) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-VIOLENCIA-PRIMARIO | primário, com violência | 25% | LEP art. 112, III (Lei 13.964/2019) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-VIOLENCIA-REINCIDENTE-ANTECEDENTE-NAO | reincidente violento, antecedente não violento ou desconhecido | 25% | LEP art. 112, III, por analogia favorável | STJ, AgRg no HC 675.062/SP; HC 947.647/SP | 25%; comparar 30% se o antecedente for violento (#68) | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-VIOLENCIA-REINCIDENTE | reincidente violento, antecedente violento | 30% | LEP art. 112, IV (Lei 13.964/2019) | — | Conforme #68 | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-HEDIONDO-PRIMARIO | hediondo sem morte, primário | 70% | LEP art. 112, V (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-HEDIONDO-GENERICO | hediondo sem morte, reincidente só em crime comum | 70% | LEP art. 112, VII prevê 80% | — | 70% | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-HEDIONDO-REINCIDENTE | hediondo sem morte, reincidente específico | 80% | LEP art. 112, VII (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-HEDIONDO-MORTE-PRIMARIO | hediondo com morte, primário | 75% | LEP art. 112, VI, a (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-HEDIONDO-MORTE-GENERICO | hediondo com morte, reincidente só em crime comum | 75% | LEP art. 112, VIII prevê 85% | STJ Tema 1196 (Era 2) | 75% | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-HEDIONDO-MORTE-REINCIDENTE | hediondo com morte, reincidente específico | 85% | LEP art. 112, VIII (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-COMANDO-ORCRIM | comando de organização criminosa ultraviolenta | 75% | LEP art. 112, VI, b (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-MILICIA | constituição de milícia privada | 75% | LEP art. 112, VI, c (Lei 15.358/2026) | — | Sem vedação própria de LC | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3A-FEMINICIDIO-PRIMARIO | feminicídio, primário | 75% | LEP art. 112, VI, d (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |

**Era 3B — fatos a partir de 08/05/2026 (Lei 15.402/2026)**

| ID | Hipótese | Fração PR | Texto legal | Precedente qualificado | Posição defensiva | Status |
|---|---|---:|---|---|---|---|
| E31-ERA3B-COMUM-PRIMARIO | regra geral, primário sem violência | 1/6 | LEP art. 112, caput (Lei 15.402/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-COMUM-REINCIDENTE | reincidente sem violência | 20% | LEP art. 112, III (Lei 15.402/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-VIOLENCIA-PRIMARIO | primário violento, fora do Título XII | 25% | LEP art. 112, I (Lei 15.402/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-VIOLENCIA-REINCIDENTE | reincidente violento, fora do Título XII | 30% | LEP art. 112, II (Lei 15.402/2026) | — | Não depende do antecedente violento (#68 não alterada) | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-TITULO-XII-PRIMARIO | crime violento do Título XII, primário | 1/6 | LEP art. 112, caput (Lei 15.402/2026) | — | Lei posterior mais favorável retroage | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-TITULO-XII-REINCIDENTE | crime violento do Título XII, reincidente | 20% | LEP art. 112, III (Lei 15.402/2026) | — | 20% padrão defensivo; 30% do inciso IV como alternativa | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-HEDIONDO-PRIMARIO | hediondo sem morte, primário | 70% | LEP art. 112, V (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-HEDIONDO-GENERICO | hediondo sem morte, reincidente só em crime comum | 70% | LEP art. 112, VII prevê 80% | — | 70% | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-HEDIONDO-REINCIDENTE | hediondo sem morte, reincidente específico | 80% | LEP art. 112, VII (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-HEDIONDO-MORTE-PRIMARIO | hediondo com morte, primário | 75% | LEP art. 112, VI, a (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-HEDIONDO-MORTE-GENERICO | hediondo com morte, reincidente só em crime comum | 75% | LEP art. 112, VIII prevê 85% | STJ Tema 1196 (Era 2) | 75% | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-HEDIONDO-MORTE-REINCIDENTE | hediondo com morte, reincidente específico | 85% | LEP art. 112, VIII (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-COMANDO-ORCRIM | comando de organização criminosa ultraviolenta | 75% | LEP art. 112, VI, b (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-MILICIA | constituição de milícia privada | 75% | LEP art. 112, VI, c (Lei 15.358/2026) | — | Sem vedação própria de LC | Decidida pelo Núcleo; fontes a conferir |
| E31-ERA3B-FEMINICIDIO-PRIMARIO | feminicídio, primário | 75% | LEP art. 112, VI, d (Lei 15.358/2026) | — | — | Decidida pelo Núcleo; fontes a conferir |

Consequências E31: 1/6 é mais gravoso que 16%, por isso 1/6 só se aplica a fatos desde 08/05/2026; o Título XII recebe a regra posterior benéfica; hediondos e hipóteses especiais têm progressão própria. As vedações de LC são determinadas exclusivamente por E42, nunca pela fração de progressão. Frações gravosas das Eras 3 só alcançam fatos posteriores. Os incisos IV a X do projeto da Lei 15.402 não promulgados não são tratados como vigentes; ADIs 7966/7967 (V01).

## Livramento condicional

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E40 | Pena (somada, art. 84) igual ou superior a 2 anos; abaixo disso, "não cabe LC" | CP arts. 83 e 84 | Implementada (`engine.js`, `calcularBeneficios`) |
| E41 | Frações: mais de 1/3 (primário com bons antecedentes); mais de 1/2 (reincidente em crime doloso); mais de 2/3 (hediondo/equiparado, tráfico, tortura, terrorismo, tráfico de pessoas), vedado ao reincidente específico nesses crimes. "Mais de" = dia seguinte ao implemento da fração | CP art. 83, I, II e V | Implementada (`dados/fracoes-livramento.js`, `core/regras.js`, `fracaoLC`; `engine.js`, `calcularBeneficios`) |
| E42 | Vedações de livramento são calculadas em dados próprios, separadas da tabela de progressão: reincidência específica do CP e enquadramento opcional nos dispositivos da Lei 15.358. O enquadramento nos arts. 2º, § 4º, III, ou 3º, parágrafo único, é informado por condenação e só produz efeito para fatos desde 25/03/2026. Comando de organização criminosa da Era 2 não recebe vedação automática; para fatos novos a vedação da Lei 15.358 só se aplica com o enquadramento legal correspondente. | **Texto legal:** CP art. 83, V; Lei 15.358/2026, art. 2º, § 4º, III, e art. 3º, parágrafo único. **Precedentes:** não aplicável | **Posição defensiva:** nenhuma vedação é inferida da linha de progressão; cada hipótese é avaliada à parte. **Status:** Decidida pelo Núcleo; fontes a conferir (`dados/vedacoes.js`) |
| E43 | Várias condenações: soma das frações de cada pena, como E30 | CP art. 84 | Implementada (`engine.js`, `calcularBeneficios`) |
| E44 | Requisito de 12 meses sem falta grave: ver E25 | — | Implementada (`engine.js`, `calcularBeneficios`) |
| E45 | Manter maus antecedentes separado da reincidência. Para primário com maus antecedentes, exigir mais de 1/3 na posição defensiva e mostrar a data a mais de 1/2 na leitura adversa; nunca usar exatamente 1/3. | **Texto legal:** CP art. 83, I e II. **Precedentes:** STJ RHC 12.608/RJ ([CONFERIR](docs/legislacao/PRECEDENTES.md#a-conferir), favorável), [STF Informativo 146](docs/legislacao/PRECEDENTES.md#a-conferir) (HC 73.002 e RHC 66.222; CONFERIR) e [HC 78.410/RJ](docs/legislacao/PRECEDENTES.md#a-conferir) — CONFERIR | **Posição defensiva:** mais de 1/3; alternativa adversa mais de 1/2. **Status:** Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente |
| E97 | Na conferência, se a fonte oficial informa data válida de livramento e o motor, com dados suficientes, declara que não cabe com fundamento E40–E42, classificar como divergência jurídica, mostrar a regra do motor e não calcular diferença em dias. Informar a regra oficial quando identificável. Dados incompletos não bastam | CP arts. 83–84; E40–E42 | Implementada — `explicador.js` (`explicarDivergencias`) e `ui.js`; `ferramentas/explicador.test.js`, `ferramentas/ui.test.js` |
| E98 | Classificar cada diferença, nesta ordem: (3) falta confirmar dado quando fato não informado muda as datas possíveis; (1) diferença de convenção se outra combinação D1–D3 ou de inclusão/exclusão do primeiro dia reproduzir exatamente a data oficial, ou nos limites operacionais de E101 para o término SEEU; (2) divergência jurídica quando fatos e convenções iguais reproduzirem a data oficial sob regra diferente; (4) sem explicação quando nenhuma hipótese reproduzir o valor oficial. Exibir categoria, explicação curta e, para dado pendente, as datas possíveis lado a lado. E97 é divergência jurídica | Critério de conferência; E05, E31, E40–E45, E97, E101 | Implementada — `explicador.js`, `engine.js`, `ui.js`, demonstrativo e modelos exportáveis; `ferramentas/explicador.test.js`, `ferramentas/ui.test.js`, `ferramentas/documentos.test.js` |
| E100 | Comutação já concedida: registrar dias, decreto, data da decisão, origem e, opcionalmente, condenação. Reduz a pena a cumprir desde a decisão, preservando as penas originais; limite pelo saldo global, sem truncar a concessão por rateio presumido. Comutar antes de aplicar o teto do art. 75 (E11), sem reduzir o próprio teto quando a pena comutada ainda o supera. Para progressão e livramento posteriores à decisão, aplicar provisoriamente as frações ao remanescente após a comutação, sem alterar a data-base; mostrar `CONFERIR` e o cenário “comutação não altera a base de cálculo dos benefícios”. A comutação não equivale a tempo cumprido e não cria efeitos antes da decisão | CF art. 84, XII; CP arts. 75 e 107, II; decreto e decisão informados. Efeitos sobre benefícios: decisão provisória (IA), issue #166; não se presume precedente validado | **Pendente de validação** pela Assessoria Criminal; padrão defensivo e cenário contrário — `core/engine.js`, `test/comutacoes.test.js`; memória e relatório com ID E100 |
| E101 | Na conferência do término SEEU, calcular a hipótese explicativa como data de emissão + (pena total − pena cumprida), subtraindo anos, meses e dias campo a campo, com empréstimo de 12 meses e 30 dias, e somando o restante pelo calendário sem −1. Classificar como diferença de convenção somente se tanto o término do motor quanto o da hipótese ficarem a até 2 dias da data oficial. Não altera o cálculo principal nem D1–D3 | Convenção observada nas amostras de relatórios SEEU (`docs/INVESTIGACAO-GABARITOS.md`); PD-04 | Premissa operacional — conferência em `explicador.js`; leitura/rastro de `dataEmissao` em `core/leitores/seeu-relatorio.js`; testes sintéticos E101 |
| E102 | Se o término E50 for anterior ou igual à data do cálculo e houver prisão ativa, informar a data em que a pena consta como cumprida e os dias transcorridos; emitir aviso de triagem a conferir, não calcular datas de benefícios e não incluir marcos posteriores ao término na linha do tempo. O leitor também sinaliza remanescente SEEU igual a zero, sempre para conferência na data do cálculo. Não altera término, frações, prazos ou D1–D3 | E50/E51; E96; decisão do defensor na issue #202 | Implementada — `core/engine.js`, `core/leitores/seeu-relatorio.js`; testes E102 em `test/engine.test.js` e `test/seeu-avisos.test.js` |
| E103 | Se a data prevista de progressão no relatório for anterior à data do cálculo, não houver benefício posterior anotado e o regime informado não for aberto, apontar possível pedido de progressão; o requisito objetivo aparente não substitui a análise dos demais requisitos | LEP art. 112; decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E104 | Se a data prevista de livramento for anterior à data do cálculo, sem livramento concedido anotado e sem vedação identificada por E41/E42, apontar possível pedido, sem concluir cabimento | CP art. 83; E41/E42; decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E105 | Interrupção expressa ou cumprimento não iniciado gera somente alerta genérico para verificar prescrição executória, sem informar data nem ativar E80–E82 | Tema 788/STF — CONFERIR; decisão do defensor na issue #202 | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E106 | Data-base igual à data de incidente “Somatório de Penas” gera alerta para conferir se a unificação alterou indevidamente a data-base | STJ, REsp 1.557.461/SC — CONFERIR; decisão do defensor na issue #202 | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E107 | Fração percentual indicada no relatório para crime anterior a 23/01/2020 gera alerta para verificar a regra mais benéfica | Lei 13.964/2019; decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E108 | Marcação em branco de violência ou grave ameaça, resultado morte, comando de organização criminosa ou reincidência, havendo fração informada, gera dado a conferir; o leitor não preenche a marcação | Campos do relatório SEEU; decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E109 | Trânsito em julgado informado como “Não informado” gera dado a conferir; o leitor não presume data | Campo do relatório SEEU; decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E110 | Fração 1/6 com reincidência, violência ou outra marcação positiva que possa afetar a fração gera aviso neutro para conferir tanto a fração quanto as marcações, sem decidir qual está correta | LEP art. 112; decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E111 | Fração 1/6 indicada para crime posterior a 23/01/2020 gera dado a conferir, sem alterar a fração ou o cálculo | LEP art. 112; Lei 13.964/2019; decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E112 | Relatório emitido há mais de 30 dias em relação à data do cálculo gera dado a conferir; a data de emissão não substitui a data do cálculo | Decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |
| E113 | Em lesão corporal (CP, art. 129), a marcação “Violência ou grave ameaça: Não” gera dado a conferir, preservada a marcação do relatório e sem segundo cenário | CP art. 129; decisão do defensor na issue #202; precedentes CONFERIR | Decisão provisória do defensor sobre proposta da IA, a revisar com a Assessoria Criminal; sempre “a conferir” — `core/leitores/seeu-relatorio.js`, `test/seeu-avisos.test.js` |

## Término e saldo

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E50 | Término = data-base do cumprimento + (pena total − detração − remição + dias de interrupção), pelo calendário (E03) | CP arts. 10 e 42; LEP art. 128 | Implementada (`engine.js`, `calcular`; `ferramentas/testar-engine.js`) |
| E51 | Pena cumprida e restante na data do cálculo, em anos/meses/dias e em dias; para E70, repetir o mesmo cálculo em cada corte histórico de 25/12, sem incluir fatos posteriores ao corte | — | Implementada (`engine.js`, `calcular`; `ferramentas/testar-engine.js`, `test/engine.test.js`); corte histórico e aplicação ao indulto pendentes de validação |
| E52 | Ferramentas rápidas: conversão 360/30 e 365/30 usa anos × convenção + meses × 30 + dias; calendário soma anos e meses à data inicial (limitando ao último dia do mês) e conta dias corridos. Conversão inversa usa a mesma origem; somar/subtrair anos e meses limita dias inexistentes ao último dia do mês. Contagem padrão = final − inicial (sem contar a data final); a opção inclusiva soma um dia para contar ambas as datas. As frações de E31–E33, E37, E41 e E61 são apenas referência matemática e arredondam para cima (D3), sem decidir cabimento. Datas são UTC | D1/D3; E01; regras de fração citadas | Pendente de validação — decisão provisória (IA); revisão da Assessoria Criminal pendente; opção provisória e aviso em `ferramentas.html`; `ferramentas-rapidas.test.js` |

## Saída temporária (Fase 2)

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E60 | Gozo exige semiaberto. Manter as viradas: antes de 23/01/2020 finalidades antigas; de 23/01/2020 a 10/04/2024 impedimento do hediondo com morte; de 11/04/2024 impedimento do hediondo ou violência/grave ameaça; de 13/06/2024 somente estudo (art. 122, II). Em execução conjunta, apontar a condenação ainda em cumprimento e a lei que alcança o fato; apresentar como possível impedimento, sem bloquear toda a execução. Para fatos anteriores atingidos, indicar o [Tema 1.381/STF](docs/legislacao/PRECEDENTES.md#stf-tema-1381), de mérito pendente. Tema adicional: [HC 932.864/SC](docs/legislacao/PRECEDENTES.md#a-conferir) (CONFERIR). Requisito temporal não substitui autorização judicial | LEP art. 122; Leis 13.964/2019 e 14.843/2024; STF [Tema 1.381](docs/legislacao/PRECEDENTES.md#stf-tema-1381); [HC 932.864/SC](docs/legislacao/PRECEDENTES.md#a-conferir) (CONFERIR) | Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente; aviso na tela/impressão; `test/saida-temporaria.test.js` |
| E61 | Requisito objetivo: 1/6 (primário) ou 1/4 (reincidente genérico ou específico em qualquer condenação) da pena total somada, sem limite do art. 75, contando também tempo no fechado (Súmula 40/STJ), detração e remição homologada. Falta grave e progressão não reiniciam a contagem; a data não autoriza a saída | LEP art. 123, II; LEP art. 128; CP art. 42; STJ Súmula 40; E04–E06, E21, E26–E28 | Decisão provisória (IA, 05/11/2026); revisão da Assessoria Criminal pendente |

## Indulto e comutação (Fase 2)

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E70 | Decretos em módulos UMD `dados/decretos/AAAA.js`, com requisito, ID, artigo, fonte, vigência e status. Calcular cortes de 25/12 pela E51; admitir corte histórico, tempo informado e classificação de pena impeditiva/não impeditiva; separar indulto, comutação, impedimentos e itens a conferir. Avaliar lapsos e rotas com campos estruturados; dados ausentes ou hipóteses ainda não estruturadas permanecem “a conferir”, nunca “não cabe”. Permitir simular decreto anterior | Decretos 12.338/2024, arts. 5º–14, e 12.790/2025, arts. 5º–14 | Pendente de validação — decisão provisória (IA), a revisar com a Assessoria Criminal; protótipo fora do piloto, chave desligada por padrão e gabaritos pendentes |
| E71 | Guardar fato, instauração, reconhecimento judicial e publicação do decreto. Exigir sanção judicial reconhecida; avaliar a janela de 12 meses retroativa a 25/12 do respectivo ano; falta posterior à publicação não impede. Quando datas, reconhecimento ou mora estatal não permitirem conclusão segura, manter o resultado inconclusivo. O Tema 1.195/STJ trata do Decreto 9.246/2017; conferir se alcança os Decretos 12.338/2024 e 12.790/2025 | Decretos 12.338/2024 e 12.790/2025, art. 6º; STJ Tema 1.195 | Pendente de validação — decisão provisória (IA), a revisar com a Assessoria Criminal; protótipo fora do piloto, chave desligada por padrão |

## IDs das regras mantidas como dados

Este inventário é verificado por `npm run verificar-regras`. Os IDs associados a
mais de uma era, hipótese ou decreto continuam identificando a regra jurídica
comum; os artigos e campos discriminam os itens de dados.

- E31; E31-ERA1-COMUM; E31-ERA1-HEDIONDO-ANTES-2007; E31-ERA1-HEDIONDO-PRIMARIO; E31-ERA1-HEDIONDO-REINCIDENTE.
- E31-ERA2-COMUM-PRIMARIO; E31-ERA2-COMUM-REINCIDENTE; E31-ERA2-VIOLENCIA-PRIMARIO; E31-ERA2-VIOLENCIA-REINCIDENTE-ANTECEDENTE-NAO; E31-ERA2-VIOLENCIA-REINCIDENTE; E31-ERA2-HEDIONDO-PRIMARIO-GENERICO; E31-ERA2-HEDIONDO-MORTE-PRIMARIO-GENERICO; E31-ERA2-COMANDO-ORCRIM; E31-ERA2-MILICIA; E31-ERA2-FEMINICIDIO-PRIMARIO; E31-ERA2-HEDIONDO-ESPECIFICO; E31-ERA2-HEDIONDO-MORTE-ESPECIFICO.
- E31-ERA3A-COMUM-PRIMARIO; E31-ERA3A-COMUM-REINCIDENTE; E31-ERA3A-VIOLENCIA-PRIMARIO; E31-ERA3A-VIOLENCIA-REINCIDENTE-ANTECEDENTE-NAO; E31-ERA3A-VIOLENCIA-REINCIDENTE; E31-ERA3A-HEDIONDO-PRIMARIO; E31-ERA3A-HEDIONDO-GENERICO; E31-ERA3A-HEDIONDO-MORTE-PRIMARIO; E31-ERA3A-HEDIONDO-MORTE-GENERICO; E31-ERA3A-HEDIONDO-REINCIDENTE; E31-ERA3A-HEDIONDO-MORTE-REINCIDENTE; E31-ERA3A-COMANDO-ORCRIM; E31-ERA3A-MILICIA; E31-ERA3A-FEMINICIDIO-PRIMARIO.
- E31-ERA3B-COMUM-PRIMARIO; E31-ERA3B-COMUM-REINCIDENTE; E31-ERA3B-VIOLENCIA-PRIMARIO; E31-ERA3B-VIOLENCIA-REINCIDENTE; E31-ERA3B-TITULO-XII-PRIMARIO; E31-ERA3B-TITULO-XII-REINCIDENTE; E31-ERA3B-HEDIONDO-PRIMARIO; E31-ERA3B-HEDIONDO-GENERICO; E31-ERA3B-HEDIONDO-MORTE-PRIMARIO; E31-ERA3B-HEDIONDO-MORTE-GENERICO; E31-ERA3B-HEDIONDO-REINCIDENTE; E31-ERA3B-HEDIONDO-MORTE-REINCIDENTE; E31-ERA3B-COMANDO-ORCRIM; E31-ERA3B-MILICIA; E31-ERA3B-FEMINICIDIO-PRIMARIO.
- E37; E41; E42-LEI15358-ART2-P4-III; E42-LEI15358-ART3-PU; E45; E70.
- E99-CP155-CAPUT; E99-CP157-CAPUT; E99-CP157-ARMA-ANTES; E99-CP157-ARMA-DEPOIS; E99-CP157-ARMA-RESTRITA; E99-CP157-LESAO-GRAVE-MORTE; E99-CP157-LESAO-GRAVE-MORTE-2020; E99-CP155-EXPLOSIVO; E99-CP121-QUALIFICADO; E99-CP121-FEMINICIDIO-QUALIFICADOR; E99-CP121A-FEMINICIDIO; E99-CP213-ESTUPRO; E99-CP217A-ESTUPRO-VULNERAVEL; E99-CP158-MORTE; E99-CP158-RESTRICAO-LESAO-MORTE; E99-CP159-SEQUESTRO; E99-LEI11343-33-TRAFICO; E99-LEI11343-33-4-PRIVILEGIADO; E99-LEI9455-TORTURA; E99-LEI13260-TERRORISMO; E99-CP288A-MILICIA; E99-LEI12850-COMANDO-ORCRIM.

## Prescrição (Fase 2)

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E80 | Calcular por crime, inclusive quando uma sentença condenar por vários crimes (um registro por crime, art. 119 do CP); considerar a pena restante na fuga ou na revogação do livramento; aumentar 1/3 pela reincidência; aplicar uma única vez a redução etária pela metade. Para fatos desde 04/07/2025, não aplicar a redução em crime com violência sexual contra a mulher (Lei 15.160/2025). Manter o prazo mínimo do art. 109, VI, em 2 anos para fatos anteriores a 06/05/2010 e 3 anos desde essa data. Só emitir data após conferência das certidões de trânsito, prisão, decisões e causas de interrupção ou suspensão; sem confirmação, manter a data não calculada. | CP arts. 109, 110, 113 e 115; Leis 12.234/2010 e 15.160/2025 | Pendente de validação — decisão provisória (IA, 10/11/2026), revisão da Assessoria Criminal pendente; módulo oculto no piloto |
| E81 | Marco guiado: trânsito para a acusação até 12/11/2020, inclusive; depois, trânsito para ambas as partes. Sem certidão suficiente, não emitir data. Preservar extinção já declarada. O REsp 2.073.668/RS menciona “até 11/11/2020”; limite exato a CONFERIR. | STF Tema 788 (modulação); REsp 2.073.668/RS (limite temporal a conferir) | Pendente de validação — decisão provisória (IA, 10/11/2026), revisão da Assessoria Criminal pendente; módulo oculto no piloto |
| E82 | Prazo de 2 anos para falta anterior a 06/05/2010 e de 3 anos desde essa data. Na fuga, contar da recaptura; se a fuga atravessar o corte de 2010, selecionar provisoriamente o prazo pela data da recaptura. Sem certidão da falta ou da recaptura, não emitir data. | STJ (aplicação analógica do art. 109, VI); Lei 12.234/2010 | Pendente de validação — decisão provisória (IA, 10/11/2026), revisão da Assessoria Criminal pendente; módulo oculto no piloto |

## Vigilância (acompanhar; podem mudar regras)

| ID | Objeto | Afeta |
|---|---|---|
| V01 | ADIs 7966 e 7967 (Lei 15.402/2026) | Era 3b |
| V02 | [Tema 1.319/STF](docs/legislacao/PRECEDENTES.md#stf-tema-1319) (RE 1.464.013; mérito pendente; sobrestamento do [Tema 1.196/STJ](docs/legislacao/PRECEDENTES.md#stj-tema-1196)) | E33 |
| V03 | Tema 1408/STF — exame criminológico × irretroatividade | E36 |
| V04 | [Tema 1.457/STJ](docs/legislacao/PRECEDENTES.md#stj-tema-1457) (afetado em 26/06/2026; mérito pendente) — data-base na descontinuidade da prisão | D7 |
| V05 | [Tema 1.454/STF](docs/legislacao/PRECEDENTES.md#stf-tema-1454) (RE 1.598.180; mérito pendente) — detração de cautelar diversa da prisão | E27-A |
| V06 | Novo decreto de indulto natalino (dez/2026) | E70 |

## Radar da carteira

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| E94 | O radar considera as datas de progressão e livramento dos arquivos `.calcpen` salvos; ordena pela data mais próxima. Data passada sem pedido marcado pelo usuário aparece como "vencido sem pedido"; a carteira não presume protocolo. O requisito de 12 meses sem falta usa E25. | Convenção operacional D-D em `docs/DIFERENCIAIS.md` | Premissa operacional |
| E95 | Base numerada AAAA.MM.N. Ao importar, abrir ou desbloquear a carteira, versões diferentes são recalculadas localmente com a **entrada, data e opções originais**, isolando mudanças de regra da passagem do tempo. Diferenças de benefícios, término e prescrição mostram valores anteriores/atuais e IDs cruzados com o histórico. Sem versão conhecida, os IDs são apenas regras associadas, sem causa confirmada. Resultados e avisos são persistidos no mesmo cofre; pedidos são preservados. Falha, entrada/data ausente ou versão futura preserva o cálculo e gera aviso individual; nunca atualiza silenciosamente. A Vigilância pública V01–V06 informa temas a acompanhar, sem consulta automática aos tribunais nem alteração de critério por tema pendente. | Convenção operacional D-E em `docs/DIFERENCIAIS.md`; rastreabilidade E93; PD-03 | Premissa operacional — `regras.js` (`base`), `engine.js`, `radar.js` (`updateRules`), `radar-ui.js`; testes E95 em `ferramentas/vigilancia.test.js` |

## Entradas e validação

| ID | Regra | Status |
|---|---|---|
| E90 | Ao menos uma condenação; data do fato ≤ data de início ≤ data do cálculo (avisar, não bloquear, se início < fato por erro de digitação comum) | Implementada (`engine.js`, validação; `ferramentas/testar-engine.js`) |
| E91 | Fatos anteriores a 26/07/1990: bloquear com mensagem ("fora do escopo") | Implementada (`engine.js`, validação; `ferramentas/testar-engine.js`) |
| E92 | Natureza incompatível com a era (ex.: feminicídio autônomo antes de 09/10/2024; furto com explosivo como hediondo antes de 23/01/2020) → aviso com a regra | Implementada (`engine.js`, avisos de incompatibilidade; `ferramentas/testar-engine.js`) |
| E93 | Todo campo importado guarda `origem`; no Copilot v2, cada valor extraído exige trecho literal e página (ou `null` quando não há paginação). Campo sem trecho, não encontrado ou contraditório é recusado e vira pendência manual; formato v1 é recusado com aviso. Saldo individual por condenação só pode ser informado/importado quando a fonte o identifica, com origem própria. Totais não são rateados nem convertidos em saldos. Resultado fica "a conferir" até "Concluí a revisão" | I01/I02; issue #124. Só proveniência e conferência, sem alteração de critério jurídico | Implementada (`copilot.js`, `calcpenal-copilot-v2.schema.json`; testes em `ferramentas/testar-copilot.test.js`) |

---

## Importação local de documentos

| ID | Convenção | Fundamento | Status |
|---|---|---|---|
| I04 | Entrada por `postMessage` aceita somente a janela de abertura ou, em iframe, exclusivamente o quadro pai, e origens HTTPS permitidas, comparadas estritamente (padrão: domínio `defensoria.sp.def.br` e subdomínios com sufixo `.defensoria.sp.def.br`, sem porta alternativa). Aviso `calcpen:pronto` contém apenas tipo e versão. Exatamente um de documento SEEU/TJSP, `calcpen` v1 ou `processo` (`calcpen-processo` v1), com data explícita válida, fica na memória, sem query string, log, requisição a servidor ou armazenamento automático; todo dado recebido fica **a conferir**, e a conferência é **triagem**. Limite de texto igual a I02; pacote do processo limitado a 2 milhões de caracteres no JSON completo, incluindo metadados e documentos ignorados. O componente aceita a propriedade objeto `processo` como alternativa exclusiva a texto/calcpen, com a mesma data e limite do pacote; preserva a leitura no evento `resultado`. Ambos usam `lerProcesso` (I14), exibem documento usado com nome (ou tipo/ID) e data, ignorados por ID e motivo, movimentos posteriores e aviso de possível desatualização, mesmo com erro do motor; movimentos não alteram o cálculo. Recálculos preservam IDs, campos não editados e origens; seletores e caixas sem informação não presumem valores. Saldos editados conservam a fonte e registram a alteração manual. | Issues #83, #157 e #196; privacidade; E93, I02 e I14. Convenção de integração, sem alteração jurídica, de D1–D3 ou do contrato calcpen v1. | Implementada — `ui/integracao.js`, `ui.js`, `componente/calc-conferencia.js`; testes I04 em `test/integracao.test.js`, `test/componente.test.js` e `ferramentas/testar-calc-navegador.js` |
| I01 | PDFs e envelopes P7Z são lidos localmente; os leitores recebem texto, reconhecem as assinaturas versionadas em `core/leitores/versoes-documentos.js` e identificam cada campo com trecho e página quando informada pelo chamador. No Copilot v2, cada valor tem trecho literal e página; sem paginação, página `null`, sem invenção. Campos acrescentados ou alterados na conferência recebem fonte manual, sem apagar as fontes dos demais. Os três canais usam a conferência E93, sempre inicialmente **a conferir**; resposta Copilot só pode seguir para cálculo após "Concluí a revisão". | Issues #123 e #124; issue #13 ([11]); `docs/DIFERENCIAIS.md`, §3; E93 | Implementada — `importacao.js`, `core/leitores/`, `copilot.js`, `ui-importacao.js`; testes I01 em `test/leitores/versoes-documentos.test.js`, `ferramentas/importacao.test.js` e `ferramentas/testar-copilot.test.js` |
| I02 | Extração conservadora: só rótulos explícitos; dados ausentes, inválidos, contraditórios, sem citação ou não reconhecidos geram pendências, nunca classificação jurídica definitiva presumida. A sugestão provisória E99, aplicada nos leitores por I17 e ao Copilot v2 quando lei, artigo e data do fato têm citação, é exceção explícita: fica marcada como IA/a conferir; com elementos insuficientes, não preenche o campo e lista possibilidades. O agente não decide hediondez nem infere reincidência por antecedentes. Rótulos esperados ausentes, extras ou fora de ordem invalidam o modelo e impedem preenchimento automático. No relatório SEEU, rótulos conhecidos são separados mesmo com espaçamento de coluna; marcações opcionais em branco ficam ausentes, sem virar conflito. A ausência de "Fim do Relatório" não impede ler campos reconhecidos, mas gera alerta de incompletude. Pena total não substitui condenações; anos/meses não são convertidos em dias; totais de remição/detração não viram decisões ou períodos. Listas vazias exigem conferência. Não guardar PDF nem texto bruto; apenas campos previstos. PDF sem texto selecionável ou escaneado exige nova exportação ou leitura por IA; não há OCR nesta tela. Limites operacionais: 20 MB, 200 páginas e 2 milhões de caracteres extraídos por PDF; 2 milhões por texto colado. | `agente-copilot-execucao.txt`; issues #123, #124 e #201; privacidade e limites de recursos do navegador | Implementada — `importacao.js`, `core/leitores/versoes-documentos.js`, `core/leitores/seeu-relatorio.js`, `copilot.js`; testes I02 em `test/leitores/versoes-documentos.test.js`, `ferramentas/importacao.test.js`, `test/leitores/seeu-fixtures.test.js` e `ferramentas/testar-copilot.test.js` |
| I03 | Lote gera um rascunho independente por PDF ou P7Z no radar local, inclusive com pendências, versão e rastros; erro de um arquivo não interrompe os demais. Armazenamento indisponível ou cheio gera aviso e opção de salvar em arquivo; nenhum descarte silencioso. Conferência e conclusão da revisão são individuais. O radar de importações não calcula nem ordena benefícios sem o motor. | Issue #13 ([11]); issue #123; diferencial D-D; E93 | Implementada — `radar-importacoes.js`, `ui-importacao.js`; testes I03 em `ferramentas/importacao.test.js` e `ferramentas/radar-importacoes.test.js` |
| I05 | O texto dos PDFs é montado pela posição de cada trecho: mesma altura (tolerância de 2,5 pontos) forma uma linha, palavras próximas recebem um espaço e distâncias maiores que 8 pontos, três espaços (separação de colunas). A função pura `montarTextoDeItens` fica em `core/leitura-texto.js`, para a tela e para a pasta digital | Medição em 09/11/2026: relatórios do SEEU trazem cada palavra como trecho separado; juntar na ordem do arquivo quebrava rótulos e colunas (0 de 19 reconhecidos) | Implementada — `core/leitura-texto.js`, `importacao.js`; `test/leitores/documentos-reais.test.js` |
| I06 | Relatório do SEEU: "Total Interrupções", "Regime Atual" e a seção de eventos podem faltar; a ausência gera aviso e nunca valor presumido. Aceitos os rótulos "Data prevista livramento condicional" (sem "para") e "Data-base adotada no cálculo para …". Previsão entre parênteses (ex.: "Em regime aberto deferido em …") é guardada como situação, sem data; data seguida de observação ("DD/MM/AAAA (Em livramento condicional deferido em …)") vale a data, e a observação vira situação | Layout observado em relatórios reais (09/11/2026): 12 de 18 sem total de interrupções, 5 sem eventos, 1 sem regime atual; rótulo do livramento sem "para" em todos os que o trazem | Implementada — `core/leitores/seeu-relatorio.js`, `core/leitores/versoes-documentos.js`; `test/leitores/documentos-reais.test.js` |
| I07 | Cálculo de pena do TJSP/SAJ no layout real (título "CÁLCULO DE PENA" ou "FICHA DO RÉU", seções sem numeração, "Rótulo : valor" em colunas, penas por extenso): lê condenações (data do fato, pena, regime, trânsito), controle de pena (pena total, cumprida e a cumprir, data de referência) e previsões (próximo benefício, data-base, fração e regime). A pena em execução do controle de pena prevalece sobre a da sentença quando diferem, com aviso e a original guardada em `penaSentenca`. A classificação abaixo de cada pena ("Hediondo - Reincidente específico") dá a reincidência; a natureza informada fica só em `naturezaDocumento`, como referência, e continua sendo pedida | Layout observado em cálculos reais (09/11/2026), nas pastas do SEEU e do e-SAJ | Implementada — `core/leitores/tjsp-calculo.js` (`lerModeloReal`, `penaPorExtenso`), `core/leitores/versoes-documentos.js` (`tjsp-saj-v2`); `test/leitores/documentos-reais.test.js` |
| I08 | Períodos de prisão a partir do documento oficial: no SEEU, "PRISÃO/INÍCIO DE CUMPRIMENTO" abre e "INTERRUPÇÃO" fecha; no TJSP, cada linha da tabela "Dados da prisão" (na falta, "Períodos de prisão considerados") é um intervalo de custódia, e os intervalos sobrepostos de processos somados são unidos; eventos de corte (soma de pena, falta grave, sentença) não encerram a custódia, e linhas dos blocos de sentença só são usadas se não houver tabela. Os períodos entram como cumprimento (`tipo: "definitiva"`), como o documento os conta; o início em prisão cautelar fica em `iniciouComo` e gera aviso. Sequência não reconhecida não gera prisão | Marcar o período como provisório fazia o motor contá-lo também como detração (diferenças de 90 a 3.824 dias); como cumprimento, o término bateu com o oficial em 0 a 6 dias nos relatórios medidos | Pendente de validação — convenção de leitura a conferir pela Assessoria Criminal; `test/leitores/documentos-reais.test.js` |
| I09 | O saldo de dias remidos do relatório do SEEU (remidos menos perdidos) e a "Remição" do controle de pena do TJSP entram como uma remição homologada a conferir, com a data da decisão de remição mais recente quando houver | Relatório do SEEU, campo "Saldo dias Remidos"; cálculo TJSP, controle de pena | Pendente de validação — `core/leitores/seeu-relatorio.js`; `test/leitores/documentos-reais.test.js` |
| I10 | Relatório do SEEU: diferença maior que 10 dias (365/30) entre a soma das condenações e a "Pena Total Imposta" é guardada em `oficial.diferencaPenaTotalDias` e gera aviso. Diferença positiva com incidente de comutação concedida preenche `comutacoes`, com origem “Diferença entre a soma das condenações e a pena total do relatório — a conferir”. Mantém aviso e penas originais; indulto isolado não autoriza presumir comutação. Sem decreto/data identificáveis ou havendo várias decisões, devolve lançamento parcial para revisão, sem duplicar a diferença nem inventar dados; cálculo bloqueado até completar | Medição em 24 relatórios reais (09/11/2026): sem comutação, soma = total (até 5 dias); com comutação, total menor em 1.879 a 2.578 dias em 3; lançamento provisório conforme #166/E100 | Leitura com aviso — `core/leitores/seeu-relatorio.js`; testes sintéticos em `test/seeu-relatorio.test.js`. Aplicação E100 **pendente de validação** |
| I11 | Relatório do SEEU: o evento "PRISÃO/INÍCIO DE CUMPRIMENTO — LIVRAMENTO CONDICIONAL" continua o período de cumprimento em curso (ou abre um, se não houver), e a "INTERRUPÇÃO" na mesma data é tratada como a saída para o período de prova, não como interrupção. Interrupção em data posterior fecha o período. Sempre gera aviso de conferência | Medição em relatório real (09/11/2026): a pena cumprida do SEEU inclui o período de prova; com esta leitura, o término calculado fica a 4 dias do oficial. CP, art. 88; LEP, art. 141 e 142 (revogação pode excluir o tempo) | Implementada (a conferir) — `core/leitores/seeu-relatorio.js`; `test/leitores/documentos-reais.test.js`. Revogação do livramento continua dependendo de conferência humana |
| I12 | Relatório do SEEU: incidente de medida de segurança gera aviso próprio (a calculadora não calcula medida de segurança) no lugar do aviso de pena total; condenação com "Pena Imposta" zerada gera aviso para conferir se deve entrar no cálculo | CP, art. 96 a 99; LEP, art. 183. Medição em relatórios reais (09/11/2026): 1 caso de cada | Implementada (aviso) — `core/leitores/seeu-relatorio.js`; `test/leitores/documentos-reais.test.js` |
| I13 | Cálculo TJSP: linha "Pena" com reclusão, detenção e/ou prisão simples, inclusive quebrada em várias linhas, usa o "Total geral" do documento (sem ele, soma as espécies, com 30 dias = 1 mês e 12 meses = 1 ano) e avisa que a ordem de execução não é tratada; trânsito para o Ministério Público posterior ao da defesa passa a ser o trânsito para ambas as partes, com aviso | CP, art. 69 e 76; trânsito definitivo ocorre com o último trânsito das partes. Medição em cálculos reais (09/11/2026): 3 documentos deixavam de calcular por esses dois motivos | Implementada (a conferir) — `core/leitores/tjsp-calculo.js`; `test/leitores/documentos-reais.test.js` |
| I14 | `lerProcesso` recebe `calcpen-processo` v1 sem buscar dados. Descarta com motivo documentos cuja situação não seja OK, sem texto ou com sigilo 5 (nunca lidos); prefere Relatório da Situação ao Cálculo de Pena e escolhe o mais recente da categoria, avisando empate. Só o leitor existente e um modelo reconhecido preenchem `calcpen`; sem documento ou sem reconhecimento, não inventa dados. Movimentos posteriores ao documento são triagem por padrões descritivos propostos, preservam `codigo` sem classificá-lo e geram um único aviso; nunca alteram `calcpen`. Campos extras na raiz são ignorados. | Issue #156; texto já extraído e documentos obtidos pelo sistema hospedeiro; campos CNJ sujeitos à conferência da versão do MNI em uso. Convenção de integração, sem mudança jurídica nem do contrato `calcpen` v1. | Implementada — `core/leitores/processo.js`, `dados/movimentos-execucao.js`; testes I14 em `test/processo.test.js` |
| I15 | Na tela de importação, PDF ou texto lido neste navegador passa pela conferência E93 em modo local: campos a mais dos leitores (lei, artigo, violência, eventos, dados oficiais do relatório) são preservados; a origem de cada campo vem do mapa de fontes do leitor; dado obrigatório ausente no documento (natureza do crime, regime inicial, equiparação, bons antecedentes, reincidência, condenações) vira pendência "informe antes de calcular", sem impedir o preenchimento. Valor presente e inválido continua erro. Resposta colada do Copilot exige formato `calcpenal-copilot` v2 e citações E93; v1 é recusada com instrução para obter a versão atual do agente. Condenação lida de PDF do SEEU tem origem "Relatório SEEU (PDF)" | Teste de ponta a ponta em 09/11/2026: a validação estrita recusava todo PDF reconhecido (cerca de 25 campos), e nada chegava a "Dados do cálculo"; E93; I01; issue #124 | Implementada — `copilot.js`, `core/leitores/seeu-relatorio.js`; testes em `test/leitores/pdf-sintetico.test.js`, `ferramentas/testar-copilot.test.js` e `ferramentas/testar-calc-navegador.js` |
| I16 | PDF/P7Z do SEEU ou TJSP pode ser lido em `importar.html` e transferido para Execução por `sessionStorage` da mesma origem, removido logo após a leitura; nenhum dado segue na URL, rede ou armazenamento persistente nessa passagem. Execução também aceita arquivo escolhido ou solto na página. A entrada `calcpen` v1, datas oficiais, origens, rastros, versão do documento e pendências ficam visíveis e **a conferir** antes do cálculo, que só ocorre por ação explícita. As datas oficiais alimentam o quadro existente de comparação, sem duplicar o comparador. PDF sem texto selecionável continua recusado com o aviso de I02. | Issue #176; I01, I02, I15 e comparador existente; sem mudança de critério jurídico ou contrato `calcpen` v1 | Implementada — `importacao.js`, `ui-importacao.js`, `ui.js`; testes com PDFs sintéticos SEEU/TJSP e PDF escaneado em `test/leitores/pdf-sintetico.test.js` e `ferramentas/testar-calc-navegador.js` |
| I18 | Rascunhos de importação (`calcpen:radar-importacoes:v1`) e identificação do caso (`calcpenal:caso`) guardam `gravadoEm` local, renovado a cada edição gravada. Expiram após 7 dias completos desde a gravação, com prazo único em `dados-casos.js`; a abertura de qualquer página remove os vencidos antes da leitura e informa uma vez a quantidade de rascunhos removidos. Dados sem data recebem a data do primeiro acesso após a atualização. Aviso e botão “Apagar dados de casos deste computador” permanecem visíveis na importação, no Radar e na Execução; confirmação apaga apenas essas duas chaves e descarta os campos em memória ao recarregar a página. Não apaga assinatura, tema, carteira IndexedDB ou arquivos exportados. Sem envio de dados, mudança no canal `postMessage` ou no formato `calcpen` v1. | Decisão #181, implementação #186; convenção de privacidade, sem mudança de critério jurídico. | Implementada — `dados-casos.js`, `privacidade-ui.js`, `radar-importacoes.js`, `ui.js`; testes I18 em `test/dados-casos.test.js` e `ferramentas/testar-calc-navegador.js` |
| I19 | No bloco “PROCESSO DE EXECUÇÃO” do relatório SEEU, nome, CPF, RG, nome da mãe e data de nascimento não são incluídos em `calcpen`, `oficial`, `alertas`, `origens` ou `rastros`, inclusive nos trechos de evidência. A data de nascimento não é usada; se seu uso vier a ser decidido, a saída poderá conter somente a conclusão pertinente, nunca a data. | Minimização de dados pessoais; issue #203. Sem alteração de critério jurídico ou do contrato `calcpen` v1. | Implementada — `core/leitores/seeu-relatorio.js`; teste I19 em `test/leitores/versoes-documentos.test.js` |
| I20 | O relatório SEEU devolve `conferencias` com SC-01–SC-06, cada qual com situação (`bateu`, `não bateu`, `não deu para conferir`) e uma frase de conta: pena cumprida + remanescente = total (365/30, conforme I10); soma das penas dos crimes com `suspenso` e `extinto` explicitamente falsos = total; em cada sentença, soma das penas dos crimes = pena da sentença; saldo de remição = soma dos incidentes de remição; regime atual = regime do último incidente confirmado de fixação/alteração, pela data disponível. Valores ou situações insuficientes, conflitos e incidentes de regime ambíguos ficam sem conclusão. SC-06 informa apenas a quantidade de caracteres não vazios sem rótulo reconhecido, nunca o texto residual. Sem o marcador final, o leitor ainda pode preencher os campos se os demais rótulos esperados forem reconhecidos, mas avisa que o relatório está incompleto. O resumo embutido mostra as seis situações em “Precisa da sua atenção”, divergências e pendências antes das conferências que bateram e dos lembretes de rotina. | Issue #199; convenções I02, I09 e I10. Sem mudança de critério jurídico, D1–D3 ou contrato `calcpen` v1. | Implementada — `core/leitores/seeu-relatorio.js`, `ui.js`; testes I20 em `test/seeu-relatorio.test.js` e `ferramentas/ui.test.js` |
| I21 | Relatório SEEU: interrupções também ficam em `oficial.interrupcoes` e, na montagem de prisões, uma interrupção e um novo início na mesma data fecham o período já aberto antes de abrir o novo. Só uma homologação de falta grave concedida com uma única data válida no complemento preenche `calcpen.faltasGraves`. Progressões/regressões reconhecidas pelo complemento ficam tipadas em `oficial.progressoes`/`oficial.regressoes`, sem converter datas de decisão em marcos do cálculo. Datas do recebimento da denúncia, sentença e trânsito, vara, marcação de comando e frações por condenação ficam em `oficial`; “Não informado” é preservado e campos em branco/ausentes não são presumidos. `alertas` contém problemas de dados; `lembretes` reúne conferências genéricas. | Issues #200; convenções I02, I05, I08, I11 e I20. Sem mudança de critério jurídico, motor ou contrato `calcpen` v1. | Implementada — `core/leitores/seeu-relatorio.js`, `importacao.js`; testes I21 em `test/seeu-relatorio.test.js`, I05 em `test/leitores/documentos-reais.test.js` e `test/leitores/pdf-sintetico.test.js` |

## Sugestão provisória de natureza

| ID | Texto legal | Precedente | Posição defensiva | Status |
|---|---|---|---|---|
| E99 | **Texto legal:** Lei 8.072/1990, arts. 1º e 2º; CP, arts. 121, 121-A, 155, 157, 158, 159, 213, 217-A e 288-A; Lei 11.343/2006, art. 33, caput e § 4º; Leis 9.455/1997, art. 1º, 12.850/2013, art. 2º, § 3º, e 13.260/2016, art. 2º; LEP, art. 112. Vigências e sub-IDs em `dados/natureza.js`. | **Precedente:** CONFERIR — nenhum precedente foi usado; não se atribui número, data ou tese. | **Posição defensiva:** sugestão provisória só com correspondência única por lei, artigo e data; violência/grave ameaça e resultado morte são dados de entrada. Sem capitulação suficiente, não preenche natureza/equiparado, lista possibilidades e nunca escolhe a mais grave. | Provisória (IA) — revisar com a Assessoria Criminal |
| I17 | Os leitores aplicam E99 somente quando a natureza não veio informada. Guardam a origem “Sugestão pela lei e artigo — decisão provisória (IA), a conferir” e acrescentam um aviso por condenação. Artigo ausente não produz sugestão; com mais de uma possibilidade, a natureza e o campo `equiparado` ficam sem preenchimento. | Não se aplica; ver E99. | Convenção de importação: manter texto, fonte, rastros e selo “a conferir”; não alterar o contrato `calcpen` v1, as frações ou o comparador. | Provisória (IA) — revisar com a Assessoria Criminal |

Sub-IDs de E99 em `dados/natureza.js` (cada linha tem fonte, vigência e status
próprios; todos herdam o precedente e a posição defensiva acima):

| ID | Fonte legal e natureza sugerida | Vigência | Status |
|---|---|---|---|
| E99-CP155-CAPUT | CP, art. 155, caput; Lei 8.072/1990, art. 1º — comum; com violência informada, violência | 26/07/1990– | Provisória (IA) — CONFERIR |
| E99-CP157-CAPUT | CP, art. 157, caput; LEP, art. 112, I e II — violência | 26/07/1990– | Provisória (IA) — CONFERIR |
| E99-CP157-ARMA-ANTES | CP, art. 157, § 2º-A, I; Lei 13.654/2018 — violência | 24/04/2018–22/01/2020 | Provisória (IA) — CONFERIR |
| E99-CP157-ARMA-DEPOIS | CP, art. 157, § 2º-A, I; Lei 8.072/1990, art. 1º, II, b — hediondo | 23/01/2020– | Provisória (IA) — CONFERIR |
| E99-CP157-ARMA-RESTRITA | CP, art. 157, § 2º-B; Lei 8.072/1990, art. 1º, II, b — hediondo | 23/01/2020– | Provisória (IA) — CONFERIR |
| E99-CP157-LESAO-GRAVE-MORTE | CP, art. 157, § 3º; Lei 8.072/1990, art. 1º, II — violência ou hediondo com morte conforme o resultado | 26/07/1990–22/01/2020 | Provisória (IA) — CONFERIR |
| E99-CP157-LESAO-GRAVE-MORTE-2020 | CP, art. 157, § 3º; Lei 8.072/1990, art. 1º, II, c — hediondo ou hediondo com morte conforme o resultado | 23/01/2020– | Provisória (IA) — CONFERIR |
| E99-CP155-EXPLOSIVO | CP, art. 155, § 4º-A; Lei 8.072/1990, art. 1º, IX — hediondo | 23/01/2020– | Provisória (IA) — CONFERIR |
| E99-CP121-QUALIFICADO | CP, art. 121, § 2º; Lei 8.072/1990, art. 1º, I — hediondo com morte | 07/09/1994– | Provisória (IA) — CONFERIR |
| E99-CP121-FEMINICIDIO-QUALIFICADOR | CP, art. 121, § 2º, VI; Lei 8.072/1990, art. 1º, I — hediondo com morte | 10/03/2015–09/10/2024 | Provisória (IA) — CONFERIR |
| E99-CP121A-FEMINICIDIO | CP, art. 121-A; Lei 8.072/1990, art. 1º, I-A; LEP, art. 112 — feminicídio | 10/10/2024– | Provisória (IA) — CONFERIR |
| E99-CP213-ESTUPRO | CP, art. 213; Lei 8.072/1990, art. 1º, V — hediondo | 26/07/1990– | Provisória (IA) — CONFERIR |
| E99-CP217A-ESTUPRO-VULNERAVEL | CP, art. 217-A; Lei 8.072/1990, art. 1º, VI — hediondo | 10/08/2009– | Provisória (IA) — CONFERIR |
| E99-CP158-MORTE | CP, art. 158, § 2º; Lei 8.072/1990, art. 1º, III — hediondo com morte | 26/07/1990– | Provisória (IA) — CONFERIR |
| E99-CP158-RESTRICAO-LESAO-MORTE | CP, art. 158, § 3º; Lei 8.072/1990, art. 1º, III — hediondo ou hediondo com morte conforme o resultado | 23/01/2020– | Provisória (IA) — CONFERIR |
| E99-CP159-SEQUESTRO | CP, art. 159, caput e §§ 1º a 3º; Lei 8.072/1990, art. 1º, IV — hediondo | 07/09/1994– | Provisória (IA) — CONFERIR |
| E99-LEI11343-33-TRAFICO | Lei 8.072/1990, art. 2º; Lei 11.343/2006, art. 33, caput — hediondo equiparado | 08/10/2006– | Provisória (IA) — CONFERIR |
| E99-LEI11343-33-4-PRIVILEGIADO | Lei 11.343/2006, art. 33, § 4º; LEP, art. 112, § 5º — tráfico privilegiado, não equiparado | 23/01/2020– | Provisória (IA) — CONFERIR |
| E99-LEI9455-TORTURA | Lei 8.072/1990, art. 2º; Lei 9.455/1997, art. 1º — tortura equiparada | 08/04/1997– | Provisória (IA) — CONFERIR |
| E99-LEI13260-TERRORISMO | Lei 8.072/1990, art. 2º; Lei 13.260/2016, art. 2º — terrorismo equiparado | 17/03/2016– | Provisória (IA) — CONFERIR |
| E99-CP288A-MILICIA | CP, art. 288-A; LEP, art. 112, VI, c — milícia | 23/01/2020– | Provisória (IA) — CONFERIR |
| E99-LEI12850-COMANDO-ORCRIM | Lei 12.850/2013, art. 2º, § 3º; LEP, art. 112, VI, b — comando de organização ultraviolenta | 23/01/2020– | Provisória (IA) — CONFERIR |

## Projeção (antes da condenação) — ver docs/PROJECAO.md

Módulo de estimativa. Todos os resultados levam o aviso "projeção; a pena depende do
juiz e das provas". Status inicial de todas as linhas: **A implementar**, salvo indicação.

### Antecedentes

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| P01 | Reincidente = novo crime cometido depois do trânsito em julgado de condenação anterior, e até cinco anos do cumprimento ou extinção da pena (período depurador, computado o período de prova do sursis/LC não revogados); só após cinco anos completos a condenação fica depurada | CP arts. 63 e 64, I | Implementada em `antecedentes.js`; teste P01 em `test/antecedentes.test.js` |
| P02 | Condenação definitiva que não gera reincidência (fato posterior ao novo crime, trânsito posterior ou depurada) pode ser **maus antecedentes**; a calculadora aponta e avisa da tese do direito ao esquecimento | STF Tema 150 (RE 593.818); STJ | Padrão pelo PD: considerada no cenário desfavorável e ignorada no favorável (`antecedentes.js`) |
| P03 | Inquéritos e ações penais em curso não são maus antecedentes nem reincidência | STJ Súmula 444 | Implementada em `antecedentes.js`; teste P03 em `test/antecedentes.test.js` |
| P04 | Crimes militares próprios e políticos não geram reincidência | CP art. 64, II | Implementada em `antecedentes.js`; teste P04 em `test/antecedentes.test.js` |
| P05 | Reincidência específica: mesma natureza (para hediondos, anterior hediondo ou equiparado) — usada para progressão/LC | LEP art. 112; CP art. 83, V | Implementada em `antecedentes.js`; teste P05 em `test/antecedentes.test.js` |

### Dosimetria (art. 68 do CP)

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| P10 | Pena em abstrato da lei vigente na data do fato; lei posterior mais benéfica retroage. O catálogo só exibe a versão cuja vigência coincide com a data do fato; a retroatividade benéfica não é calculada e as penas permanecem “a conferir” até revisão humana | CF art. 5º, XL; CP art. 2º; `docs/legislacao/catalogo-tipos-conferido.json` | Pendente de validação |
| P11 | 1ª fase: cada circunstância judicial desfavorável aumenta a pena-base por um critério escolhido: 1/6 da pena mínima (padrão) ou 1/8 do intervalo entre mínima e máxima; mostrar o outro critério em nota | CP art. 59; jurisprudência do STJ (critérios aceitos, sem vinculação) | Padrão pelo PD (ver seção PD) |
| P12 | 2ª fase: agravante de reincidência e atenuantes (menoridade relativa, maior de 70, confissão) em 1/6 cada; a atenuante de idade **não** se aplica se o crime envolver violência sexual contra a mulher (art. 65, I, red. Lei 15.160/2025 — fatos posteriores); confissão compensa a reincidência; multirreincidência pode preponderar | CP arts. 61, 65, 67; STJ Tema 585 | Padrão pelo PD (ver seção PD) |
| P13 | Atenuantes não levam a pena abaixo do mínimo nem agravantes acima do máximo na 2ª fase | STJ Súmula 231 | A implementar |
| P14 | 3ª fase: majorantes e minorantes do catálogo, em cascata; com várias majorantes da parte especial, aplicar uma (a maior) e avisar da possibilidade de cumulação fundamentada | CP art. 68, p.u. | Padrão pelo PD (ver seção PD) |
| P15 | Tentativa: redução de 1/3 (cenário desfavorável) a 2/3 (favorável) | CP art. 14, p.u. | A implementar |
| P16 | Tráfico privilegiado: redução de 1/6 a 2/3 se primário, de bons antecedentes, sem dedicação a atividade criminosa nem integração a organização; não hediondo | Lei 11.343, art. 33, § 4º; LEP art. 112, § 5º | A implementar |
| P17 | Concurso material: soma; formal próprio: maior pena + 1/6 a 1/2; continuidade: + 1/6 a 2/3 (cenários pela fração); cúmulo material benéfico | CP arts. 69, 70, 71 | A implementar |

### Regime inicial, substituição e sursis

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| P20 | Regime inicial pela pena final: > 8 anos fechado; > 4 e ≤ 8 semiaberto; ≤ 4 aberto (não reincidente); reclusão; detenção nunca começa no fechado | CP art. 33, §§ 2º e 3º | A implementar |
| P21 | Reincidente com pena ≤ 4 anos e circunstâncias judiciais favoráveis: semiaberto | STJ Súmula 269 | A implementar |
| P22 | Gravidade abstrata não justifica regime mais gravoso; hediondo não impõe fechado | STJ Súm. 440; STF Súm. 718 e 719; STF HC 111.840 | A implementar |
| P23 | Detração para fixar o regime: tempo de prisão provisória abatido antes de aplicar P20 | CPP art. 387, § 2º | A implementar |
| P24 | Substituição por restritivas: pena ≤ 4 anos, sem violência ou grave ameaça (culposos: qualquer pena), não reincidente em doloso (salvo § 3º), circunstâncias favoráveis; vedada em violência doméstica contra a mulher com violência/ameaça | CP art. 44; STJ Súm. 588 | A implementar |
| P25 | Sursis: pena ≤ 2 anos (≤ 4 se > 70 anos ou por saúde), não reincidente em doloso, PRD incabível | CP art. 77 | A implementar |

### Antes da sentença (custódia)

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| P30 | Preventiva só se: crime doloso com pena máxima > 4 anos (I); condenação anterior por crime doloso transitada, não depurada (II); violência doméstica contra mulher, criança, adolescente, idoso, enfermo ou PcD para garantir medida protetiva (III); integrante de orcrim ultraviolenta, grupo paramilitar ou milícia no contexto da Lei 15.358 (V, desde 25/03/2026); crimes contra a dignidade sexual de criança ou adolescente e arts. 240–241-D e 244-A do ECA (VI, Lei 15.487/2026 — conferir vigência); ou dúvida de identidade (§ 1º). Nunca como antecipação de pena (§ 2º) | CPP art. 313 (texto conferido, docs/legislacao) | A implementar |
| P31 | Homogeneidade: se o cenário desfavorável projeta regime aberto, PRD ou sursis, gerar argumento de desproporcionalidade da prisão cautelar | CPP art. 282; jurisprudência STJ | Premissa operacional |
| P32 | ANPP: sem violência ou grave ameaça, pena mínima < 4 anos (com majorantes e minorantes na fração que mais favorece), não reincidente (salvo insignificantes), sem ANPP/transação/sursis processual nos 5 anos anteriores, não cabe em violência doméstica; exige confissão formal (só na visão do defensor) ; para a pena mínima, contam as causas de aumento e diminuição do caso (§ 1º) | CPP art. 28-A (texto conferido) | A implementar |
| P33 | Transação penal: infração de menor potencial (pena máxima ≤ 2 anos), sem transação nos 5 anos anteriores; não cabe na violência doméstica | Lei 9.099, arts. 61 e 76; Lei 11.340, art. 41; STJ Súm. 536 | A implementar |
| P34 | Suspensão condicional do processo: pena mínima ≤ 1 ano (com o aumento do concurso), sem outro processo nem condenação por crime; não cabe na violência doméstica | Lei 9.099, art. 89; STJ Súm. 243; STF Súm. 723; STJ Súm. 536 | A implementar |

### Projeção da execução

| ID | Regra | Fundamento | Status |
|---|---|---|---|
| P40 | Cada cenário vira uma condenação "virtual" com data do fato, natureza, reincidência e data de início = prisão (ou "data hipotética da prisão" informada) e passa pelo mesmo motor da execução (E-regras) | — | A implementar |
| P41 | "Tempo estimado em regime fechado" = data da 1ª progressão − início, só para regime inicial fechado | — | Premissa operacional |
