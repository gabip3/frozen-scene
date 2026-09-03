/* ==================================================================
   NOVEMBRA · THE THAW · Cena 01: FROZEN → 0°C

   Sem scroll. O ÚNICO motor da cena é o esforço do usuário com os
   instrumentos: cada gesto acumula em reveal.thaw, e daí saem a
   temperatura (−20°C → 0°C), a espessura do gelo, as rachaduras e a
   presença dela.

   E o gelo NUNCA quebra antes da data (CONFIG.reveal.unlockDate):
   por mais que o usuário martele, as trincas se refazem.

   Para trocar assets: substitua o conteúdo das camadas no HTML.
   Tudo é selecionado por [data-layer], então nada quebra.
   ================================================================== */

/* ------------------------------------------------------------------
   CONFIG — ajuste fino sem mexer na lógica
   ------------------------------------------------------------------ */
const CONFIG = {
  tempStart: -20,
  tempEnd: 0,
  particles: { desktop: 34, mobile: 14 },
  butterflies: { desktop: 6, mobile: 3 },

  frost: {
    /* Cobertura do vidro (0 = limpo · 1 = todo embaçado) ao longo do
       descongelamento — ver frostTarget() */
    coverageStart: 0.78,    // −20°C
    coverageMid:   0.34,    // meio do caminho
    coverageEnd:   0.22,    // 0°C — o vidro nunca fica totalmente limpo
    regrow: 0.012,          // reembaça por frame (~3s para voltar)
    erase:  0.42,           // força do dedo por evento
    brush:  0.13,           // raio do dedo (fração da largura)
    maskWidth: { desktop: 240, mobile: 150 },  // resolução da máscara
    maxWidth:  { desktop: 1280, mobile: 600 }, // resolução da textura
    tint: 'rgb(54, 92, 138)',  // assenta a textura na paleta (multiply)
    haptics: true,             // vibração leve ao tocar (Android)
  },

  reveal: {
    /* O gelo só cede nesta data (fuso local do usuário).
       Até lá, por mais que o usuário martele, ele se refaz. */
    unlockDate: '2026-11-01T00:00:00',
    /* Janela em que o gelo já começa a enfraquecer (dias antes) */
    weakenWindowDays: 30,
    /* Segundos até a trinca fechar (multiplicado perto da data) */
    healDelay: 2.2,
    /* Ela NUNCA se revela por completo antes da data: continua sendo
       uma presença dentro do gelo, nunca uma foto limpa. */
    maxVivid: 0.5,
    /* Borrão residual (px) que nunca sai: o gelo sempre está na frente */
    minBlur: 2.1,
    /* Quanto cada gesto acumula */
    gain: { wipe: 0.001, strike: 0.02, gust: 0.0012 },
  },
};

