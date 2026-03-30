'use client';

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

const PARTICLE_COUNT = 150;

export default function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);
  const frameRef = useRef<number>(0);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 12;
      pos[i3 + 1] = (Math.random() - 0.5) * 10;
      pos[i3 + 2] = (Math.random() - 0.5) * 6;

      vel[i3] = (Math.random() - 0.5) * 0.002;
      vel[i3 + 1] = Math.random() * 0.003 + 0.001;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.001;
    }

    return { positions: pos, velocities: vel };
  }, []);

  useEffect(() => {
    let running = true;

    const animate = () => {
      if (!running || !pointsRef.current) return;

      const geo = pointsRef.current.geometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        arr[i3] += velocities[i3];
        arr[i3 + 1] += velocities[i3 + 1];
        arr[i3 + 2] += velocities[i3 + 2];

        // Reset particles that drift too far
        if (arr[i3 + 1] > 5) {
          arr[i3 + 1] = -5;
          arr[i3] = (Math.random() - 0.5) * 12;
          arr[i3 + 2] = (Math.random() - 0.5) * 6;
        }
        if (Math.abs(arr[i3]) > 6) {
          arr[i3] = -Math.sign(arr[i3]) * 6;
        }
      }

      posAttr.needsUpdate = true;
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [velocities]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#D4A843"
        size={0.015}
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
