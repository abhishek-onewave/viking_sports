'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  varying vec2 vUv;

  // Smooth noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;

    float t = uTime * 0.15;

    // Aurora bands
    vec2 q = vec2(0.0);
    q.x = fbm(uv + t * 0.5);
    q.y = fbm(uv + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(uv + 1.0 * q + vec2(1.7, 9.2) + t * 0.3);
    r.y = fbm(uv + 1.0 * q + vec2(8.3, 2.8) + t * 0.4);

    float f = fbm(uv + r);

    // Navy base
    vec3 col1 = vec3(0.027, 0.051, 0.094); // dark navy
    // Teal aurora
    vec3 col2 = vec3(0.0, 0.22, 0.35);
    // Gold hint
    vec3 col3 = vec3(0.15, 0.12, 0.02);
    // Ice blue
    vec3 col4 = vec3(0.04, 0.15, 0.28);

    vec3 color = mix(col1, col2, clamp(f * f * 4.0, 0.0, 1.0));
    color = mix(color, col3, clamp(length(q), 0.0, 1.0));
    color = mix(color, col4, clamp(length(r.x), 0.0, 1.0));

    // Edge vignette - fade to deep navy at edges
    float vignette = uv.x * (1.0 - uv.x) * uv.y * (1.0 - uv.y) * 16.0;
    vignette = clamp(vignette, 0.0, 1.0);
    color = mix(vec3(0.027, 0.051, 0.094), color, vignette * 0.7);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function AuroraBackground() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -4]}>
      <planeGeometry args={[24, 14]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}
