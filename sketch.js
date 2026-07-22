// ============================================================
// SUSHI DASH — a horizontal pixel-art platformer
// ------------------------------------------------------------
// Run right through the level as a chef, collect sushi
// ingredients, AVOID the pufferfish, beat the timer, then
// assemble the sushi in the end-of-level minigame.
//
// All art is generated procedurally in a pixel-art style.
// The chef is drawn into a runtime-built SPRITE SHEET
// (idle / run x4 / jump) and animated frame-by-frame.
// ============================================================

// ------------------------------------------------------------
// CANVAS / WORLD
// ------------------------------------------------------------
const VIEW_W = 900;
const VIEW_H = 500;
const WORLD_W = 4200; // level is much wider than the view — you run through it
const GRAVITY = 0.7;

// Game states drive what draw() shows and updates.
const STATE = { PLAY: "play", ASSEMBLE: "assemble", WIN: "win", OVER: "over" };
let state = STATE.PLAY;

let camX = 0; // camera scroll offset

// ------------------------------------------------------------
// TIMER
// ------------------------------------------------------------
const TIME_LIMIT = 75; // seconds
let timeStartMs = 0;
let timeLeft = TIME_LIMIT;

// ------------------------------------------------------------
// PIXEL-ART PALETTE (shared colour keys)
// ------------------------------------------------------------
const COL = {
  hat: "#ffffff",
  hatShade: "#d8dde6",
  skin: "#f2c49b",
  skinShade: "#d99f76",
  eye: "#2b2130",
  jacket: "#f4f6fb",
  jacketShade: "#c9d0dc",
  scarf: "#e5484d",
  scarfShade: "#b7373b",
  pants: "#2f3a56",
  boots: "#20263a",
  outline: "#20232e",
};

// ------------------------------------------------------------
// CHEF SPRITE SHEET
// Built once in setup() into an off-screen p5.Graphics buffer.
// 7 frames laid out horizontally: idle, run0..run3, jump, hurt.
// Each cell is CELL_W x CELL_H "art pixels"; we scale it up on
// draw with noSmooth() so it stays crisp and blocky.
// ------------------------------------------------------------
const CELL_W = 22;
const CELL_H = 26;
const FRAMES = { IDLE: 0, RUN0: 1, RUN1: 2, RUN2: 3, RUN3: 4, JUMP: 5, HURT: 6 };
const FRAME_COUNT = 7;
let chefSheet;

// ------------------------------------------------------------
// PLAYER
// ------------------------------------------------------------
let player = {
  x: 120,
  y: 0,
  w: 34,
  h: 44,
  vx: 0,
  vy: 0,
  speed: 0.8,
  maxSpeed: 5.6,
  jumpForce: -13.5,
  friction: 0.86, // higher = more glide; 0.86 keeps movement smooth but stops fairly quickly
  onGround: false,
  facing: 1, // 1 = right, -1 = left
  animT: 0,
  hp: 3,
  invuln: 0, // frames of invulnerability after a hit
};

// ------------------------------------------------------------
// LEVEL DATA — platforms across the whole world.
// The player runs to the DOOR at the far right to finish.
// ------------------------------------------------------------
let platforms = [];
let ingredients = [];
let puffers = [];
const door = { x: WORLD_W - 140, y: 300, w: 70, h: 110 };

// Ingredient types the player can collect. `key` is the number
// key used in the assembly minigame.
const ING_TYPES = ["rice", "salmon", "tuna", "avocado", "shrimp", "egg"];
let collected = { rice: 0, salmon: 0, tuna: 0, avocado: 0, shrimp: 0, egg: 0 };
let totalIngredients = 0;

// Parallax decoration offsets (drawn procedurally)
let cloudSeed = [];

// Background image (loaded from assets/). Clouds are still drawn on top.
let bgImage;

// ============================================================
// preload() — runs before setup(); guarantees the image is ready
// ============================================================
function preload() {
  bgImage = loadImage("assets/images/background.jpg");
}

// ============================================================
// setup()
// ============================================================
function setup() {
  createCanvas(VIEW_W, VIEW_H);
  noSmooth();
  buildChefSheet();
  for (let i = 0; i < 8; i++) {
    cloudSeed.push({ x: i * 560 + 80, y: 40 + (i % 3) * 45, s: 0.4 + (i % 3) * 0.25 });
  }
  startGame(); // no title screen — drop straight into play
}

