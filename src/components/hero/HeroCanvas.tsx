'use client';

import { Suspense, lazy } from 'react';
import dynamic from 'next/dynamic';

const View = dynamic(
  () =>
    import('@react-three/fiber').then((mod) => {
      const { Canvas } = mod;

      const FloatingCard = lazy(() => import('./FloatingCard'));
      const ParticleField = lazy(() => import('./ParticleField'));

      function Scene() {
        return (
          <>
            <ambientLight intensity={0.3} />
            <directionalLight
              position={[5, 5, 5]}
              intensity={0.8}
              color="#F1F5F9"
            />
            <pointLight
              position={[-3, 2, 4]}
              intensity={0.5}
              color="#D4A843"
            />
            <pointLight
              position={[3, -2, 3]}
              intensity={0.3}
              color="#7DD3FC"
            />
            <FloatingCard />
            <ParticleField />
          </>
        );
      }

      function CanvasWrapper() {
        return (
          <Canvas
            camera={{ position: [0, 0, 6], fov: 45 }}
            gl={{
              antialias: true,
              toneMapping: 5, // ACESFilmicToneMapping
              toneMappingExposure: 1.2,
            }}
            shadows="soft"
            style={{ pointerEvents: 'auto' }}
          >
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        );
      }

      return { default: CanvasWrapper };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gradient-to-br from-viking-navy via-viking-deep to-viking-charcoal" />
    ),
  }
);

export default function HeroCanvas() {
  return (
    <div className="absolute inset-0 w-full h-full">
      <View />
    </div>
  );
}