const isMobile = matchMedia('(max-width: 700px)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Helper: seleciona camada pelo slot */
const layer = (name) => document.querySelector(`[data-layer="${name}"]`);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ------------------------------------------------------------------
   PARTÍCULAS / CRISTAIS  [SUBSTITUIR: partículas]
   Spans com animação CSS (barato). Para cristais reais, troque por
   sprites <img> ou por um canvas leve mantendo a mesma densidade.
   ------------------------------------------------------------------ */
function createParticles() {
  if (reducedMotion) return;
  const host = layer('particles');
  const count = isMobile ? CONFIG.particles.mobile : CONFIG.particles.desktop;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    const size = 1 + Math.random() * 2.6;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${20 + Math.random() * 80}%`;
    p.style.setProperty('--p-alpha', (0.15 + Math.random() * 0.5).toFixed(2));
    p.style.setProperty('--p-dx', `${(Math.random() * 6 - 3).toFixed(1)}vw`);
    p.style.setProperty('--p-dy', `${-(8 + Math.random() * 16).toFixed(1)}vh`);
    p.style.animationDuration = `${9 + Math.random() * 14}s`;
    p.style.animationDelay = `${-Math.random() * 20}s`;
    host.appendChild(p);
  }
}

/* ------------------------------------------------------------------
   BORBOLETAS-MONARCA  [SUBSTITUIR: borboletas]
   Fotos reais recortadas (fundo removido por floodfill no ffmpeg).
   · voo   = GSAP com repeatRefresh (deriva errante, só transform)
   · asa   = cross-fade entre as duas poses de topo (lê como blur)
   Monarca é sempre laranja — é o único calor no frame frio.
   ------------------------------------------------------------------ */
function butterflyMarkup() {
  /* Todas batem asa. A pose de perfil (assets/butterfly_side.webp)
     ficou de fora: asa fechada de lado é pose de borboleta pousada,
     e parada no ar ela lê como morta. Fica guardada para quando
     alguma pousar no gelo. */
  const A = 'assets/butterfly_open.webp';
  const B = 'assets/butterfly_closed.webp';
  return `<img class="bf-frame bf-frame--a" src="${A}" alt="" decoding="async">
          <img class="bf-frame bf-frame--b" src="${B}" alt="" decoding="async">`;
}

function createButterflies() {
  if (reducedMotion) return;
  const host = layer('butterflies');
  const count = isMobile
    ? CONFIG.butterflies.mobile
    : CONFIG.butterflies.desktop;

  /* Zonas ao redor do bloco de gelo (evitam o centro, onde ela está) */
  const anchors = [
    { x: 20, y: 28 }, { x: 76, y: 20 }, { x: 84, y: 58 },
    { x: 14, y: 62 }, { x: 62, y: 80 }, { x: 34, y: 12 },
  ];

  for (let i = 0; i < count; i++) {
    const b = document.createElement('div');
    b.className = 'butterfly';
    b.innerHTML = butterflyMarkup();

    const size = 26 + Math.random() * 32;            // profundidade
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;                    // assets quadrados
    b.style.left = `${anchors[i % anchors.length].x}%`;
    b.style.top = `${anchors[i % anchors.length].y}%`;
    b.style.opacity = (0.6 + (size / 58) * 0.4).toFixed(2);
    /* monarca bate ~3–5 Hz; a variação larga dá o ar de que umas
       planam mais que outras, sem precisar parar de bater */
    b.style.setProperty('--flap', `${(0.2 + Math.random() * 0.24).toFixed(2)}s`);
    b.style.setProperty('--flap-delay', `${(-Math.random() * 0.5).toFixed(2)}s`);
    if (size < 34) b.style.filter = 'blur(0.6px)';   // as pequenas ficam "longe"
    host.appendChild(b);

    /* Deriva errante: cada repetição sorteia um novo destino */
    gsap.to(b, {
      x: 'random(-70, 70)',
      y: 'random(-50, 50)',
      rotation: 'random(-16, 16)',
      duration: 'random(3.5, 7)',
      ease: 'sine.inOut',
      repeat: -1,
      repeatRefresh: true,
      delay: Math.random() * -6,
    });
  }
}

/* ------------------------------------------------------------------
   GEOMETRIA DE TRINCA — compartilhada pelas rachaduras ambiente e
   pelas do martelo.
   Trinca de gelo é curta, quebrada em segmentos retos e ramifica.
   arm() devolve o "d" e os vértices, para as forquilhas saírem de um
   ponto do próprio traço.
   ------------------------------------------------------------------ */
const NS = 'http://www.w3.org/2000/svg';

function crackArm(x, y, len, angle, steps) {
  const pts = [[x, y]];
  let cx = x, cy = y, a = angle;
  for (let i = 0; i < steps; i++) {
    a += (Math.random() - 0.5) * 1.1;            // zigue-zague marcado
    const seg = (len / steps) * (0.5 + Math.random() * 1);
    cx += Math.cos(a) * seg;
    cy += Math.sin(a) * seg;
    pts.push([cx, cy]);
  }
  const d = pts
    .map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ');
  return { d, pts, angle: a };
}

function addCrackPath(parent, cls, d, width, opacity) {
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('class', cls);
  path.setAttribute('d', d);
  path.setAttribute('stroke-width', width.toFixed(2));
  path.setAttribute('stroke-opacity', opacity.toFixed(2));
  parent.appendChild(path);
  return path;
}

/* ------------------------------------------------------------------
   RACHADURAS AMBIENTE  [SUBSTITUIR: rachaduras]
   Fraturas do bloco inteiro: nascem nas bordas do quadro e crescem
   para dentro. Desenhadas progressivamente com o descongelamento.
   ------------------------------------------------------------------ */
function buildAmbientCracks() {
  const svg = document.getElementById('cracks-svg');
  const scene = document.getElementById('scene-frozen');
  const rect = scene.getBoundingClientRect();
  const W = Math.round(rect.width) || 1280;
  const H = Math.round(rect.height) || 720;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.textContent = '';

  const unit = Math.min(W, H);
  const out = [];
  const count = isMobile ? 7 : 9;

  for (let i = 0; i < count; i++) {
    /* origem numa borda, crescendo para dentro do quadro */
    const edge = i % 4;
    const t = 0.12 + Math.random() * 0.76;
    let x, y, angle;
    if (edge === 0)      { x = W * t; y = 0; angle = Math.PI / 2; }
    else if (edge === 1) { x = W;     y = H * t; angle = Math.PI; }
    else if (edge === 2) { x = W * t; y = H; angle = -Math.PI / 2; }
    else                 { x = 0;     y = H * t; angle = 0; }
    angle += (Math.random() - 0.5) * 1.5;

    /* curta e com muitos segmentos: é o que dá o aspecto quebradiço */
    const len = unit * (0.26 + Math.random() * 0.32);
    const main = crackArm(x, y, len, angle, 8 + Math.floor(Math.random() * 4));
    const path = addCrackPath(svg, 'crack', main.d,
      0.8 + Math.random() * 0.5, 0.45 + Math.random() * 0.25);
    out.push(path);

    /* forquilhas: saem de um vértice do traço, mais curtas e finas */
    const forks = 1 + Math.floor(Math.random() * 2);
    for (let f = 0; f < forks; f++) {
      const [fx, fy] = main.pts[2 + Math.floor(Math.random() * (main.pts.length - 3))];
      const fa = main.angle + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.8);
      const sub = crackArm(fx, fy, len * (0.25 + Math.random() * 0.3), fa, 4);
      out.push(addCrackPath(svg, 'crack crack--thin', sub.d,
        0.4 + Math.random() * 0.3, 0.25 + Math.random() * 0.2));
    }
  }

  crackPaths = out.map((path) => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    return { path, len };
  });
}

/* ------------------------------------------------------------------
   TEMPERATURA — °C e °F ao mesmo tempo (ela é global)
   ------------------------------------------------------------------ */
const tempC = document.getElementById('temp-c');
const tempF = document.getElementById('temp-f');
const tempFill = document.getElementById('temp-fill');

/* U+2212 (minus tipográfico) no negativo; 0 sem sinal */
const signed = (n) => (n < 0 ? `−${Math.abs(n)}` : `${n}`);

function updateTemperature(t) {
  const c = lerp(CONFIG.tempStart, CONFIG.tempEnd, t);
  tempC.textContent = `${signed(Math.round(c))}°C`;
  tempF.textContent = `${signed(Math.round(c * 9 / 5 + 32))}°F`;
  tempFill.style.height = `${t * 100}%`;
}

/* ------------------------------------------------------------------
   REVELAÇÃO — tudo sai de reveal.thaw (o esforço do usuário).
   ------------------------------------------------------------------ */
const reveal = { thaw: 0 };
let revealTargets = null;
let crackPaths = [];

function frostTarget(t) {
  const F = CONFIG.frost;
  if (t < 0.2) return F.coverageStart;
  if (t < 0.7) return lerp(F.coverageStart, F.coverageMid, (t - 0.2) / 0.5);
  return lerp(F.coverageMid, F.coverageEnd, (t - 0.7) / 0.3);
}

/* Ela só começa a aparecer depois de algum trabalho, e ganha presença
   de verdade na reta final. */
function revealCurve(t) {
  if (t < 0.15) return 0;
  if (t < 0.6) return lerp(0, 0.45, (t - 0.15) / 0.45);
  return lerp(0.45, 1, (t - 0.6) / 0.4);
}

function applyReveal(frost) {
  if (!revealTargets) {
    revealTargets = {
      sharp: document.querySelector('.figure-sharp'),
      blur: document.querySelector('.figure-blur'),
      scrim: document.querySelector('.figure-scrim'),
      iceFront: layer('ice-front'),
      cracks: layer('cracks'),
    };
  }
  const R = CONFIG.reveal;
  const t = reveal.thaw;
  const vivid = Math.min(R.maxVivid, revealCurve(t));

  /* O esforço muda a DEFINIÇÃO dela, não a presença: as duas cópias
     se revezam para que a soma fique quase constante. Ela nunca vira
     uma foto limpa — o gelo continua na frente. */
  const k = vivid / R.maxVivid;                   // 0..1 dentro do teto
  /* a penumbra cresce junto: é ela que dá contraste ao vestido
     escuro contra a caverna clara que vai sendo revelada */
  revealTargets.scrim.style.opacity = (0.2 + k * 0.55).toFixed(3);
  revealTargets.blur.style.opacity = (0.38 * (1 - k * 0.55)).toFixed(3);
  revealTargets.sharp.style.opacity = (R.maxVivid * k).toFixed(3);
  revealTargets.sharp.style.filter =
    `blur(${(R.minBlur + (1 - k) * 3).toFixed(2)}px) ` +
    `saturate(${(0.8 + k * 0.3).toFixed(2)}) brightness(${(0.95 + k * 0.1).toFixed(2)})`;

  /* A placa da frente recua bastante, mas nunca some. Ela é luz
     aditiva e a faixa mais brilhante cai justo sobre a artista —
     sobrando demais, apaga a personagem por excesso de brilho. */
  revealTargets.iceFront.style.opacity = (1 - t * 0.78).toFixed(3);

  /* rachaduras ambiente surgem na segunda metade */
  const c = clamp01((t - 0.45) / 0.5);
  revealTargets.cracks.style.opacity = clamp01((t - 0.45) / 0.15).toFixed(3);
  crackPaths.forEach(({ path, len }, i) => {
    /* cada uma entra num momento levemente diferente */
    const local = clamp01((c - (i % 5) * 0.08) / 0.6);
    path.style.strokeDashoffset = (len * (1 - local)).toFixed(1);
  });

  frost.setTarget(frostTarget(t));
  updateTemperature(t);
}

/* ------------------------------------------------------------------
   FROST INTERATIVO — o vidro que o dedo limpa  [SUBSTITUIR: condensação]

   textura (imagem de condensação, tingida) × máscara de cobertura.
   · coverage[]  → 0..1 por célula (baixa resolução, upscale suave)
   · o dedo/mouse subtrai cobertura com um pincel macio
   · a cada frame a cobertura volta lentamente ao alvo (regrow)
   · o alvo vem do descongelamento, com viés radial: o centro, sobre a
     personagem, fica sempre um pouco mais limpo
   Render: drawImage(textura) → destination-in drawImage(máscara).
   ------------------------------------------------------------------ */
function drawProceduralFrost(ctx, w, h) {
  /* fallback caso a textura não carregue */
  ctx.fillStyle = 'rgb(200, 222, 238)';
  ctx.fillRect(0, 0, w, h);
  const specks = Math.round((w * h) / 90);
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = `rgba(234,247,255,${(0.2 + Math.random() * 0.5).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2.5 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function initFrost() {
  const F = CONFIG.frost;
  const host = layer('condensation');
  const scene = document.getElementById('scene-frozen');
  const canvas = document.getElementById('frost-canvas');
  const ctx = canvas.getContext('2d');

  const texture = document.createElement('canvas');
  const texCtx = texture.getContext('2d');
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');

  let W = 0, H = 0;          // textura / canvas visível
  let MW = 0, MH = 0;        // máscara (baixa resolução)
  let coverage = null;       // Float32Array MW×MH
  let bias = null;           // viés radial por célula
  let maskData = null;       // ImageData reutilizado
  let target = F.coverageStart;
  let dirty = true;
  let image = null;
  let lastW = 0, lastH = 0;

  function paintTexture() {
    texCtx.globalCompositeOperation = 'source-over';
    texCtx.clearRect(0, 0, W, H);
    if (image) {
      const s = Math.max(W / image.width, H / image.height);   // cover
      const dw = image.width * s, dh = image.height * s;
      texCtx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      drawProceduralFrost(texCtx, W, H);
    }
    texCtx.globalCompositeOperation = 'multiply';
    texCtx.fillStyle = F.tint;
    texCtx.fillRect(0, 0, W, H);
    texCtx.globalCompositeOperation = 'source-over';
    dirty = true;
  }

  function resize(force) {
    const rect = scene.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return false;
    /* ignora o jitter da barra de endereço no mobile */
    const dh = Math.abs(rect.height - lastH) / Math.max(rect.height, 1);
    if (!force && rect.width === lastW && dh < 0.2) return true;
    lastW = rect.width; lastH = rect.height;

    /* reavalia aqui: o viewport pode ter mudado (ou ter nascido com 0) */
    const mobile = matchMedia('(max-width: 700px)').matches;
    const maxW = mobile ? F.maxWidth.mobile : F.maxWidth.desktop;
    W = Math.round(Math.min(rect.width * (window.devicePixelRatio || 1), maxW));
    H = Math.round((W * rect.height) / rect.width);
    canvas.width = W; canvas.height = H;
    texture.width = W; texture.height = H;

    MW = mobile ? F.maskWidth.mobile : F.maskWidth.desktop;
    MH = Math.round((MW * rect.height) / rect.width);
    maskCanvas.width = MW; maskCanvas.height = MH;
    maskData = maskCtx.createImageData(MW, MH);
    for (let i = 0; i < maskData.data.length; i += 4) {
      maskData.data[i] = maskData.data[i + 1] = maskData.data[i + 2] = 255;
    }

    coverage = new Float32Array(MW * MH);
    bias = new Float32Array(MW * MH);
    const cx = MW / 2, cy = MH * 0.5;
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const d = Math.hypot((x - cx) / MW, (y - cy) / MH);   // 0 → ~0.7
        const i = y * MW + x;
        bias[i] = 0.78 + d * 0.55;
        coverage[i] = Math.min(1, target * bias[i]);
      }
    }
    paintTexture();
    return true;
  }

  /* ── pincel ─────────────────────────────────────────────────────
     brush/strength são parametrizáveis: o leque usa pincel largo e
     fraco, a mão usa o padrão. */
  function eraseAt(nx, ny, opts) {
    if (!coverage || nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
    const brush = (opts && opts.brush) || F.brush;
    const power = (opts && opts.strength) || F.erase;
    const px = nx * MW, py = ny * MH;
    const r = MW * brush;
    const x0 = Math.max(0, Math.floor(px - r)), x1 = Math.min(MW - 1, Math.ceil(px + r));
    const y0 = Math.max(0, Math.floor(py - r)), y1 = Math.min(MH - 1, Math.ceil(py + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - px, y - py);
        if (d > r) continue;
        let f = 1 - d / r;
        f = f * f * (3 - 2 * f);                  // smoothstep: borda macia
        const i = y * MW + x;
        coverage[i] = Math.max(0, coverage[i] - f * power);
      }
    }
    dirty = true;
  }

  function normalize(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return [(clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height];
  }

  /* ── loop ───────────────────────────────────────────────────────── */
  function tick() {
    requestAnimationFrame(tick);
    if (!coverage) return;

    let moved = false;
    const k = F.regrow;
    for (let i = 0; i < coverage.length; i++) {
      const t = Math.min(1, target * bias[i]);
      const d = t - coverage[i];
      if (d > 0.0015 || d < -0.0015) { coverage[i] += d * k; moved = true; }
    }
    if (!dirty && !moved) return;
    dirty = false;

    const data = maskData.data;
    for (let i = 0, j = 3; i < coverage.length; i++, j += 4) data[j] = coverage[i] * 255;
    maskCtx.putImageData(maskData, 0, 0);

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(texture, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(maskCanvas, 0, 0, W, H);     // upscale suave = borda orgânica
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── init ───────────────────────────────────────────────────────── */
  const src = host.dataset.src;
  if (src) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { image = img; if (W) paintTexture(); };
    img.src = src;
  }
  if (!resize(true)) {
    const retry = setInterval(() => resize(true) && clearInterval(retry), 250);
  }
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resize(false), 200);
  });
  requestAnimationFrame(tick);

  return {
    setTarget: (v) => { target = v; },
    erase: eraseAt,
    toNorm: normalize,
  };
}

/* ------------------------------------------------------------------
   A TRAVA — o gelo NUNCA quebra antes da data.
   Por mais que o usuário martele, as rachaduras se refazem. Quanto
   mais perto da data, mais tempo elas demoram para fechar — e no dia,
   o gelo finalmente cede.
   Debug: ?days=7 simula faltar 7 dias · ?unlock=1 destrava.
   ------------------------------------------------------------------ */
function computeGate() {
  const p = new URLSearchParams(location.search);
  const forced = p.get('days');
  const target = new Date(CONFIG.reveal.unlockDate).getTime();
  let days = forced !== null
    ? parseFloat(forced)
    : (target - Date.now()) / 86400000;
  if (p.get('unlock') === '1') days = 0;

  const unlocked = days <= 0;
  const weakness = Math.min(1, Math.max(0, 1 - days / CONFIG.reveal.weakenWindowDays));
  return { days: Math.max(0, Math.ceil(days)), weakness, unlocked };
}

/* ------------------------------------------------------------------
   INSTRUMENTOS — mão (arrastar) · martelo (tocar) · leque (deslizar)
   São o único motor da cena.
   ------------------------------------------------------------------ */
function initTools(frost) {
  const scene = document.getElementById('scene-frozen');
  const svg = document.getElementById('impact-svg');
  const flash = layer('flash');
  const gateLine = document.getElementById('gate-line');
  const rail = layer('tools');
  const gate = computeGate();

  let tool = 'hand';
  let stress = 0;
  let lastPoint = null;

  /* viewBox em pixels: as coordenadas do dedo mapeiam 1:1 */
  function sizeSvg() {
    const r = scene.getBoundingClientRect();
    if (r.width < 10) return;
    svg.setAttribute('viewBox', `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
  }
  sizeSvg();
  window.addEventListener('resize', () => setTimeout(sizeSvg, 200));

  /* ── haptics ──────────────────────────────────────────────────── */
  let lastHaptic = 0;
  function buzz(pattern, minGap = 140) {
    if (!CONFIG.frost.haptics || !navigator.vibrate) return;
    const now = performance.now();
    if (now - lastHaptic < minGap) return;
    lastHaptic = now;
    try { navigator.vibrate(pattern); } catch (_) { /* sem suporte */ }
  }

  /* Cada impacto racha — e depois o gelo se refaz.
     Usa a mesma geometria das rachaduras ambiente (crackArm). */
  function impact(x, y, opts = {}) {
    const big = !!opts.big;
    const rect = scene.getBoundingClientRect();
    const unit = Math.min(rect.width, rect.height);
    const reach = unit * (big ? 0.3 : 0.13);
    const arms = big ? 7 : 3 + Math.floor(Math.random() * 3);

    const g = document.createElementNS(NS, 'g');
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + Math.random() * 0.9;
      const len = reach * (0.6 + Math.random() * 0.8);
      const main = crackArm(x, y, len, a, 4 + Math.floor(Math.random() * 3));
      addCrackPath(g, 'impact-crack', main.d,
        (big ? 0.95 : 0.75) + Math.random() * 0.45, 0.6 + Math.random() * 0.3);

      /* forquilhas: saem de um vértice do traço, mais curtas e finas */
      const forks = Math.random() < 0.7 ? 1 : 0;
      for (let f = 0; f < forks; f++) {
        const [fx, fy] = main.pts[1 + Math.floor(Math.random() * (main.pts.length - 2))];
        const fa = main.angle + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.7);
        const sub = crackArm(fx, fy, len * (0.35 + Math.random() * 0.3), fa, 3);
        addCrackPath(g, 'impact-crack', sub.d,
          0.4 + Math.random() * 0.3, 0.35 + Math.random() * 0.25);
      }
    }
    svg.appendChild(g);

    /* desenha do ponto do toque para fora */
    gsap.utils.toArray(g.children).forEach((path) => {
      const len = path.getTotalLength();
      gsap.fromTo(path,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: big ? 0.5 : 0.22, ease: 'power2.out' });
    });

    /* clarão no ponto do impacto */
    gsap.set(flash, {
      opacity: 0,
      background: `radial-gradient(${big ? 70 : 26}vmin at ${x}px ${y}px,
        rgba(234,247,255,${big ? .5 : .34}), transparent 70%)`,
    });
    gsap.to(flash, { opacity: 1, duration: 0.06, yoyo: true, repeat: 1 });

    /* ...e o gelo fecha de novo. Quanto mais perto da data, mais
       tempo a trinca resiste. Destravado: não fecha mais. */
    if (!gate.unlocked) {
      const hold = CONFIG.reveal.healDelay * (1 + gate.weakness * 4);
      gsap.to(g, {
        opacity: 0,
        duration: 1.6,
        delay: hold,
        ease: 'power1.in',
        onComplete: () => g.remove(),
      });
    }

    /* limite de segurança de DOM */
    while (svg.children.length > 16) svg.firstChild.remove();
  }

  /* O momento em que o gelo quase cede — e segura. */
  function holdMoment(x, y) {
    impact(x, y, { big: true });
    buzz([26, 60, 34, 40, 90], 0);

    if (gate.unlocked) {
      /* ► CENA 02 (ruptura + IT'S TIME) pluga aqui.
         Por enquanto o gelo apenas fica permanentemente rachado. */
      gateLine.textContent = 'The ice is ready';
      gateLine.hidden = false;
      return;
    }
    gateLine.textContent = gate.days === 1
      ? 'The ice holds · 1 day'
      : `The ice holds · ${gate.days} days`;
    gateLine.hidden = false;
  }

  /* stress decai sozinho: parar de martelar acalma o gelo */
  setInterval(() => { stress = Math.max(0, stress - 1); }, 2600);

  /* Todo esforço fica registrado nela — nunca até o fim, mas fica. */
  function addThaw(amount) {
    if (reveal.thaw >= 1) return;
    reveal.thaw = Math.min(1, reveal.thaw + amount);
    applyReveal(frost);
  }

  function strike(clientX, clientY) {
    const r = scene.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    stress += 1;
    addThaw(CONFIG.reveal.gain.strike);
    /* perto da data o gelo cede com menos insistência */
    const limit = Math.round(6 - gate.weakness * 3);
    if (stress >= limit) {
      stress = 0;
      holdMoment(x, y);
    } else {
      impact(x, y);
      buzz(14, 60);
    }
    /* o impacto também limpa o frost em volta */
    frost.erase(...frost.toNorm(clientX, clientY), { brush: 0.09, strength: 0.5 });
  }

  function gust(clientX, clientY) {
    const [nx, ny] = frost.toNorm(clientX, clientY);
    /* pincel largo e fraco: varre em vez de furar */
    frost.erase(nx, ny, { brush: 0.3, strength: 0.16 });
    addThaw(CONFIG.reveal.gain.gust);
    if (lastPoint) {
      const dx = clientX - lastPoint.x;
      /* cristais são empurrados na direção do gesto */
      gsap.to(layer('particles'), {
        x: gsap.utils.clamp(-40, 40, dx * 2.5),
        duration: 0.5,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete() { gsap.to(layer('particles'), { x: 0, duration: 2.4, ease: 'power1.out' }); },
      });
    }
    lastPoint = { x: clientX, y: clientY };
  }

  function wipe(clientX, clientY) {
    frost.erase(...frost.toNorm(clientX, clientY));
    addThaw(CONFIG.reveal.gain.wipe);
    buzz(6);
  }

  /* ── entrada ──────────────────────────────────────────────────────
     A cena tem touch-action: none, então o navegador não rouba o
     gesto e os pointer events chegam inteiros — no toque eles só
     disparam com o dedo encostado, no mouse basta passar por cima. */
  scene.addEventListener('pointermove', (e) => {
    if (tool === 'hand') wipe(e.clientX, e.clientY);
    else if (tool === 'fan') gust(e.clientX, e.clientY);
    /* martelo não age no arrasto: ele bate */
  }, { passive: true });

  scene.addEventListener('pointerdown', (e) => {
    if (tool === 'hammer') strike(e.clientX, e.clientY);
    else if (tool === 'hand') wipe(e.clientX, e.clientY);
  }, { passive: true });

  /* ── bandeja ─────────────────────────────────────────────────── */
  rail.querySelectorAll('.tool').forEach((btn) => {
    btn.addEventListener('click', () => {
      tool = btn.dataset.tool;
      lastPoint = null;
      rail.querySelectorAll('.tool').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      buzz(10, 0);
    });
  });
  /* GSAP em vez de transition CSS: o ticker continua correndo mesmo
     quando a aba está oculta/estrangulada pelo navegador. */
  gsap.to(rail, { opacity: 1, duration: 0.9, delay: 1.6 });

  return { gate };
}

/* ------------------------------------------------------------------
   INIT
   ------------------------------------------------------------------ */
createParticles();
createButterflies();
const frost = initFrost();
buildAmbientCracks();
initTools(frost);
applyReveal(frost);

/* Ao mudar o viewport as fraturas são refeitas na nova proporção,
   preservando o quanto já foi desenhado. */
let crackResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(crackResizeTimer);
  crackResizeTimer = setTimeout(() => {
    buildAmbientCracks();
    applyReveal(frost);
  }, 240);
});
