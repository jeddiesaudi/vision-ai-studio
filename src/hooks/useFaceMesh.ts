import { useEffect, useRef, useCallback, useState } from 'react';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FaceMeshResults {
  landmarks: NormalizedLandmark[];
  timestamp: number;
}

export interface FaceMeshState {
  results: FaceMeshResults | null;
  isInitializing: boolean;
  isReady: boolean;
  error: string | null;
}

export function useFaceMesh(videoRef: React.RefObject<HTMLVideoElement>): FaceMeshState {
  const [state, setState] = useState<FaceMeshState>({
    results: null,
    isInitializing: true,
    isReady: false,
    error: null,
  });

  const faceLandmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);

  const detect = useCallback(() => {
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const results = landmarker.detectForVideo(video, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        setState(prev => ({
          ...prev,
          results: {
            landmarks: results.faceLandmarks[0],
            timestamp: performance.now(),
          },
        }));
      }
    }

    animFrameRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const init = async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });

        if (cancelled) return;
        faceLandmarkerRef.current = faceLandmarker;

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setState(prev => ({ ...prev, isInitializing: false, isReady: true }));
        animFrameRef.current = requestAnimationFrame(detect);

      } catch (err) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            isInitializing: false,
            error: err instanceof Error ? err.message : 'Failed to initialize.',
          }));
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      stream?.getTracks().forEach(t => t.stop());
      faceLandmarkerRef.current?.close();
    };
  }, [detect, videoRef]);

  return state;
}