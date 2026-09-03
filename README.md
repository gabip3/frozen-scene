# Novembra · The Thaw

Cena web interativa: uma artista presa num bloco de gelo, revelada só
pelo esforço de quem toca a tela. Mobile-first, sem scroll, composta
ao vivo no navegador.

**Demo:** https://gabip3.github.io/frozen-scene/
**Estudo de caso:** https://gabip3.github.io/frozen-scene/case/

> Peça autoral. A artista, o nome e o evento são fictícios; a figura na
> cena é um mockup gerado por IA.

## Como funciona

**Sem scroll.** O único motor é o esforço do usuário com os
instrumentos: cada gesto acumula em `reveal.thaw` (0 → 1), e daí saem
a temperatura (−20°C → 0°C), a espessura do gelo, as rachaduras e a
presença dela, tudo em `applyReveal()`.

O esforço muda a **definição** dela, não a presença: as duas cópias
(`.figure-blur` e `.figure-sharp`) se revezam para que a soma fique
quase constante. Ela nunca passa de `maxVivid` e conserva um borrão
residual (`minBlur`), então nunca vira uma foto limpa.

### Instrumentos

| | Gesto | Efeito |
| --- | --- | --- |
| **Hand** | arrastar | limpa a condensação por onde passa; ela reembaça sozinha |
| **Pick** | tocar | crava uma trinca a partir do ponto exato do toque |
| **Fan** | deslizar | rajada larga que varre a névoa e empurra os cristais |

A cena usa `touch-action: none` e a página não rola: o navegador não
rouba o gesto, então o dedo controla o descongelamento inteiro.

### A trava de data

Configurada em `CONFIG.reveal` (`js/main.js`):

```js
unlockDate: '2026-11-01T00:00:00',  // o gelo só cede aqui
weakenWindowDays: 30,               // enfraquece nos 30 dias anteriores
```

Antes da data, toda trinca se refaz, e quanto mais perto mais tempo ela
resiste. Ao insistir, aparece `THE ICE HOLDS · N DAYS`.

**Debug:** `?days=7` simula faltar 7 dias · `?unlock=1` destrava.

## Camadas

Ordem de empilhamento em `index.html`, cada uma um slot marcado com
`[SUBSTITUIR: ...]`:

```
background · névoa · gelo traseiro · personagem · gelo frontal
condensação (canvas interativo) · rachaduras · rachaduras de impacto
partículas · borboletas · névoa frontal · clarão · vinheta · grão
tipografia · temperatura · instrumentos
```

O JS seleciona por `data-layer`, então trocar um asset não mexe na
animação.

## Notas de implementação

- **Nada de `mix-blend-mode`.** Um blend `screen` sobre a personagem
  (que tem `filter`) isola o grupo de blend e passa a compor contra
  preto, apagando o que está atrás. Todo asset usa alpha real.
- **Nada de `will-change` nas camadas.** São 16 camadas fullscreen;
  forçar uma textura de GPU para cada uma estoura a memória de
  composição no celular e a maior delas vira preto sólido.
- **Gelo frontal é luz pura**: alpha derivado do brilho e cor
  normalizada, para só somar luz e nunca escurecer a cena atrás.
- **Recorte dos assets** feito com ffmpeg: `floodfill` a partir da
  borda nas borboletas (para não comer as veias pretas de dentro) e
  limiar de luminância no gelo.

## Rodar

```bash
npx serve -l 4180 .
```