// ============================================================
// buildLevel() — lay out ground, platforms, ingredients, puffers
// ============================================================
function buildLevel() {
  platforms = [];
  ingredients = [];
  puffers = [];

  const groundY = 410;
  const groundH = 90;

  // Ground segments with gaps you must jump over.
  const groundSegs = [
    [0, 640], [720, 520], [1320, 460], [1880, 520], [2500, 420],
    [3000, 560], [3660, WORLD_W - 3660],
  ];
  for (const [gx, gw] of groundSegs) {
    platforms.push({ x: gx, y: groundY, w: gw, h: groundH, type: "ground" });
  }

  // Floating platforms (pixel sushi-mat style).
  const floats = [
    [260, 320, 120], [430, 250, 110], [860, 300, 120], [1050, 220, 120],
    [1420, 300, 130], [1600, 210, 110], [2000, 300, 120], [2200, 230, 130],
    [2560, 310, 120], [2760, 240, 120], [3120, 300, 130], [3320, 220, 120],
    [3520, 300, 120],
  ];
  for (const [fx, fy, fw] of floats) {
    platforms.push({ x: fx, y: fy, w: fw, h: 22, type: "mat" });
  }

  // Ingredients — scatter a mix across ground and platforms.
  const ingSpots = [
    [300, 285, "rice"], [470, 215, "salmon"], [560, 375, "rice"],
    [900, 265, "tuna"], [1090, 185, "avocado"], [1200, 375, "shrimp"],
    [1470, 265, "egg"], [1650, 175, "salmon"], [1780, 375, "rice"],
    [2050, 265, "tuna"], [2250, 195, "avocado"], [2400, 375, "shrimp"],
    [2610, 275, "egg"], [2810, 205, "salmon"], [2950, 375, "rice"],
    [3170, 265, "tuna"], [3370, 185, "avocado"], [3560, 265, "shrimp"],
    [3760, 375, "egg"], [3950, 375, "salmon"],
  ];
  for (const [ix, iy, it] of ingSpots) {
    ingredients.push({ x: ix, y: iy, type: it, got: false, bob: random(TWO_PI) });
  }
  totalIngredients = ingredients.length;

  // Pufferfish — obstacles. Placed in the player's path.
  const puffSpots = [
    [700, 360], [1310, 360], [1560, 320], [2150, 360],
    [2740, 300], [3100, 360], [3480, 320], [3900, 360],
  ];
  for (const [px, py] of puffSpots) {
    puffers.push({ x: px, y: py, baseY: py, phase: random(TWO_PI) });
  }
}

// ============================================================
// buildChefSheet() — draw the chef sprite sheet into a buffer
// ============================================================
function buildChefSheet() {
  chefSheet = createGraphics(CELL_W * FRAME_COUNT, CELL_H);
  chefSheet.noSmooth();
  chefSheet.noStroke();

  // Pose params per frame: leg positions + body bounce + arm swing.
  // legL/legR are horizontal foot offsets; bob shifts the whole body.
  const poses = [
    { name: "idle", bob: 0, legL: 0, legR: 0, arm: 0 },
    { name: "run0", bob: -1, legL: 3, legR: -3, arm: 3 },
    { name: "run1", bob: 0, legL: 0, legR: 0, arm: 0 },
    { name: "run2", bob: -1, legL: -3, legR: 3, arm: -3 },
    { name: "run3", bob: 0, legL: 0, legR: 0, arm: 0 },
    { name: "jump", bob: -2, legL: -2, legR: 4, arm: -4, jumping: true },
    { name: "hurt", bob: 1, legL: 2, legR: 2, arm: 4, hurt: true },
  ];

  for (let f = 0; f < poses.length; f++) {
    drawChefFrame(chefSheet, f * CELL_W, poses[f]);
  }
}

// Helper: fill a block of "art pixels" in a buffer.
function px(g, x, y, w, h, c) {
  g.fill(c);
  g.rect(x, y, w, h);
}

