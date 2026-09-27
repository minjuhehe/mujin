'use strict';

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  let bg = document.createElement('canvas');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBackground();
  }

  function buildBackground() {
    bg.width = W;
    bg.height = H;
    const b = bg.getContext('2d');
    b.fillStyle = '#16181e';
    b.fillRect(0, 0, W, H);
    b.strokeStyle = 'rgba(255,255,255,0.035)';
    b.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { b.beginPath(); b.moveTo(x + 0.5, 0); b.lineTo(x + 0.5, H); b.stroke(); }
    for (let y = 0; y < H; y += 48) { b.beginPath(); b.moveTo(0, y + 0.5); b.lineTo(W, y + 0.5); b.stroke(); }
    for (let i = 0; i < 90; i++) {
      b.fillStyle = `rgba(${Math.random() < 0.5 ? '40,50,35' : '30,30,38'},${Math.random() * 0.4})`;
      b.beginPath();
      b.arc(Math.random() * W, Math.random() * H, Math.random() * 30 + 5, 0, Math.PI * 2);
      b.fill();
    }
  }

  // ---------- helpers ----------
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOut = t => 1 - (1 - t) * (1 - t);
  const d2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };

  // ---------- skills ----------
  const SKILLS = [
    { id: 'lifesteal', name: 'Void Devour', th: 'ดูดเลือด/ฮีล', icon: '🧛', type: 'passive', color: '#b46cff', on: true,
      desc: 'ทุกการโจมตีดูดวิญญาณสีม่วงกลับมาฮีลผู้เล่น (ฆ่าได้ = ลูกใหญ่)' },
    { id: 'bleed', name: 'Bleed', th: 'เลือดไหล', icon: '🩸', type: 'passive', color: '#e0203a', on: true,
      desc: 'เลือดไหล ดาเมจต่อเนื่อง ซ้อนได้ 5 ชั้น' },
    { id: 'inferno', name: 'Inferno', th: 'ไฟลุก', icon: '🔥', type: 'passive', color: '#ff7a1a', on: true,
      desc: 'เผาซอมบี้ ไฟลามไปตัวข้างๆ ได้' },
    { id: 'frost', name: 'Frost', th: 'เยือกแข็ง', icon: '❄️', type: 'passive', color: '#7fd8ff', on: true,
      desc: 'ลดความเร็ว ซ้อนครบ 5 ชั้น = แช่แข็ง' },
    { id: 'explosive', name: 'Explosive', th: 'ระเบิด', icon: '💥', type: 'passive', color: '#ffb347', on: true,
      desc: '22% ระเบิดวงกว้าง กระเด็น' },
    { id: 'electric', name: 'Electric', th: 'ช็อตต่อเนื่อง', icon: '⚡', type: 'passive', color: '#6ff3ff', on: true,
      desc: '30% สายฟ้ากระโดดระหว่างซอมบี้ 5 ต่อ + สตัน' },
    { id: 'toxic', name: 'Toxic', th: 'พิษ', icon: '☣️', type: 'passive', color: '#7dff4a', on: true,
      desc: 'พิษซ้อน 8 ชั้น ตายแล้วทิ้งหมอกพิษ' },
    { id: 'blackhole', name: 'Black Hole', th: 'หลุมดำ', icon: '🕳️', type: 'active', key: '1', cd: 12, color: '#9b5cff',
      desc: 'ดูดซอมบี้เข้าศูนย์กลาง แล้วยุบตัวระเบิด' },
    { id: 'meteor', name: 'Meteor', th: 'อุกกาบาต', icon: '☄️', type: 'active', key: '2', cd: 6, color: '#ff5a1f',
      desc: 'อุกกาบาตตก ระเบิด + พื้นไฟลุก' },
    { id: 'voidrift', name: 'Void Rift', th: 'ประตูมิติ', icon: '🌀', type: 'active', key: '3', cd: 9, color: '#c04dff',
      desc: 'ประตูสีม่วงทำดาเมจต่อเนื่อง หนวดดึงศัตรู' },
    { id: 'starblade', name: 'Starblade', th: 'ดาวตก', icon: '🌠', type: 'active', key: '4', cd: 7, color: '#7aa8ff',
      desc: 'ดาวตกสีม่วง/ฟ้า 16 ดวง ตามล็อกเป้า' },
    { id: 'divine', name: 'Divine Wrath', th: 'แสงทองรอบตัว', icon: '☀️', type: 'active', key: '5', cd: 10, color: '#ffd54a',
      desc: 'ยิงแสงสีทองรอบตัวผู้เล่น 3 ระลอก' },
    { id: 'judgement', name: 'Judgement', th: 'ลำแสงพิพากษา', icon: '⚖️', type: 'active', key: '6', cd: 8, color: '#ffe27a',
      desc: 'ชาร์จแล้วยิงลำแสงทองเส้นตรงจากผู้เล่น' },
  ];
  const S = Object.fromEntries(SKILLS.map(s => [s.id, s]));

  // ---------- state ----------
  let player, zombies, bullets, particles, effects, texts, decals, arcs, clouds;
  let time, score, spawnTimer, fireTimer, autoTimer, shake, flash, paused, gameOver, healAcc, healTimer;
  const settings = { autoCast: false, god: false, spawnRate: 1 };
  const keys = {};
  const mouse = { x: 0, y: 0, inside: false, down: false };

  const dm = () => 1 + time / 70; // damage scaling over time

  function reset() {
    player = { x: W / 2, y: H / 2, r: 16, hp: 250, maxHp: 250, speed: 230, face: 0, healGlow: 0, hurt: 0 };
    zombies = []; bullets = []; particles = []; effects = []; texts = []; decals = []; arcs = []; clouds = [];
    time = 0; score = 0; spawnTimer = 0; fireTimer = 0; autoTimer = 0; shake = 0; flash = null;
    gameOver = false; paused = false; healAcc = 0; healTimer = 0;
    SKILLS.forEach(s => { s.t = 0; });
    overlay.classList.add('hidden');
    for (let i = 0; i < 8; i++) spawnZombie();
  }

  // ---------- particles / texts ----------
  function P(o) {
    if (particles.length > 3500) return;
    const p = { vx: 0, vy: 0, life: 1, size: 3, color: '#fff', g: 0, drag: 0, kind: 'dot', glow: false, rot: 0, vr: 0 };
    Object.assign(p, o);
    p.max = p.life;
    particles.push(p);
  }

  function addText(x, y, txt, color, size = 13) {
    if (texts.length > 260) texts.shift();
    texts.push({ x: x + rand(-8, 8), y, txt, color, size, life: 0.9, max: 0.9, vy: -50 });
  }

  function ring(x, y, r0, r1, color, life = 0.4, size = 4, follow = false) {
    P({ kind: 'ring', x, y, r0, r1, color, life, size, glow: true, follow });
  }

  function sparks(x, y, n, colors, speed = 260, size = 2) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      P({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3, life: rand(0.2, 0.5),
        size, color: pick(colors), glow: true });
    }
  }

  // ---------- zombies ----------
  function spawnZombie() {
    const m = 30;
    let x, y;
    const side = (Math.random() * 4) | 0;
    if (side === 0) { x = rand(0, W); y = -m; }
    else if (side === 1) { x = W + m; y = rand(0, H); }
    else if (side === 2) { x = rand(0, W); y = H + m; }
    else { x = -m; y = rand(0, H); }
    const lvl = 1 + time / 45;
    const big = Math.random() < 0.08;
    const hp = (big ? 240 : 60) * lvl;
    zombies.push({
      x, y, r: big ? 22 : 14, hp, maxHp: hp, speed: big ? 42 : rand(55, 85), big,
      kx: 0, ky: 0, flash: 0, shock: 0, wob: rand(0, TAU), hue: rand(75, 115),
      st: {
        bleed: { n: 0, t: 0, acc: 0 },
        burn: { t: 0, acc: 0 },
        poison: { n: 0, t: 0, acc: 0 },
        frost: { n: 0, t: 0 },
        freeze: 0,
      },
    });
  }

  function hit(z, dmg, color, size) {
    if (z.dead) return 0;
    const dealt = Math.min(z.hp, dmg);
    z.hp -= dmg;
    z.flash = 0.08;
    addText(z.x, z.y - z.r - 4, Math.max(1, Math.round(dmg)), color || '#fff', size);
    if (z.hp <= 0) kill(z);
    return dealt;
  }

  function knock(z, fx, fy, power) {
    const dx = z.x - fx, dy = z.y - fy;
    const d = Math.hypot(dx, dy) || 1;
    const m = z.big ? 0.35 : 1;
    z.kx += dx / d * power * m;
    z.ky += dy / d * power * m;
  }

  function kill(z) {
    z.dead = true;
    score++;
    for (let i = 0; i < 14; i++) {
      P({ x: z.x, y: z.y, vx: rand(-170, 170), vy: rand(-170, 170), drag: 4, life: rand(0.3, 0.7),
        size: rand(2, 4), color: pick(['#5d7a3a', '#3f5a28', '#8a1a22']) });
    }
    addDecal({ kind: 'goo', x: z.x, y: z.y, r: z.r * rand(0.9, 1.4), life: 12 });

    // Toxic: poisoned zombies leave a toxic cloud
    if (z.st.poison.n > 0) {
      clouds.push({ x: z.x, y: z.y, r: 50 + z.st.poison.n * 5, t: 3.5, max: 3.5, acc: 0, seed: rand(0, 100) });
    }
    // Inferno: burning zombies burst and ignite neighbours
    if (z.st.burn.t > 0) {
      for (let i = 0; i < 16; i++) {
        const a = rand(0, TAU), s = rand(40, 160);
        P({ kind: 'flame', x: z.x, y: z.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, drag: 2,
          life: rand(0.3, 0.6), size: rand(4, 8), glow: true });
      }
      for (const o of zombies) {
        if (!o.dead && d2(o, z) < 70 * 70) applyBurn(o, 2.5);
      }
    }
    // Void Devour: bigger soul on kill
    if (S.lifesteal.on) soul(z.x, z.y, 3 + z.maxHp * 0.03, true);
  }

  // ---------- statuses ----------
  function applyBleed(z) { const b = z.st.bleed; b.n = Math.min(5, b.n + 1); b.t = 4; }
  function applyBurn(z, dur = 3) { const b = z.st.burn; if (b.t <= 0) b.acc = 0; b.t = Math.max(b.t, dur); }
  function applyPoison(z) { const p = z.st.poison; p.n = Math.min(8, p.n + 1); p.t = 5; }
  function applyFrost(z) {
    if (z.st.freeze > 0) return;
    const f = z.st.frost;
    f.n++;
    f.t = 3;
    if (f.n >= 5) {
      f.n = 0; f.t = 0;
      z.st.freeze = 1.6;
      addText(z.x, z.y - z.r - 18, 'FROZEN', '#bff4ff', 12);
      for (let i = 0; i < 12; i++) {
        const a = rand(0, TAU), s = rand(60, 200);
        P({ kind: 'shard', x: z.x, y: z.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3, life: rand(0.4, 0.8),
          size: rand(3, 6), color: pick(['#dff6ff', '#9fe0ff', '#6fc8ff']), rot: rand(0, TAU), vr: rand(-10, 10), glow: true });
      }
      ring(z.x, z.y, z.r, z.r + 30, '#bff4ff', 0.4, 3);
    }
  }

  function soul(x, y, v, big) {
    P({ kind: 'soul', x, y, vx: rand(-140, 140), vy: rand(-140, 140), life: 3, size: big ? 6 : 3.5,
      color: big ? '#d49bff' : '#b46cff', heal: v, glow: true });
    // wisps being devoured out of the zombie
    for (let i = 0; i < (big ? 8 : 3); i++) {
      P({ x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-30, 30), vy: rand(-60, -20), life: rand(0.3, 0.6),
        size: rand(1.5, 3), color: '#8a3dff', glow: true });
    }
  }

  function heal(v) {
    if (gameOver) return;
    player.hp = Math.min(player.maxHp, player.hp + v);
    player.healGlow = 0.5;
    healAcc += v;
    if (Math.random() < 0.35) ring(player.x, player.y, player.r, player.r + 22, '#6dff9a', 0.35, 3, true);
    for (let i = 0; i < 2; i++) {
      P({ kind: 'plus', x: player.x + rand(-18, 18), y: player.y + rand(-10, 10), vy: rand(-70, -40),
        life: rand(0.5, 0.8), size: rand(3, 5), color: '#6dff9a', glow: true });
    }
  }

  // ---------- combat primitives ----------
  function explode(x, y, R, dmg, opt = {}) {
    for (const z of zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < R + z.r) {
        const f = 1 - 0.5 * Math.min(1, d / R);
        hit(z, dmg * f, opt.textColor || '#ffb347', 14);
        knock(z, x, y, opt.knock ?? 320);
        if (opt.burn && !z.dead) applyBurn(z, 3);
      }
    }
    effects.push(boom(x, y, R, opt.c1 || '#fff4c2', opt.c2 || '#ff8a1f'));
    sparks(x, y, Math.min(40, R / 2), opt.sparkColors || ['#fff1a8', '#ffb347', '#ff6a1f'], R * 4);
    if (opt.smoke !== false) {
      for (let i = 0; i < R / 8; i++) {
        const a = rand(0, TAU), s = rand(20, R * 1.2);
        P({ kind: 'smoke', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3, life: rand(0.6, 1.2), size: rand(8, 16),
          color: '#3a3a40' });
      }
    }
    ring(x, y, R * 0.2, R * 1.1, opt.c2 || '#ffb347', 0.35, 5);
    shake = Math.max(shake, opt.shake ?? R / 12);
    if (opt.decal !== false) addDecal({ kind: 'scorch', x, y, r: R * 0.55, life: 8 });
  }

  function boom(x, y, R, c1, c2) {
    return {
      x, y, R, t: 0, dur: 0.35,
      update(dt) { this.t += dt; this.done = this.t >= this.dur; },
      draw() {
        const k = this.t / this.dur;
        const r = R * (0.3 + 0.9 * easeOut(k));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - k;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, c1);
        g.addColorStop(0.45, c2);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.restore();
      },
    };
  }

  function chainLightning(origin, jumps, dmg) {
    const used = new Set([origin]);
    let cur = { x: origin.x, y: origin.y };
    for (let i = 0; i < jumps; i++) {
      let best = null, bd = 160 * 160;
      for (const z of zombies) {
        if (z.dead || used.has(z)) continue;
        const dd = d2(z, cur);
        if (dd < bd) { bd = dd; best = z; }
      }
      if (!best) break;
      used.add(best);
      arcs.push({ ax: cur.x, ay: cur.y, bx: best.x, by: best.y, life: 0.28, max: 0.28 });
      const bx = best.x, by = best.y;
      hit(best, dmg, '#8ff4ff', 12);
      if (!best.dead) best.shock = 0.4;
      sparks(bx, by, 6, ['#ffffff', '#8ff4ff', '#3fc8ff'], 220, 1.5);
      cur = { x: bx, y: by };
    }
  }

  function addDecal(d) {
    d.max = d.life;
    decals.push(d);
    if (decals.length > 260) decals.shift();
  }

  function onBulletHit(z, b) {
    const zx = z.x, zy = z.y;
    const dealt = hit(z, b.dmg, '#ffffff');
    knock(z, b.x - b.vx, b.y - b.vy, 60);
    if (S.lifesteal.on) soul(zx, zy, dealt * 0.3 + 0.5, false);
    if (!z.dead) {
      if (S.bleed.on) applyBleed(z);
      if (S.inferno.on) applyBurn(z, 3);
      if (S.frost.on) applyFrost(z);
      if (S.toxic.on) applyPoison(z);
    }
    if (S.explosive.on && Math.random() < 0.22) explode(zx, zy, 75, 22 * dm(), { shake: 5 });
    if (S.electric.on && Math.random() < 0.3) chainLightning(z, 5, 14 * dm());
  }

  // ---------- targeting ----------
  function densest() {
    const list = zombies.filter(z => !z.dead && z.x > 0 && z.x < W && z.y > 0 && z.y < H);
    if (!list.length) return null;
    const sample = list.length > 60 ? Array.from({ length: 60 }, () => pick(list)) : list;
    let best = null, bc = -1;
    for (const a of sample) {
      let c = 0;
      for (const b of list) if (d2(a, b) < 130 * 130) c++;
      if (c > bc) { bc = c; best = a; }
    }
    return { x: best.x, y: best.y };
  }

  function nearest(maxD) {
    let best = null, bd = maxD * maxD;
    for (const z of zombies) {
      if (z.dead) continue;
      const dd = d2(z, player);
      if (dd < bd) { bd = dd; best = z; }
    }
    return best;
  }

  // =================== ACTIVE SKILLS ===================

  // 1. Black hole
  function castBlackhole(x, y) {
    effects.push({
      x, y, t: 0, dur: 3.5, R: 230, acc: 0, scale: 0,
      update(dt) {
        this.t += dt;
        const t = this.t;
        this.scale = t < 0.35 ? easeOut(t / 0.35) : t > this.dur - 0.25 ? Math.max(0, (this.dur - t) / 0.25) : 1;
        const R = this.R * this.scale;
        for (const z of zombies) {
          if (z.dead) continue;
          const dx = x - z.x, dy = y - z.y;
          const d = Math.hypot(dx, dy);
          if (d < R && d > 1) {
            const s = 1 - d / R;
            const m = z.big ? 0.6 : 1;
            const move = Math.min(d - 6, (120 + 560 * s) * dt * m);
            z.x += dx / d * move + (-dy / d) * s * 170 * dt * m;
            z.y += dy / d * move + (dx / d) * s * 170 * dt * m;
          }
        }
        this.acc += dt;
        if (this.acc >= 0.2) {
          this.acc -= 0.2;
          for (const z of zombies) if (!z.dead && d2(z, this) < 60 * 60) hit(z, 10 * dm(), '#d6a8ff', 12);
        }
        for (let i = 0; i < 2; i++) {
          P({ kind: 'orbit', cx: x, cy: y, ang: rand(0, TAU), rad: this.R * rand(0.5, 1) * this.scale, w: rand(1.5, 3),
            inward: rand(70, 150), life: 3, size: rand(1.5, 3), color: pick(['#b98bff', '#ff8fe6', '#8fb0ff', '#ffffff']), glow: true });
        }
        if (t >= this.dur) {
          this.done = true;
          explode(x, y, 150, 90 * dm(), { c1: '#ffffff', c2: '#9b5cff', textColor: '#d6a8ff', knock: 520, shake: 14,
            sparkColors: ['#ffffff', '#d6a8ff', '#9b5cff', '#ff8fe6'], smoke: false });
          ring(x, y, 10, 220, '#d6a8ff', 0.5, 6);
          flash = { c: '160,90,255', a: 0.25 };
        }
      },
      draw() {
        const k = this.scale;
        const { x, y } = this;
        ctx.save();
        let g = ctx.createRadialGradient(x, y, 10, x, y, this.R * k);
        g.addColorStop(0, 'rgba(120,40,255,0.35)');
        g.addColorStop(0.45, 'rgba(80,20,160,0.14)');
        g.addColorStop(1, 'rgba(40,0,80,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, this.R * k, 0, TAU); ctx.fill();

        // inward distortion ripples
        ctx.strokeStyle = 'rgba(190,140,255,0.25)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const f = 1 - ((this.t * 0.9 + i / 3) % 1);
          ctx.globalAlpha = f;
          ctx.beginPath(); ctx.arc(x, y, this.R * k * f, 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // accretion disk
        ctx.globalCompositeOperation = 'lighter';
        const cols = ['rgba(200,120,255,0.85)', 'rgba(255,120,220,0.6)', 'rgba(120,170,255,0.6)', 'rgba(255,200,140,0.5)'];
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(this.t * (2.5 + i) + i * 1.7);
          ctx.scale(1, 0.45);
          ctx.strokeStyle = cols[i];
          ctx.lineWidth = 5 - i;
          ctx.beginPath(); ctx.arc(0, 0, (52 + i * 13) * k, 0, Math.PI * 1.3); ctx.stroke();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';

        // event horizon
        const cr = 34 * k;
        g = ctx.createRadialGradient(x, y, 0, x, y, cr);
        g.addColorStop(0, '#000');
        g.addColorStop(0.72, '#000');
        g.addColorStop(0.88, 'rgba(230,180,255,0.95)');
        g.addColorStop(1, 'rgba(160,80,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, cr, 0, TAU); ctx.fill();
        ctx.restore();
      },
    });
  }

  // 2. Meteor
  function castMeteor(tx, ty) {
    const sx = tx + 420, sy = ty - 760;
    const len = Math.hypot(tx - sx, ty - sy);
    const dirx = (tx - sx) / len, diry = (ty - sy) / len;
    effects.push({
      tx, ty, x: sx, y: sy, t: 0, fall: 0.85, impacted: false, acc: 0,
      update(dt) {
        this.t += dt;
        if (!this.impacted) {
          const p = Math.min(1, this.t / this.fall);
          const e = p * p;
          this.x = lerp(sx, tx, e);
          this.y = lerp(sy, ty, e);
          for (let i = 0; i < 4; i++) {
            P({ kind: 'flame', x: this.x + rand(-8, 8), y: this.y + rand(-8, 8), vx: -dirx * rand(60, 160) + rand(-30, 30),
              vy: -diry * rand(60, 160) + rand(-30, 30), drag: 2, life: rand(0.2, 0.45), size: rand(5, 9), glow: true });
          }
          P({ kind: 'smoke', x: this.x, y: this.y, vx: -dirx * 40, vy: -diry * 40, life: 0.8, size: rand(6, 10), color: '#2c2a2a' });
          if (p >= 1) {
            this.impacted = true;
            explode(tx, ty, 125, 150 * dm(), { burn: true, shake: 18, c1: '#fff6d0', c2: '#ff5a1f', decal: false, knock: 420 });
            addDecal({ kind: 'crater', x: tx, y: ty, r: 70, life: 14 });
            for (let i = 0; i < 22; i++) {
              const a = rand(0, TAU), s = rand(100, 380);
              P({ kind: 'rock', x: tx, y: ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - rand(120, 280), g: 900,
                floor: ty + rand(-50, 60), life: 1.2, size: rand(3, 6), color: pick(['#4a3a30', '#6b4c36', '#2e2622']),
                rot: rand(0, TAU), vr: rand(-12, 12) });
            }
            flash = { c: '255,140,40', a: 0.35 };
          }
        } else {
          // burning crater
          this.acc += dt;
          if (this.acc >= 0.3) {
            this.acc -= 0.3;
            for (const z of zombies) {
              if (!z.dead && d2(z, { x: tx, y: ty }) < 95 * 95) { hit(z, 6 * dm(), '#ff9a3c', 11); if (!z.dead) applyBurn(z, 1.5); }
            }
          }
          const a = rand(0, TAU), r = rand(0, 90);
          P({ kind: 'flame', x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r, vy: rand(-80, -30), life: rand(0.3, 0.6),
            size: rand(3, 7), glow: true });
          this.done = this.t >= this.fall + 2.2;
        }
      },
      drawUnder() {
        ctx.save();
        if (!this.impacted) {
          const p = this.t / this.fall;
          ctx.fillStyle = `rgba(255,60,0,${0.08 + 0.18 * p})`;
          ctx.beginPath(); ctx.arc(tx, ty, 125, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(255,90,30,${0.5 + 0.5 * Math.sin(this.t * 30) ** 2})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]);
          ctx.lineDashOffset = -this.t * 60;
          ctx.beginPath(); ctx.arc(tx, ty, 125, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(255,200,120,0.8)';
          ctx.beginPath(); ctx.arc(tx, ty, 125 * (1 - p) + 4, 0, TAU); ctx.stroke();
        } else {
          const k = 1 - (this.t - this.fall) / 2.2;
          const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 100);
          g.addColorStop(0, `rgba(255,120,30,${0.35 * k})`);
          g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(tx, ty, 100, 0, TAU); ctx.fill();
        }
        ctx.restore();
      },
      draw() {
        if (this.impacted) return;
        const { x, y } = this;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const tail = ctx.createLinearGradient(x - dirx * 160, y - diry * 160, x, y);
        tail.addColorStop(0, 'rgba(255,80,0,0)');
        tail.addColorStop(1, 'rgba(255,190,90,0.9)');
        ctx.strokeStyle = tail;
        ctx.lineCap = 'round';
        ctx.lineWidth = 22;
        ctx.beginPath(); ctx.moveTo(x - dirx * 160, y - diry * 160); ctx.lineTo(x, y); ctx.stroke();
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 40);
        glow.addColorStop(0, 'rgba(255,220,150,0.9)');
        glow.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        const rock = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, 16);
        rock.addColorStop(0, '#fff3c4');
        rock.addColorStop(0.4, '#ff8a2a');
        rock.addColorStop(1, '#5a2410');
        ctx.fillStyle = rock;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
        ctx.restore();
      },
    });
  }

  // 3. Void Rift
  function castVoidRift(x, y) {
    effects.push({
      x, y, t: 0, dur: 4.5, R: 100, acc: 0, s: 0, targets: [],
      update(dt) {
        this.t += dt;
        const t = this.t;
        this.s = t < 0.4 ? easeOut(t / 0.4) : t > this.dur - 0.4 ? Math.max(0, (this.dur - t) / 0.4) : 1;
        const R = this.R * this.s;
        this.targets = [];
        for (const z of zombies) {
          if (z.dead) continue;
          const dx = x - z.x, dy = y - z.y, d = Math.hypot(dx, dy);
          if (d < R + 30) {
            if (this.targets.length < 10) this.targets.push(z);
            if (d > 10) { z.x += dx / d * 55 * dt; z.y += dy / d * 55 * dt; }
          }
        }
        this.acc += dt;
        if (this.acc >= 0.25) {
          this.acc -= 0.25;
          for (const z of zombies) if (!z.dead && d2(z, this) < (R + z.r) ** 2) hit(z, 11 * dm(), '#e08bff', 12);
        }
        for (let i = 0; i < 2; i++) {
          const a = rand(0, TAU), r = rand(0, R);
          P({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vy: rand(-60, -20), vx: rand(-10, 10), life: rand(0.5, 1),
            size: rand(1.5, 3), color: pick(['#c04dff', '#ff6bf0', '#8a5bff']), glow: true });
        }
        if (Math.random() < 0.3) sparks(x, y, 2, ['#e8b0ff', '#c04dff'], 180, 1.5);
        this.done = t >= this.dur;
      },
      drawUnder() {
        const R = this.R * this.s;
        ctx.save();
        ctx.translate(x, y);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        g.addColorStop(0, 'rgba(120,0,200,0.3)');
        g.addColorStop(1, 'rgba(120,0,200,0.05)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
        ctx.rotate(this.t * 0.6);
        ctx.strokeStyle = 'rgba(200,90,255,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
        ctx.rotate(-this.t * 1.6);
        ctx.setLineDash([4, 12]);
        ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        // rune marks
        ctx.fillStyle = 'rgba(230,160,255,0.7)';
        for (let i = 0; i < 8; i++) {
          ctx.rotate(TAU / 8);
          ctx.fillRect(R * 0.86, -2, 8 * this.s, 4);
        }
        ctx.restore();
      },
      draw() {
        const s = this.s;
        const rx = 36 * s, ry = 62 * s;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // tendrils
        ctx.lineCap = 'round';
        this.targets.forEach((z, i) => {
          if (z.dead) return;
          const w = Math.sin(this.t * 7 + i) * 30;
          ctx.strokeStyle = 'rgba(200,90,255,0.55)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo((x + z.x) / 2 + w, (y + z.y) / 2 - w, z.x, z.y);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,200,255,0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        ctx.translate(x, y);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, ry * 1.6);
        glow.addColorStop(0, 'rgba(200,80,255,0.5)');
        glow.addColorStop(1, 'rgba(120,0,200,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, ry * 1.6, 0, TAU); ctx.fill();
        const cols = ['#ff6bf0', '#c04dff', '#8a5bff', '#e8b0ff', '#c04dff'];
        for (let i = 0; i < 5; i++) {
          const f = 1 - i * 0.15;
          ctx.strokeStyle = cols[i];
          ctx.lineWidth = 3;
          ctx.setLineDash([20 * f, 10]);
          ctx.lineDashOffset = -this.t * 50 * (i % 2 ? -1 : 1) * (i + 1);
          ctx.beginPath(); ctx.ellipse(0, 0, rx * f, ry * f, 0, 0, TAU); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'source-over';
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, ry * 0.55);
        core.addColorStop(0, '#05000a');
        core.addColorStop(0.7, '#1a0030');
        core.addColorStop(1, 'rgba(90,0,150,0.9)');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.55, ry * 0.55, 0, 0, TAU); ctx.fill();
        ctx.restore();
      },
    });
  }

  // 4. Starblade
  function castStarblade(tx, ty) {
    const cands = zombies.filter(z => !z.dead && d2(z, { x: tx, y: ty }) < 320 * 320);
    const strikes = [];
    for (let i = 0; i < 16; i++) {
      const z = cands.length ? pick(cands) : null;
      const ex = z ? z.x : tx + rand(-180, 180);
      const ey = z ? z.y : ty + rand(-180, 180);
      strikes.push({
        z, tx: ex, ty: ey, sx: ex - 280 + rand(-80, 80), sy: ey - 560, delay: i * 0.07, fall: 0.32, landed: false,
        color: i % 2 ? '#b77bff' : '#6fd6ff', x: 0, y: 0,
      });
    }
    effects.push({
      t: 0, strikes,
      update(dt) {
        this.t += dt;
        let all = true;
        for (const s of strikes) {
          if (s.landed) continue;
          all = false;
          if (this.t < s.delay) continue;
          if (s.z && !s.z.dead) { s.tx = s.z.x; s.ty = s.z.y; }
          const p = Math.min(1, (this.t - s.delay) / s.fall);
          s.x = lerp(s.sx, s.tx, p);
          s.y = lerp(s.sy, s.ty, p);
          P({ kind: 'star', x: s.x, y: s.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.35, size: rand(2, 3.5), color: s.color,
            glow: true, rot: rand(0, TAU) });
          if (p >= 1) {
            s.landed = true;
            explode(s.tx, s.ty, 50, 38 * dm(), { c1: '#ffffff', c2: s.color, textColor: s.color, knock: 180, shake: 3,
              decal: false, smoke: false, sparkColors: ['#ffffff', s.color, '#e0d0ff'] });
            for (let i = 0; i < 8; i++) {
              const a = rand(0, TAU), sp = rand(60, 200);
              P({ kind: 'star', x: s.tx, y: s.ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, life: rand(0.4, 0.8),
                size: rand(3, 6), color: pick(['#ffffff', s.color]), glow: true, rot: rand(0, TAU), vr: rand(-6, 6) });
            }
          }
        }
        this.done = all;
      },
      draw() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const s of strikes) {
          if (s.landed || this.t < s.delay) continue;
          const dx = s.tx - s.sx, dy = s.ty - s.sy, l = Math.hypot(dx, dy);
          const ux = dx / l, uy = dy / l;
          const g = ctx.createLinearGradient(s.x - ux * 120, s.y - uy * 120, s.x, s.y);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, s.color);
          ctx.strokeStyle = g;
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(s.x - ux * 120, s.y - uy * 120); ctx.lineTo(s.x, s.y); ctx.stroke();
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(this.t * 12);
          ctx.fillStyle = s.color;
          starPath(0, 0, 13, 4);
          ctx.fill();
          ctx.fillStyle = '#fff';
          starPath(0, 0, 6, 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      },
    });
  }

  function starPath(x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const rr = i % 2 === 0 ? R : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  // 5. Divine Wrath
  function castDivine() {
    const N = 20;
    effects.push({
      t: 0, fired: 0, beams: [], times: [0, 0.4, 0.8],
      update(dt) {
        this.t += dt;
        while (this.fired < 3 && this.t >= this.times[this.fired]) { this.fire(this.fired); this.fired++; }
        for (const b of this.beams) b.t += dt;
        this.beams = this.beams.filter(b => b.t < b.life);
        if (Math.random() < 0.6) {
          const a = rand(0, TAU);
          P({ x: player.x + Math.cos(a) * 30, y: player.y + Math.sin(a) * 30, vy: -60, life: 0.6, size: 2,
            color: '#ffe38a', glow: true });
        }
        this.done = this.fired >= 3 && this.beams.length === 0;
      },
      fire(i) {
        const off = i * (Math.PI / N);
        const step = TAU / N;
        const L = Math.hypot(W, H);
        for (let k = 0; k < N; k++) this.beams.push({ a: off + k * step, t: 0, life: 0.5, L });
        for (const z of zombies) {
          if (z.dead) continue;
          const dx = z.x - player.x, dy = z.y - player.y;
          const dist = Math.hypot(dx, dy);
          let da = (((Math.atan2(dy, dx) - off) % step) + step) % step;
          da = Math.min(da, step - da);
          if (dist * Math.sin(da) < 16 + z.r) {
            hit(z, 48 * dm(), '#ffe066', 15);
            if (!z.dead) knock(z, player.x, player.y, 260);
          }
        }
        ring(player.x, player.y, 20, 140, '#ffd54a', 0.45, 6, true);
        shake = Math.max(shake, 5);
        flash = { c: '255,215,90', a: 0.15 };
      },
      draw() {
        const px = player.x, py = player.y;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fade = this.fired >= 3 && this.beams.length ? Math.min(1, this.beams[0].life - this.beams[0].t + 0.2) : 1;
        const halo = ctx.createRadialGradient(px, py, 0, px, py, 70);
        halo.addColorStop(0, `rgba(255,240,180,${0.6 * fade})`);
        halo.addColorStop(1, 'rgba(255,200,60,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(px, py, 70, 0, TAU); ctx.fill();
        // rotating sun ring
        ctx.strokeStyle = `rgba(255,220,110,${0.8 * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 34, 0, TAU); ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = this.t * 2 + i * TAU / 12;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(a) * 36, py + Math.sin(a) * 36);
          ctx.lineTo(px + Math.cos(a) * 46, py + Math.sin(a) * 46);
          ctx.stroke();
        }
        ctx.lineCap = 'round';
        for (const b of this.beams) {
          const k = b.t / b.life;
          const len = b.L * Math.min(1, b.t / 0.08);
          const c = Math.cos(b.a), s = Math.sin(b.a);
          const x0 = px + c * 22, y0 = py + s * 22, x1 = px + c * len, y1 = py + s * len;
          ctx.strokeStyle = `rgba(255,200,60,${0.45 * (1 - k)})`;
          ctx.lineWidth = (1 - k) * 18 + 2;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.strokeStyle = `rgba(255,250,220,${1 - k})`;
          ctx.lineWidth = (1 - k) * 4 + 1;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  // 6. Judgement
  function castJudgement(tx, ty) {
    const a = Math.atan2(ty - player.y, tx - player.x);
    const c = Math.cos(a), s = Math.sin(a);
    const L = Math.hypot(W, H) * 1.3;
    const w = 34;
    effects.push({
      t: 0, charge: 0.55, beamT: 0.7, fired: false, ox: player.x, oy: player.y,
      update(dt) {
        this.t += dt;
        if (!this.fired) {
          this.ox = player.x; this.oy = player.y;
          player.face = a;
          for (let i = 0; i < 3; i++) {
            const ang = rand(0, TAU), r = rand(50, 90);
            const hx = this.ox + c * 24, hy = this.oy + s * 24;
            P({ x: hx + Math.cos(ang) * r, y: hy + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 4, vy: -Math.sin(ang) * r * 4,
              life: 0.25, size: rand(1.5, 3), color: pick(['#fff4c0', '#ffd54a']), glow: true });
          }
          if (this.t >= this.charge) { this.fired = true; this.fire(); }
        } else {
          for (let i = 0; i < 4; i++) {
            const along = rand(0, L), side = rand(-w, w);
            P({ x: this.ox + c * along - s * side, y: this.oy + s * along + c * side, vx: -s * rand(-80, 80), vy: c * rand(-80, 80) + 30,
              life: rand(0.3, 0.7), size: rand(1.5, 3), color: pick(['#fff4c0', '#ffd54a', '#ffffff']), glow: true });
          }
          this.done = this.t >= this.charge + this.beamT;
        }
      },
      fire() {
        for (const z of zombies) {
          if (z.dead) continue;
          const dx = z.x - this.ox, dy = z.y - this.oy;
          const along = dx * c + dy * s;
          const perp = Math.abs(-dx * s + dy * c);
          if (along > -z.r && along < L && perp < w + z.r) {
            hit(z, 260 * dm(), '#fff2a8', 20);
            if (!z.dead) { z.kx += c * 500; z.ky += s * 500; }
          }
        }
        shake = Math.max(shake, 16);
        flash = { c: '255,230,140', a: 0.45 };
        sparks(this.ox + c * 24, this.oy + s * 24, 30, ['#ffffff', '#fff4c0', '#ffd54a'], 400, 2.5);
        for (let i = 0; i < 60; i++) {
          const along = rand(0, L * 0.7), side = rand(-1, 1);
          P({ kind: 'spark', x: this.ox + c * along, y: this.oy + s * along, vx: -s * side * rand(200, 500), vy: c * side * rand(200, 500),
            drag: 4, life: rand(0.2, 0.5), size: 2, color: pick(['#ffffff', '#ffe27a']), glow: true });
        }
      },
      draw() {
        ctx.save();
        ctx.translate(this.ox, this.oy);
        ctx.rotate(a);
        ctx.globalCompositeOperation = 'lighter';
        if (!this.fired) {
          const p = this.t / this.charge;
          // aim line
          ctx.strokeStyle = `rgba(255,220,110,${(0.3 + 0.5 * p) * (0.7 + 0.3 * Math.random())})`;
          ctx.lineWidth = 1 + p * 3;
          ctx.setLineDash([14, 10]);
          ctx.lineDashOffset = -this.t * 200;
          ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(L, 0); ctx.stroke();
          ctx.setLineDash([]);
          // rune circle
          ctx.rotate(this.t * 6);
          ctx.strokeStyle = `rgba(255,220,110,${0.4 + 0.6 * p})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke();
          for (let i = 0; i < 6; i++) {
            ctx.rotate(TAU / 6);
            ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(40, 0); ctx.stroke();
          }
          ctx.rotate(-this.t * 6 - TAU);
          // gathering orb
          const r = 4 + 12 * p;
          const g = ctx.createRadialGradient(24, 0, 0, 24, 0, r * 2);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.4, 'rgba(255,220,110,0.9)');
          g.addColorStop(1, 'rgba(255,200,60,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(24, 0, r * 2, 0, TAU); ctx.fill();
        } else {
          const k = (this.t - this.charge) / this.beamT;
          const f = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
          const hw = w * 1.6 * f + 2;
          const g = ctx.createLinearGradient(0, -hw, 0, hw);
          g.addColorStop(0, 'rgba(255,200,60,0)');
          g.addColorStop(0.3, 'rgba(255,210,80,0.55)');
          g.addColorStop(0.5, 'rgba(255,255,240,1)');
          g.addColorStop(0.7, 'rgba(255,210,80,0.55)');
          g.addColorStop(1, 'rgba(255,200,60,0)');
          ctx.fillStyle = g;
          ctx.fillRect(10, -hw, L, hw * 2);
          ctx.fillStyle = `rgba(255,255,255,${f})`;
          ctx.fillRect(10, -hw * 0.18, L, hw * 0.36);
          const o = ctx.createRadialGradient(20, 0, 0, 20, 0, hw * 1.8);
          o.addColorStop(0, `rgba(255,255,255,${f})`);
          o.addColorStop(1, 'rgba(255,210,80,0)');
          ctx.fillStyle = o;
          ctx.beginPath(); ctx.arc(20, 0, hw * 1.8, 0, TAU); ctx.fill();
        }
        ctx.restore();
      },
    });
  }

  function castSkill(id, auto) {
    const s = S[id];
    if (!s || s.type !== 'active' || s.t > 0 || gameOver || paused) return false;
    let tgt = null;
    if (!auto && mouse.inside) tgt = { x: mouse.x, y: mouse.y };
    else tgt = densest();
    if (!tgt) {
      if (auto) return false;
      tgt = { x: player.x + rand(-150, 150), y: player.y - 160 };
    }
    switch (id) {
      case 'blackhole': castBlackhole(tgt.x, tgt.y); break;
      case 'meteor': castMeteor(tgt.x, tgt.y); break;
      case 'voidrift': castVoidRift(tgt.x, tgt.y); break;
      case 'starblade': castStarblade(tgt.x, tgt.y); break;
      case 'divine': castDivine(); break;
      case 'judgement': castJudgement(tgt.x, tgt.y); break;
    }
    s.t = s.cd;
    const el = buttons[id];
    el.classList.remove('cast');
    void el.offsetWidth;
    el.classList.add('cast');
    return true;
  }

  // =================== UPDATE ===================
  function update(dt) {
    time += dt;
    for (const s of SKILLS) if (s.t > 0) s.t = Math.max(0, s.t - dt);

    // spawning
    spawnTimer -= dt * settings.spawnRate;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.18, 0.9 / (1 + time / 60));
      if (zombies.length < 220) spawnZombie();
    }

    // player movement
    let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (mouse.down && mouse.touch) {
      const dx = mouse.x - player.x, dy = mouse.y - player.y;
      if (Math.hypot(dx, dy) > 20) { mx = dx; my = dy; }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 0) {
      player.x = clamp(player.x + mx / ml * player.speed * dt, player.r, W - player.r);
      player.y = clamp(player.y + my / ml * player.speed * dt, player.r, H - player.r);
    }
    player.healGlow = Math.max(0, player.healGlow - dt);
    player.hurt = Math.max(0, player.hurt - dt);

    // auto shoot
    fireTimer -= dt;
    if (fireTimer <= 0) {
      const t = nearest(560);
      if (t) {
        fireTimer = 0.18;
        const a = Math.atan2(t.y - player.y, t.x - player.x);
        player.face = a;
        bullets.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780,
          life: 1, dmg: 12 * dm() });
      }
    }

    // auto cast
    if (settings.autoCast) {
      autoTimer -= dt;
      if (autoTimer <= 0 && zombies.some(z => !z.dead && d2(z, player) < 450 * 450)) {
        for (const s of SKILLS) {
          if (s.type === 'active' && s.t <= 0 && castSkill(s.id, true)) { autoTimer = 0.6; break; }
        }
      }
    }

    // bullets
    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.life = 0;
      if (b.life <= 0) continue;
      for (const z of zombies) {
        if (z.dead) continue;
        const rr = z.r + 4;
        if (d2(b, z) < rr * rr) { onBulletHit(z, b); b.life = 0; break; }
      }
    }
    bullets = bullets.filter(b => b.life > 0);

    // zombies
    for (const z of zombies) {
      if (!z.dead) updateZombie(z, dt);
    }
    // separation
    for (let i = 0; i < zombies.length; i++) {
      const a = zombies[i];
      if (a.dead) continue;
      for (let j = i + 1; j < zombies.length; j++) {
        const b = zombies[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.r + b.r;
        const dd = dx * dx + dy * dy;
        if (dd < rr * rr && dd > 0.01) {
          const d = Math.sqrt(dd), push = (rr - d) / 2;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
    zombies = zombies.filter(z => !z.dead);

    // toxic clouds
    for (const c of clouds) {
      c.t -= dt;
      c.acc += dt;
      if (c.acc >= 0.5) {
        c.acc -= 0.5;
        for (const z of zombies) {
          if (!z.dead && d2(z, c) < c.r * c.r) { hit(z, 4 * dm(), '#9dff6a', 11); if (!z.dead) applyPoison(z); }
        }
      }
      if (Math.random() < dt * 10) {
        const a = rand(0, TAU), r = rand(0, c.r);
        P({ kind: 'bubble', x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vy: rand(-30, -10), life: rand(0.5, 1),
          size: rand(2, 5), color: '#8dff5a' });
      }
    }
    clouds = clouds.filter(c => c.t > 0);

    // effects
    for (const e of effects) e.update(dt);
    effects = effects.filter(e => !e.done);

    // particles
    for (const p of particles) updateParticle(p, dt);
    particles = particles.filter(p => p.life > 0);

    for (const t of texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 1 - 2 * dt; }
    texts = texts.filter(t => t.life > 0);
    for (const a of arcs) a.life -= dt;
    arcs = arcs.filter(a => a.life > 0);
    for (const d of decals) d.life -= dt;
    decals = decals.filter(d => d.life > 0);

    // heal numbers are batched so they don't spam
    healTimer -= dt;
    if (healTimer <= 0 && healAcc >= 1) {
      addText(player.x, player.y - 30, '+' + Math.round(healAcc), '#6dff9a', 14);
      healAcc = 0;
      healTimer = 0.3;
    }

    shake = Math.max(0, shake - dt * 40);
    if (flash) { flash.a -= dt * 1.5; if (flash.a <= 0) flash = null; }

    if (player.hp <= 0 && !settings.god) endGame();
  }

  function updateZombie(z, dt) {
    const st = z.st;
    const m = dm();
    z.flash = Math.max(0, z.flash - dt);
    z.shock = Math.max(0, z.shock - dt);
    z.wob += dt * 6;

    // Bleed
    if (st.bleed.t > 0) {
      st.bleed.t -= dt;
      st.bleed.acc += dt;
      if (Math.random() < dt * 5 * st.bleed.n) {
        P({ kind: 'drop', x: z.x + rand(-z.r / 2, z.r / 2), y: z.y, vx: rand(-40, 40), vy: rand(-110, -30), g: 500,
          floor: z.y + z.r * 0.8 + rand(0, 8), life: 1.5, size: rand(1.5, 3), color: pick(['#b3001b', '#d4142e', '#8a0010']) });
      }
      if (st.bleed.acc >= 0.5) { st.bleed.acc -= 0.5; hit(z, 4 * st.bleed.n * m * 0.5, '#ff4d5e', 11); if (z.dead) return; }
      if (st.bleed.t <= 0) { st.bleed.n = 0; st.bleed.acc = 0; }
    }

    // Inferno
    if (st.burn.t > 0) {
      st.burn.t -= dt;
      st.burn.acc += dt;
      for (let i = 0; i < 2; i++) {
        if (Math.random() < dt * 14) {
          P({ kind: 'flame', x: z.x + rand(-z.r * 0.7, z.r * 0.7), y: z.y + rand(-z.r * 0.5, z.r * 0.5), vx: rand(-15, 15),
            vy: rand(-110, -50), life: rand(0.35, 0.6), size: rand(3, 6) * (z.big ? 1.4 : 1), glow: true });
        }
      }
      if (st.burn.acc >= 0.5) {
        st.burn.acc -= 0.5;
        hit(z, 10 * m * 0.5, '#ff9a3c', 11);
        if (z.dead) return;
        if (Math.random() < 0.2) {
          for (const o of zombies) {
            if (o !== z && !o.dead && o.st.burn.t <= 0 && d2(o, z) < 50 * 50) {
              applyBurn(o, 2.5);
              for (let i = 0; i < 5; i++) {
                const k = i / 5;
                P({ kind: 'flame', x: lerp(z.x, o.x, k), y: lerp(z.y, o.y, k), vy: -40, life: 0.4, size: 4, glow: true });
              }
              break;
            }
          }
        }
      }
    }

    // Toxic
    if (st.poison.t > 0) {
      st.poison.t -= dt;
      st.poison.acc += dt;
      if (Math.random() < dt * 2.5 * st.poison.n) {
        P({ kind: 'bubble', x: z.x + rand(-z.r, z.r), y: z.y + rand(-z.r / 2, z.r / 2), vy: rand(-45, -20), vx: rand(-10, 10),
          life: rand(0.5, 0.9), size: rand(2, 4), color: pick(['#7dff4a', '#b6ff6a', '#4ad62a']) });
      }
      if (st.poison.acc >= 0.5) { st.poison.acc -= 0.5; hit(z, 2.5 * st.poison.n * m * 0.5, '#9dff6a', 11); if (z.dead) return; }
      if (st.poison.t <= 0) { st.poison.n = 0; st.poison.acc = 0; }
    }

    // Frost
    if (st.frost.t > 0) {
      st.frost.t -= dt;
      if (st.frost.t <= 0) st.frost.n = 0;
      if (Math.random() < dt * 5) {
        P({ kind: 'shard', x: z.x + rand(-z.r, z.r), y: z.y - z.r, vx: rand(-15, 15), vy: rand(10, 35), life: 0.8, size: rand(1.5, 2.5),
          color: '#cdefff', rot: rand(0, TAU), vr: rand(-4, 4), glow: true });
      }
    }
    if (st.freeze > 0) {
      st.freeze -= dt;
      if (st.freeze <= 0) {
        for (let i = 0; i < 8; i++) {
          const a = rand(0, TAU);
          P({ kind: 'shard', x: z.x, y: z.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, drag: 4, life: 0.5, size: 3,
            color: '#dff6ff', rot: rand(0, TAU), vr: 8, glow: true });
        }
      }
    }

    // movement
    let spd = z.speed;
    if (st.freeze > 0 || z.shock > 0) spd = 0;
    else if (st.frost.t > 0) spd *= Math.max(0.35, 1 - 0.13 * st.frost.n);
    const dx = player.x - z.x, dy = player.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    z.x += dx / d * spd * dt + z.kx * dt;
    z.y += dy / d * spd * dt + z.ky * dt;
    const dec = Math.exp(-7 * dt);
    z.kx *= dec;
    z.ky *= dec;

    if (spd > 0 && d < z.r + player.r) {
      if (!settings.god) player.hp -= (z.big ? 26 : 13) * dt;
      player.hurt = 0.15;
    }
  }

  function updateParticle(p, dt) {
    p.life -= dt;
    switch (p.kind) {
      case 'soul': {
        const dx = player.x - p.x, dy = player.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx += dx / d * 1600 * dt;
        p.vy += dy / d * 1600 * dt;
        p.vx *= 1 - 2.5 * dt;
        p.vy *= 1 - 2.5 * dt;
        if (Math.random() < 0.5) {
          P({ x: p.x, y: p.y, life: 0.25, size: p.size * 0.6, color: p.color, glow: true });
        }
        if (d < player.r + 4 || p.life <= 0) { heal(p.heal); p.life = 0; return; }
        break;
      }
      case 'orbit': {
        p.rad -= p.inward * dt;
        p.ang += p.w * dt * (1 + (1 - Math.min(1, p.rad / 230)) * 4);
        p.x = p.cx + Math.cos(p.ang) * p.rad;
        p.y = p.cy + Math.sin(p.ang) * p.rad;
        if (p.rad < 20) p.life = 0;
        return;
      }
      case 'ring':
        if (p.follow) { p.x = player.x; p.y = player.y; }
        return;
    }
    if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.floor !== undefined && p.vy > 0 && p.y >= p.floor) {
      if (p.kind === 'drop') addDecal({ kind: 'blood', x: p.x, y: p.y, r: p.size * rand(1.2, 2.2), life: 6 });
      p.life = 0;
    }
  }

  // =================== DRAW ===================
  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
    ctx.drawImage(bg, 0, 0, W, H);

    drawDecals();
    drawClouds();
    for (const e of effects) if (e.drawUnder) e.drawUnder();
    for (const z of zombies) drawZombie(z);
    drawBullets();
    drawPlayer();
    for (const e of effects) if (e.draw) e.draw();
    drawParticles();
    drawArcs();
    drawTexts();
    ctx.restore();

    if (flash) {
      ctx.fillStyle = `rgba(${flash.c},${Math.max(0, flash.a)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (player.hp / player.maxHp < 0.3 && !settings.god) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(200,0,0,0)');
      g.addColorStop(1, `rgba(200,0,0,${0.25 + 0.1 * Math.sin(time * 6)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawDecals() {
    for (const d of decals) {
      const a = Math.min(1, d.life / d.max * 2);
      ctx.save();
      if (d.kind === 'blood') {
        ctx.fillStyle = `rgba(120,0,15,${0.7 * a})`;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 1.4, d.r * 0.8, 0, 0, TAU); ctx.fill();
      } else if (d.kind === 'goo') {
        ctx.fillStyle = `rgba(60,80,35,${0.55 * a})`;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 1.3, d.r, 0, 0, TAU); ctx.fill();
      } else if (d.kind === 'scorch') {
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        g.addColorStop(0, `rgba(10,8,6,${0.6 * a})`);
        g.addColorStop(1, 'rgba(10,8,6,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      } else if (d.kind === 'crater') {
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        g.addColorStop(0, `rgba(5,3,2,${0.85 * a})`);
        g.addColorStop(0.75, `rgba(30,20,15,${0.7 * a})`);
        g.addColorStop(0.9, `rgba(90,60,40,${0.6 * a})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
        const heat = Math.max(0, d.life / d.max - 0.6) / 0.4;
        if (heat > 0) {
          ctx.globalCompositeOperation = 'lighter';
          const h = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 0.7);
          h.addColorStop(0, `rgba(255,90,20,${0.6 * heat})`);
          h.addColorStop(1, 'rgba(255,40,0,0)');
          ctx.fillStyle = h;
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.7, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  function drawClouds() {
    ctx.save();
    for (const c of clouds) {
      const a = Math.min(1, c.t / c.max * 2);
      for (let i = 0; i < 5; i++) {
        const ang = c.seed + i * 1.3 + time * 0.7 * (i % 2 ? 1 : -1);
        const x = c.x + Math.cos(ang) * c.r * 0.35, y = c.y + Math.sin(ang) * c.r * 0.35;
        const r = c.r * (0.6 + 0.1 * Math.sin(time * 3 + i));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(120,255,70,${0.22 * a})`);
        g.addColorStop(1, 'rgba(60,160,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawZombie(z) {
    const { x, y, r, st } = z;
    const a = Math.atan2(player.y - y, player.x - x);
    const frozen = st.freeze > 0;
    const wob = frozen || z.shock > 0 ? 0 : Math.sin(z.wob) * 3;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.75, r * 0.95, r * 0.35, 0, 0, TAU); ctx.fill();

    // arms
    ctx.strokeStyle = frozen ? '#7fb8d8' : `hsl(${z.hue},25%,26%)`;
    ctx.lineWidth = r * 0.38;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const ax = x + Math.cos(a + side * 0.75) * r * 0.7, ay = y + Math.sin(a + side * 0.75) * r * 0.7;
      const len = r * 1.25 + wob * side;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(a) * len, ay + Math.sin(a) * len); ctx.stroke();
    }

    // body
    ctx.fillStyle = z.flash > 0 ? '#ffffff' : frozen ? '#a8dcf5' : `hsl(${z.hue},28%,${z.big ? 30 : 36}%)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // eyes
    ctx.fillStyle = frozen ? '#e8f8ff' : '#ff3040';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(a + side * 0.45) * r * 0.55, y + Math.sin(a + side * 0.45) * r * 0.55, r * 0.14, 0, TAU);
      ctx.fill();
    }

    // status overlays
    if (st.frost.t > 0 && !frozen) {
      ctx.fillStyle = `rgba(130,210,255,${0.2 + 0.05 * st.frost.n})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    if (st.poison.t > 0) {
      ctx.strokeStyle = `rgba(125,255,74,${0.4 + 0.06 * st.poison.n})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(90,220,40,${0.08 + 0.03 * st.poison.n})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    if (st.bleed.t > 0) {
      ctx.fillStyle = 'rgba(200,0,20,0.8)';
      for (let i = 0; i < st.bleed.n; i++) {
        const ang = i * 1.3 + 0.5;
        ctx.beginPath(); ctx.arc(x + Math.cos(ang) * r * 0.5, y + Math.sin(ang) * r * 0.5, 2, 0, TAU); ctx.fill();
      }
    }
    if (st.burn.t > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.6);
      g.addColorStop(0, `rgba(255,120,20,${0.35 + 0.15 * Math.random()})`);
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (frozen) {
      const s = r * 1.3;
      ctx.fillStyle = 'rgba(190,235,255,0.45)';
      ctx.strokeStyle = 'rgba(235,250,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * 0.6); ctx.lineTo(x - s * 0.4, y - s * 1.1); ctx.lineTo(x + s * 0.8, y - s * 0.9);
      ctx.lineTo(x + s * 1.05, y + s * 0.3); ctx.lineTo(x + s * 0.4, y + s); ctx.lineTo(x - s * 0.9, y + s * 0.8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.7); ctx.lineTo(x - s * 0.1, y - s * 0.2); ctx.stroke();
    }
    if (z.shock > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#9ff6ff';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a0 = rand(0, TAU);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a0) * r * 0.3, y + Math.sin(a0) * r * 0.3);
        ctx.lineTo(x + Math.cos(a0 + 0.4) * r * 0.9 + rand(-3, 3), y + Math.sin(a0 + 0.4) * r * 0.9 + rand(-3, 3));
        ctx.lineTo(x + Math.cos(a0) * r * 1.4, y + Math.sin(a0) * r * 1.4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // HP bar
    if (z.hp < z.maxHp) {
      const w = r * 2, h = 3, bx = x - r, by = y - r - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
      ctx.fillStyle = z.st.poison.t > 0 ? '#7dff4a' : '#ff4d5e';
      ctx.fillRect(bx, by, w * Math.max(0, z.hp / z.maxHp), h);
    }
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of bullets) {
      ctx.strokeStyle = 'rgba(255,220,140,0.6)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const { x, y, r } = player;
    ctx.save();
    if (S.lifesteal.on) {
      ctx.globalCompositeOperation = 'lighter';
      const pr = r * (2 + 0.2 * Math.sin(time * 4));
      const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, pr);
      g.addColorStop(0, 'rgba(150,70,255,0.25)');
      g.addColorStop(1, 'rgba(150,70,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fill();
    }
    if (player.healGlow > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4);
      g.addColorStop(0, `rgba(80,255,140,${player.healGlow * 0.8})`);
      g.addColorStop(1, 'rgba(80,255,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r, r * 0.35, 0, 0, TAU); ctx.fill();

    // gun
    ctx.strokeStyle = '#cfd8e6';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(player.face) * (r + 10), y + Math.sin(player.face) * (r + 10));
    ctx.stroke();

    const g = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, r);
    g.addColorStop(0, '#f0f7ff');
    g.addColorStop(1, player.hurt > 0 ? '#ff5d6c' : '#3f7fe8');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = settings.god ? '#ffd54a' : '#cfe3ff';
    ctx.lineWidth = settings.god ? 3 : 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      ctx.globalAlpha = a;
      switch (p.kind) {
        case 'dot':
        case 'orbit':
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.3, p.size * a), 0, TAU); ctx.fill();
          break;
        case 'soul': {
          ctx.globalAlpha = 1;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.35, p.color);
          g.addColorStop(1, 'rgba(120,40,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, TAU); ctx.fill();
          break;
        }
        case 'spark':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
          break;
        case 'flame':
          ctx.fillStyle = a > 0.7 ? '#fff0a0' : a > 0.4 ? '#ffa21f' : '#e0401a';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.8), 0, TAU); ctx.fill();
          break;
        case 'smoke':
          ctx.globalAlpha = a * 0.35;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - a), 0, TAU); ctx.fill();
          break;
        case 'drop':
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 1.3, 0, 0, TAU); ctx.fill();
          break;
        case 'bubble':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.4), 0, TAU); ctx.stroke();
          break;
        case 'shard':
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 1.6); ctx.lineTo(p.size * 0.6, 0); ctx.lineTo(0, p.size * 1.6); ctx.lineTo(-p.size * 0.6, 0);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        case 'rock':
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          break;
        case 'star':
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          starPath(0, 0, p.size * 1.8, p.size * 0.5);
          ctx.fill();
          ctx.restore();
          break;
        case 'plus':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size, p.y); ctx.lineTo(p.x + p.size, p.y);
          ctx.moveTo(p.x, p.y - p.size); ctx.lineTo(p.x, p.y + p.size);
          ctx.stroke();
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.5, p.size * a);
          ctx.beginPath(); ctx.arc(p.x, p.y, lerp(p.r0, p.r1, easeOut(1 - a)), 0, TAU); ctx.stroke();
          break;
      }
    }
    ctx.restore();
  }

  function drawArcs() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    for (const arc of arcs) {
      const a = arc.life / arc.max;
      const pts = jagged(arc.ax, arc.ay, arc.bx, arc.by, 9, 12);
      const passes = [[8, `rgba(60,180,255,${0.25 * a})`], [3, `rgba(110,240,255,${0.8 * a})`], [1.2, `rgba(255,255,255,${a})`]];
      for (const [lw, col] of passes) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
      // small fork
      const mid = pts[(pts.length / 2) | 0];
      const fork = jagged(mid[0], mid[1], mid[0] + rand(-30, 30), mid[1] + rand(-30, 30), 4, 6);
      ctx.strokeStyle = `rgba(150,245,255,${0.6 * a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      fork.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
    ctx.restore();
  }

  function jagged(x1, y1, x2, y2, segs, amp) {
    const pts = [[x1, y1]];
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    for (let i = 1; i < segs; i++) {
      const t = i / segs, o = rand(-amp, amp);
      pts.push([x1 + dx * t + nx * o, y1 + dy * t + ny * o]);
    }
    pts.push([x2, y2]);
    return pts;
  }

  function drawTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
      ctx.font = `bold ${t.size}px Arial`;
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.restore();
  }

  // =================== UI ===================
  const overlay = document.getElementById('overlay');
  const hpFill = document.getElementById('hpFill');
  const hpText = document.getElementById('hpText');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const zEl = document.getElementById('zcount');
  const btnAuto = document.getElementById('btnAuto');
  const btnGod = document.getElementById('btnGod');
  const btnPause = document.getElementById('btnPause');
  const buttons = {};

  function buildSkillbar() {
    for (const s of SKILLS) {
      const b = document.createElement('button');
      b.className = `skill ${s.type}` + (s.type === 'passive' && s.on ? ' on' : '');
      b.style.setProperty('--c', s.color);
      b.title = `${s.name} (${s.th}) — ${s.desc}`;
      b.innerHTML = `<span class="key">${s.key || ''}</span><span class="icon">${s.icon}</span>` +
        `<span class="name">${s.name}</span><span class="th">${s.th}</span>` +
        (s.type === 'active' ? '<span class="cd"></span><span class="cdText"></span>' : '');
      b.addEventListener('click', () => {
        if (s.type === 'passive') { s.on = !s.on; b.classList.toggle('on', s.on); }
        else castSkill(s.id, false);
        b.blur();
      });
      document.getElementById(s.type === 'passive' ? 'passives' : 'actives').appendChild(b);
      buttons[s.id] = b;
    }
  }

  function updateUI() {
    for (const s of SKILLS) {
      if (s.type !== 'active') continue;
      const b = buttons[s.id];
      b.style.setProperty('--p', s.t / s.cd);
      b.classList.toggle('ready', s.t <= 0);
      const txt = s.t > 0 ? s.t.toFixed(1) : '';
      const cdText = b.querySelector('.cdText');
      if (cdText.textContent !== txt) cdText.textContent = txt;
    }
    const hp = Math.max(0, player.hp);
    hpFill.style.width = (hp / player.maxHp * 100) + '%';
    hpText.textContent = `${Math.ceil(hp)} / ${player.maxHp}`;
    scoreEl.textContent = score;
    timeEl.textContent = Math.floor(time);
    zEl.textContent = zombies.length;
  }

  function setAuto(v) { settings.autoCast = v; btnAuto.textContent = `Auto-cast: ${v ? 'ON' : 'OFF'} (T)`; btnAuto.classList.toggle('on', v); }
  function setGod(v) { settings.god = v; btnGod.textContent = `God mode: ${v ? 'ON' : 'OFF'} (G)`; btnGod.classList.toggle('on', v); }
  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    btnPause.textContent = paused ? 'Resume (P)' : 'Pause (P)';
    btnPause.classList.toggle('on', paused);
  }

  function endGame() {
    gameOver = true;
    document.getElementById('ovTitle').textContent = 'GAME OVER';
    document.getElementById('ovText').textContent = `รอดได้ ${Math.floor(time)} วินาที · ฆ่าซอมบี้ ${score} ตัว`;
    overlay.classList.remove('hidden');
  }

  btnAuto.addEventListener('click', () => { setAuto(!settings.autoCast); btnAuto.blur(); });
  btnGod.addEventListener('click', () => { setGod(!settings.god); btnGod.blur(); });
  btnPause.addEventListener('click', () => { togglePause(); btnPause.blur(); });
  document.getElementById('spawn').addEventListener('input', e => { settings.spawnRate = parseFloat(e.target.value); });
  document.getElementById('btnRestart').addEventListener('click', reset);

  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  window.addEventListener('keydown', e => {
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); return; }
    const digit = /^(Digit|Numpad)([1-6])$/.exec(e.code);
    if (digit) {
      const s = SKILLS.filter(k => k.type === 'active')[+digit[2] - 1];
      if (s) castSkill(s.id, false);
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Space') { togglePause(); e.preventDefault(); }
    else if (e.code === 'KeyR') reset();
    else if (e.code === 'KeyG') setGod(!settings.god);
    else if (e.code === 'KeyT') setAuto(!settings.autoCast);
  });
  window.addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  canvas.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; });
  canvas.addEventListener('pointerleave', () => { mouse.inside = false; mouse.down = false; });
  canvas.addEventListener('pointerdown', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
    mouse.down = true;
    mouse.touch = e.pointerType !== 'mouse';
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  // =================== LOOP ===================
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused && !gameOver) update(dt);
    draw();
    updateUI();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  buildSkillbar();
  reset();
  requestAnimationFrame(loop);

  // exposed for debugging / testing in the console
  window.zombieSkills = { castSkill, settings, SKILLS, get zombies() { return zombies; } };
})();
