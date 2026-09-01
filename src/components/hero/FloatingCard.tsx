'use client';

import { useRef, useMemo } from 'react';
import { Float, RoundedBox, Text, MeshTransmissionMaterial } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Holographic scanline shader
const holoVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const holoFragmentShader = `
  uniform float uTime;
  uniform float uHover;
  uniform vec3 uColor;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    // Fresnel rim
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - dot(vNormal, viewDir), 2.5);

    // Scan lines - multiple frequencies
    float scan1 = sin(vUv.y * 80.0 + uTime * 2.0) * 0.5 + 0.5;
    float scan2 = sin(vUv.y * 160.0 - uTime * 1.5) * 0.5 + 0.5;
    float scanLine = mix(scan1, scan2, 0.3);
    scanLine = pow(scanLine, 6.0) * 0.25 + 0.06;

    // Diagonal shimmer
    float shimmer = sin((vUv.x + vUv.y) * 4.0 + uTime * 3.0) * 0.5 + 0.5;
    shimmer = pow(shimmer, 3.0) * 0.15;

    // Iridescent color shift
    float hue = vUv.x * 0.6 + vUv.y * 0.4 + uTime * 0.1;
    vec3 iridColor = vec3(
      sin(hue * 6.28 + 0.0) * 0.5 + 0.5,
      sin(hue * 6.28 + 2.094) * 0.5 + 0.5,
      sin(hue * 6.28 + 4.189) * 0.5 + 0.5
    );

    // Base gold
    vec3 baseColor = uColor;
    vec3 irid = mix(baseColor, iridColor, 0.3 * fresnel);
    vec3 final = irid + vec3(scanLine) + vec3(shimmer);
    final = mix(final, final * 1.4, fresnel * 0.5);
    final = mix(final, final, 1.0 + uHover * 0.2);

    float alpha = 0.92 + fresnel * 0.08;
    gl_FragColor = vec4(final, alpha);
  }
`;

// Orbit ring component
function OrbitRing({ radius, speed, color, thickness }: { radius: number; speed: number; color: string; thickness: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = clock.getElapsedTime() * speed;
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.4;
    if (mat.current) {
      mat.current.emissiveIntensity = 0.3 + Math.sin(clock.getElapsedTime() * 2) * 0.15;
    }
  });

  const curve = useMemo(() => {
    return new THREE.TorusGeometry(radius, thickness, 2, 64);
  }, [radius, thickness]);

  return (
    <mesh ref={ref} geometry={curve}>
      <meshStandardMaterial
        ref={mat}
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        metalness={0.8}
        roughness={0.2}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

// Floating data node
function DataNode({ position, delay }: { position: [number, number, number]; delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() + delay;
    ref.current.position.y = position[1] + Math.sin(t * 1.2) * 0.12;
    ref.current.rotation.y = t * 0.8;
  });
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.06, 0]} />
      <meshStandardMaterial
        color="#D4A843"
        emissive="#E8B84B"
        emissiveIntensity={0.8}
        metalness={1}
        roughness={0}
      />
    </mesh>
  );
}

