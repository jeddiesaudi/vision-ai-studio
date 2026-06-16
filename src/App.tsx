import { useRef, useEffect, useState } from 'react';
import { useFaceMesh } from './hooks/useFaceMesh';
import { analyzeFace, analyzeSkinFromCanvas, FaceAnalysis, SkinAnalysis } from './utils/faceAnalysis';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { results, isInitializing, isReady, error } = useFaceMesh(videoRef);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysis | null>(null);
  const [skinAnalysis, setSkinAnalysis] = useState<SkinAnalysis | null>(null);

  // Draw landmarks on canvas and run analysis on every frame
  useEffect(() => {
    if (!results || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror + draw video frame to canvas for pixel sampling
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, -CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    // Draw landmark mesh
    ctx.fillStyle = 'rgba(99, 102, 241, 0.6)'; // indigo dots
    for (const landmark of results.landmarks) {
      ctx.beginPath();
      ctx.arc(
        (1 - landmark.x) * CANVAS_WIDTH,  // mirror x
        landmark.y * CANVAS_HEIGHT,
        1.2, 0, 2 * Math.PI
      );
      ctx.fill();
    }

    // Draw key feature points larger
    const keyPoints = [4, 10, 152, 33, 362, 61, 291]; // nose, forehead, chin, eyes, mouth corners
    ctx.fillStyle = '#818CF8';
    for (const idx of keyPoints) {
      const lm = results.landmarks[idx];
      if (!lm) continue;
      ctx.beginPath();
      ctx.arc((1 - lm.x) * CANVAS_WIDTH, lm.y * CANVAS_HEIGHT, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Run geometric analysis
    const face = analyzeFace(results.landmarks);
    setFaceAnalysis(face);

    // Run skin analysis (pixel sampling from canvas)
    const skin = analyzeSkinFromCanvas(canvas, face.skinRegions, CANVAS_WIDTH, CANVAS_HEIGHT);
    setSkinAnalysis(skin);
  }, [results]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
            AI
          </div>
          <span className="font-semibold text-lg tracking-tight">Vision AI Studio</span>
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            browser-native · no backend
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-sm text-gray-400">
            {isInitializing ? 'Loading model...' : isReady ? 'Live' : 'Camera off'}
          </span>
        </div>
      </header>

      <main className="flex-1 flex gap-0">
        {/* Camera + Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-950 p-8">
          <div className="relative rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
            {/* Hidden video element — MediaPipe reads from this */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="hidden"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
            />

            {/* Canvas shows mirrored video + AI overlay */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block"
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)' }}
            />

            {/* Loading / Error overlay */}
            {(isInitializing || error) && (
              <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center gap-4">
                {isInitializing && (
                  <>
                    <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-300 text-sm">Loading face mesh model...</p>
                    <p className="text-gray-500 text-xs">~8MB from CDN, first load only</p>
                  </>
                )}
                {error && (
                  <>
                    <div className="text-red-400 text-4xl">⚠️</div>
                    <p className="text-red-400 text-sm text-center max-w-xs">{error}</p>
                  </>
                )}
              </div>
            )}

            {/* Landmark count badge */}
            {results && (
              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-indigo-300 font-mono">
                {results.landmarks.length} landmarks · {Math.round(1000 / (performance.now() - results.timestamp))}fps
              </div>
            )}
          </div>
        </div>

        {/* Analysis Panel */}
        <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-gray-800">
            <h2 className="font-semibold text-sm text-gray-300 uppercase tracking-wider">AI Analysis</h2>
            <p className="text-xs text-gray-500 mt-1">All processing happens in your browser</p>
          </div>

          <div className="p-5 space-y-6">
            {/* Face Geometry */}
            {faceAnalysis ? (
              <>
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Face Geometry
                  </h3>
                  <div className="space-y-3">
                    <MetricRow
                      label="Symmetry"
                      value={`${faceAnalysis.symmetryScore}/100`}
                      bar={faceAnalysis.symmetryScore}
                      color="indigo"
                    />
                    <MetricRow
                      label="Face Width"
                      value={faceAnalysis.faceWidth.toFixed(3)}
                      bar={faceAnalysis.faceWidth * 200}
                      color="violet"
                    />
                    <MetricRow
                      label="Eye Distance"
                      value={faceAnalysis.eyeDistance.toFixed(3)}
                      bar={faceAnalysis.eyeDistance * 300}
                      color="purple"
                    />
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Aspect Ratio</span>
                      <span className="text-gray-300 font-mono">{faceAnalysis.aspectRatio.toFixed(2)}</span>
                    </div>
                  </div>
                </section>

                {/* Skin Analysis */}
                {skinAnalysis && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Skin Analysis
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Tone</span>
                        <span className="text-gray-200 font-medium capitalize">{skinAnalysis.tone}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Undertone</span>
                        <span className="text-gray-200 font-medium capitalize">{skinAnalysis.warmth}</span>
                      </div>
                      <MetricRow
                        label="Brightness"
                        value={skinAnalysis.brightness.toString()}
                        bar={skinAnalysis.brightness / 2.55}
                        color="amber"
                      />
                    </div>
                  </section>
                )}

                {/* Recommendations */}
                {skinAnalysis && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {skinAnalysis.recommendations.map((rec, i) => (
                        <li key={i} className="flex gap-2 text-xs text-gray-300">
                          <span className="text-indigo-400 mt-0.5 shrink-0">→</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-600">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-sm">Position your face in the camera to begin analysis</p>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="mt-auto p-4 border-t border-gray-800">
            <p className="text-xs text-gray-600 text-center">
              No data is transmitted. Analysis runs locally via WebGL.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

// Reusable metric component
function MetricRow({
  label, value, bar, color
}: {
  label: string;
  value: string;
  bar: number;
  color: 'indigo' | 'violet' | 'purple' | 'amber';
}) {
  const colors = {
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-300 font-mono">{value}</span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color]} rounded-full transition-all duration-150`}
          style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
        />
      </div>
    </div>
  );
}