// Draw a single chef frame at cell origin ox.
function drawChefFrame(g, ox, pose) {
  const cx = ox + 11; // horizontal centre of the cell
  const b = pose.bob;

  // ---- Legs (draw first, behind body) ----
  const legY = 20 + b;
  if (pose.hurt) {
    px(g, cx - 6, legY, 4, 5, COL.boots);
    px(g, cx + 2, legY, 4, 5, COL.boots);
  } else {
    px(g, cx - 5 + pose.legL, legY, 4, 5, COL.pants);
    px(g, cx - 5 + pose.legL, legY + 4, 4, 2, COL.boots);
    px(g, cx + 1 + pose.legR, legY, 4, 5, COL.pants);
    px(g, cx + 1 + pose.legR, legY + 4, 4, 2, COL.boots);
  }

  // ---- Jacket / body ----
  px(g, cx - 7, 12 + b, 14, 9, COL.jacket);
  px(g, cx - 7, 18 + b, 14, 3, COL.jacketShade); // lower shade
  // button line
  px(g, cx - 1, 13 + b, 2, 7, COL.jacketShade);

  // ---- Arms (swing) ----
  px(g, cx - 9, 12 + b + Math.max(0, pose.arm), 3, 7, COL.jacket);
  px(g, cx + 6, 12 + b - Math.min(0, pose.arm), 3, 7, COL.jacket);
  // hands
  px(g, cx - 9, 18 + b + Math.max(0, pose.arm), 3, 2, COL.skin);
  px(g, cx + 6, 17 + b - Math.min(0, pose.arm), 3, 2, COL.skin);

  // ---- Scarf ----
  px(g, cx - 6, 11 + b, 12, 2, COL.scarf);
  px(g, cx - 2, 12 + b, 3, 2, COL.scarfShade);

  // ---- Head ----
  px(g, cx - 5, 5 + b, 10, 7, COL.skin);
  px(g, cx - 5, 10 + b, 10, 2, COL.skinShade); // chin shade
  // eyes (look toward facing = right by default)
  px(g, cx - 3, 7 + b, 2, 2, COL.eye);
  px(g, cx + 2, 7 + b, 2, 2, COL.eye);
  // cheeks
  px(g, cx - 4, 9 + b, 1, 1, COL.scarf);
  px(g, cx + 3, 9 + b, 1, 1, COL.scarf);

  // ---- Chef hat ----
  px(g, cx - 6, 2 + b, 12, 4, COL.hat);   // puffy top
  px(g, cx - 4, 0 + b, 8, 3, COL.hat);
  px(g, cx - 6, 5 + b, 12, 2, COL.hatShade); // hat band
  px(g, cx - 5, 1 + b, 2, 2, COL.hatShade); // puff shading
  px(g, cx + 3, 1 + b, 2, 2, COL.hatShade);
}

// ============================================================
// draw() — main loop, dispatches on state
// ============================================================
function draw() {
  switch (state) {
    case STATE.PLAY: updatePlay(); drawPlay(); break;
    case STATE.ASSEMBLE: drawAssemble(); break;
    case STATE.WIN: drawWin(); break;
    case STATE.OVER: drawOver(); break;
  }
}

// ============================================================
// PLAY STATE
// ============================================================
function updatePlay() {
  // ---- Timer ----
  timeLeft = TIME_LIMIT - (millis() - timeStartMs) / 1000;
  if (timeLeft <= 0) {
    timeLeft = 0;
    state = STATE.OVER;
    return;
  }

  handleInput();
  applyPhysics();
  resolvePlatformCollisions();
  checkIngredients();
  checkPuffers();
  checkDoor();

  // ---- Camera follows player, clamped to world ----
  camX = constrain(player.x - VIEW_W * 0.35, 0, WORLD_W - VIEW_W);

  if (player.invuln > 0) player.invuln--;
  player.animT += 1;
}

function handleInput() {
  let moving = false;
  if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) { player.vx -= player.speed; player.facing = -1; moving = true; }
  if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { player.vx += player.speed; player.facing = 1; moving = true; }
  player.vx = constrain(player.vx, -player.maxSpeed, player.maxSpeed);
  if (!moving) player.vx *= player.friction;

  if ((keyIsDown(UP_ARROW) || keyIsDown(87) || keyIsDown(32)) && player.onGround) {
    player.vy = player.jumpForce;
    player.onGround = false;
  }
}

function applyPhysics() {
  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  player.x = constrain(player.x, player.w / 2, WORLD_W - player.w / 2);

  // Fell into a gap → lose a heart and respawn at a safe spot.
  if (player.y > VIEW_H + 120) {
    damagePlayer(true);
  }
  player.onGround = false;
}