export default function FloatingCard() {
  const groupRef = useRef<THREE.Group>(null);
  const cardRef = useRef<THREE.Mesh>(null);
  const holoRef = useRef<THREE.ShaderMaterial>(null);
  const targetRotation = useRef({ x: 0, y: 0.15 });
  const currentRotation = useRef({ x: 0, y: 0.15 });

  const { viewport, pointer } = useThree();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHover: { value: 0 },
    uColor: { value: new THREE.Color('#D4A843') },
  }), []);

  useFrame(({ clock }) => {
    if (!groupRef.current || !holoRef.current) return;

    const t = clock.getElapsedTime();

    // Update shader time
    holoRef.current.uniforms.uTime.value = t;

    // Smooth mouse-follow tilt
    targetRotation.current.y = pointer.x * 0.35;
    targetRotation.current.x = -pointer.y * 0.2;

    currentRotation.current.x = THREE.MathUtils.lerp(currentRotation.current.x, targetRotation.current.x, 0.06);
    currentRotation.current.y = THREE.MathUtils.lerp(currentRotation.current.y, targetRotation.current.y, 0.06);

    groupRef.current.rotation.x = currentRotation.current.x;
    groupRef.current.rotation.y = currentRotation.current.y + 0.15;

    // Card pulse scale
    if (cardRef.current) {
      const pulse = 1 + Math.sin(t * 1.8) * 0.004;
      cardRef.current.scale.setScalar(pulse);
    }
  });

  const dataNodePositions: [number, number, number][] = [
    [-1.5, 0.8, 0.3],
    [1.6, -0.5, 0.2],
    [-1.8, -1.0, 0.0],
    [1.4, 1.2, 0.1],
    [-1.2, 1.6, -0.2],
    [1.9, 0.2, -0.1],
  ];

  return (
    <group position={[1.8, 0, 0]}>
      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.35} floatingRange={[-0.08, 0.08]}>
        <group ref={groupRef}>
          {/* Main card body — holographic shader */}
          <RoundedBox ref={cardRef} args={[2.4, 3.4, 0.06]} radius={0.1} smoothness={6}>
            <shaderMaterial
              ref={holoRef}
              vertexShader={holoVertexShader}
              fragmentShader={holoFragmentShader}
              uniforms={uniforms}
              transparent
              side={THREE.FrontSide}
            />
          </RoundedBox>

          {/* Glass inner panel */}
          <RoundedBox args={[2.18, 3.18, 0.065]} radius={0.08} smoothness={6}>
            <MeshTransmissionMaterial
              color="#0B1120"
              background={new THREE.Color('#070D19')}
              transmission={0.6}
              thickness={0.1}
              roughness={0.05}
              metalness={0.1}
              ior={1.4}
              chromaticAberration={0.03}
              anisotropy={0.1}
            />
          </RoundedBox>

          {/* Horizontal accent lines */}
          {[-1.25, 1.25].map((y, i) => (
            <mesh key={i} position={[0, y, 0.04]}>
              <planeGeometry args={[1.8, 0.002]} />
              <meshStandardMaterial color="#D4A843" emissive="#D4A843" emissiveIntensity={1.2} />
            </mesh>
          ))}

          {/* VALHALLA text */}
          <Text position={[0, 0.72, 0.06]} fontSize={0.36} letterSpacing={0.22} anchorX="center" anchorY="middle">
            VALHALLA
            <meshStandardMaterial color="#D4A843" emissive="#E8B84B" emissiveIntensity={0.6} metalness={0.8} />
          </Text>

          {/* SPORTS text */}
          <Text position={[0, 0.26, 0.06]} fontSize={0.26} letterSpacing={0.18} anchorX="center" anchorY="middle">
            SPORTS
            <meshStandardMaterial color="#F1F5F9" emissive="#7DD3FC" emissiveIntensity={0.2} />
          </Text>

          {/* AI large text */}
          <Text position={[0, -0.42, 0.06]} fontSize={0.62} letterSpacing={0.35} anchorX="center" anchorY="middle">
            AI
            <meshStandardMaterial color="#7DD3FC" emissive="#7DD3FC" emissiveIntensity={0.9} metalness={0.3} />
          </Text>

          {/* Corner dots */}
          {([-0.95, 0.95] as number[]).flatMap(x =>
            ([-1.38, 1.38] as number[]).map((y, j) => (
              <mesh key={`${x}-${j}`} position={[x, y, 0.04]}>
                <circleGeometry args={[0.028, 12]} />
                <meshStandardMaterial color="#D4A843" emissive="#E8B84B" emissiveIntensity={1.5} />
              </mesh>
            ))
          )}

          {/* Orbiting rings */}
          <OrbitRing radius={1.9} speed={0.4} color="#D4A843" thickness={0.008} />
          <OrbitRing radius={2.2} speed={-0.25} color="#7DD3FC" thickness={0.005} />

          {/* Data nodes */}
          {dataNodePositions.map((pos, i) => (
            <DataNode key={i} position={pos} delay={i * 1.2} />
          ))}
        </group>
      </Float>
    </group>
  );
}
