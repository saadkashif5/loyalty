"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";
import { LogoMark } from "@taptapsell/brand/logo";

/** Built by portal/scripts/optimize-stamper.mjs from the designers' export. */
const MODEL_URL = "/models/stamper.glb";

const BASE_TILT = 0.38; // lean the cap towards the camera so its petals show
const PITCH_LIMIT = 0.55;
const AUTO_SPIN = 0.35; // rad/s while nobody is touching it
const IDLE_AFTER_MS = 2200;
const PRESS_SECONDS = 0.6;
const CLICK_SLOP_PX = 6;

/**
 * The Stamply stamper in 3D. Drag (or swipe sideways) to turn it, move the
 * cursor and it leans towards it, click or press Enter to stamp. three.js is
 * loaded only after the page has painted, so it never delays the first view;
 * until then, or without WebGL, the flower mark stands in.
 */
export function Stamper3D({
  label,
  onStamp,
  className = "",
}: {
  /** Accessible name and instructions for the interactive model. */
  label: string;
  /** Called when the stamper hits the bottom of a press. */
  onStamp?: () => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onStampRef = useRef(onStamp);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onStampRef.current = onStamp;
  }, [onStamp]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let teardown = () => {};

    (async () => {
      const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/environments/RoomEnvironment.js"),
      ]);
      if (disposed) return;

      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
      } catch {
        setStatus("error");
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      // Neutral keeps Stamp Orange looking like Stamp Orange (ACES would wash it out).
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.05;
      const canvas = renderer.domElement;
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      // Vertical swipes still scroll the page on phones; sideways ones turn the model.
      canvas.style.touchAction = "pan-y";
      canvas.style.cursor = "grab";
      canvas.setAttribute("aria-hidden", "true");
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
      camera.position.set(0, 0.35, 8);
      camera.lookAt(0, -0.05, 0);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envMap;
      scene.environmentIntensity = 0.75;

      const key = new THREE.DirectionalLight(0xfff1e2, 2.4);
      key.position.set(3, 5, 4);
      const rim = new THREE.DirectionalLight(0xff5a1f, 3.2); // Stamp Orange edge light
      rim.position.set(-4, 2.5, -3.5);
      const fill = new THREE.HemisphereLight(0xfff6ea, 0x151a33, 0.7); // Crema over Midnight Ink
      scene.add(key, rim, fill);

      // Pose hierarchy: lift (float and press) > lean (pitch) > spin (yaw) > model.
      const lift = new THREE.Group();
      const lean = new THREE.Group();
      const spin = new THREE.Group();
      lift.add(lean);
      lean.add(spin);
      scene.add(lift);

      // A soft contact shadow, drawn once on a canvas.
      const shadowCanvas = document.createElement("canvas");
      shadowCanvas.width = shadowCanvas.height = 128;
      const ctx = shadowCanvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(21,26,51,0.55)");
      gradient.addColorStop(0.55, "rgba(21,26,51,0.18)");
      gradient.addColorStop(1, "rgba(21,26,51,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -1.58;
      scene.add(shadow);

      try {
        const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
        if (disposed) {
          renderer.dispose();
          return;
        }
        const model = gltf.scene;
        // Centre it and make it 2.45 units tall, whatever units it was exported in.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const scale = 2.45 / size.y;
        model.scale.setScalar(scale);
        model.position.copy(centre).multiplyScalar(-scale);
        // A little clear-coat, like the satin finish on a printed part.
        model.traverse((object) => {
          const mesh = object as THREE_NS.Mesh;
          if (!mesh.isMesh) return;
          const original = mesh.material as THREE_NS.MeshStandardMaterial;
          const isBody = original.name === "Midnight Ink";
          mesh.material = new THREE.MeshPhysicalMaterial({
            name: original.name,
            color: original.color,
            roughness: isBody ? 0.42 : 0.34,
            metalness: 0,
            clearcoat: isBody ? 0.55 : 0.35,
            clearcoatRoughness: 0.32,
          });
          original.dispose();
        });
        spin.add(model);
      } catch {
        setStatus("error");
        renderer.dispose();
        canvas.remove();
        return;
      }

      // ---- Interaction ----------------------------------------------------
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let yaw = -0.5;
      let yawVelocity = 0;
      let pitch = 0;
      let hoverX = 0;
      let hoverY = 0;
      let hoverTargetX = 0;
      let hoverTargetY = 0;
      let lastInteraction = -Infinity;
      let pressStart = -1;
      let pressFired = false;
      let drag: {
        id: number;
        x: number;
        y: number;
        startX: number;
        startY: number;
        t: number;
      } | null = null;

      const stamp = () => {
        if (pressStart >= 0) return;
        pressStart = performance.now();
        pressFired = false;
      };

      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        drag = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
          t: performance.now(),
        };
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
        yawVelocity = 0;
        lastInteraction = performance.now();
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id) return;
        const now = performance.now();
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        const dt = Math.max((now - drag.t) / 1000, 1 / 240);
        yaw += dx * 0.012;
        yawVelocity = (dx * 0.012) / dt;
        pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + dy * 0.006));
        drag.x = e.clientX;
        drag.y = e.clientY;
        drag.t = now;
        lastInteraction = now;
      };
      const onPointerUp = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id) return;
        const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        if (e.type === "pointerup" && moved < CLICK_SLOP_PX) {
          yawVelocity = 0;
          stamp();
        }
        drag = null;
        canvas.style.cursor = "grab";
        lastInteraction = performance.now();
      };
      // Anywhere on the page, a mouse makes the stamper lean towards it.
      const onWindowPointerMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const rect = host.getBoundingClientRect();
        const nx = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2);
        const ny = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2);
        hoverTargetX = Math.max(-1, Math.min(1, nx));
        hoverTargetY = Math.max(-1, Math.min(1, ny));
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          stamp();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          yawVelocity += e.key === "ArrowLeft" ? -2.5 : 2.5;
          lastInteraction = performance.now();
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          pitch = Math.max(
            -PITCH_LIMIT,
            Math.min(PITCH_LIMIT, pitch + (e.key === "ArrowUp" ? -0.15 : 0.15)),
          );
          lastInteraction = performance.now();
        }
      };
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
      host.addEventListener("keydown", onKeyDown);

      // ---- Sizing ---------------------------------------------------------
      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // Keep the whole stamper in frame on narrow containers.
        camera.position.z = camera.aspect < 0.8 ? 8 / camera.aspect ** 0.5 : 8;
        camera.updateProjectionMatrix();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      // ---- Loop -----------------------------------------------------------
      const timer = new THREE.Timer();
      const damp = (from: number, to: number, rate: number, dt: number) =>
        from + (to - from) * (1 - Math.exp(-rate * dt));

      const frame = () => {
        timer.update();
        const dt = Math.min(timer.getDelta(), 1 / 20);
        const now = performance.now();
        const t = timer.getElapsed();
        const idle = !drag && now - lastInteraction > IDLE_AFTER_MS;

        if (!drag) {
          yawVelocity = damp(
            yawVelocity,
            idle && !reduceMotion ? AUTO_SPIN : 0,
            idle ? 1.2 : 2.6,
            dt,
          );
          yaw += yawVelocity * dt;
          pitch = damp(pitch, 0, 1.6, dt);
        }
        hoverX = damp(hoverX, hoverTargetX, 4, dt);
        hoverY = damp(hoverY, hoverTargetY, 4, dt);

        // Press: a quick drop, then back up with a small overshoot.
        let press = 0;
        if (pressStart >= 0) {
          const p = (now - pressStart) / 1000 / PRESS_SECONDS;
          if (p >= 1) {
            pressStart = -1;
          } else if (p < 0.28) {
            press = 1 - (1 - p / 0.28) ** 3;
          } else {
            const q = (p - 0.28) / 0.72;
            press = (1 - q) * Math.cos(q * Math.PI * 1.5) ** 2 * (1 - q);
            if (!pressFired) {
              pressFired = true;
              onStampRef.current?.();
            }
          }
        }

        const float = reduceMotion ? 0 : Math.sin(t * 1.3) * 0.07;
        lift.position.y = float - press * 0.32;
        lift.scale.set(1 + press * 0.02, 1 - press * 0.045, 1 + press * 0.02);
        spin.rotation.y = yaw + hoverX * 0.45;
        lean.rotation.x = BASE_TILT * (1 - press * 0.85) + pitch + hoverY * 0.22;
        lean.rotation.z = -0.1 * (1 - press) - hoverX * 0.08;

        const closeness = Math.min(1, Math.max(0, -lift.position.y / 0.32)); // 0 resting .. 1 pressed down
        shadow.scale.setScalar(0.85 + closeness * 0.25);
        (shadow.material as THREE_NS.MeshBasicMaterial).opacity = 0.55 + closeness * 0.4;

        renderer.render(scene, camera);
      };

      // Only draw while on screen.
      const visibility = new IntersectionObserver(([entry]) => {
        renderer.setAnimationLoop(entry?.isIntersecting ? frame : null);
        if (entry?.isIntersecting) timer.reset();
      });
      visibility.observe(host);

      frame();
      setStatus("ready");

      teardown = () => {
        visibility.disconnect();
        resizeObserver.disconnect();
        renderer.setAnimationLoop(null);
        timer.dispose();
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        window.removeEventListener("pointermove", onWindowPointerMove);
        host.removeEventListener("keydown", onKeyDown);
        scene.traverse((object) => {
          const mesh = object as THREE_NS.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          (mesh.material as THREE_NS.Material).dispose();
        });
        shadowTexture.dispose();
        envMap.dispose();
        pmrem.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })().catch(() => {
      if (!disposed) setStatus("error");
    });

    return () => {
      disposed = true;
      teardown();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(e) => {
        // Before the model loads (or without WebGL) Enter still stamps.
        if (status !== "ready" && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onStamp?.();
        }
      }}
      className={`relative select-none rounded-[2rem] outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 ${className}`}
    >
      {status !== "ready" ? (
        <div
          aria-hidden
          onClick={() => onStamp?.()}
          className="absolute inset-0 flex cursor-pointer items-center justify-center"
        >
          <span className={status === "loading" ? "animate-pulse" : ""}>
            <LogoMark size={140} />
          </span>
        </div>
      ) : null}
    </div>
  );
}