function resolvePlatformCollisions() {
  const pL = player.x - player.w / 2;
  const pR = player.x + player.w / 2;
  const pB = player.y + player.h / 2;

  for (const p of platforms) {
    const overlapH = pR > p.x && pL < p.x + p.w;
    const landing = player.vy >= 0 && pB >= p.y && pB <= p.y + 24;
    if (overlapH && landing) {
      player.y = p.y - player.h / 2;
      player.vy = 0;
      player.onGround = true;
    }
  }
}

function checkIngredients() {
  for (const ing of ingredients) {
    if (ing.got) continue;
    if (dist(player.x, player.y, ing.x, ing.y) < 30) {
      ing.got = true;
      collected[ing.type]++;
    }
  }
}

function checkPuffers() {
  if (player.invuln > 0) return;
  for (const pf of puffers) {
    const py = pf.baseY + sin(frameCount * 0.05 + pf.phase) * 10;
    if (dist(player.x, player.y, pf.x, py) < 34) {
      damagePlayer(false);
      // knock the player back away from the puffer
      player.vx = player.x < pf.x ? -7 : 7;
      player.vy = -7;
      return;
    }
  }
}

function damagePlayer(fell) {
  player.hp--;
  player.invuln = 70;
  if (player.hp <= 0) {
    player.hp = 0;
    state = STATE.OVER;
    return;
  }
  if (fell) {
    // respawn near a safe ground spot behind current position
    player.x = max(120, player.x - 120);
    player.y = 200;
    player.vx = 0;
    player.vy = 0;
  }
}

function checkDoor() {
  // The GOAL only opens once EVERY ingredient has been collected.
  let got = 0;
  for (const t of ING_TYPES) got += collected[t];
  if (got < totalIngredients) return;

  if (player.x + player.w / 2 > door.x && player.x - player.w / 2 < door.x + door.w) {
    state = STATE.ASSEMBLE;
    setupAssemble();
  }
}

// ------------------------------------------------------------
// drawPlay() — world + HUD
// ------------------------------------------------------------
function drawPlay() {
  drawSkyBackground();

  push();
  translate(-camX, 0);
  drawFarDecor();
  for (const p of platforms) drawPlatform(p);
  for (const ing of ingredients) drawIngredient(ing);
  for (const pf of puffers) drawPuffer(pf);
  drawDoor();
  drawPlayer();
  pop();

  drawHUD();
}

function drawSkyBackground() {
  if (bgImage && bgImage.width > 1) {
    // cover-fit the background image to the canvas (no distortion)
    const s = max(VIEW_W / bgImage.width, VIEW_H / bgImage.height);
    const w = bgImage.width * s;
    const h = bgImage.height * s;
    push();
    imageMode(CORNER);
    image(bgImage, (VIEW_W - w) / 2, (VIEW_H - h) / 2, w, h);
    pop();
  } else {
    // fallback: vertical gradient sky
    for (let y = 0; y < VIEW_H; y += 4) {
      const t = y / VIEW_H;
      fill(lerpColor(color("#2a4a7f"), color("#79b7d6"), t));
      noStroke();
      rect(0, y, VIEW_W, 4);
    }
  }
}

function drawFarDecor() {
  // parallax clouds (slower than camera)
  noStroke();
  for (const c of cloudSeed) {
    const cxp = c.x - camX * c.s;
    fill(255, 255, 255, 200);
    rect(cxp, c.y, 60, 14);
    rect(cxp + 12, c.y - 8, 40, 12);
    rect(cxp + 22, c.y - 14, 24, 10);
  }
}

function drawPlatform(p) {
  noStroke();
  if (p.type === "ground") {
    // rice-block ground
    px(this, p.x, p.y, p.w, p.h, "#f4efe3");
    px(this, p.x, p.y, p.w, 6, "#ffffff");
    // nori edge
    px(this, p.x, p.y + p.h - 14, p.w, 14, "#2c3b2f");
    // rice speckles
    fill("#dcd3bf");
    for (let sx = p.x + 6; sx < p.x + p.w - 6; sx += 16) {
      rect(sx, p.y + 14, 6, 4);
      rect(sx + 8, p.y + 26, 5, 4);
    }
  } else {
    // sushi-mat floating platform
    px(this, p.x, p.y, p.w, p.h, "#caa15a");
    for (let sx = p.x; sx < p.x + p.w; sx += 8) {
      px(this, sx, p.y, 2, p.h, "#a9843f");
    }
    px(this, p.x, p.y, p.w, 3, "#e6c079");
  }
}

