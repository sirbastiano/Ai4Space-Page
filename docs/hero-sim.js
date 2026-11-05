/* AI4Space hero "mission console": three simulated channels drawn as HUD displays on one canvas.
 * CH-1 cooperative Mars exploration (frontier allocation on a shared map), CH-2 launch with hot
 * staging, booster return and transfer-orbit insertion, CH-3 Earth-observation constellation relaying flood and
 * wildfire alerts over inter-satellite links. Plain JS, no dependencies. */
(function () {
    'use strict';

    const hero = document.querySelector('.hero');
    const canvas = document.getElementById('hero-canvas');
    const stageEl = document.querySelector('.hero-stage');
    if (!hero || !canvas || !stageEl || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const buttons = Array.from(document.querySelectorAll('.channel-btn'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const COL = {
        cyan: '#5ad1ff',
        cyanDim: 'rgba(90, 209, 255, 0.16)',
        cyanMid: 'rgba(90, 209, 255, 0.45)',
        amber: '#ffb14a',
        red: '#ff5a4f',
        blue: '#3d8bff',
        rust: '255, 140, 80',
        text: '#d8e3ec',
        dim: 'rgba(216, 227, 236, 0.55)',
        bg: '#05080d'
    };
    const TAU = Math.PI * 2;
    const DEG = Math.PI / 180;
    const CHANNEL_SECONDS = 14;
    const FADE_SECONDS = 0.35;

    let W = 0, H = 0, dpr = 1, small = false;
    let stage = { x: 0, y: 0, w: 0, h: 0 };
    let stars = [];
    let met = 0;

    /* ---------- small helpers ---------- */

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const hyp = (v) => Math.hypot(v[0], v[1]);

    function mono(size, weight) {
        return `${weight || 500} ${size}px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    }

    function text(str, x, y, color, size, align, weight) {
        ctx.font = mono(size || 11, weight);
        ctx.fillStyle = color;
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(str, x, y);
    }

    function brackets(x, y, w, h, len, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
        ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
        ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
        ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
        ctx.stroke();
    }

    function polyline(pts, upto) {
        const n = upto === undefined ? pts.length : Math.max(0, Math.min(pts.length, upto));
        if (n < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
    }

    function glowDot(x, y, r, color) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function pushLog(scene, line) {
        scene.logs.push(line);
        if (scene.logs.length > 5) scene.logs.shift();
    }

    function fmtClock(seconds) {
        const s = Math.floor(seconds);
        const hh = String(Math.floor(s / 3600)).padStart(3, '0');
        const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    /* =====================================================================
     * CH-2  Autonomous GNC: launch with hot staging. The upper stage ignites while still
     * attached, the booster flips, burns back and lands near the pad, and the upper stage
     * reaches a parking orbit before burning into a transfer orbit. Side view of Earth with
     * altitudes exaggerated so the whole profile fits; the transfer orbit coasts with
     * constant angular momentum (r² dθ/dt = const) and speed from vis-viva.
     * ===================================================================== */
    const gnc = (function () {
        const scene = {
            id: 'gnc',
            title: 'CH-2 // AUTONOMOUS GNC',
            subtitle: 'HOT STAGING · BOOSTER RETURN · TRANSFER ORBIT INSERTION',
            logs: []
        };
        // event times in scene seconds
        const T = {
            liftoff: 0.6, maxQ: 2.3, hot: 4.3, sep: 4.65, flip: 5.0, boostback: [5.5, 6.6], seco: 8.6,
            entry: [9.0, 9.6], landing: [10.6, 11.3], transfer: [10.0, 11.0], end: 15.5
        };
        const PARK_KM = 200;
        const SEP_KM = 70;
        const ECC = 0.85;                       // transfer orbit eccentricity
        const RISE = 6;                         // visual exaggeration of the transfer orbit's climb
        const MET_SCALE = 50;                   // scene seconds -> mission seconds
        const EVENTS = [
            [T.liftoff, 'LIFTOFF · ALL ENGINES NOMINAL'],
            [T.maxQ, 'MAX-Q · THROTTLE BUCKET'],
            [T.hot, 'HOT STAGING · S2 IGNITION BEFORE SEPARATION'],
            [T.sep, 'STAGE SEPARATION CONFIRMED'],
            [T.boostback[0], 'S1 FLIP COMPLETE · BOOSTBACK BURN → LZ-1'],
            [T.seco, `S2 ENGINE CUTOFF · PARKING ORBIT ${PARK_KM} km`],
            [T.entry[0], 'S1 ENTRY BURN'],
            [T.transfer[0], 'S2 TRANSFER BURN · GTO INSERTION'],
            [T.landing[0], 'S1 LANDING BURN · LEGS DEPLOYED'],
            [T.transfer[1], 'S2 COASTING TO APOGEE 35 786 km'],
            [T.landing[1], 'S1 TOUCHDOWN AT LZ-1']
        ];
        let s = null, g = null;

        const pos = (phi, r) => [g.cx + r * Math.sin(phi), g.cy - r * Math.cos(phi)];
        const transferR = (nu) => (g.rp * (1 + ECC)) / (1 + ECC * Math.cos(nu));
        const transferShown = (nu) => g.rp + (transferR(nu) - g.rp) * RISE;
        const within = (t, span) => t >= span[0] && t <= span[1];

        function geometry() {
            const { x, y, w, h } = stage;
            const R = Math.max(w, h) * 1.05;
            const ang = (frac) => Math.asin(clamp(((frac - 0.5) * w) / R, -1, 1));
            const hp = h * 0.42;
            g = {
                R, cx: x + w * 0.5, cy: y + h * 0.7 + R, hp, hs: (hp * SEP_KM) / PARK_KM,
                pad: ang(0.12), lz: ang(0.19), sep: ang(0.3), seco: ang(0.46)
            };
            g.omegaPark = ((g.seco - g.sep) / (T.seco - T.sep)) * 1.15;
            g.burn = g.seco + g.omegaPark * (T.transfer[0] - T.seco);
            g.rp = g.R + g.hp;
            // altitude-per-angle at the end of the ascent, expressed for the post-separation segment
            const ascentSlope = (g.hs * 1.25) / (2.2 * (g.sep - g.pad));
            g.climbSlope = clamp((ascentSlope * (g.seco - g.sep)) / (g.hp - g.hs), 0, 3);
        }

        function ascent(t) {
            const u = clamp((t - T.liftoff) / (T.sep - T.liftoff), 0, 1);
            return [g.pad + (g.sep - g.pad) * Math.pow(u, 2.2), g.R + g.hs * Math.pow(u, 1.25)];
        }

        function upperPolar(t) {
            if (t <= T.sep) return ascent(t);
            if (t <= T.seco) {
                // cubic Hermite climb: matches the ascent's flight-path angle at separation, levels off at SECO
                const u = (t - T.sep) / (T.seco - T.sep);
                const m = g.climbSlope;
                const f = m * u + (3 - 2 * m) * u * u + (m - 2) * u * u * u;
                return [g.sep + (g.seco - g.sep) * u, g.R + g.hs + (g.hp - g.hs) * f];
            }
            if (t <= T.transfer[0]) return [g.seco + g.omegaPark * (t - T.seco), g.rp];
            return [g.burn + s.nu, transferShown(s.nu)];
        }

        /* Return-to-launch-site arc: quadratic Bezier in (angle, radius), slowing toward touchdown. */
        function boosterPolar(t) {
            if (t <= T.sep) return ascent(t);
            const u0 = clamp((t - T.sep) / (T.landing[1] - T.sep), 0, 1);
            const u = 1 - Math.pow(1 - u0, 1.7);
            const p0 = [g.sep, g.R + g.hs];
            const p1 = [g.sep + 0.45 * (g.sep - g.pad), g.R + g.hs * 2.2];
            const p2 = [g.lz, g.R];
            const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
            return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
        }

        function upperSpeed(t, r) {
            const table = [[0, 0], [T.liftoff, 0], [T.sep, 2.1], [T.seco, 7.8], [T.transfer[0], 7.8], [T.transfer[1], 10.2]];
            if (t >= T.transfer[1]) {
                const a = g.rp / (1 - ECC);
                return 10.2 * Math.sqrt((2 / r - 1 / a) / (2 / g.rp - 1 / a));
            }
            for (let i = 1; i < table.length; i++) {
                if (t <= table[i][0]) {
                    const [t0, v0] = table[i - 1], [t1, v1] = table[i];
                    return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-6, t1 - t0);
                }
            }
            return 7.8;
        }

        scene.reset = function () {
            s = { t: 0, nu: 0, fired: 0, trailA: [], trailU: [], trailB: [], headU: -Math.PI / 2, headB: -Math.PI / 2 };
            scene.logs = [];
            pushLog(scene, 'T-0 · GUIDANCE INTERNAL · TARGET GTO');
        };

        scene.resize = function () {
            geometry();
            if (!s) scene.reset();
        };

        scene.update = function (dt) {
            const prevU = pos(...upperPolar(s.t));
            const prevB = pos(...boosterPolar(s.t));
            s.t += dt;
            if (s.t > T.transfer[0]) {
                const r = transferR(s.nu);
                s.nu += g.omegaPark * Math.sqrt(1 + ECC) * (g.rp / r) * (g.rp / r) * dt;
            }
            while (s.fired < EVENTS.length && s.t >= EVENTS[s.fired][0]) pushLog(scene, EVENTS[s.fired++][1]);

            const pu = pos(...upperPolar(s.t));
            const pb = pos(...boosterPolar(s.t));
            if (Math.hypot(pu[0] - prevU[0], pu[1] - prevU[1]) > 0.01) s.headU = Math.atan2(pu[1] - prevU[1], pu[0] - prevU[0]);
            if (Math.hypot(pb[0] - prevB[0], pb[1] - prevB[1]) > 0.01) s.headB = Math.atan2(pb[1] - prevB[1], pb[0] - prevB[0]);

            if (s.t > T.liftoff && s.t <= T.sep) s.trailA.push(pu);
            if (s.t > T.sep) { s.trailU.push(pu); if (s.t <= T.landing[1]) s.trailB.push(pb); }
            if (s.trailU.length > 900) s.trailU.shift();
            if (s.t > T.end) scene.reset();
        };

        /* Booster attitude: along velocity, flipping to engine-first after separation. */
        function boosterAttitude(t) {
            if (t <= T.liftoff) return g.pad - Math.PI / 2;
            if (t <= T.flip) return s.headB;
            if (t >= T.landing[1]) return g.lz - Math.PI / 2;
            const k = clamp((t - T.flip) / 0.5, 0, 1);
            return s.headB + Math.PI * k;
        }

        function plume(len, width) {
            const flick = 0.75 + Math.random() * 0.45;
            ctx.fillStyle = 'rgba(255, 177, 74, 0.85)';
            ctx.beginPath(); ctx.moveTo(0, -width); ctx.lineTo(-len * flick, 0); ctx.lineTo(0, width); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath(); ctx.moveTo(0, -width * 0.45); ctx.lineTo(-len * 0.4 * flick, 0); ctx.lineTo(0, width * 0.45); ctx.closePath(); ctx.fill();
        }

        /* Draw a stage in its own frame: nose toward +x, engine at x = from. */
        function body(from, to, wd, nose, fins) {
            ctx.fillStyle = 'rgba(216, 227, 236, 0.18)';
            ctx.strokeStyle = COL.text;
            ctx.lineWidth = 1;
            ctx.fillRect(from, -wd / 2, to - from, wd);
            ctx.strokeRect(from, -wd / 2, to - from, wd);
            if (nose) {
                ctx.beginPath(); ctx.moveTo(to, -wd / 2); ctx.lineTo(to + wd * 1.4, 0); ctx.lineTo(to, wd / 2); ctx.stroke();
            }
            if (fins) {
                ctx.strokeStyle = COL.cyan;
                ctx.beginPath(); ctx.moveTo(to - 1, -wd / 2); ctx.lineTo(to - 1, -wd / 2 - 3); ctx.moveTo(to - 1, wd / 2); ctx.lineTo(to - 1, wd / 2 + 3); ctx.stroke();
            }
        }

        scene.draw = function () {
            const { x, y, w, h } = stage;
            const t = s.t;
            const scale = small ? 0.85 : 1;
            const LB = 24 * scale, LU = 12 * scale, WD = 4.5 * scale;

            // Earth, atmosphere and reference altitudes
            const atm = ctx.createRadialGradient(g.cx, g.cy, g.R, g.cx, g.cy, g.R + g.hp * 0.45);
            atm.addColorStop(0, 'rgba(61, 139, 255, 0.28)');
            atm.addColorStop(1, 'rgba(61, 139, 255, 0)');
            ctx.fillStyle = atm;
            ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R + g.hp * 0.45, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(4, 12, 24, 0.96)';
            ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, TAU); ctx.fill();
            ctx.strokeStyle = 'rgba(90, 209, 255, 0.6)';
            ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, TAU); ctx.stroke();
            ctx.strokeStyle = 'rgba(90, 209, 255, 0.1)';
            for (let k = 1; k < 7; k++) {
                ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R - k * 26, 0, TAU); ctx.stroke();
            }
            ctx.setLineDash([2, 6]);
            ctx.strokeStyle = 'rgba(216, 227, 236, 0.18)';
            ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R + g.hp * 0.5, 0, TAU); ctx.stroke();
            const karman = pos(g.lz - 0.02, g.R + g.hp * 0.5);
            text('100 km', karman[0], karman[1] - 4, COL.dim, 9);

            // parking orbit and transfer orbit predictions
            if (t > T.hot) {
                ctx.strokeStyle = 'rgba(90, 209, 255, 0.35)';
                ctx.beginPath(); ctx.arc(g.cx, g.cy, g.rp, 0, TAU); ctx.stroke();
                const lab = pos(g.seco - 0.05, g.rp);
                text(`PARKING ORBIT ${PARK_KM} km`, lab[0], lab[1] - 8, COL.cyanMid, 9, 'center');
            }
            if (t > T.transfer[0] - 0.4) {
                ctx.strokeStyle = 'rgba(255, 177, 74, 0.6)';
                ctx.beginPath();
                let lastIn = null;
                for (let k = 0; k <= 90; k++) {
                    const nu = (k / 90) * Math.PI;
                    const p = pos(g.burn + nu, transferShown(nu));
                    if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
                    if (p[0] > x + 20 && p[0] < x + w - 20 && p[1] > y + 60 && p[1] < y + h - 20) lastIn = p;
                }
                ctx.stroke();
                if (lastIn) text('TRANSFER ORBIT → APOGEE 35 786 km', lastIn[0] - 6, lastIn[1] + 14, COL.amber, 9, 'right');
            }
            ctx.setLineDash([]);

            // pads
            [[g.pad, 'LC-1'], [g.lz, 'LZ-1']].forEach(([phi, name]) => {
                const p = pos(phi, g.R);
                ctx.save();
                ctx.translate(p[0], p[1]);
                ctx.rotate(phi);
                ctx.strokeStyle = COL.amber;
                ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
                if (name === 'LZ-1') { ctx.beginPath(); ctx.arc(0, -0.5, 5, Math.PI, TAU); ctx.stroke(); }
                ctx.restore();
                text(name, p[0], p[1] + 16, COL.amber, 9, 'center');
            });

            // trails
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = 'rgba(90, 209, 255, 0.85)';
            polyline(s.trailA);
            polyline(s.trailU);
            ctx.strokeStyle = 'rgba(255, 177, 74, 0.7)';
            ctx.setLineDash([3, 4]);
            polyline(s.trailB);
            ctx.setLineDash([]);
            ctx.lineWidth = 1;

            // liftoff exhaust cloud
            if (t > T.liftoff - 0.2 && t < T.liftoff + 1.6) {
                const p = pos(g.pad, g.R);
                const k = clamp((t - T.liftoff + 0.2) / 1.8, 0, 1);
                ctx.fillStyle = `rgba(216, 227, 236, ${0.25 * (1 - k)})`;
                ctx.beginPath(); ctx.ellipse(p[0], p[1] - 3, 10 + 26 * k, 5 + 8 * k, g.pad, 0, TAU); ctx.fill();
            }

            if (t <= T.sep) {
                // stacked vehicle
                const p = pos(...upperPolar(t));
                const a = t <= T.liftoff ? -Math.PI / 2 + g.pad : s.headU;
                ctx.save();
                ctx.translate(p[0], p[1]);
                ctx.rotate(a);
                if (t > T.liftoff && t < T.hot + 0.1) { ctx.save(); ctx.translate(-LB, 0); plume(26 * scale, WD * 0.9); ctx.restore(); }
                body(-LB, 0, WD, false, false);
                body(1, LU, WD * 0.9, true, false);
                if (t > T.hot) {
                    // hot-staging flash through the open interstage
                    const f = 0.6 + Math.random() * 0.4;
                    ctx.fillStyle = `rgba(255, 177, 74, ${0.8 * f})`;
                    ctx.beginPath(); ctx.arc(0.5, 0, 6 * f * scale, 0, TAU); ctx.fill();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.beginPath(); ctx.arc(0.5, 0, 2.5 * scale, 0, TAU); ctx.fill();
                }
                ctx.restore();
                if (t > T.hot) text('HOT STAGING', p[0] + 14, p[1] - 14, COL.amber, 10, 'left', 600);
                else if (t > T.liftoff) text('S1+S2', p[0] + 12, p[1] - 10, COL.cyan, 9);
            } else {
                // upper stage
                const pu = pos(...upperPolar(t));
                ctx.save();
                ctx.translate(pu[0], pu[1]);
                ctx.rotate(s.headU);
                const s2Burn = (t > T.sep && t < T.seco) || within(t, T.transfer);
                if (s2Burn) { ctx.save(); ctx.translate(-LU / 2, 0); plume(18 * scale, WD * 0.75); ctx.restore(); }
                body(-LU / 2, LU / 2, WD * 0.9, true, false);
                ctx.restore();
                glowDot(pu[0], pu[1], 1.6, COL.cyan);
                text('S2', pu[0] + 10, pu[1] - 10, COL.cyan, 10, 'left', 600);

                // booster
                const pb = pos(...boosterPolar(t));
                const ab = boosterAttitude(t);
                ctx.save();
                ctx.translate(pb[0], pb[1]);
                ctx.rotate(ab);
                const s1Burn = within(t, T.boostback) || within(t, T.entry) || within(t, T.landing);
                if (s1Burn) { ctx.save(); ctx.translate(-LB / 2, 0); plume(16 * scale, WD * 0.85); ctx.restore(); }
                body(-LB / 2, LB / 2, WD, false, true);
                if (t > T.landing[0] + 0.2) {
                    ctx.strokeStyle = COL.text;
                    ctx.beginPath();
                    ctx.moveTo(-LB / 2 + 3, -WD / 2); ctx.lineTo(-LB / 2 - 3, -WD / 2 - 5);
                    ctx.moveTo(-LB / 2 + 3, WD / 2); ctx.lineTo(-LB / 2 - 3, WD / 2 + 5);
                    ctx.stroke();
                }
                ctx.restore();
                text('S1', pb[0] + 10, pb[1] - 10, COL.amber, 10, 'left', 600);
                if (t >= T.landing[1]) text('LANDED ✓', pb[0] + 10, pb[1] + 2, COL.amber, 9);
            }
        };

        scene.stats = function () {
            const t = s.t;
            const r = t > T.transfer[0] ? transferR(s.nu) : upperPolar(t)[1];
            const met = Math.max(0, (t - T.liftoff) * MET_SCALE);
            const mm = String(Math.floor(met / 60)).padStart(2, '0');
            const ss = String(Math.floor(met % 60)).padStart(2, '0');
            let s1 = 'ON PAD';
            if (t >= T.landing[1]) s1 = 'LANDED';
            else if (within(t, T.landing)) s1 = 'LANDING BURN';
            else if (within(t, T.entry)) s1 = 'ENTRY BURN';
            else if (within(t, T.boostback)) s1 = 'BOOSTBACK';
            else if (t > T.sep) s1 = 'COAST';
            else if (t > T.liftoff) s1 = 'ASCENT';
            return [
                ['T+', `${mm}:${ss}`],
                ['S2 ALTITUDE', `${Math.max(0, ((r - g.R) / g.hp) * PARK_KM).toFixed(0)} km`],
                ['S2 VELOCITY', `${upperSpeed(t, r).toFixed(2)} km/s`],
                ['S1 BOOSTER', s1]
            ];
        };

        return scene;
    })();

    /* =====================================================================
     * CH-1  Mars: three rovers and a helicopter share one map and split the
     * unexplored frontier between them; found sample sites get a rover assigned.
     * ===================================================================== */
    const mars = (function () {
        const scene = {
            id: 'mars',
            title: 'CH-1 // MARS SURFACE OPS',
            subtitle: 'MULTI-ROBOT EXPLORATION · SHARED MAP · FRONTIER ALLOCATION',
            logs: []
        };
        const GX = 72, GY = 44;
        let seed = 1, terrain = null, cells = null, FX = 0, FY = 0, cw = 0, ch = 0;
        let agents = [], sites = [], packets = [], links = [];
        let msgs = 0, explored = 0, packetT = 0, finished = -1;

        function hash(ix, iy) {
            const v = Math.sin(ix * 127.1 + iy * 311.7 + seed * 17.13) * 43758.5453;
            return v - Math.floor(v);
        }
        function vnoise(px, py) {
            const xi = Math.floor(px), yi = Math.floor(py), xf = px - xi, yf = py - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
            return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
        }
        function fbm(px, py) {
            let sum = 0, amp = 0.5, f = 1;
            for (let o = 0; o < 4; o++) { sum += amp * vnoise(px * f, py * f); f *= 2; amp *= 0.5; }
            return sum / 0.9375;
        }

        /* Topographic contour lines (marching squares) rendered once to an offscreen canvas. */
        const SEGMENTS = {
            1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[3, 0], [2, 1]], 6: [[0, 2]], 7: [[3, 0]],
            8: [[3, 0]], 9: [[0, 2]], 10: [[0, 1], [3, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]]
        };
        function buildTerrain() {
            const field = [];
            for (let j = 0; j < GY; j++) {
                field.push([]);
                for (let i = 0; i < GX; i++) field[j].push(fbm(i / 11, j / 11));
            }
            const off = document.createElement('canvas');
            off.width = Math.max(1, Math.round(stage.w * dpr));
            off.height = Math.max(1, Math.round(stage.h * dpr));
            const c2 = off.getContext('2d');
            c2.scale(dpr, dpr);
            const sx = stage.w / (GX - 1), sy = stage.h / (GY - 1);
            let li = 0;
            for (let lvl = 0.18; lvl < 0.86; lvl += 0.035, li++) {
                const major = li % 5 === 0;
                c2.strokeStyle = `rgba(${COL.rust}, ${major ? 0.5 : 0.2})`;
                c2.lineWidth = major ? 1.1 : 0.8;
                c2.beginPath();
                for (let j = 0; j < GY - 1; j++) {
                    for (let i = 0; i < GX - 1; i++) {
                        const a = field[j][i], b = field[j][i + 1], c = field[j + 1][i + 1], d = field[j + 1][i];
                        const idx = (a > lvl ? 8 : 0) | (b > lvl ? 4 : 0) | (c > lvl ? 2 : 0) | (d > lvl ? 1 : 0);
                        const segs = SEGMENTS[idx];
                        if (!segs) continue;
                        const edge = (e) => {
                            if (e === 0) return [i + (lvl - a) / (b - a), j];
                            if (e === 1) return [i + 1, j + (lvl - b) / (c - b)];
                            if (e === 2) return [i + (lvl - d) / (c - d), j + 1];
                            return [i, j + (lvl - a) / (d - a)];
                        };
                        segs.forEach(([e1, e2]) => {
                            const p1 = edge(e1), p2 = edge(e2);
                            c2.moveTo(p1[0] * sx, p1[1] * sy);
                            c2.lineTo(p2[0] * sx, p2[1] * sy);
                        });
                    }
                }
                c2.stroke();
            }
            // a few craters
            for (let k = 0; k < 6; k++) {
                const cx = hash(k, 91) * stage.w, cy = hash(k, 47) * stage.h, r = (0.02 + hash(k, 13) * 0.05) * stage.w;
                c2.strokeStyle = `rgba(${COL.rust}, 0.55)`;
                c2.beginPath(); c2.arc(cx, cy, r, 0, TAU); c2.stroke();
                c2.strokeStyle = `rgba(${COL.rust}, 0.18)`;
                c2.beginPath(); c2.arc(cx, cy, r * 1.25, 0, TAU); c2.stroke();
            }
            terrain = off;
        }

        function cellOf(px, py) {
            return [clamp(Math.floor(px / cw), 0, FX - 1), clamp(Math.floor(py / ch), 0, FY - 1)];
        }

        function reveal(a) {
            const r = a.sense;
            const [ci, cj] = cellOf(a.x, a.y);
            const span = Math.ceil(r / Math.min(cw, ch)) + 1;
            for (let j = cj - span; j <= cj + span; j++) {
                for (let i = ci - span; i <= ci + span; i++) {
                    if (i < 0 || j < 0 || i >= FX || j >= FY || cells[j][i]) continue;
                    if (Math.hypot((i + 0.5) * cw - a.x, (j + 0.5) * ch - a.y) < r) { cells[j][i] = 1; explored++; }
                }
            }
            sites.forEach((site) => {
                if (site.found) return;
                const [si, sj] = cellOf(site.x, site.y);
                if (cells[sj][si]) {
                    site.found = true;
                    pushLog(scene, `${a.id} ▸ SAMPLE SITE ${site.name} IDENTIFIED`);
                    agents.forEach((b) => { if (b !== a) sendPacket(a, b); });
                }
            });
        }

        function retarget(a) {
            let best = null, bestScore = Infinity;
            for (let j = 0; j < FY; j++) {
                for (let i = 0; i < FX; i++) {
                    if (cells[j][i]) continue;
                    const px = (i + 0.5) * cw, py = (j + 0.5) * ch;
                    let score = Math.hypot(px - a.x, py - a.y);
                    agents.forEach((b) => {
                        if (b !== a && b.tx !== undefined && Math.hypot(px - b.tx, py - b.ty) < stage.w * 0.22) score += stage.w * 0.5;
                    });
                    if (score < bestScore) { bestScore = score; best = [px, py]; }
                }
            }
            if (best) { a.tx = best[0]; a.ty = best[1]; a.label = `→ FRONTIER ${String(Math.floor(best[0] / cw)).padStart(2, '0')},${String(Math.floor(best[1] / ch)).padStart(2, '0')}`; }
            else { a.tx = a.x; a.ty = a.y; a.label = 'IDLE'; }
        }

        function sendPacket(a, b) {
            packets.push({ a, b, t: 0 });
            msgs++;
        }

        scene.reset = function () {
            seed = Math.floor(rand(1, 999));
            scene.logs = [];
            buildTerrain();
            FX = small ? 30 : 46;
            FY = Math.max(10, Math.round(FX * stage.h / stage.w));
            cw = stage.w / FX;
            ch = stage.h / FY;
            cells = Array.from({ length: FY }, () => new Uint8Array(FX));
            explored = 0;
            msgs = 0;
            packets = [];
            finished = -1;
            const bx = stage.w * 0.18, by = stage.h * 0.72;
            const unit = stage.w;
            agents = [
                { id: 'R1', kind: 'rover', x: bx, y: by, speed: unit * 0.032, sense: unit * 0.07 },
                { id: 'R2', kind: 'rover', x: bx + 24, y: by - 10, speed: unit * 0.032, sense: unit * 0.07 },
                { id: 'R3', kind: 'rover', x: bx - 10, y: by + 20, speed: unit * 0.032, sense: unit * 0.07 },
                { id: 'H1', kind: 'heli', x: bx + 10, y: by + 4, speed: unit * 0.08, sense: unit * 0.1 }
            ];
            agents.forEach((a) => { a.trail = []; a.trailT = 0; a.heading = 0; a.task = null; });
            sites = ['A', 'B', 'C'].map((name) => ({
                name, x: rand(0.3, 0.92) * stage.w, y: rand(0.18, 0.85) * stage.h, found: false, assigned: null, sampled: false
            }));
            agents.forEach(reveal);
            agents.forEach(retarget);
            pushLog(scene, 'LANDED · 4 AGENTS ONLINE · MAP SYNC ESTABLISHED');
        };

        scene.resize = function () { scene.reset(); };

        scene.update = function (dt) {
            if (finished >= 0) {
                finished += dt;
                if (finished > 3) scene.reset();
                return;
            }
            // assign rovers to newly found sites
            sites.forEach((site) => {
                if (!site.found || site.assigned) return;
                const free = agents.filter((a) => a.kind === 'rover' && !a.task);
                if (!free.length) return;
                const r = free.reduce((p, q) => (Math.hypot(q.x - site.x, q.y - site.y) < Math.hypot(p.x - site.x, p.y - site.y) ? q : p));
                r.task = { site, t: 0 };
                site.assigned = r;
                r.tx = site.x; r.ty = site.y;
                r.label = `→ SAMPLE SITE ${site.name}`;
                pushLog(scene, `${r.id} TASKED → SAMPLE SITE ${site.name}`);
            });

            agents.forEach((a) => {
                const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
                if (d > 2) {
                    const step = Math.min(d, a.speed * dt);
                    a.x += (dx / d) * step;
                    a.y += (dy / d) * step;
                    a.heading = Math.atan2(dy, dx);
                } else if (a.task) {
                    a.task.t += dt;
                    a.label = `SAMPLING ${a.task.site.name} ${Math.min(100, Math.round(a.task.t / 2.2 * 100))}%`;
                    if (a.task.t > 2.2) {
                        a.task.site.sampled = true;
                        pushLog(scene, `${a.id} ▸ SITE ${a.task.site.name} SAMPLED · CACHED`);
                        a.task = null;
                        retarget(a);
                    }
                } else {
                    retarget(a);
                }
                if (!a.task) {
                    const [ti, tj] = cellOf(a.tx, a.ty);
                    if (cells[tj][ti]) retarget(a);
                }
                reveal(a);
                a.trailT += dt;
                if (a.trailT > 0.12) { a.trailT = 0; a.trail.push([a.x, a.y]); if (a.trail.length > 70) a.trail.shift(); }
            });

            const range = stage.w * 0.45;
            links = [];
            for (let i = 0; i < agents.length; i++) {
                for (let j = i + 1; j < agents.length; j++) {
                    if (Math.hypot(agents[i].x - agents[j].x, agents[i].y - agents[j].y) < range) links.push([agents[i], agents[j]]);
                }
            }
            packetT += dt;
            if (packetT > 0.45 && links.length) {
                packetT = 0;
                const [a, b] = links[Math.floor(Math.random() * links.length)];
                if (Math.random() < 0.5) sendPacket(a, b); else sendPacket(b, a);
            }
            packets.forEach((p) => { p.t += dt / 0.55; });
            packets = packets.filter((p) => p.t < 1);

            if (explored / (FX * FY) > 0.95 && sites.every((st) => st.sampled || !st.found)) {
                finished = 0;
                pushLog(scene, 'MAP COMPLETE · UPLINKING SURVEY TO ORBITER');
            }
        };

        scene.draw = function () {
            const { x, y, w, h } = stage;
            ctx.save();
            ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
            ctx.fillStyle = 'rgba(40, 14, 6, 0.35)';
            ctx.fillRect(x, y, w, h);
            if (terrain) ctx.drawImage(terrain, x, y, w, h);

            // fog of war over unexplored cells
            ctx.fillStyle = 'rgba(5, 8, 13, 0.9)';
            for (let j = 0; j < FY; j++) {
                for (let i = 0; i < FX; i++) if (!cells[j][i]) ctx.fillRect(x + i * cw - 0.5, y + j * ch - 0.5, cw + 1, ch + 1);
            }
            ctx.fillStyle = 'rgba(90, 209, 255, 0.18)';
            for (let j = 0; j < FY; j += 2) {
                for (let i = 0; i < FX; i += 2) if (!cells[j][i]) ctx.fillRect(x + (i + 0.5) * cw - 1, y + (j + 0.5) * ch - 1, 2, 2);
            }

            // sample sites
            sites.forEach((site) => {
                if (!site.found) return;
                const sx = x + site.x, sy = y + site.y;
                ctx.strokeStyle = site.sampled ? COL.amber : COL.text;
                ctx.beginPath(); ctx.arc(sx, sy, 7, 0, TAU); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(sx - 11, sy); ctx.lineTo(sx + 11, sy); ctx.moveTo(sx, sy - 11); ctx.lineTo(sx, sy + 11); ctx.stroke();
                text(`SITE ${site.name}${site.sampled ? ' ✓' : ''}`, sx + 12, sy - 9, site.sampled ? COL.amber : COL.text, 9);
            });

            // comm links and packets
            ctx.strokeStyle = 'rgba(90, 209, 255, 0.35)';
            ctx.setLineDash([3, 5]);
            links.forEach(([a, b]) => {
                ctx.beginPath(); ctx.moveTo(x + a.x, y + a.y); ctx.lineTo(x + b.x, y + b.y); ctx.stroke();
            });
            ctx.setLineDash([]);
            packets.forEach((p) => {
                const px = x + p.a.x + (p.b.x - p.a.x) * p.t, py = y + p.a.y + (p.b.y - p.a.y) * p.t;
                glowDot(px, py, 1.8, COL.cyan);
            });

            // agents
            agents.forEach((a) => {
                const ax = x + a.x, ay = y + a.y;
                ctx.fillStyle = a.kind === 'heli' ? 'rgba(255, 177, 74, 0.55)' : 'rgba(90, 209, 255, 0.55)';
                a.trail.forEach((p, i) => { if (i % 2 === 0) ctx.fillRect(x + p[0] - 0.7, y + p[1] - 0.7, 1.4, 1.4); });
                ctx.strokeStyle = 'rgba(90, 209, 255, 0.15)';
                ctx.beginPath(); ctx.arc(ax, ay, a.sense, 0, TAU); ctx.stroke();
                if (a.kind === 'heli') {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                    ctx.beginPath(); ctx.arc(ax + 6, ay + 8, 4, 0, TAU); ctx.fill();
                    const spin = met * 18;
                    ctx.strokeStyle = COL.amber;
                    ctx.beginPath();
                    ctx.moveTo(ax + Math.cos(spin) * 9, ay + Math.sin(spin) * 9); ctx.lineTo(ax - Math.cos(spin) * 9, ay - Math.sin(spin) * 9);
                    ctx.moveTo(ax + Math.cos(spin + 1.6) * 9, ay + Math.sin(spin + 1.6) * 9); ctx.lineTo(ax - Math.cos(spin + 1.6) * 9, ay - Math.sin(spin + 1.6) * 9);
                    ctx.stroke();
                    glowDot(ax, ay, 2.5, COL.amber);
                } else {
                    ctx.save();
                    ctx.translate(ax, ay);
                    ctx.rotate(a.heading);
                    ctx.fillStyle = 'rgba(90, 209, 255, 0.25)';
                    ctx.strokeStyle = COL.cyan;
                    ctx.fillRect(-6, -4, 12, 8);
                    ctx.strokeRect(-6, -4, 12, 8);
                    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(10, 0); ctx.stroke();
                    ctx.restore();
                }
                if (!small || a.task) {
                    text(a.id, ax + 10, ay - 8, a.kind === 'heli' ? COL.amber : COL.cyan, 10, 'left', 600);
                    text(a.label || '', ax + 10, ay + 4, COL.dim, 9);
                }
            });
            ctx.restore();
        };

        scene.stats = function () {
            return [
                ['COVERAGE', `${Math.round(explored / (FX * FY) * 100)} %`],
                ['AGENTS', `${agents.length} · ${links.length} LINKS`],
                ['MESSAGES', `${msgs}`],
                ['SITES', `${sites.filter((st) => st.sampled).length}/${sites.filter((st) => st.found).length} SAMPLED`]
            ];
        };

        return scene;
    })();

    /* =====================================================================
     * CH-3  Earth: a small Earth-observation constellation. A satellite passing over a
     * flood or wildfire detects it, relays over an inter-satellite link to a neighbour that
     * re-tasks to confirm, which downlinks the alert to the nearest ground station.
     * ===================================================================== */
    const earth = (function () {
        const scene = {
            id: 'earth',
            title: 'CH-3 // EARTH RESPONSE CONSTELLATION',
            subtitle: 'ONBOARD DETECTION · INTER-SATELLITE RELAY · RAPID ALERTING',
            logs: []
        };
        const TILT = 18 * DEG;
        const EVENTS = [
            { kind: 'FLOOD', where: 'VALENCIA', lat: 39.4, lon: -0.4 },
            { kind: 'WILDFIRE', where: 'SIERRA NEVADA', lat: 38.9, lon: -120.1 },
            { kind: 'FLOOD', where: 'BRAHMAPUTRA', lat: 24.5, lon: 90.4 },
            { kind: 'WILDFIRE', where: 'ATTICA', lat: 38.1, lon: 23.8 },
            { kind: 'FLOOD', where: 'INDUS', lat: 27.0, lon: 68.3 },
            { kind: 'WILDFIRE', where: 'NEW SOUTH WALES', lat: -33.5, lon: 150.2 },
            { kind: 'FLOOD', where: 'RIO GRANDE DO SUL', lat: -30.0, lon: -51.2 },
            { kind: 'WILDFIRE', where: 'ALBERTA', lat: 56.7, lon: -111.4 },
            { kind: 'FLOOD', where: 'BEIRA', lat: -19.8, lon: 34.9 },
            { kind: 'WILDFIRE', where: 'YAKUTIA', lat: 62.0, lon: 129.7 }
        ];
        const STATIONS = [
            { name: 'SVALBARD', lat: 78.2, lon: 15.4 },
            { name: 'MATERA', lat: 40.6, lon: 16.7 },
            { name: 'SANTIAGO', lat: -33.4, lon: -70.6 },
            { name: 'CANBERRA', lat: -35.4, lon: 149.0 },
            { name: 'FAIRBANKS', lat: 64.8, lon: -147.7 },
            { name: 'HARTEBEESTHOEK', lat: -25.9, lon: 27.7 }
        ];
        let land = [];
        let sats = [], events = [], packets = [], tasks = [];
        let lon0 = 0, spin = 0, spawnT = 0, nextEvent = 0, alerts = 0;
        let cx = 0, cy = 0, R = 0;

        scene.setLand = function (points) { land = points; };

        function project(lat, lon, k) {
            const phi = lat * DEG, lam = (lon - lon0) * DEG;
            const X = Math.cos(phi) * Math.sin(lam);
            const Y = Math.cos(TILT) * Math.sin(phi) - Math.sin(TILT) * Math.cos(phi) * Math.cos(lam);
            const Z = Math.sin(TILT) * Math.sin(phi) + Math.cos(TILT) * Math.cos(phi) * Math.cos(lam);
            const kk = k || 1;
            const hidden = Z < 0 && Math.hypot(X, Y) * kk < 1;
            return { x: cx + kk * R * X, y: cy - kk * R * Y, z: Z, hidden };
        }

        function angDist(lat1, lon1, lat2, lon2) {
            const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
            return Math.acos(clamp(Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl), -1, 1)) / DEG;
        }

        function satLatLon(sat) {
            const u = sat.u, i = sat.inc, O = sat.raan;
            const X = Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i);
            const Y = Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i);
            const Z = Math.sin(u) * Math.sin(i);
            return [Math.asin(Z) / DEG, Math.atan2(Y, X) / DEG - spin];
        }

        function fmtLL(lat, lon) {
            return `${Math.abs(lat).toFixed(1)}${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}${lon >= 0 ? 'E' : 'W'}`;
        }

        function send(fromFn, toFn, dur, color, onArrive) {
            packets.push({ fromFn, toFn, t: 0, dur, color, onArrive });
        }

        scene.reset = function () {
            sats = [];
            const planes = [
                { inc: 97.6 * DEG, raan: 20 * DEG, n: 4 },
                { inc: 53 * DEG, raan: 140 * DEG, n: 4 },
                { inc: 70 * DEG, raan: 260 * DEG, n: 4 }
            ];
            let id = 1;
            planes.forEach((pl) => {
                for (let k = 0; k < pl.n; k++) {
                    sats.push({ id: `SAT-${String(id++).padStart(2, '0')}`, inc: pl.inc, raan: pl.raan, u: (k / pl.n) * TAU + rand(0, 0.4), rate: TAU / 13 });
                }
            });
            events = [];
            packets = [];
            tasks = [];
            nextEvent = Math.floor(rand(0, EVENTS.length));
            spawnT = 1.5;
            pushLog(scene, '12 SPACECRAFT NOMINAL · ISL MESH ONLINE');
        };

        scene.resize = function () {
            cx = stage.x + stage.w / 2;
            cy = stage.y + stage.h / 2 + (small ? 10 : 6);
            R = Math.min(stage.w, stage.h) * (small ? 0.36 : 0.34);
            if (!sats.length) scene.reset();
        };

        scene.update = function (dt) {
            lon0 += dt * 7;
            spin += dt * 1.5;
            sats.forEach((s) => {
                s.u += s.rate * dt;
                const ll = satLatLon(s);
                s.lat = ll[0];
                s.lon = ll[1];
            });

            spawnT -= dt;
            if (spawnT <= 0 && events.filter((e) => e.state !== 'done').length < 4) {
                const proto = EVENTS[nextEvent % EVENTS.length];
                nextEvent++;
                if (!events.some((e) => e.where === proto.where)) events.push(Object.assign({ state: 'active', age: 0 }, proto));
                spawnT = rand(1.8, 3.2);
            }

            events.forEach((ev) => {
                ev.age += dt;
                if (ev.state === 'active') {
                    const det = sats.find((s) => angDist(s.lat, s.lon, ev.lat, ev.lon) < 16);
                    if (!det) return;
                    ev.state = 'detected';
                    pushLog(scene, `${det.id} ▸ ${ev.kind} DETECTED · ${ev.where} ${fmtLL(ev.lat, ev.lon)}`);
                    const nb = sats.filter((s) => s !== det)
                        .reduce((a, b) => (angDist(b.lat, b.lon, det.lat, det.lon) < angDist(a.lat, a.lon, det.lat, det.lon) ? b : a));
                    send(() => project(det.lat, det.lon, 1.13), () => project(nb.lat, nb.lon, 1.13), 0.9, COL.cyan, () => {
                        ev.state = 'confirmed';
                        tasks.push({ sat: nb, ev, t: 0 });
                        pushLog(scene, `${det.id} ⇢ ${nb.id} ISL RELAY · ${nb.id} RE-TASKED`);
                        const gs = STATIONS.reduce((a, b) => (angDist(b.lat, b.lon, nb.lat, nb.lon) < angDist(a.lat, a.lon, nb.lat, nb.lon) ? b : a));
                        send(() => project(nb.lat, nb.lon, 1.13), () => project(gs.lat, gs.lon, 1), 1.1, COL.amber, () => {
                            ev.state = 'relayed';
                            ev.doneAge = ev.age;
                            alerts++;
                            pushLog(scene, `GS ${gs.name} ▸ ${ev.kind} ALERT DISPATCHED`);
                        });
                    });
                } else if (ev.state === 'relayed' && ev.age - ev.doneAge > 5) {
                    ev.state = 'done';
                }
            });
            events = events.filter((e) => e.state !== 'done');
            tasks.forEach((tk) => { tk.t += dt; });
            tasks = tasks.filter((tk) => tk.t < 3.5);
            packets.forEach((p) => {
                p.t += dt / p.dur;
                if (p.t >= 1 && !p.arrived) { p.arrived = true; if (p.onArrive) p.onArrive(); }
            });
            packets = packets.filter((p) => p.t < 1);
        };

        function drawOrbit(sat) {
            ctx.beginPath();
            let started = false;
            for (let k = 0; k <= 64; k++) {
                const u = (k / 64) * TAU;
                const X = Math.cos(sat.raan) * Math.cos(u) - Math.sin(sat.raan) * Math.sin(u) * Math.cos(sat.inc);
                const Y = Math.sin(sat.raan) * Math.cos(u) + Math.cos(sat.raan) * Math.sin(u) * Math.cos(sat.inc);
                const Z = Math.sin(u) * Math.sin(sat.inc);
                const p = project(Math.asin(Z) / DEG, Math.atan2(Y, X) / DEG - spin, 1.13);
                if (p.hidden) { started = false; continue; }
                if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

        scene.draw = function () {
            // atmosphere and disc
            const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.18);
            g.addColorStop(0, 'rgba(61, 139, 255, 0.0)');
            g.addColorStop(0.45, 'rgba(61, 139, 255, 0.16)');
            g.addColorStop(1, 'rgba(61, 139, 255, 0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(4, 12, 24, 0.95)';
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
            ctx.strokeStyle = 'rgba(90, 209, 255, 0.5)';
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

            // graticule
            ctx.strokeStyle = 'rgba(90, 209, 255, 0.12)';
            ctx.beginPath();
            for (let lat = -60; lat <= 60; lat += 30) {
                let started = false;
                for (let lon = -180; lon <= 180; lon += 4) {
                    const p = project(lat, lon);
                    if (p.z < 0) { started = false; continue; }
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
                }
            }
            for (let lon = -180; lon < 180; lon += 30) {
                let started = false;
                for (let lat = -90; lat <= 90; lat += 4) {
                    const p = project(lat, lon);
                    if (p.z < 0) { started = false; continue; }
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
                }
            }
            ctx.stroke();

            // land as a dot matrix, dimmer toward the limb
            const dot = small ? 1.3 : 1.6;
            for (let k = 0; k < land.length; k++) {
                const p = project(land[k][0], land[k][1]);
                if (p.z <= 0) continue;
                ctx.fillStyle = `rgba(90, 209, 255, ${0.15 + 0.55 * p.z})`;
                ctx.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
            }

            // ground stations
            STATIONS.forEach((gs) => {
                const p = project(gs.lat, gs.lon);
                if (p.z <= 0) return;
                ctx.strokeStyle = 'rgba(255, 177, 74, 0.8)';
                ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x + 4, p.y + 3); ctx.lineTo(p.x - 4, p.y + 3); ctx.closePath(); ctx.stroke();
                if (!small) text(gs.name, p.x + 6, p.y + 3, 'rgba(255, 177, 74, 0.7)', 8);
            });

            // events
            events.forEach((ev) => {
                const p = project(ev.lat, ev.lon);
                if (p.z <= 0) return;
                const color = ev.kind === 'FLOOD' ? COL.blue : COL.red;
                const pulse = (ev.age * 1.2) % 1;
                ctx.strokeStyle = color;
                ctx.globalAlpha = 1 - pulse;
                ctx.beginPath(); ctx.arc(p.x, p.y, 4 + pulse * 18, 0, TAU); ctx.stroke();
                ctx.globalAlpha = 1;
                if (ev.kind === 'WILDFIRE') {
                    for (let k = 0; k < 6; k++) {
                        ctx.fillStyle = k % 2 ? COL.red : COL.amber;
                        ctx.fillRect(p.x + Math.sin(ev.age * 9 + k * 2.1) * 5, p.y + Math.cos(ev.age * 7 + k) * 4, 1.6, 1.6);
                    }
                } else {
                    ctx.fillStyle = 'rgba(61, 139, 255, 0.35)';
                    ctx.beginPath(); ctx.ellipse(p.x, p.y, 7, 4, 0.4, 0, TAU); ctx.fill();
                }
                glowDot(p.x, p.y, 2.2, color);
                if (ev.state !== 'active' && !small) {
                    const tag = { detected: 'DETECTED', confirmed: 'CONFIRMED', relayed: 'ALERTED' }[ev.state];
                    text(`${ev.kind} · ${tag}`, p.x + 10, p.y - 8, color, 9, 'left', 600);
                }
            });

            // orbits
            ctx.strokeStyle = 'rgba(216, 227, 236, 0.1)';
            [0, 4, 8].forEach((i) => sats[i] && drawOrbit(sats[i]));

            // inter-satellite links between nearby visible spacecraft
            ctx.strokeStyle = 'rgba(90, 209, 255, 0.18)';
            ctx.setLineDash([2, 5]);
            for (let i = 0; i < sats.length; i++) {
                const a = project(sats[i].lat, sats[i].lon, 1.13);
                if (a.hidden) continue;
                for (let j = i + 1; j < sats.length; j++) {
                    if (angDist(sats[i].lat, sats[i].lon, sats[j].lat, sats[j].lon) > 45) continue;
                    const b = project(sats[j].lat, sats[j].lon, 1.13);
                    if (b.hidden) continue;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
            }
            ctx.setLineDash([]);

            // re-tasked sensors pointing at events
            tasks.forEach((tk) => {
                const a = project(tk.sat.lat, tk.sat.lon, 1.13);
                const b = project(tk.ev.lat, tk.ev.lon);
                if (a.hidden || b.z <= 0) return;
                ctx.fillStyle = 'rgba(255, 177, 74, 0.12)';
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x - 9, b.y); ctx.lineTo(b.x + 9, b.y); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(255, 177, 74, 0.7)';
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            });

            // satellites
            sats.forEach((s) => {
                const p = project(s.lat, s.lon, 1.13);
                if (p.hidden) return;
                const busy = tasks.some((tk) => tk.sat === s);
                ctx.strokeStyle = busy ? COL.amber : COL.text;
                ctx.beginPath(); ctx.moveTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y); ctx.stroke();
                glowDot(p.x, p.y, 2, busy ? COL.amber : COL.cyan);
                if (!small && (busy || p.z > 0.6)) text(s.id, p.x + 7, p.y - 5, busy ? COL.amber : COL.dim, 8);
            });

            // packets in flight
            packets.forEach((pk) => {
                const a = pk.fromFn(), b = pk.toFn();
                const t = clamp(pk.t, 0, 1);
                ctx.strokeStyle = pk.color;
                ctx.globalAlpha = 0.5;
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                ctx.globalAlpha = 1;
                glowDot(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2.6, pk.color);
            });
        };

        scene.stats = function () {
            return [
                ['SPACECRAFT', `${sats.length} · 3 PLANES`],
                ['ACTIVE EVENTS', `${events.length}`],
                ['IN FLIGHT', `${packets.length} MSG`],
                ['ALERTS SENT', `${alerts}`]
            ];
        };

        return scene;
    })();

    /* Land mask: Natural Earth 110m land (public domain) via world-atlas, decoded from TopoJSON,
     * rasterised to an equirectangular mask and sampled into evenly spaced dots. */
    function loadLand() {
        fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json')
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((topo) => {
                const [sx, sy] = topo.transform.scale;
                const [tx, ty] = topo.transform.translate;
                const arcs = topo.arcs.map((arc) => {
                    let ax = 0, ay = 0;
                    return arc.map(([dx, dy]) => { ax += dx; ay += dy; return [ax * sx + tx, ay * sy + ty]; });
                });
                const arcPts = (i) => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
                const obj = topo.objects.land;
                const geoms = obj.type === 'GeometryCollection' ? obj.geometries : [obj];
                const mask = document.createElement('canvas');
                mask.width = 720; mask.height = 360;
                const m = mask.getContext('2d');
                m.fillStyle = '#fff';
                m.beginPath();
                geoms.forEach((g) => {
                    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
                    polys.forEach((poly) => poly.forEach((ring) => {
                        let first = true;
                        ring.forEach((ai) => arcPts(ai).forEach(([lon, lat]) => {
                            const px = (lon + 180) * 2, py = (90 - lat) * 2;
                            if (first) { m.moveTo(px, py); first = false; } else m.lineTo(px, py);
                        }));
                        m.closePath();
                    }));
                });
                m.fill('evenodd');
                const data = m.getImageData(0, 0, 720, 360).data;
                const pts = [];
                const step = 2.2;
                for (let lat = -80; lat <= 82; lat += step) {
                    const n = Math.max(1, Math.round((360 * Math.cos(lat * DEG)) / step));
                    for (let k = 0; k < n; k++) {
                        const lon = -180 + (k * 360) / n;
                        const px = Math.floor((lon + 180) * 2), py = Math.floor((90 - lat) * 2);
                        if (data[(py * 720 + px) * 4 + 3] > 128) pts.push([lat, lon]);
                    }
                }
                earth.setLand(pts);
                if (reduceMotion) render();
            })
            .catch(() => { /* graticule-only globe is fine */ });
    }

    /* =====================================================================
     * Console: layout, starfield, shared HUD, channel switching, loop.
     * ===================================================================== */
    const scenes = [mars, gnc, earth];
    let current = 0, chanT = 0, trans = null, running = false, last = 0, heroVisible = true;

    function layout() {
        const hr = hero.getBoundingClientRect();
        const sr = stageEl.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.round(hr.width);
        H = Math.round(hr.height);
        small = W < 760;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        stage = { x: sr.left - hr.left, y: sr.top - hr.top, w: sr.width, h: sr.height };
        stars = Array.from({ length: Math.round((W * H) / 6000) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(0.3, 1.2), p: rand(0, TAU) }));
        scenes.forEach((sc) => sc.resize());
    }

    function drawStars() {
        for (let i = 0; i < stars.length; i++) {
            const st = stars[i];
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(met * 0.8 + st.p);
            ctx.fillStyle = '#cfe6ff';
            ctx.fillRect(st.x, st.y, st.r, st.r);
        }
        ctx.globalAlpha = 1;
    }

    function drawHud(scene) {
        const { x, y, w, h } = stage;
        ctx.fillStyle = 'rgba(5, 8, 13, 0.35)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(90, 209, 255, 0.08)';
        ctx.beginPath();
        const gs = small ? 40 : 56;
        for (let gx = x + gs; gx < x + w; gx += gs) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
        for (let gy = y + gs; gy < y + h; gy += gs) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
        ctx.stroke();
    }

    function drawHudOverlay(scene) {
        const { x, y, w, h } = stage;
        brackets(x, y, w, h, 18, COL.cyan);
        text(scene.title, x + 14, y + 24, COL.cyan, small ? 11 : 13, 'left', 600);
        if (!small) text(scene.subtitle, x + 14, y + 41, COL.dim, 10);

        const stats = scene.stats();
        const pw = small ? 150 : 190, ph = stats.length * 16 + 12;
        const px = x + w - pw - 12, py = small ? y + 36 : y + 12;
        ctx.fillStyle = 'rgba(5, 8, 13, 0.72)';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(90, 209, 255, 0.3)';
        ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
        stats.forEach(([k, v], i) => {
            text(k, px + 8, py + 19 + i * 16, COL.dim, small ? 9 : 10);
            text(v, px + pw - 8, py + 19 + i * 16, COL.text, small ? 9 : 10, 'right', 600);
        });

        const lines = scene.logs.slice(small ? -2 : -4);
        const lw = Math.min(w - 24, small ? w - 24 : 470);
        const lh = lines.length * 15 + 10;
        if (lines.length) {
            ctx.fillStyle = 'rgba(5, 8, 13, 0.72)';
            ctx.fillRect(x + 12, y + h - lh - 12, lw, lh);
        }
        lines.forEach((ln, i) => {
            const alpha = 0.45 + 0.55 * ((i + 1) / lines.length);
            text(`> ${ln}`, x + 20, y + h - lh - 12 + 19 + i * 15, `rgba(216, 227, 236, ${alpha})`, small ? 9 : 10);
        });
        if (!small) text(`MET ${fmtClock(met)}`, x + w - 14, y + h - 16, COL.cyanMid, 10, 'right');
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        drawStars();
        const scene = scenes[current];
        drawHud(scene);
        ctx.save();
        ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
        scene.draw();
        ctx.restore();
        drawHudOverlay(scene);
        if (trans) {
            const a = trans.t < FADE_SECONDS ? trans.t / FADE_SECONDS : 1 - (trans.t - FADE_SECONDS) / FADE_SECONDS;
            ctx.fillStyle = `rgba(5, 8, 13, ${clamp(a, 0, 1)})`;
            ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
        }
        buttons.forEach((b, i) => {
            const on = i === (trans ? trans.to : current);
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
            b.style.setProperty('--p', on && !reduceMotion ? String(clamp(chanT / CHANNEL_SECONDS, 0, 1)) : on ? '1' : '0');
        });
    }

    function step(dt) {
        met += dt;
        if (trans) {
            const before = trans.t;
            trans.t += dt;
            if (before < FADE_SECONDS && trans.t >= FADE_SECONDS) current = trans.to;
            if (trans.t >= FADE_SECONDS * 2) trans = null;
        } else {
            chanT += dt;
            if (chanT >= CHANNEL_SECONDS) switchTo((current + 1) % scenes.length);
        }
        scenes[current].update(dt);
    }

    function switchTo(i) {
        chanT = 0;
        if (reduceMotion) { current = i; render(); return; }
        if (i === current && !trans) return;
        trans = { to: i, t: 0 };
    }

    function frame(now) {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        step(dt);
        render();
        requestAnimationFrame(frame);
    }

    function updateRunning() {
        const shouldRun = !reduceMotion && heroVisible && !document.hidden;
        if (shouldRun && !running) {
            running = true;
            last = performance.now();
            requestAnimationFrame(frame);
        } else if (!shouldRun) {
            running = false;
        }
    }

    buttons.forEach((b, i) => b.addEventListener('click', () => switchTo(i)));

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { layout(); render(); }, 150);
    });
    document.addEventListener('visibilitychange', updateRunning);
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            heroVisible = entries[0].isIntersecting;
            updateRunning();
        }).observe(hero);
    }

    layout(); // each scene's resize() also seeds it on first call
    if (reduceMotion) {
        // Still frames: advance each simulation a few seconds so every channel has something to show.
        scenes.forEach((sc) => { for (let k = 0; k < 240; k++) sc.update(1 / 30); });
        render();
    } else {
        updateRunning();
    }
    loadLand();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!running) render(); });
})();
