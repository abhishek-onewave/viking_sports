'use client';

import { useRef, useCallback, useState } from 'react';
import { Float, RoundedBox, Text } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function FloatingCard() {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const { viewport } = useThree();

  const handlePointerMove = useCallback(
    (e: { point: THREE.Vector3 }) => {
      if (!groupRef.current) return;
      const x = (e.point.x / viewport.width) * 2;
      const y = (e.point.y / viewport.height) * 2;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        x * 0.15,
        0.1
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -y * 0.1,
        0.1
      );
    },
    [viewport]
  );

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <group
        ref={groupRef}
        onPointerMove={handlePointerMove}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          setHovered(false);
          if (groupRef.current) {
            groupRef.current.rotation.y = 0;
            groupRef.current.rotation.x = 0;
          }
        }}
      >
        {/* Card body */}
        <RoundedBox
          args={[2.4, 3.4, 0.05]}
          radius={0.08}
          smoothness={4}
        >
          <meshPhysicalMaterial
            color="#D4A843"
            metalness={0.7}
            roughness={0.2}
            iridescence={1}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[100, 800]}
            clearcoat={0.5}
            clearcoatRoughness={0.1}
            envMapIntensity={1.5}
            emissive="#D4A843"
            emissiveIntensity={hovered ? 0.15 : 0.05}
          />
        </RoundedBox>

        {/* Inner border accent */}
        <RoundedBox
          args={[2.15, 3.15, 0.052]}
          radius={0.06}
          smoothness={4}
        >
          <meshStandardMaterial
            color="#070D19"
            metalness={0.3}
            roughness={0.5}
            transparent
            opacity={0.85}
          />
        </RoundedBox>

        {/* Top decorative line */}
        <mesh position={[0, 1.2, 0.03]}>
          <planeGeometry args={[1.6, 0.003]} />
          <meshStandardMaterial
            color="#D4A843"
            emissive="#D4A843"
            emissiveIntensity={0.5}
          />
        </mesh>

        {/* Bottom decorative line */}
        <mesh position={[0, -1.2, 0.03]}>
          <planeGeometry args={[1.6, 0.003]} />
          <meshStandardMaterial
            color="#D4A843"
            emissive="#D4A843"
            emissiveIntensity={0.5}
          />
        </mesh>

        {/* VIKING text */}
        <Text
          position={[0, 0.55, 0.04]}
          fontSize={0.38}
          letterSpacing={0.2}
          color="#D4A843"
          font="/fonts/SpaceGrotesk-Bold.woff"
          anchorX="center"
          anchorY="middle"
        >
          VIKING
          <meshStandardMaterial
            color="#D4A843"
            emissive="#E8B84B"
            emissiveIntensity={0.3}
          />
        </Text>

        {/* SPORTS text */}
        <Text
          position={[0, 0.1, 0.04]}
          fontSize={0.28}
          letterSpacing={0.15}
          color="#F1F5F9"
          font="/fonts/SpaceGrotesk-Bold.woff"
          anchorX="center"
          anchorY="middle"
        >
          SPORTS
          <meshStandardMaterial
            color="#F1F5F9"
            emissive="#F1F5F9"
            emissiveIntensity={0.1}
          />
        </Text>

        {/* AI text */}
        <Text
          position={[0, -0.3, 0.04]}
          fontSize={0.55}
          letterSpacing={0.3}
          color="#7DD3FC"
          font="/fonts/SpaceGrotesk-Bold.woff"
          anchorX="center"
          anchorY="middle"
        >
          AI
          <meshStandardMaterial
            color="#7DD3FC"
            emissive="#7DD3FC"
            emissiveIntensity={0.4}
          />
        </Text>

        {/* Subtle corner accents */}
        {[
          [-0.95, 1.35],
          [0.95, 1.35],
          [-0.95, -1.35],
          [0.95, -1.35],
        ].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.03]}>
            <circleGeometry args={[0.025, 16]} />
            <meshStandardMaterial
              color="#D4A843"
              emissive="#D4A843"
              emissiveIntensity={0.6}
            />
          </mesh>
        ))}

        {/* Soft ambient glow plane behind card */}
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[3.2, 4.2]} />
          <meshBasicMaterial
            color="#D4A843"
            transparent
            opacity={0.03}
          />
        </mesh>
      </group>
    </Float>
  );
}