// ------------------------------------------------------------
// Ingredients (pixel-art nigiri / pieces)
// ------------------------------------------------------------
function drawIngredient(ing) {
  if (ing.got) return;
  const bob = sin(frameCount * 0.06 + ing.bob) * 4;
  const x = ing.x;
  const y = ing.y + bob;

  push();
  translate(x, y);
  noStroke();

  // sparkle glow
  fill(255, 255, 180, 60);
  ellipse(0, 0, 40, 40);

  drawIngredientIcon(ing.type, 0, 0, 1);
  pop();
}

// Reusable icon drawer (also used in the minigame).
function drawIngredientIcon(type, x, y, s) {
  push();
  translate(x, y);
  scale(s);
  noStroke();
  const rice = "#f6f2e8";
  const riceShade = "#ddd5c2";

  if (type === "rice") {
    // rice ball / onigiri-ish
    px(this, -10, -6, 20, 14, rice);
    px(this, -8, -10, 16, 6, rice);
    px(this, -10, 4, 20, 4, riceShade);
    px(this, -5, 0, 10, 8, "#2c3b2f"); // nori
  } else {
    // nigiri base (rice pillow) + topping
    px(this, -12, 2, 24, 9, rice);
    px(this, -12, 9, 24, 3, riceShade);
    let top = "#000";
    if (type === "salmon") top = "#ff8a4c";
    if (type === "tuna") top = "#e5484d";
    if (type === "avocado") top = "#7bbf4f";
    if (type === "shrimp") top = "#ffb0a3";
    if (type === "egg") top = "#f4c430";
    px(this, -12, -6, 24, 9, top);
    px(this, -12, -6, 24, 3, "#ffffff44"); // top highlight
    if (type === "salmon" || type === "tuna") {
      // fish stripes — kept inside the topping (x: -12..12) so they don't spill onto the rice
      px(this, -9, -4, 18, 2, "#ffffff77");
      px(this, -7, 0, 14, 2, "#ffffff55");
    }
    if (type === "egg") {
      // nori band around tamago
      px(this, -3, -6, 6, 15, "#2c3b2f");
    }
    if (type === "avocado") {
      px(this, -8, -4, 4, 4, "#a7d98a");
      px(this, 2, -3, 4, 4, "#a7d98a");
    }
    if (type === "shrimp") {
      px(this, -9, -5, 3, 2, "#e5484d");
      px(this, 6, -5, 3, 2, "#e5484d");
    }
  }
  pop();
}

// ------------------------------------------------------------
// PUFFERFISH — the obstacle. Made deliberately OBVIOUS:
// spiky body, pulsing red DANGER ring, and a floating "!".
// ------------------------------------------------------------
function drawPuffer(pf) {
  const y = pf.baseY + sin(frameCount * 0.05 + pf.phase) * 10;
  const pulse = 1 + sin(frameCount * 0.15 + pf.phase) * 0.12;

  push();
  translate(pf.x, y);
  noStroke();

  // red danger halo
  fill(229, 72, 77, 70);
  ellipse(0, 0, 78 * pulse, 78 * pulse);
  fill(229, 72, 77, 40);
  ellipse(0, 0, 96 * pulse, 96 * pulse);

  // spikes
  fill("#c0413f");
  const spikes = 12;
  for (let i = 0; i < spikes; i++) {
    const a = (TWO_PI / spikes) * i + frameCount * 0.01;
    const r1 = 20;
    const r2 = 30 * pulse;
    triangle(
      cos(a - 0.14) * r1, sin(a - 0.14) * r1,
      cos(a + 0.14) * r1, sin(a + 0.14) * r1,
      cos(a) * r2, sin(a) * r2
    );
  }

  // body (blocky pixel sphere)
  fill("#8a5cc4");
  ellipse(0, 0, 42, 40);
  fill("#a678db");
  ellipse(-5, -5, 20, 16);
  // belly
  fill("#efe7fb");
  ellipse(0, 8, 24, 16);

  // grumpy eyes
  fill("#ffffff");
  ellipse(-8, -4, 12, 12);
  ellipse(8, -4, 12, 12);
  fill("#20232e");
  ellipse(-8, -3, 6, 6);
  ellipse(8, -3, 6, 6);
  // angry brows
  fill("#3a2a4f");
  rect(-13, -12, 10, 3);
  rect(3, -12, 10, 3);
  // frown
  rect(-5, 12, 10, 2);

  // floating "!" warning bubble
  const wob = sin(frameCount * 0.12 + pf.phase) * 3;
  fill("#ffd23f");
  triangle(-8, -34 + wob, 8, -34 + wob, 0, -48 + wob);
  fill("#20232e");
  rect(-2, -46 + wob, 4, 7);
  rect(-2, -38 + wob, 4, 3);
  pop();
}

