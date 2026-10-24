"use client";
// The thinking orb: the face of Ask the books. A sphere of points that rests, listens to the microphone, works
// through the question and talks with the answer's audio. It is the push to talk control's picture; the button
// around it (panel.tsx) owns the behaviour.
//
// Ported from Speaking Orb in Ship Notes components (github.com/aqualang89/shipnotes-components, MIT, copyright 2026
// Ship Notes): the point sphere, its shapes per state, the blend between them and the syllable rings. Changed for
// Fermata: colours come from our tokens (navy at rest, blue while listening and speaking, blue toward info while it
// works; never amber, never red), the points are drawn for a cream page instead of a dark one, the particle captions
// are left out (the panel captions the answer as text), and it reads levels from voice.ts.
//
// The MIT notice, as the license asks:
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright
// notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
// OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
import { useEffect, useRef } from "react";
import { voiceLevel } from "./voice";

export type OrbState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

// Shapes, in blend order: a breathing wave sphere (idle and listening), the thinking knot, three tilted rings
// (writing down the question), the talking sphere.
const SHAPES = ["wave", "knot", "rings", "talk"] as const;
const SHAPE_OF: Record<OrbState, number> = { idle: 0, listening: 0, transcribing: 2, thinking: 1, speaking: 3 };
const TAU = Math.PI * 2;
// The drawing's own units: the shapes are about 400 across, so a 560 view lets the sphere fill most of the orb and
// leaves room for the waves and the glow.
const VIEW = 560, C = VIEW / 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

type Seed = { x: number; y: number; z: number; a: number; u: number; sa: number; ca: number };
const seedCache = new Map<number, Seed[]>();
function seedsFor(count: number): Seed[] {
  const have = seedCache.get(count);
  if (have) return have;
  // A dense Fibonacci sphere shows moire stripes, so past 1000 points each one gets a small fixed nudge.
  const jitter = count > 1000 ? ((1 - 1000 / count) * 1.6) / Math.sqrt(count) : 0;
  const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const seeds = Array.from({ length: count }, (_, i) => {
    const y0 = 1 - (2 * (i + 0.5)) / count, a = i * 2.399963229728653 + (rnd(i) - 0.5) * jitter * 6;
    const y = clamp(y0 + (rnd(i + 0.37) - 0.5) * jitter, -1, 1);
    const r = Math.sqrt(1 - y * y);
    return { x: Math.cos(a) * r, y, z: Math.sin(a) * r, a, u: i / count, sa: Math.sin(a), ca: Math.cos(a) };
  });
  seedCache.set(count, seeds);
  return seeds;
}
const BAND_TILT = [[0.32, 0], [-0.72, 1.02], [1.08, -0.82]].map(([tilt, rot]) => [Math.cos(tilt + 1), Math.sin(tilt + 1), Math.cos(rot), Math.sin(rot)]);

// Points drawn for a light page: normal (premultiplied) blending and a small solid disc per point (the original's
// glowing skirt only reads on black), and the points nearest the eye deepen toward navy instead of sparking white.
const VS = `attribute vec2 p;attribute vec3 d;uniform vec2 res;varying float a;varying float s;
void main(){float size=max(d.x,2.0);float k=min(1.0,d.x*d.x/(size*size));a=d.y*k;s=d.z*k;
gl_Position=vec4(p/res*2.0-1.0,0.0,1.0)*vec4(1,-1,1,1);gl_PointSize=size;}`;
const FS = `precision mediump float;uniform vec3 col;uniform vec3 core;varying float a;varying float s;
void main(){float r=length(gl_PointCoord-.5)*2.0;if(r>1.0)discard;
float dot=1.0-smoothstep(.55,1.0,r);
float al=min(1.0,dot*a);vec3 c=mix(col,core,clamp(s,0.0,1.0));
gl_FragColor=vec4(c*al,al);}`;

type GL = { gl: WebGLRenderingContext; res: WebGLUniformLocation | null; col: WebGLUniformLocation | null; core: WebGLUniformLocation | null };
function setupGL(canvas: HTMLCanvasElement): GL | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  const lp = gl.getAttribLocation(prog, "p"), ld = gl.getAttribLocation(prog, "d");
  gl.enableVertexAttribArray(lp); gl.enableVertexAttribArray(ld);
  gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(ld, 3, gl.FLOAT, false, 20, 8);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return { gl, res: gl.getUniformLocation(prog, "res"), col: gl.getUniformLocation(prog, "col"), core: gl.getUniformLocation(prog, "core") };
}

