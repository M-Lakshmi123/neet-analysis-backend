import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeBackground = ({ is3DEnabled = true }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!is3DEnabled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 24;

        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0x6366f1, 2.6); // Indigo light
        dirLight1.position.set(15, 20, 15);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 2.0); // Cyan light
        dirLight2.position.set(-15, -15, 10);
        scene.add(dirLight2);

        const pointLight = new THREE.PointLight(0xec4899, 1.8, 50); // Pink accent
        pointLight.position.set(0, 0, 10);
        scene.add(pointLight);

        // Group for 3D elements
        const floatingGroup = new THREE.Group();
        scene.add(floatingGroup);

        // Materials
        const crystalMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.65,
            thickness: 1.2,
            transparent: true,
            opacity: 0.45,
            reflectivity: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });

        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            wireframe: true,
            transparent: true,
            opacity: 0.22
        });

        const cyanMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x38bdf8,
            metalness: 0.2,
            roughness: 0.2,
            transmission: 0.5,
            transparent: true,
            opacity: 0.4
        });

        const goldMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf59e0b,
            metalness: 0.3,
            roughness: 0.2,
            transmission: 0.5,
            transparent: true,
            opacity: 0.35
        });

        // 1. Primary Central 3D Icosahedron
        const icoGeo = new THREE.IcosahedronGeometry(3.5, 0);
        const centralIco = new THREE.Mesh(icoGeo, crystalMaterial);
        centralIco.position.set(16, 6, -4);
        floatingGroup.add(centralIco);

        const icoWireGeo = new THREE.IcosahedronGeometry(3.7, 1);
        const centralWire = new THREE.Mesh(icoWireGeo, wireframeMaterial);
        centralWire.position.copy(centralIco.position);
        floatingGroup.add(centralWire);

        // 2. 3D Torus Ring
        const torusGeo = new THREE.TorusGeometry(3.0, 0.45, 16, 60);
        const torusMesh = new THREE.Mesh(torusGeo, cyanMaterial);
        torusMesh.position.set(-18, -8, -6);
        floatingGroup.add(torusMesh);

        // 3. 3D Octahedron
        const octaGeo = new THREE.OctahedronGeometry(2.4);
        const octaMesh = new THREE.Mesh(octaGeo, goldMaterial);
        octaMesh.position.set(-16, 9, -5);
        floatingGroup.add(octaMesh);

        // 4. 3D Dodecahedron
        const dodecaGeo = new THREE.DodecahedronGeometry(2.2);
        const dodecaMesh = new THREE.Mesh(dodecaGeo, crystalMaterial);
        dodecaMesh.position.set(18, -10, -5);
        floatingGroup.add(dodecaMesh);

        // 5. Floating 3D Micro-Cubes / Data Nodes
        const cubeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const cubes = [];
        for (let i = 0; i < 18; i++) {
            const cubeMat = (i % 2 === 0) ? cyanMaterial : wireframeMaterial;
            const cube = new THREE.Mesh(cubeGeo, cubeMat);
            cube.position.set(
                (Math.random() - 0.5) * 44,
                (Math.random() - 0.5) * 30,
                (Math.random() - 0.5) * 16 - 2
            );
            cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            cubes.push({
                mesh: cube,
                speedX: (Math.random() - 0.5) * 0.008,
                speedY: (Math.random() - 0.5) * 0.008,
                rotSpeed: (Math.random() + 0.5) * 0.015
            });
            floatingGroup.add(cube);
        }

        // 6. 3D Ambient Dust Particles
        const particleCount = 140;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 50;
            positions[i + 1] = (Math.random() - 0.5) * 36;
            positions[i + 2] = (Math.random() - 0.5) * 20;
        }
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0x818cf8,
            size: 0.12,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const particles = new THREE.Points(particleGeometry, particleMat);
        scene.add(particles);

        // Mouse Parallax tracking
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const handleMouseMove = (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
        };
        window.addEventListener('mousemove', handleMouseMove);

        // Window resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // Animation loop
        let animationFrameId;
        let clock = new THREE.Clock();

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            const elapsedTime = clock.getElapsedTime();

            // Smooth mouse interpolation (lerp)
            targetX += (mouseX - targetX) * 0.05;
            targetY += (mouseY - targetY) * 0.05;

            // Camera reacts gently in 3D
            camera.position.x = targetX * 1.5;
            camera.position.y = targetY * 1.5;
            camera.lookAt(0, 0, 0);

            // Floating 3D shapes rotation & subtle oscillation
            centralIco.rotation.x = elapsedTime * 0.25;
            centralIco.rotation.y = elapsedTime * 0.35;
            centralIco.position.y = 6 + Math.sin(elapsedTime * 0.8) * 0.8;

            centralWire.rotation.x = -elapsedTime * 0.2;
            centralWire.rotation.y = -elapsedTime * 0.3;
            centralWire.position.y = centralIco.position.y;

            torusMesh.rotation.x = elapsedTime * 0.3;
            torusMesh.rotation.y = elapsedTime * 0.4;
            torusMesh.position.y = -8 + Math.cos(elapsedTime * 0.7) * 0.7;

            octaMesh.rotation.y = elapsedTime * 0.45;
            octaMesh.rotation.z = elapsedTime * 0.2;
            octaMesh.position.y = 9 + Math.sin(elapsedTime * 0.9) * 0.6;

            dodecaMesh.rotation.x = elapsedTime * 0.3;
            dodecaMesh.rotation.y = elapsedTime * 0.25;
            dodecaMesh.position.y = -10 + Math.cos(elapsedTime * 0.6) * 0.7;

            cubes.forEach((c) => {
                c.mesh.rotation.x += c.rotSpeed;
                c.mesh.rotation.y += c.rotSpeed;
                c.mesh.position.y += Math.sin(elapsedTime + c.mesh.position.x) * 0.005;
            });

            particles.rotation.y = elapsedTime * 0.03;

            renderer.render(scene, camera);
        };

        animate();

        // Cleanup
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);

            // Dispose geometries and materials
            icoGeo.dispose();
            icoWireGeo.dispose();
            torusGeo.dispose();
            octaGeo.dispose();
            dodecaGeo.dispose();
            cubeGeo.dispose();
            particleGeometry.dispose();

            crystalMaterial.dispose();
            wireframeMaterial.dispose();
            cyanMaterial.dispose();
            goldMaterial.dispose();
            particleMat.dispose();

            renderer.dispose();
        };
    }, [is3DEnabled]);

    if (!is3DEnabled) return null;

    return (
        <canvas
            ref={canvasRef}
            className="three-3d-canvas"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 0,
                opacity: 0.75,
                transition: 'opacity 0.5s ease'
            }}
        />
    );
};

export default ThreeBackground;