function drawDoor() {
  let got = 0;
  for (const t of ING_TYPES) got += collected[t];
  const locked = got < totalIngredients;

  push();
  noStroke();
  // torii-gate style finish marker (greys out while locked)
  fill(locked ? "#7a5a5c" : "#e5484d");
  rect(door.x - 6, door.y, 12, door.h);
  rect(door.x + door.w - 6, door.y, 12, door.h);
  rect(door.x - 18, door.y - 18, door.w + 36, 14);
  rect(door.x - 10, door.y + 4, door.w + 20, 10);
  fill("#20232e");
  rect(door.x - 20, door.y - 20, door.w + 40, 4);

  // GOAL banner
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  fill("#20232e");
  rect(door.x - 6, door.y - 46, door.w + 12, 22, 4);
  textSize(16);
  fill(locked ? "#8a8f9e" : "#ffd23f");
  text(locked ? "GOAL 🔒" : "GOAL", door.x + door.w / 2, door.y - 34);

  // While locked, remind the player. Size the box to the text so it never overflows.
  if (locked) {
    const msg = "Collect all ingredients!";
    textSize(12);
    textStyle(BOLD);
    const bw = textWidth(msg) + 20;
    const cxg = door.x + door.w / 2;
    fill("#20232e");
    rect(cxg - bw / 2, door.y - 76, bw, 20, 4);
    fill("#e5484d");
    text(msg, cxg, door.y - 66);
  }
  textStyle(NORMAL);
  pop();
}

// ------------------------------------------------------------
// drawPlayer() — blit the animated chef sprite from the sheet
// ------------------------------------------------------------
function drawPlayer() {
  // pick frame
  let frame = FRAMES.IDLE;
  if (!player.onGround) {
    frame = FRAMES.JUMP;
  } else if (abs(player.vx) > 0.5) {
    const cycle = floor(player.animT / 6) % 4;
    frame = [FRAMES.RUN0, FRAMES.RUN1, FRAMES.RUN2, FRAMES.RUN3][cycle];
  }
  if (player.invuln > 0 && floor(player.invuln / 4) % 2 === 0) {
    frame = FRAMES.HURT;
  }

  // flicker while invulnerable
  if (player.invuln > 0 && floor(frameCount / 4) % 2 === 0) return;

  push();
  imageMode(CENTER);
  translate(player.x, player.y);
  scale(player.facing, 1); // flip when facing left
  const dw = CELL_W * 2.0;
  const dh = CELL_H * 2.0;
  image(chefSheet, 0, 2, dw, dh, frame * CELL_W, 0, CELL_W, CELL_H);
  pop();
}

// ------------------------------------------------------------
// HUD — timer, hearts, ingredient tally
// ------------------------------------------------------------
function drawHUD() {
  noStroke();
  // top bar — two aligned columns (timer/hearts, tally/controls) with the
  // objective centred between them.
  fill(32, 35, 46, 220);
  rect(0, 0, VIEW_W, 54);

  let got = 0;
  for (const t of ING_TYPES) got += collected[t];
  const allCollected = got >= totalIngredients;

  const topY = 18;    // top line of each column
  const botY = 38;    // bottom line of each column
  const midY = 27;    // vertical centre of the bar (for the objective)

  // ---- Left column: timer (top) over hearts (bottom) ----
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  textSize(18);
  fill(timeLeft < 15 ? (frameCount % 20 < 10 ? "#e5484d" : "#ffd23f") : "#ffffff");
  text("⏱ " + nf(max(0, timeLeft), 2, 1) + "s", 16, topY);
  for (let i = 0; i < 3; i++) {
    drawHeart(24 + i * 24, botY, i < player.hp);
  }

  // ---- Right column: ingredient tally (top) over controls (bottom) ----
  textAlign(RIGHT, CENTER);
  textSize(17);
  fill(allCollected ? "#7bbf4f" : "#ffffff");
  text((allCollected ? "✓ " : "") + "Ingredients: " + got + " / " + totalIngredients, VIEW_W - 16, topY);
  textStyle(NORMAL);
  textSize(12);
  fill("#aeb6c6");
  text("Move ← →    Jump ↑ / Space", VIEW_W - 16, botY);

  // ---- Centre: objective, aligned to the bar's vertical centre ----
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(14);
  fill(allCollected ? "#7bbf4f" : "#ffd23f");
  const objective = allCollected
    ? "All ingredients collected — reach the GOAL!"
    : "Collect ALL " + totalIngredients + " ingredients, then reach the GOAL";
  text(objective, VIEW_W / 2, midY);
  textStyle(NORMAL);
}

