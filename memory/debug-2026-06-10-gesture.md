# Gesture Control Debug Report - 2026-06-10

## Symptom
The gesture page button fell back to the unavailable state, so camera gesture control could not start.

## Root Cause
`src/gesture-main.ts` loaded MediaPipe at runtime from a hard-coded external URL:

- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs`

That URL returned 404 during verification, while the installed package is `@mediapipe/tasks-vision@0.10.35`. Because camera access, external module loading, WASM loading, model loading, and GPU initialization were inside the same `try` block, any model/bootstrap failure was shown as a camera failure.

## Fix
- Import `FilesetResolver` and `HandLandmarker` from the installed npm package instead of dynamic CDN import.
- Serve MediaPipe WASM files from `public/vendor/mediapipe/wasm`.
- Serve `hand_landmarker.task` from `public/vendor/mediapipe/hand_landmarker.task`.
- Add GPU-to-CPU fallback when hand landmarker initialization fails on GPU.
- Split user-facing failure messages for unsupported browser, denied permission, missing camera, occupied camera, and model loading failure.
- Stop any opened camera stream when initialization fails.

## Evidence
- `npm run build` passes.
- `http://127.0.0.1:5174/gesture.html` returns 200.
- `http://127.0.0.1:5174/vendor/mediapipe/hand_landmarker.task` returns 200.
- `http://127.0.0.1:5174/vendor/mediapipe/wasm/vision_wasm_internal.wasm` returns 200.
- Search for `cdn.jsdelivr`, `storage.googleapis`, and `0.10.22` in `src`, `public`, `dist`, and `package.json` returns no matches after a clean rebuild.

## Status
DONE_WITH_CONCERNS: The original broken dependency path was verified and removed. Physical camera recognition still requires browser/system camera permission and a real camera test by the user on the target machine.
