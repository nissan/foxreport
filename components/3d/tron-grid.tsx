"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function TronGrid() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on server or before mounting to prevent hydration issues
  if (!mounted) {
    return <div className="fixed inset-0 -z-10 opacity-40 bg-gradient-to-b from-background to-background/50" />;
  }

  return (
    <div className="fixed inset-0 -z-10 opacity-40">
      <Canvas
        camera={{ position: [0, 5, 10], fov: 75 }}
        onCreated={({ gl }) => {
          // Handle WebGL context loss
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.warn('WebGL context lost. Attempting recovery...');
          });

          gl.domElement.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored');
          });
        }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: false,
          powerPreference: "low-power", // Use less GPU power
        }}
      >
        <ambientLight intensity={isDark ? 0.3 : 0.5} />
        <pointLight position={[10, 10, 10]} intensity={isDark ? 1 : 0.5} color={isDark ? "#00ffff" : "#0066ff"} />
        <pointLight position={[-10, -10, -10]} intensity={isDark ? 0.5 : 0.3} color={isDark ? "#ff00ff" : "#6600ff"} />

        <Grid
          position={[0, -0.5, 0]}
          args={[20, 20]}
          cellSize={1}
          cellThickness={1}
          cellColor={isDark ? "#00ffff" : "#0066ff"}
          sectionSize={5}
          sectionThickness={1.5}
          sectionColor={isDark ? "#ff00ff" : "#6600ff"}
          fadeDistance={30}
          fadeStrength={1}
          infiniteGrid
        />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}
