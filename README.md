# Sushi Dash — a horizontal pixel-art platformer

Run right through the level as a **chef**, collect sushi ingredients, dodge the
**pufferfish**, beat the **timer**, then **assemble the sushi** in the
end-of-level minigame.

## How to run

Open `index.html` in Google Chrome using Live Server (or any static file
server — the game needs no build step and loads p5.js from a CDN).

## How to play

1. **Run right** through the scrolling level.
2. **Collect ingredients** (rice, salmon, tuna, avocado, shrimp, egg) — they
   glow so you can spot them.
3. **Avoid the pufferfish!** They are spiky, pulse with a red **DANGER** ring and
   a floating **!**. Touching one costs a heart and knocks you back. Lose all
   three hearts and it's game over.
4. **Beat the timer** shown at the top — if it hits zero, game over.
5. **Reach the GOAL gate** at the far right to finish the run.
6. **Assemble the sushi** — click the ingredients in the recipe order (bottom to
   top) to build the finished piece and win.

**Controls**

- Move left/right: `←` `→` or `A` / `D`
- Jump: `↑`, `W`, or `Space`
- Start / restart: `Enter` (or `Space` on the title screen)
- Assembly minigame: click the ingredient buttons in the recipe order

## Assets

Most art is **generated procedurally in code** in a pixel-art style:

- The **chef** is drawn into a runtime-built **sprite sheet** (idle / 4-frame
  run / jump / hurt) in `buildChefSheet()` and animated frame-by-frame.
- Pufferfish, ingredients, platforms and HUD are all drawn as pixel art each
  frame.
- The scene **background** uses `assets/images/background.jpg` (cover-fit to the
  canvas), with the parallax clouds still drawn procedurally on top.

| File | Source |
|------|--------|
| `assets/images/background.jpg` | Pinterest — João [1] |

## References

[1] João. [n. d.]. [Untitled pin]. Retrieved July 22, 2026 from https://pin.it/aphrBSz0j
