'use client';

import { Suspense, lazy } from 'react';
import dynamic from 'next/dynamic';

const View = dynamic(
  () =>
    import('@react-three/fiber').then((mod) => {
      const { Canvas } = mod;

      const FloatingCard = lazy(() => import('./FloatingCard'));
      const ParticleField = lazy(() => import('./ParticleField'));
      const AuroraBackground = lazy(() => import('./AuroraBackground'));

      // Lazy-load post-processing
      const Effects = lazy(async () => {
        const [{ EffectComposer, Bloom, Vignette }] = await Promise.all([
          import('@react-three/postprocessing'),
        ]);
        function PostEffects() {
          return (
            <EffectComposer multisampling={0}>
              <Bloom
                intensity={0.8}
                luminanceThreshold={0.3}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
              <Vignette eskil={false} offset={0.3} darkness={0.6} />
            </EffectComposer>
          );
        }
        return { default: PostEffects };
      });

      function Scene() {
        return (
          <>
            <AuroraBackground />

            {/* Ambient */}
            <ambientLight intensity={0.2} />

            {/* Key light - warm */}
            <directionalLight
              position={[4, 6, 6]}
              intensity={1.2}
              color="#FFF4E0"
              castShadow
            />

            {/* Fill light - cool ice */}
            <pointLight
              position={[-5, 3, 4]}
              intensity={1.5}
              color="#7DD3FC"
              distance={20}
              decay={2}
            />

            {/* Rim light - gold */}
            <pointLight
              position={[3, -3, -2]}
              intensity={1.0}
              color="#E8B84B"
              distance={18}
              decay={2}
            />

            {/* Top accent */}
            <pointLight
              position={[0, 8, 2]}
              intensity={0.4}
              color="#D4A843"
              distance={25}
              decay={2}
            />

            <FloatingCard />
            <ParticleField />

            <Suspense fallback={null}>
              <Effects />
            </Suspense>
          </>
        );
      }

      function CanvasWrapper() {
        return (
          <Canvas
            camera={{ position: [0, 0.3, 7], fov: 42 }}
            gl={{
              antialias: true,
              toneMapping: 4, // CineonToneMapping
              toneMappingExposure: 1.4,
              powerPreference: 'high-performance',
            }}
            dpr={[1, 1.5]}
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
      <div className="w-full h-full bg-gradient-to-br from-viking-navy via-viking-deep to-[#0A1628]" />
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
