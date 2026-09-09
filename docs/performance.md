# Rendering and loading

The loader appears before the main game bundle downloads. Its first phase is indeterminate; subsequent percentages track completed preparation stages, not downloaded bytes. Level transitions compile materials and warm the full renderer before revealing gameplay. The clock and controls remain frozen during preparation.

Repeated world geometry is instanced across islands. Cubes use at most three material batches; collectible templates are cached and their static parts merged. Tiny collectibles no longer cast individual shadows. Glass remains refractive, using a smaller transmission buffer. Camera math reuses temporary objects to reduce garbage collection.

Balanced mode reduces shadow resolution, cloud count, glass target resolution and postprocessing. Both quality modes adapt pixel ratio after sustained slow frames, with a warm-up and recovery delay to avoid oscillation. Hidden tabs skip rendering and hidden scenery skips animation.

## ORBIT 2

The new renderer retains instancing and preparation from ORBIT. Skin effects use a fixed pool of 360 GPU points (180 on Balanced), 96 smoke sprites (40 on Balanced), 64 shared fragments and 96 instanced surface marks. Flying actors and mechanical scenery are batched; particles never create individual draw calls. The ORBIT 2 browser check measured 85 calls on level 1 with Inferno and 213 on level 24, below the existing 270-call regression limit. These are draw-call measurements, not a promise of a particular frame rate on phones.

The 40-level update measured 242 full-frame draw calls on level 40 with three sentinels and Inferno effects at 1440 × 960, DPR 1. This was a desktop Chrome check, not a universal device benchmark. Effects reduce their active budget after sustained slow frames. Enemy materials are prepared behind the level loader before gameplay begins.

## Original ORBIT baseline comparison

Chrome, Windows, headless, 1440 × 900, device pixel ratio 1, High preset. Draw calls include the complete frame (shadows, transmission and postprocessing).

| Level | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| 1 | 176 | 91 | 48% |
| 13 | 385 | 149 | 61% |
| 24 | 668 | 215 | 68% |

The first level previously incurred about 635 ms of CPU-side rendering work on its first frame. With preparation performed behind the loader, the first playable frame in this run took about 3 ms. Preparation still costs time: this does not claim that compilation disappeared or that every device will achieve the same frame rate.

Run `node scripts/measure-performance.mjs` against the local development server to collect current measurements. Browser regression tests check draw-call limits, geometry counts across repeated loads, adaptive resolution, and that loading blocks input without consuming level time.
