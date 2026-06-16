import { NormalizedLandmark } from '../hooks/useFaceMesh';

// MediaPipe Face Mesh landmark indices (from official docs)
// https://developers.google.com/mediapipe/solutions/vision/face_landmarker
const LANDMARKS = {
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_OUTER: 362,
  RIGHT_EYE_INNER: 263,
  NOSE_TIP: 4,
  NOSE_BASE: 6,
  LEFT_CHEEK: 116,
  RIGHT_CHEEK: 345,
  LEFT_JAW: 172,
  RIGHT_JAW: 397,
  CHIN: 152,
  FOREHEAD: 10,
  UPPER_LIP: 13,
  LOWER_LIP: 14,
};

export interface FaceAnalysis {
  symmetryScore: number;       // 0–100, higher = more symmetric
  faceWidth: number;           // normalized 0–1
  faceHeight: number;          // normalized 0–1
  eyeDistance: number;         // normalized distance between eyes
  aspectRatio: number;         // width/height ratio
  skinRegions: SkinRegion[];   // canvas sampling targets
}

export interface SkinRegion {
  name: string;
  x: number;   // normalized 0–1
  y: number;   // normalized 0–1
  radius: number;
}

export interface SkinAnalysis {
  tone: 'fair' | 'light' | 'medium' | 'tan' | 'deep';
  brightness: number;   // 0–255
  warmth: 'cool' | 'neutral' | 'warm';
  recommendations: string[];
}

// Euclidean distance between two normalized landmarks
function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