type RGB = [number, number, number];
// Token colours as numbers, read from the page so the orb follows globals.css.
function tokenRGB(name: string): RGB {
  const probe = document.createElement("canvas").getContext("2d");
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!probe || !raw) return [31, 95, 192];
  probe.fillStyle = raw;
  const hex = probe.fillStyle; // normalised to #rrggbb
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [31, 95, 192];
}
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function ThinkingOrb({ state, className = "" }: { state: OrbState; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const kick = useRef<() => void>(() => {});

  useEffect(() => { stateRef.current = state; kick.current(); }, [state]);

  useEffect(() => {
    const el = box.current, haloCanvas = haloRef.current, dots = dotsRef.current;
    if (!el || !haloCanvas || !dots) return;
    const halo = haloCanvas.getContext("2d");
    const glx = setupGL(dots);
    const d2 = glx ? null : dots.getContext("2d");
    const accent = tokenRGB("--color-accent"), info = tokenRGB("--color-info"), navy = tokenRGB("--color-heading-2"), night = tokenRGB("--color-heading");
    const palette: Record<OrbState, RGB> = { idle: navy, listening: accent, transcribing: mix(accent, info, 0.35), thinking: mix(accent, info, 0.55), speaking: accent };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let size = 0, unit = 1, dpr = 1, dotScale = 1, count = 1200, raf = 0, last = 0, time = 0, env = 0, level = 0.12;
    let visible = true;
    let weights: number[] = SHAPES.map((_, i) => (i === SHAPE_OF[stateRef.current] ? 1 : 0));
    let colour: RGB = palette[stateRef.current];
    let onsets: number[] = [];
    let buf = new Float32Array(0);

    const resize = () => {
      const w = el.getBoundingClientRect().width;
      const k = Math.min(window.devicePixelRatio || 1, 2);
      dpr = k;
      dotScale = clamp(w / 190, 0.7, 1.15);
      size = Math.max(1, Math.round(w * k));
      haloCanvas.width = haloCanvas.height = dots.width = dots.height = size;
      unit = size / VIEW;
      // Fewer points on a small orb, so it reads as a sphere of points and not a solid ball.
      count = Math.round(clamp((w * w) / 9, 800, 6000));
      paint();
    };

    const paint = () => {
      if (!size || !halo) return;
      const still = reduce.matches;
      const t = still ? 0 : time, e = still ? 0 : env;
      const [w0, w1, w2, w3] = weights;
      halo.setTransform(unit, 0, 0, unit, 0, 0);
      halo.clearRect(0, 0, VIEW, VIEW);
      const rgb = colour.map(Math.round).join(",");
      const glow = 0.1 + 0.08 * e * w3 + 0.06 * level * w0;
      const g = halo.createRadialGradient(C, C, 10, C, C, C - 4 + 20 * e * w3);
      g.addColorStop(0, `rgba(${rgb},${glow})`); g.addColorStop(0.55, `rgba(${rgb},${glow * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
      halo.fillStyle = g;
      halo.fillRect(0, 0, VIEW, VIEW);

      const seeds = seedsFor(count);
      if (buf.length < count * 5) buf = new Float32Array(count * 5);
      const spin = t * 0.23, cs = Math.cos(spin), sn = Math.sin(spin), wave = 6 + level * 26;
      const rings = onsets.map((o) => { const a = t - o; return { h: -1.15 + a * 2.1, g: Math.pow(1 - a / 1.2, 2) }; });
      for (let i = 0; i < count; i++) {
        const p = seeds[i];
        let vx = 0, vy = 0, vz = 0, lit = 0;
        if (w0 > 0.001) {
          const x = p.x * cs + p.z * sn, z = p.z * cs - p.x * sn;
          const r = (192 + Math.sin(p.y * 11 - t * 3 + p.a * 0.03) * wave + Math.sin(p.a * 0.17 + t * 2) * 5) * w0;
          vx += x * r; vy += p.y * r; vz += z * r;
        }
        if (w1 > 0.001) {
          const theta = p.u * TAU * 3 + t * 0.57, phi = p.u * TAU * 8 - t * 0.48, rt = 137 + 41 * Math.cos(phi) + 24 * p.sa;
          const bx = rt * Math.cos(theta), bz = rt * Math.sin(theta), by = 65 * Math.sin(phi) + 17 * p.y;
          vx += bx * w1; vy += (by * 0.77 - bz * 0.52) * w1; vz += (by * 0.52 + bz * 0.77) * w1;
        }
        if (w2 > 0.001) {
          const band = i % 3, angle = p.u * TAU * 5 + t * (0.7 + band * 0.2), radius = 196 + 11 * p.sa;
          const sx = Math.cos(angle) * radius, sy = Math.sin(angle) * radius;
          const [tc, ts, cr, sr] = BAND_TILT[band];
          const sy2 = sy * tc, sz = sy * ts;
          vx += (sx * cr - sy2 * sr) * w2; vy += (sx * sr + sy2 * cr) * w2; vz += sz * w2;
        }
        if (w3 > 0.001) {
          // Speaking: the voice inflates a soft lobed sphere, and every syllable sends a ring from chin to crown.
          const x = p.x * cs + p.z * sn, z = p.z * cs - p.x * sn;
          const lobe = Math.sin(x * 2.3 + t * 1.4) * Math.sin(p.y * 2.9 - t * 1.1) * Math.cos(z * 2.1 + t * 0.8);
          let r = 184 + 16 * e + lobe * (5 + 19 * e) + Math.sin(p.y * 7 - t * 2.2) * 3 * e;
          for (const R of rings) { const d = (p.y - R.h) / 0.15, gg = Math.exp(-d * d) * R.g; r += 7 * gg; lit += gg; }
          vx += x * r * w3; vy += p.y * r * w3; vz += z * r * w3; lit *= w3;
        }
        const depth = clamp((vz + 240) / 480), persp = 850 / (850 - vz), alpha = 0.14 + 0.72 * depth + 0.25 * e * w3;
        // Point size in device pixels: about 1 css px at the back, 2.5 at the front.
        const r = (1 + depth * 1.5) * (0.8 + 0.2 * Math.sin(p.a + t * 1.6)) * (1 + 0.5 * Math.min(1, lit)) * dotScale * dpr, o = i * 5;
        buf[o] = (C + vx * persp) * unit; buf[o + 1] = (C + vy * persp) * unit; buf[o + 2] = r;
        buf[o + 3] = Math.min(1, alpha + 1.2 * lit);
        buf[o + 4] = clamp((depth - 0.62) * 1.6 + lit * 0.8);
      }
      if (glx) {
        const { gl, res, col, core } = glx;
        gl.viewport(0, 0, size, size); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(res, size, size);
        gl.uniform3f(col, colour[0] / 255, colour[1] / 255, colour[2] / 255);
        gl.uniform3f(core, night[0] / 255, night[1] / 255, night[2] / 255);
        gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, count * 5), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.POINTS, 0, count);
      } else if (d2) {
        // Canvas fallback without WebGL: plain round points, the core colour for the nearest.
        d2.setTransform(1, 0, 0, 1, 0, 0); d2.clearRect(0, 0, size, size);
        const c = `rgb(${rgb})`, n = `rgb(${night.join(",")})`;
        for (let i = 0; i < count; i++) {
          const o = i * 5, s = buf[o + 2] * 0.4;
          d2.globalAlpha = buf[o + 3]; d2.fillStyle = buf[o + 4] > 0.5 ? n : c;
          d2.beginPath(); d2.arc(buf[o], buf[o + 1], Math.max(0.6, s), 0, TAU); d2.fill();
        }
        d2.globalAlpha = 1;
      }
    };

    const tick = (now: number) => {
      raf = 0;
      const st = stateRef.current;
      const target = SHAPE_OF[st];
      if (reduce.matches) {
        // Reduced motion: no loop. Snap to the state's shape and colour and draw one still frame.
        weights = SHAPES.map((_, i) => (i === target ? 1 : 0)); colour = palette[st]; env = 0; level = 0.12; onsets = []; last = 0;
        paint();
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now; time += dt;
      const k = 1 - Math.exp(-dt * 6);
      weights = weights.map((w, i) => w + ((i === target ? 1 : 0) - w) * k);
      colour = mix(colour, palette[st], 1 - Math.exp(-dt * 5));
      const v = st === "listening" || st === "speaking" ? voiceLevel() : 0;
      level += ((st === "listening" ? 0.15 + v * 0.85 : 0.12) - level) * (1 - Math.exp(-dt * 10));
      const prev = env;
      const raw = st === "speaking" ? v : 0;
      env += (raw - env) * (raw > env ? 0.55 : 0.18);
      if (env - prev > 0.06 && time - (onsets.at(-1) ?? -1) > 0.12) onsets.push(time);
      onsets = onsets.filter((o) => time - o < 1.2);
      paint();
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
    kick.current = start;

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); });
    io.observe(el);
    const onVis = () => { if (!document.hidden) start(); };
    document.addEventListener("visibilitychange", onVis);
    reduce.addEventListener("change", start);
    start();
    return () => {
      cancelAnimationFrame(raf); raf = 0; kick.current = () => {};
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      reduce.removeEventListener("change", start);
    };
  }, []);

  return (
    <div ref={box} aria-hidden className={className || "relative aspect-square w-full"}>
      <canvas ref={haloRef} className="absolute inset-0 size-full" />
      <canvas ref={dotsRef} className="absolute inset-0 size-full" />
    </div>
  );
}
