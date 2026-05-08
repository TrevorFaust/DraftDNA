import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Colors matched to your icon
const BLUE    = '#4a86c8'   // left strand blue
const RED     = '#d84a5a'   // right strand red
const CORAL   = '#e8c08a'   // center bridges coral
const OUTLINE = '#243248'   // softened outline for cleaner motion

// Cartoon-style material — flat with visible outline trick via backface shell
function CartoonTube({ curve, radius = 0.12, color }) {
  return (
    <>
      {/* Outer dark shell slightly larger — gives the outline look */}
      <mesh>
        <tubeGeometry args={[curve, 56, radius * 1.15, 10, false]} />
        <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} />
      </mesh>
      {/* Main colored tube (flat/basic for emblem-like cartoon look) */}
      <mesh>
        <tubeGeometry args={[curve, 56, radius, 10, false]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  )
}

function CartoonCylinder({ start, end, radius = 0.07, color, outlined = true }) {
  const dir = end.clone().sub(start)
  const mid = start.clone().add(dir.clone().multiplyScalar(0.5))
  const length = dir.length()
  const q = new THREE.Quaternion()
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return (
    <>
      {outlined ? (
        <mesh position={mid} quaternion={q}>
          <cylinderGeometry args={[radius * 1.18, radius * 1.18, length, 10]} />
          <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} />
        </mesh>
      ) : null}
      <mesh position={mid} quaternion={q}>
        <cylinderGeometry args={[radius, radius, length, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  )
}

function buildHelix(phaseOffset, turns = 2, height = 3, radius = 0.38) {
  const points = []
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 2 * turns
    points.push(new THREE.Vector3(
      Math.cos(t + phaseOffset) * radius,
      (i / 72) * height - height / 2,
      Math.sin(t + phaseOffset) * radius
    ))
  }
  return new THREE.CatmullRomCurve3(points)
}

function DNAMolecule() {
  const groupRef = useRef()
  const turns = 1.25
  const height = 2.15
  const radius = 0.38

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 1.16
  })

  const curve1 = buildHelix(0, turns, height, radius)
  const curve2 = buildHelix(Math.PI, turns, height, radius)

  // Sample points on each curve for rung endpoints
  const rungCount = 3
  const rungs = []
  for (let i = 0; i < rungCount; i++) {
    const t = (i + 0.5) / rungCount
    const p1 = curve1.getPoint(t)
    const p2 = curve2.getPoint(t)
    rungs.push({ p1, p2 })
  }

  return (
    <group ref={groupRef}>
      {/* Main strands */}
      <CartoonTube curve={curve1} radius={0.12} color={BLUE} />
      <CartoonTube curve={curve2} radius={0.12} color={RED} />

      {/* Coral rungs */}
      {rungs.map((r, i) => (
        <CartoonCylinder key={i} start={r.p1} end={r.p2} radius={0.07} color={CORAL} outlined={false} />
      ))}
    </group>
  )
}

export function DNALoader({ size = 140 }) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        dpr={[1, 1.15]}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        camera={{ position: [0, 0, 4.2], fov: 38 }}
      >
        <DNAMolecule />
      </Canvas>
    </div>
  )
}

export default DNALoader