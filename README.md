# Vision AI Studio

Real-time face analysis that runs entirely in your browser. No server. No backend. Your camera feed never leaves your device.

**[Live Demo →](https://vision-ai-studio-gold.vercel.app/)**

![Demo](vision-ai-studio-demo.gif)

---

## What is this?

I built this to answer a question I kept running into: _do we actually need a server to run AI?_

For a lot of real-time tasks — face tracking, gesture detection, live overlays — the answer is no. Your browser has WebGL, your device has a GPU, and models like MediaPipe are small enough to run at 30fps client-side. No round-trips. No API bills. No privacy concerns.

This project is the proof of concept. It tracks 468 facial landmarks in real-time, runs geometric analysis on them, and derives skin tone from pixel sampling — all without a single network request after the initial page load.

---

## Try it yourself

```bash
git clone https://github.com/jeddiesaudi/vision-ai-studio
cd vision-ai-studio
npm install
npm run dev
```

Open `http://localhost:5173`, allow camera access, and you're running AI inference locally.

No API keys. No `.env` file. No backend to spin up.

---

## How it works

The core of the app is two things working together:

**MediaPipe Face Landmarker** — Google's ML model, loaded from CDN and running via WebAssembly + WebGL in the browser. It outputs 478 landmark points on your face, 30+ times per second.

**Canvas pixel sampling** — Once we know _where_ your face is (thanks to the landmarks), we sample small regions of the video frame directly from the canvas. From those raw pixel values, we derive brightness, undertone warmth, and skin tone category.

The analysis panel updates in real-time as you move. Nothing is stored. Nothing is sent anywhere.

---

## Architecture

```
src/
├── hooks/
│   └── useFaceMesh.ts      — initializes MediaPipe, runs the detection loop,
│                             returns landmarks on every frame
└── utils/
    └── faceAnalysis.ts     — takes those landmarks and does the math:
                              symmetry scoring, skin tone, recommendations
```

The hook and the analysis logic are completely decoupled. `useFaceMesh` doesn't know what you do with the landmarks — it just delivers them. This made it easy to iterate on the analysis without touching the ML code.

---

## Stack

| What                   | Why                                                        |
| ---------------------- | ---------------------------------------------------------- |
| React 18 + TypeScript  | Predictable state management for a real-time data stream   |
| Vite                   | Fast dev cycle, clean ESM output                           |
| MediaPipe Tasks Vision | Modern, stable Google ML API — works in Chromium + Firefox |
| Tailwind CSS           | Utility-first, no context switching                        |
| Canvas API             | Direct pixel access for skin sampling                      |

---

## The tradeoffs

Browser-native ML isn't free. Here's what I gave up:

- **Model size** — the face landmarker model is ~30MB, downloaded once on first load
- **Complexity ceiling** — you can't run a 7B parameter model in a browser (yet)
- **Lighting sensitivity** — pixel sampling from compressed video is noisy; the skin analysis works best in even, natural light

For this use case — real-time face tracking and basic analysis — those tradeoffs are worth it. For heavier tasks, a server makes more sense.

---

## What I'd add next

- [ ] Export analysis results as JSON
- [ ] Historical tracking across a session (trend lines for symmetry score)
- [ ] Mobile support (currently best on desktop Chrome)
- [ ] Calibration mode for different lighting conditions

---

## License

MIT — use it, fork it, build on it.
