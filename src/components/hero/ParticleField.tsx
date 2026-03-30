'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const PARTICLE_COUNT = 280;

export default function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);
  const frameRef = useRef<number>(0);

  const { positions, velocities, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const sz = new Float32Array(PARTICLE_COUNT);

    const goldColor = new THREE.Color('#D4A843');
    const iceColor = new THREE.Color('#7DD3FC');
    const amberColor = new THREE.Color('#E8B84B');

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 16;
      pos[i3 + 1] = (Math.random() - 0.5) * 12;
      pos[i3 + 2] = (Math.random() - 0.5) * 8;

      vel[i3] = (Math.random() - 0.5) * 0.0015;
      vel[i3 + 1] = Math.random() * 0.0025 + 0.0005;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.001;

      // Color: 65% gold, 25% ice, 10% amber
      const r = Math.random();
      const c = r < 0.65 ? goldColor : r < 0.90 ? iceColor : amberColor;
      // slight variation
      col[i3] = c.r + (Math.random() - 0.5) * 0.15;
      col[i3 + 1] = c.g + (Math.random() - 0.5) * 0.1;
      col[i3 + 2] = c.b + (Math.random() - 0.5) * 0.1;

      sz[i] = Math.random() * 0.012 + 0.004;
    }

    return { positions: pos, velocities: vel, colors: col, sizes: sz };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;

    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      arr[i3] += velocities[i3];
      arr[i3 + 1] += velocities[i3 + 1];
      arr[i3 + 2] += velocities[i3 + 2];

      // slight swirl on x
      arr[i3] += Math.sin(arr[i3 + 1] * 0.3 + frameRef.current * 0.0005) * 0.0003;

      if (arr[i3 + 1] > 6) {
        arr[i3 + 1] = -6;
        arr[i3] = (Math.random() - 0.5) * 16;
        arr[i3 + 2] = (Math.random() - 0.5) * 8;
      }
      if (Math.abs(arr[i3]) > 8) {
        arr[i3] = -Math.sign(arr[i3]) * 8;
      }
    }

    posAttr.needsUpdate = true;
    frameRef.current++;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        vertexColors
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