function drawHeart(x, y, full) {
  push();
  translate(x, y);
  noStroke();
  fill(full ? "#e5484d" : "#5a5f70");
  // blocky pixel heart
  px(this, -7, -5, 4, 4, full ? "#e5484d" : "#5a5f70");
  px(this, 3, -5, 4, 4, full ? "#e5484d" : "#5a5f70");
  px(this, -8, -1, 16, 4, full ? "#e5484d" : "#5a5f70");
  px(this, -6, 3, 12, 3, full ? "#e5484d" : "#5a5f70");
  px(this, -3, 6, 6, 3, full ? "#e5484d" : "#5a5f70");
  pop();
}

// ============================================================
// ASSEMBLE MINIGAME
// Build the nigiri by clicking ingredient buttons in the
// correct bottom-to-top order shown in the recipe.
// ============================================================
let recipe = [];        // ordered list of ingredient types to place
let stackIndex = 0;     // how many placed correctly
let buttons = [];       // clickable ingredient buttons
let shake = 0;          // wrong-click feedback

function setupAssemble() {
  // Recipe order (bottom to top). Uses core sushi build order.
  recipe = ["rice", "avocado", "shrimp", "salmon", "tuna", "egg"];
  stackIndex = 0;
  shake = 0;

  // Build a shuffled row of buttons (one per recipe type).
  const types = shuffle([...recipe], true);
  buttons = [];
  const bw = 110, gap = 20;
  const totalW = types.length * bw + (types.length - 1) * gap;
  let bx = VIEW_W / 2 - totalW / 2;
  for (const t of types) {
    buttons.push({ type: t, x: bx, y: 410, w: bw, h: 64 });
    bx += bw + gap;
  }
}

function drawAssemble() {
  // ---- Timer keeps ticking through the minigame ----
  timeLeft = TIME_LIMIT - (millis() - timeStartMs) / 1000;
  if (timeLeft <= 0) {
    timeLeft = 0;
    state = STATE.OVER;
    return;
  }

  // solid background for the assembly stage (not the scene photo)
  background("#243049");
  noStroke();

  // header panel: title + instruction together at the top
  textAlign(CENTER, CENTER);
  fill("#20232e");
  rect(VIEW_W / 2 - 300, 16, 600, 74, 8);
  fill("#ffd23f");
  textStyle(BOLD);
  textSize(25);
  text("ASSEMBLE THE SUSHI!", VIEW_W / 2, 42);
  textStyle(NORMAL);
  textSize(14);
  fill("#cfd6e4");
  text("Click the ingredients in the recipe order (bottom → top)", VIEW_W / 2, 72);

  // timer badge (top-left, clear of the header panel and recipe list)
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  textSize(20);
  fill(timeLeft < 15 ? (frameCount % 20 < 10 ? "#e5484d" : "#ffd23f") : "#ffffff");
  text("⏱ " + nf(max(0, timeLeft), 2, 1) + "s", 16, 30);
  textStyle(NORMAL);

  // ---- Recipe list (left) ----
  fill("#ffffff");
  textAlign(LEFT, CENTER);
  textSize(16);
  text("Recipe (bottom → top):", 60, 110);
  for (let i = 0; i < recipe.length; i++) {
    const ry = 140 + i * 34;
    const done = i < stackIndex;
    fill(done ? "#7bbf4f" : (i === stackIndex ? "#ffd23f" : "#8a8f9e"));
    textAlign(LEFT, CENTER);
    text((done ? "✓ " : (i === stackIndex ? "▶ " : "• ")) + (i + 1) + ". " + recipe[i], 60, ry);
    push();
    translate(230, ry);
    scale(0.7);
    drawIngredientIcon(recipe[i], 0, 0, 1);
    pop();
  }

  // ---- The stack being built (centre) ----
  const baseX = VIEW_W / 2 + 60 + (shake > 0 ? sin(frameCount) * shake : 0);
  const baseY = 340;
  // plate
  fill("#c9d0dc");
  ellipse(baseX, baseY + 26, 200, 30);
  fill("#eef1f6");
  ellipse(baseX, baseY + 22, 200, 26);
  for (let i = 0; i < stackIndex; i++) {
    const sy = baseY - i * 22;
    push();
    translate(baseX, sy);
    scale(1.4);
    drawIngredientIcon(recipe[i], 0, 0, 1);
    pop();
  }
  if (shake > 0) shake--;

  // ---- Buttons ----
  for (const b of buttons) {
    const isNext = b.type === recipe[stackIndex];
    fill(isNext ? "#5a3a3a" : "#20232e");
    rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 8);
    fill(hoverBtn(b) ? "#485070" : "#39415a"); // hover tint
    rect(b.x, b.y, b.w, b.h, 6);
    push();
    translate(b.x + 30, b.y + b.h / 2);
    scale(0.8);
    drawIngredientIcon(b.type, 0, 0, 1);
    pop();
    fill("#ffffff");
    textAlign(LEFT, CENTER);
    textSize(14);
    text(b.type, b.x + 52, b.y + b.h / 2);
  }

  if (stackIndex >= recipe.length) {
    state = STATE.WIN;
  }
}