// Midpoint of two landmarks
function midpoint(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function analyzeFace(landmarks: NormalizedLandmark[]): FaceAnalysis {
  const get = (idx: number) => landmarks[idx];

  // Face dimensions
  const leftJaw = get(LANDMARKS.LEFT_JAW);
  const rightJaw = get(LANDMARKS.RIGHT_JAW);
  const forehead = get(LANDMARKS.FOREHEAD);
  const chin = get(LANDMARKS.CHIN);

  const faceWidth = distance(leftJaw, rightJaw);
  const faceHeight = distance(forehead, chin);
  const aspectRatio = faceWidth / faceHeight;

  // Eye distance
  const leftEyeOuter = get(LANDMARKS.LEFT_EYE_OUTER);
  const rightEyeOuter = get(LANDMARKS.RIGHT_EYE_OUTER);
  const eyeDistance = distance(leftEyeOuter, rightEyeOuter);

  // Symmetry: compare distances from face midline to paired landmarks
  const noseTip = get(LANDMARKS.NOSE_TIP);
  const faceCenter = midpoint(forehead, chin);

  const leftEyeFromCenter = Math.abs(leftEyeOuter.x - faceCenter.x);
  const rightEyeFromCenter = Math.abs(rightEyeOuter.x - faceCenter.x);
  const leftJawFromCenter = Math.abs(leftJaw.x - faceCenter.x);
  const rightJawFromCenter = Math.abs(rightJaw.x - faceCenter.x);
  const leftCheek = get(LANDMARKS.LEFT_CHEEK);
  const rightCheek = get(LANDMARKS.RIGHT_CHEEK);
  const leftCheekFromCenter = Math.abs(leftCheek.x - faceCenter.x);
  const rightCheekFromCenter = Math.abs(rightCheek.x - faceCenter.x);

  // Symmetry score: 100 = perfect, lower = more asymmetric
  const symmetryFactors = [
    1 - Math.abs(leftEyeFromCenter - rightEyeFromCenter) / faceWidth,
    1 - Math.abs(leftJawFromCenter - rightJawFromCenter) / faceWidth,
    1 - Math.abs(leftCheekFromCenter - rightCheekFromCenter) / faceWidth,
    1 - Math.abs(noseTip.x - faceCenter.x) / faceWidth,
  ];

  const symmetryScore = Math.round(
    (symmetryFactors.reduce((a, b) => a + b, 0) / symmetryFactors.length) * 100
  );

  // Skin sampling regions (for canvas pixel analysis)
  const noseBase = get(LANDMARKS.NOSE_BASE);
  const skinRegions: SkinRegion[] = [
    { name: 'forehead', x: forehead.x, y: forehead.y, radius: 0.02 },
    { name: 'left_cheek', x: leftCheek.x, y: leftCheek.y, radius: 0.025 },
    { name: 'right_cheek', x: rightCheek.x, y: rightCheek.y, radius: 0.025 },
    { name: 'nose', x: noseBase.x, y: noseBase.y, radius: 0.015 },
  ];

  return {
    symmetryScore: Math.min(100, Math.max(0, symmetryScore)),
    faceWidth,
    faceHeight,
    eyeDistance,
    aspectRatio,
    skinRegions,
  };
}

// Sample canvas pixels at skin regions and derive skin tone
export function analyzeSkinFromCanvas(
  canvas: HTMLCanvasElement,
  regions: SkinRegion[],
  videoWidth: number,
  videoHeight: number
): SkinAnalysis {
  const ctx = canvas.getContext('2d');
  if (!ctx) return defaultSkinAnalysis();

  let totalR = 0, totalG = 0, totalB = 0, samples = 0;

  for (const region of regions) {
    const cx = Math.round(region.x * videoWidth);
    const cy = Math.round(region.y * videoHeight);
    const radius = Math.round(region.radius * Math.min(videoWidth, videoHeight));

    const x = Math.max(0, cx - radius);
    const y = Math.max(0, cy - radius);
    const size = radius * 2;

    try {
      const imageData = ctx.getImageData(x, y, size, size);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        totalR += data[i];
        totalG += data[i + 1];
        totalB += data[i + 2];
        samples++;
      }
    } catch {
      // Canvas might be tainted if video from cross-origin
    }
  }

  if (samples === 0) return defaultSkinAnalysis();

  const avgR = totalR / samples;
  const avgG = totalG / samples;
  const avgB = totalB / samples;
  const brightness = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114);
  const warmth = avgR - avgB;

  // Classify skin tone by luminance
  let tone: SkinAnalysis['tone'];
  if (brightness > 200) tone = 'fair';
  else if (brightness > 170) tone = 'light';
  else if (brightness > 130) tone = 'medium';
  else if (brightness > 90) tone = 'tan';
  else tone = 'deep';

  // Warmth classification
  let warmthClass: SkinAnalysis['warmth'];
  if (warmth > 20) warmthClass = 'warm';
  else if (warmth < -10) warmthClass = 'cool';
  else warmthClass = 'neutral';

  return {
    tone,
    brightness: Math.round(brightness),
    warmth: warmthClass,
    recommendations: getRecommendations(tone, warmthClass),
  };
}

function getRecommendations(tone: SkinAnalysis['tone'], warmth: SkinAnalysis['warmth']): string[] {
  const base: Record<SkinAnalysis['tone'], string[]> = {
    fair: ['SPF 50+ daily', 'Hydrating serum', 'Gentle exfoliant 2x/week'],
    light: ['SPF 30-50 daily', 'Vitamin C serum', 'Light moisturizer'],
    medium: ['SPF 30 daily', 'Niacinamide for even tone', 'Retinol at night'],
    tan: ['SPF 30 daily', 'Kojic acid for brightening', 'Rich moisturizer'],
    deep: ['SPF 15-30 daily', 'Shea butter moisturizer', 'AHA/BHA weekly'],
  };

  const warmthRecs: Record<SkinAnalysis['warmth'], string> = {
    warm: 'Avoid blue-toned toners that can dull complexion',
    cool: 'Rose water toner works well for your undertone',
    neutral: 'Most skincare formulations suit your balanced undertone',
  };

  return [...base[tone], warmthRecs[warmth]];
}

function defaultSkinAnalysis(): SkinAnalysis {
  return {
    tone: 'medium',
    brightness: 128,
    warmth: 'neutral',
    recommendations: ['Position face in better lighting for accurate analysis'],
  };
}
