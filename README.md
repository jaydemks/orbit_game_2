# ORBIT 2

**Small ball. Big adventure.** A colorful 3D gravity puzzle: roll across walls and ceilings, leap between islands, and unlock portals into other worlds.

### [Play ORBIT 2](https://jaydemks.github.io/orbit_game_2/) · [Play the original ORBIT](https://jaydemks.github.io/orbit_game/)

ORBIT 2 is a separate release with its own saves. The original game stays available unchanged.

![ORBIT 2 menu](docs/screenshots/menu.jpg)

| Neon challenges | A window into another world |
| --- | --- |
| ![Advanced emissive level](docs/screenshots/advanced.jpg) | ![Unlocked portal](docs/screenshots/portal.jpg) |

- **32 levels, four living worlds:** gardens, oceans, volcanic machinery and cosmic islands, with animated flying creatures and structures.
- **Easy or Extreme:** classic precise steps by default, or physical acceleration, inertia, braking and speed-dependent jumps. Slow down to wrap around edges; excessive speed can send you into the void.
- **Ten earnable spheres:** glass, pearl and crystal join fire, ice, plasma and stardust. Fire and ice leave fading surface trails.
- Animated portal absorption, falls and destruction; lava, spikes, gaps, timers and three lives.
- Readable English menus, portrait/landscape touch controls, loading progress, shader warm-up, instanced scenery and adaptive resolution.

| Inferno | Frost |
| --- | --- |
| ![Fire sphere with sparks](docs/screenshots/inferno.jpg) | ![Ice sphere with crystals and surface trails](docs/screenshots/frost.jpg) |

| Control | Easy | Extreme |
| --- | --- | --- |
| W / S or ↑ / ↓ | Step forward / backward | Accelerate / reverse thrust to brake |
| A / D or ← / → | Turn 90° | Steer continuously; momentum persists |
| Space | Jump two blocks | Jump with your current velocity |
| Esc / R | Pause / restart | Pause / restart |

Touch buttons support steering and acceleration together. Difficulty changes apply to the next attempt; records are tracked separately.

## Soundtrack

Add `Track_01.mp3` through `Track_10.mp3` to [`public/music/`](public/music/) and push to `main`. Present tracks shuffle without consecutive repeats and crossfade over five seconds. Missing tracks use a procedural ambient fallback. Audio starts after interaction; the audio toggle controls music and effects. See the [soundtrack notes](public/music/README.md).

## Development

Node.js 22.12+ and WebGL 2 are required.

```sh
npm ci
npm run dev
npm test
npm run test:browser
npm run build
```

Browser tests require Chrome on Windows or `npx playwright install chromium` elsewhere. Tests solve all 32 levels in Easy and cover Extreme inertia, jumps, collisions, 832 surface transitions and a complete input-driven first-level run. The full Extreme campaign has not been automated end to end.

Pushes to this repository's `main` deploy **only ORBIT 2** to GitHub Pages. The original repository is independent. Built with Three.js and Vite; procedural artwork and effects. An original homage to Kula World, not affiliated with its owners. MIT licensed.