function hoverBtn(b) {
  return mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h;
}

// ============================================================
// WIN / GAME OVER
// ============================================================
function drawWin() {
  drawSkyBackground();
  noStroke();

  push();
  imageMode(CENTER);
  translate(VIEW_W / 2, 170 + sin(frameCount * 0.06) * 8);
  const s = 5;
  image(chefSheet, 0, 0, CELL_W * s, CELL_H * s, FRAMES.IDLE * CELL_W, 0, CELL_W, CELL_H);
  pop();

  // finished sushi
  push();
  translate(VIEW_W / 2, 300);
  scale(2.2);
  drawIngredientIcon("salmon", 0, 0, 1);
  pop();

  textAlign(CENTER, CENTER);
  fill("#20232e");
  rect(VIEW_W / 2 - 240, 340, 480, 120, 8);
  fill("#7bbf4f");
  textStyle(BOLD);
  textSize(40);
  text("SUSHI COMPLETE! 🍣", VIEW_W / 2, 372);

  let got = 0;
  for (const t of ING_TYPES) got += collected[t];
  textStyle(NORMAL);
  textSize(18);
  fill("#ffffff");
  text("Ingredients collected: " + got + " / " + totalIngredients + "   •   Time left: " + nf(max(0, timeLeft), 2, 1) + "s", VIEW_W / 2, 408);
  fill("#ffd23f");
  text("Press ENTER to play again", VIEW_W / 2, 436);
}

function drawOver() {
  drawSkyBackground();
  noStroke();
  textAlign(CENTER, CENTER);
  fill("#20232e");
  rect(VIEW_W / 2 - 240, 170, 480, 160, 10);
  fill("#e5484d");
  textStyle(BOLD);
  textSize(46);
  const reason = player.hp <= 0 ? "OUCH! The pufferfish got you!" : "TIME'S UP!";
  textSize(38);
  text("GAME OVER", VIEW_W / 2, 210);
  textStyle(NORMAL);
  textSize(18);
  fill("#ffffff");
  text(reason, VIEW_W / 2, 250);
  fill("#ffd23f");
  text("Press ENTER to try again", VIEW_W / 2, 290);
}

// ============================================================
// INPUT — state transitions
// ============================================================
function keyPressed() {
  if ((state === STATE.WIN || state === STATE.OVER) && keyCode === ENTER) {
    startGame();
  }
}

function mousePressed() {
  if (state === STATE.ASSEMBLE) {
    for (const b of buttons) {
      if (hoverBtn(b)) {
        if (b.type === recipe[stackIndex]) {
          stackIndex++;
        } else {
          shake = 6; // wrong order feedback
        }
      }
    }
  }
}

function startGame() {
  // reset everything
  player.x = 120;
  player.y = 200;
  player.vx = 0;
  player.vy = 0;
  player.hp = 3;
  player.invuln = 0;
  player.facing = 1;
  player.animT = 0;
  camX = 0;
  collected = { rice: 0, salmon: 0, tuna: 0, avocado: 0, shrimp: 0, egg: 0 };
  buildLevel();
  timeStartMs = millis();
  timeLeft = TIME_LIMIT;
  state = STATE.PLAY;
}
