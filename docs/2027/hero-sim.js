/* AI4Space landing scenes: four simulations drawn as HUD displays on one carousel canvas.
 * 01 vision-based rendezvous (Clohessy-Wiltshire approach, pose estimation, event camera),
 * 02 Earth tip-and-cue (onboard segmentation cueing a SAR satellite), 03 agentic mission design
 * (multi-agent trade-space exploration), 04 cooperative Mars exploration with terrain segmentation.
 * Plain JS, no dependencies. */
(function () {
    'use strict';

    const block = document.getElementById('scenes');
    const pin = document.querySelector('.scenes-pin');
    const canvas = document.getElementById('hero-canvas');
    if (!block || !pin || !canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const panels = Array.from(document.querySelectorAll('.scene-panel'));
    const ticks = Array.from(document.querySelectorAll('.scene-rail button'));
    const arrows = Array.from(document.querySelectorAll('.scene-arrow'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const COL = {
        cyan: '#667eea',
        cyanDim: 'rgba(102, 126, 234, 0.16)',
        cyanMid: 'rgba(102, 126, 234, 0.45)',
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
    const FADE_SECONDS = 0.35;
    const AUTO_SECONDS = 12;           // carousel advances on its own until the visitor picks a scene

    let W = 0, H = 0, dpr = 1, small = false;
    let stage = { x: 0, y: 0, w: 0, h: 0 };
    let stars = [];
    let met = 0;

    /* ---------- small helpers ---------- */

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const hyp = (v) => Math.hypot(v[0], v[1]);

    function hudFont(size, weight) {
        return `${weight || 500} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;   // same family as the page body
    }

    function text(str, x, y, color, size, align, weight) {
        ctx.font = hudFont(size || 11, weight);
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

    /* ---------- synthetic image tiles (what an onboard camera would see) ---------- */

    function tileHash(ix, iy, seed) {
        const v = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
        return v - Math.floor(v);
    }

    function tileNoise(px, py, seed) {
        let sum = 0, amp = 0.5, f = 1;
        for (let o = 0; o < 3; o++) {
            const x = px * f, y = py * f;
            const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const a = tileHash(xi, yi, seed), b = tileHash(xi + 1, yi, seed);
            const c = tileHash(xi, yi + 1, seed), d = tileHash(xi + 1, yi + 1, seed);
            sum += amp * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
            f *= 2;
            amp *= 0.5;
        }
        return sum / 0.875;
    }

    function insetBox(ix, iy, iw, ih, title) {
        ctx.fillStyle = 'rgba(2, 4, 8, 0.92)';
        ctx.fillRect(ix - 1, iy - 1, iw + 2, ih + 2);
        ctx.strokeStyle = 'rgba(102, 126, 234, 0.45)';
        ctx.strokeRect(ix - 0.5, iy - 0.5, iw + 1, ih + 1);
        text(title, ix + 2, iy - 6, COL.cyan, small ? 8 : 9, 'left', 600);
    }

    /* =====================================================================
     * 03  Agentic mission design: an orchestrator and five specialist agents exchange
     * messages while candidate designs fill a mass-cost trade space. The Pareto front
     * tightens, a knee-point design is selected, the spec sheet fills in and the V&V agent
     * traces every requirement. Sizing relations are simple but physically motivated
     * (mass grows with aperture and array power, cost with mass and aperture²).
     * ===================================================================== */
    const agents = (function () {
        const scene = {
            id: 'agents',
            title: '03 // AGENTIC MISSION DESIGN',
            subtitle: 'MULTI-AGENT SYSTEMS ENGINEERING · TRADE-SPACE EXPLORATION',
            logs: []
        };
        const AGENTS = [
            { id: 'REQ', name: 'REQUIREMENTS' },
            { id: 'ORB', name: 'ORBIT' },
            { id: 'PWR', name: 'POWER' },
            { id: 'COM', name: 'COMMS' },
            { id: 'VV', name: 'V&V' }
        ];
        const TALK = {
            REQ: ['GSD ≤ 20 m in SWIR', 'revisit ≤ 24 h', 'alert latency ≤ 30 min'],
            ORB: ['SSO 550 km · LTAN 10:30', 'Δv budget 62 m/s', 'eclipse 35 min per orbit'],
            PWR: ['array 1.8 m² · 180 W EOL', 'battery 140 Wh', 'power margin +22 %'],
            COM: ['X-band 150 Mbps downlink', 'S-band ISL for cueing', 'link margin 4.1 dB'],
            VV: ['REQ-07 traced to ORB-02', 'test case TC-31 generated', 'coverage check passed']
        };
        const REQS = 24;
        const T = { explore: [1.2, 10.5], select: 11, spec: [11.6, 13.6], trace: [13.6, 16], end: 18 };
        const MASS = [45, 135], COST = [10, 30];
        let s = null;

        function candidate() {
            const D = rand(0.08, 0.32);           // payload aperture, m
            const P = rand(80, 320);              // end-of-life array power, W
            const mass = 30 + 160 * D + 0.12 * P + rand(-6, 6);
            const cost = 6 + 0.11 * mass + 55 * D * D + rand(-1.5, 1.5);
            return { D, P, mass, cost, feasible: D >= 0.12 && P >= 140, age: 0 };
        }

        function updateFront() {
            const ok = s.designs.filter((d) => d.feasible).sort((a, b) => a.mass - b.mass);
            const front = [];
            let best = Infinity;
            ok.forEach((d) => { if (d.cost < best) { front.push(d); best = d.cost; } });
            s.front = front;
        }

        function kneePoint() {
            const n = (d) => Math.hypot((d.mass - MASS[0]) / (MASS[1] - MASS[0]), (d.cost - COST[0]) / (COST[1] - COST[0]));
            return s.front.reduce((a, b) => (n(b) < n(a) ? b : a));
        }

        function send(fromIdx, toIdx, label) {
            s.packets.push({ from: fromIdx, to: toIdx, t: 0, label });
        }

        scene.reset = function () {
            s = { t: 0, designs: [], front: [], chosen: null, packets: [], nextDesign: 0, nextTalk: 0, active: -1, activeT: 0 };
            scene.logs = [];
            pushLog(scene, 'ORCH ▸ BRIEF RECEIVED · EO WILDFIRE & FLOOD MISSION');
        };

        scene.resize = function () { if (!s) scene.reset(); };

        scene.update = function (dt) {
            s.t += dt;
            s.activeT -= dt;
            s.packets.forEach((p) => { p.t += dt / 0.7; });
            s.packets = s.packets.filter((p) => p.t < 1);
            s.designs.forEach((d) => { d.age += dt; });


            if (s.t > T.explore[0] && s.t < T.explore[1]) {
                s.nextDesign -= dt;
                if (s.nextDesign <= 0) {
                    s.nextDesign = 0.28;
                    s.designs.push(candidate());
                    updateFront();
                    const a = 1 + Math.floor(Math.random() * 3);   // orbit, power or comms evaluates it
                    send(0, a + 1, null);
                }
                s.nextTalk -= dt;
                if (s.nextTalk <= 0) {
                    s.nextTalk = 1.1;
                    const k = Math.floor(Math.random() * 4);       // REQ, ORB, PWR, COM
                    const ag = AGENTS[k];
                    const line = TALK[ag.id][Math.floor(Math.random() * TALK[ag.id].length)];
                    send(k + 1, 0, line);
                    s.active = k + 1;
                    s.activeT = 0.8;
                    pushLog(scene, `${ag.id} → ORCH · ${line}`);
                }
            }
            if (!s.chosen && s.t >= T.select && s.front.length) {
                s.chosen = kneePoint();
                pushLog(scene, `ORCH ▸ DESIGN SELECTED · ${s.chosen.mass.toFixed(0)} kg · ${s.chosen.cost.toFixed(1)} M€ (KNEE OF PARETO FRONT)`);
            }
            if (s.t >= T.trace[0] && !s.traceLogged) {
                s.traceLogged = true;
                s.active = 5;
                s.activeT = 2.4;
                send(5, 0, 'tracing requirements');
            }
            if (s.t >= T.trace[1] && !s.doneLogged) {
                s.doneLogged = true;
                pushLog(scene, `VV → ORCH · ${REQS}/${REQS} REQUIREMENTS TRACED · READY FOR REVIEW`);
            }
            if (s.t > T.end) scene.reset();
        };

        function nodePos(i, gx, gy, r) {
            if (i === 0) return [gx, gy];
            const a = -Math.PI / 2 + ((i - 1) / AGENTS.length) * TAU;
            return [gx + Math.cos(a) * r, gy + Math.sin(a) * r];
        }

        scene.draw = function () {
            const { x, y, w, h } = stage;
            const gx = small ? x + w * 0.5 : x + w * 0.31;
            const gy = small ? y + h * 0.4 : y + h * 0.5;
            const r = small ? Math.min(w * 0.3, h * 0.17) : Math.min(w * 0.15, h * 0.28);

            // links
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.22)';
            ctx.setLineDash([3, 5]);
            for (let i = 1; i <= AGENTS.length; i++) {
                const [ax, ay] = nodePos(i, gx, gy, r);
                ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ax, ay); ctx.stroke();
            }
            ctx.beginPath();
            for (let i = 1; i <= AGENTS.length; i++) {
                const [ax, ay] = nodePos(i, gx, gy, r);
                if (i === 1) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.08)';
            ctx.stroke();
            ctx.setLineDash([]);

            // packets
            s.packets.forEach((p) => {
                const a = nodePos(p.from, gx, gy, r), b = nodePos(p.to, gx, gy, r);
                const px = a[0] + (b[0] - a[0]) * p.t, py = a[1] + (b[1] - a[1]) * p.t;
                glowDot(px, py, 2.4, p.label ? COL.amber : COL.cyan);
                if (p.label && !small) text(p.label, px + 8, py - 6, COL.amber, 9);
            });

            // nodes
            const nr = small ? 15 : 20;
            for (let i = 0; i <= AGENTS.length; i++) {
                const [nx, ny] = nodePos(i, gx, gy, r);
                const on = i === s.active && s.activeT > 0;
                ctx.fillStyle = 'rgba(5, 8, 13, 0.9)';
                ctx.strokeStyle = i === 0 ? COL.cyan : on ? COL.amber : COL.cyanMid;
                ctx.lineWidth = i === 0 || on ? 1.6 : 1;
                ctx.beginPath();
                for (let k = 0; k < 6; k++) {
                    const a = Math.PI / 6 + (k / 6) * TAU;
                    const rr = i === 0 ? nr * 1.35 : nr;
                    if (k === 0) ctx.moveTo(nx + Math.cos(a) * rr, ny + Math.sin(a) * rr); else ctx.lineTo(nx + Math.cos(a) * rr, ny + Math.sin(a) * rr);
                }
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.lineWidth = 1;
                if (on) {
                    ctx.strokeStyle = `rgba(255, 177, 74, ${0.6 * s.activeT})`;
                    ctx.beginPath(); ctx.arc(nx, ny, nr + 8 + (1 - s.activeT) * 10, 0, TAU); ctx.stroke();
                }
                const label = i === 0 ? 'ORCH' : AGENTS[i - 1].id;
                text(label, nx, ny + 3, i === 0 ? COL.cyan : on ? COL.amber : COL.text, small ? 9 : 10, 'center', 600);
                if (i > 0 && !small) text(AGENTS[i - 1].name, nx, ny + nr + 14, COL.dim, 8, 'center');
            }

            // trade space
            const px = small ? x + 40 : x + w * 0.56;
            const pw = small ? w - 60 : w * 0.38;
            const py = small ? y + h * 0.56 : y + 118;
            const ph = small ? h * 0.24 : h * 0.4;
            ctx.strokeStyle = COL.cyanMid;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + ph); ctx.lineTo(px + pw, py + ph); ctx.stroke();
            text('TRADE SPACE', px, py - 8, COL.cyan, 10, 'left', 600);
            text('mass [kg] →', px + pw, py + ph + 14, COL.dim, 9, 'right');
            text('cost [M€]', px - 6, py + 4, COL.dim, 9, 'right');
            const X = (m) => px + ((m - MASS[0]) / (MASS[1] - MASS[0])) * pw;
            const Y = (c) => py + ph - ((c - COST[0]) / (COST[1] - COST[0])) * ph;
            for (let m = 60; m < MASS[1]; m += 20) text(String(m), X(m), py + ph + 14, COL.dim, 8, 'center');
            for (let c = 15; c < COST[1]; c += 5) text(String(c), px - 6, Y(c) + 3, COL.dim, 8, 'right');
            s.designs.forEach((d) => {
                const dx = X(clamp(d.mass, MASS[0], MASS[1])), dy = Y(clamp(d.cost, COST[0], COST[1]));
                const fresh = clamp(1 - d.age / 0.6, 0, 1);
                if (d.feasible) {
                    ctx.fillStyle = `rgba(102, 126, 234, ${0.45 + 0.5 * fresh})`;
                    ctx.beginPath(); ctx.arc(dx, dy, 2.2 + 2 * fresh, 0, TAU); ctx.fill();
                } else {
                    ctx.strokeStyle = 'rgba(255, 90, 79, 0.55)';
                    ctx.beginPath(); ctx.moveTo(dx - 2.5, dy - 2.5); ctx.lineTo(dx + 2.5, dy + 2.5); ctx.moveTo(dx + 2.5, dy - 2.5); ctx.lineTo(dx - 2.5, dy + 2.5); ctx.stroke();
                }
            });
            if (s.front.length > 1) {
                ctx.strokeStyle = COL.amber;
                ctx.lineWidth = 1.4;
                polyline(s.front.map((d) => [X(d.mass), Y(d.cost)]));
                ctx.lineWidth = 1;
            }
            if (s.chosen) {
                const cx = X(s.chosen.mass), cy = Y(s.chosen.cost);
                ctx.strokeStyle = COL.amber;
                ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.stroke();
                text('SELECTED', cx + 12, cy - 8, COL.amber, 9, 'left', 600);
            }

            // spec sheet
            if (!small && s.t > T.spec[0]) {
                const rows = [
                    ['MISSION', 'Wildfire & flood monitoring'],
                    ['ORBIT', 'SSO 550 km · LTAN 10:30'],
                    ['PAYLOAD', `SWIR imager · ${(s.chosen ? s.chosen.D * 100 : 0).toFixed(0)} cm aperture`],
                    ['POWER', `${(s.chosen ? s.chosen.P : 0).toFixed(0)} W EOL`],
                    ['COMMS', 'X-band 150 Mbps · S-band ISL'],
                    ['MASS / COST', s.chosen ? `${s.chosen.mass.toFixed(0)} kg · ${s.chosen.cost.toFixed(1)} M€` : '—'],
                    ['REQUIREMENTS', `${Math.round(clamp((s.t - T.trace[0]) / (T.trace[1] - T.trace[0]), 0, 1) * REQS)}/${REQS} traced`]
                ];
                const shown = Math.ceil(clamp((s.t - T.spec[0]) / (T.spec[1] - T.spec[0]), 0, 1) * rows.length);
                const sy = py + ph + 40;
                text('SPEC SHEET v0.3', px, sy, COL.cyan, 10, 'left', 600);
                rows.slice(0, shown).forEach(([k, v], i) => {
                    text(k, px, sy + 18 + i * 15, COL.dim, 9);
                    text(v, px + pw, sy + 18 + i * 15, i === rows.length - 1 && s.t >= T.trace[1] ? COL.amber : COL.text, 9, 'right', 600);
                });
            }
        };

        scene.stats = function () {
            const traced = Math.round(clamp((s.t - T.trace[0]) / (T.trace[1] - T.trace[0]), 0, 1) * REQS);
            return [
                ['DESIGNS', `${s.designs.length}`],
                ['FEASIBLE', `${s.designs.filter((d) => d.feasible).length}`],
                ['PARETO-OPTIMAL', `${s.front.length}`],
                ['REQS TRACED', `${traced}/${REQS}`]
            ];
        };

        return scene;
    })();

    /* =====================================================================
     * 01  Vision-based rendezvous: a chaser approaches a tumbling target in the target's
     * local orbital frame. Relative motion follows the Clohessy-Wiltshire equations (n = 1,
     * time = orbital phase, positions in metres); each leg is a two-impulse transfer chosen
     * as the lowest-Δv of nine candidates, then a straight V-bar final approach. Two insets
     * show the target as seen by a frame camera (with estimated keypoints and pose axes)
     * and by an event camera, which only fires where edges move.
     * ===================================================================== */
    const rpo = (function () {
        const scene = {
            id: 'rpo',
            title: '01 // VISION-BASED RENDEZVOUS',
            subtitle: 'CLOHESSY-WILTSHIRE APPROACH · 6-DOF POSE ESTIMATION · EVENT CAMERA',
            logs: []
        };
        const MEAN_MOTION = 0.00113;            // rad/s, ~LEO; converts m per rad of phase to m/s
        const SIM_RATE = 0.5;                   // orbital phase (rad) advanced per wall-clock second
        const HOLDS = [{ y: -250, name: 'H1' }, { y: -100, name: 'H2' }, { y: -30, name: 'H3' }];
        const CLOSING = 9;                      // final-approach speed, m per wall-clock second (displayed as 0.1 m/s)
        // target model: bus corners and two solar wings (unit ~ metres)
        const V = [
            [-0.5, -0.5, -0.7], [0.5, -0.5, -0.7], [0.5, 0.5, -0.7], [-0.5, 0.5, -0.7],
            [-0.5, -0.5, 0.7], [0.5, -0.5, 0.7], [0.5, 0.5, 0.7], [-0.5, 0.5, 0.7],
            [0.6, -0.4, 0], [2.7, -0.4, 0], [2.7, 0.4, 0], [0.6, 0.4, 0],
            [-0.6, -0.4, 0], [-2.7, -0.4, 0], [-2.7, 0.4, 0], [-0.6, 0.4, 0],
            [0, 0, 0.7], [0, 0, 1.3]
        ];
        const E = [
            [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
            [8, 9], [9, 10], [10, 11], [11, 8], [12, 13], [13, 14], [14, 15], [15, 12], [16, 17]
        ];
        const KEYPOINTS = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 13, 14, 17];
        const EVENT_WINDOW = 0.25;              // s of events accumulated in the event-camera view
        let s = null;

        function stm(t) {
            const c = Math.cos(t), sn = Math.sin(t);
            return {
                rr: [[4 - 3 * c, 0], [6 * (sn - t), 1]],
                rv: [[sn, 2 * (1 - c)], [-2 * (1 - c), 4 * sn - 3 * t]],
                vr: [[3 * sn, 0], [6 * (c - 1), 0]],
                vv: [[c, 2 * sn], [-2 * sn, 4 * c - 3]]
            };
        }
        const mv = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];

        function propagate(r, v, t) {
            const P = stm(t);
            const a = mv(P.rr, r), b = mv(P.rv, v), c = mv(P.vr, r), d = mv(P.vv, v);
            return { r: [a[0] + b[0], a[1] + b[1]], v: [c[0] + d[0], c[1] + d[1]] };
        }

        /* Velocity needed at r0 to reach rf after phase T (two-impulse targeting). */
        function solveTransfer(r0, rf, T) {
            const P = stm(T);
            const m = P.rv;
            const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
            if (Math.abs(det) < 1e-3) return null;
            const a = mv(P.rr, r0);
            const dx = rf[0] - a[0], dy = rf[1] - a[1];
            return [(m[1][1] * dx - m[0][1] * dy) / det, (-m[1][0] * dx + m[0][0] * dy) / det];
        }

        function startPlan() {
            const hold = HOLDS[s.leg];
            const rf = [0, hold.y];
            s.phase = 'plan';
            s.t = 0;
            s.candidates = [];
            for (let k = 0; k < 9; k++) {
                const T = (0.45 + k * 0.09) * Math.PI;
                const v0 = solveTransfer(s.r, rf, T);
                if (!v0) continue;
                const path = [];
                for (let i = 0; i < 48; i++) path.push(propagate(s.r, v0, (T * i) / 47).r);
                const vf = propagate(s.r, v0, T).v;
                const dv = hyp([v0[0] - s.v[0], v0[1] - s.v[1]]) + hyp(vf);
                s.candidates.push({ T, v0, path, dv });
            }
            s.best = s.candidates.reduce((a, b) => (b.dv < a.dv ? b : a));
            pushLog(scene, `PLAN → ${hold.name} (${Math.abs(hold.y)} m) · 9 CANDIDATES · BEST Δv ${(s.best.dv * MEAN_MOTION * 100).toFixed(1)} cm/s`);
        }

        scene.reset = function () {
            const x0 = rand(25, 45) * (Math.random() < 0.5 ? -1 : 1);
            s = {
                r: [x0, rand(-440, -400)], v: [0, 0],
                leg: 0, phase: 'plan', t: 0, legT: 0, trail: [], dvUsed: 0, burn: null,
                candidates: [], best: null, att: [rand(0, TAU), rand(0, TAU), rand(0, TAU)],
                frameAtt: null, frameT: 0, ghosts: [], prevEdges: null, events: 0, evBuf: []
            };
            scene.logs = [];
            pushLog(scene, 'TARGET ACQUIRED · TUMBLE 2.1 °/s · NAV FILTER CONVERGED');
            startPlan();
        };

        scene.resize = function () { if (!s) scene.reset(); };

        scene.update = function (dt) {
            s.t += dt;
            s.att[0] += 0.32 * dt; s.att[1] += 0.47 * dt; s.att[2] += 0.18 * dt;
            s.frameT -= dt;
            if (s.frameT <= 0) {                // the frame camera only refreshes at 10 Hz
                s.frameT = 0.1;
                if (s.frameAtt) s.ghosts.unshift(s.frameAtt.slice());
                s.ghosts = s.ghosts.slice(0, 2);
                s.frameAtt = s.att.slice();
            }
            if (s.burn) { s.burn.t += dt; if (s.burn.t > 0.9) s.burn = null; }
            s.evBuf.forEach((e) => { e.age += dt; });
            s.evBuf = s.evBuf.filter((e) => e.age < EVENT_WINDOW);

            if (s.phase === 'plan' && s.t > 1.6) {
                const dv1 = [s.best.v0[0] - s.v[0], s.best.v0[1] - s.v[1]];
                s.dvUsed += hyp(dv1);
                s.v = s.best.v0.slice();
                s.r0 = s.r.slice();
                s.v0 = s.v.slice();
                s.legT = 0;
                s.burn = { dir: dv1, t: 0 };
                s.phase = 'coast';
                pushLog(scene, `BURN · Δv ${(hyp(dv1) * MEAN_MOTION * 100).toFixed(1)} cm/s · TOF ${((s.best.T / TAU) * 92).toFixed(0)} min`);
            } else if (s.phase === 'coast') {
                s.legT += dt * SIM_RATE;
                const done = s.legT >= s.best.T;
                const st = propagate(s.r0, s.v0, Math.min(s.legT, s.best.T));
                s.r = st.r;
                s.v = st.v;
                if (done) {
                    const hold = HOLDS[s.leg];
                    s.dvUsed += hyp(s.v);
                    s.burn = { dir: [-s.v[0], -s.v[1]], t: 0 };
                    s.r = [0, hold.y];
                    s.v = [0, 0];
                    s.phase = 'hold';
                    s.t = 0;
                    pushLog(scene, `BRAKE · HOLDING AT ${hold.name} · POSE ERROR ${poseError().toFixed(1)}°`);
                }
            } else if (s.phase === 'hold' && s.t > 1.3) {
                s.leg++;
                if (s.leg < HOLDS.length) startPlan();
                else { s.phase = 'final'; s.t = 0; pushLog(scene, 'FINAL APPROACH ON V-BAR · 0.1 m/s'); }
            } else if (s.phase === 'final') {
                s.r = [0, Math.min(-3, s.r[1] + CLOSING * dt)];
                s.v = [0, CLOSING / (SIM_RATE * 1)];
                if (s.r[1] >= -3) { s.phase = 'capture'; s.t = 0; s.v = [0, 0]; pushLog(scene, 'CONTACT · SOFT CAPTURE CONFIRMED'); }
            } else if (s.phase === 'capture' && s.t > 2.6) {
                scene.reset();
            }
            s.trail.push(s.r.slice());
            if (s.trail.length > 700) s.trail.shift();
        };

        function range() { return Math.max(3, hyp(s.r)); }
        function poseError() { return 0.15 + range() * 0.006; }

        function rot(att) {
            const [a, b, c] = att;
            const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
            return [
                [cb * cc, -cb * sc, sb],
                [sa * sb * cc + ca * sc, -sa * sb * sc + ca * cc, -sa * cb],
                [-ca * sb * cc + sa * sc, ca * sb * sc + sa * cc, ca * cb]
            ];
        }

        function project(att, k, cx, cy) {
            const m = rot(att);
            return V.map((p) => {
                const X = m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2];
                const Y = m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2];
                const Z = m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2];
                const f = 6 / (6 + Z);
                return [cx + X * k * f, cy + Y * k * f];
            });
        }

        function drawWire(pts, color, width) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            E.forEach(([a, b]) => { ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); });
            ctx.stroke();
            ctx.lineWidth = 1;
        }

        function insetFrame(ix, iy, iw, ih, title) {
            ctx.fillStyle = 'rgba(2, 4, 8, 0.92)';
            ctx.fillRect(ix, iy, iw, ih);
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.4)';
            ctx.strokeRect(ix + 0.5, iy + 0.5, iw, ih);
            text(title, ix + 6, iy - 6, COL.cyan, small ? 8 : 9, 'left', 600);
        }

        scene.draw = function () {
            const { x, y, w, h } = stage;
            const tx = x + w * (small ? 0.88 : 0.84);
            const ty = y + h * (small ? 0.86 : 0.66);
            const sc = Math.min((w * 0.76) / 460, (h * 0.3) / 80);
            const P = (r) => [tx + r[1] * sc, ty - r[0] * sc];

            // axes, ticks, corridor, keep-out sphere
            ctx.strokeStyle = COL.cyanDim;
            ctx.setLineDash([3, 6]);
            ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x + w, ty); ctx.moveTo(tx, ty - h * 0.3); ctx.lineTo(tx, ty + h * 0.25); ctx.stroke();
            ctx.setLineDash([]);
            for (let m = -450; m <= 0; m += 50) {
                const [px] = P([0, m]);
                if (px < x + 8) continue;
                ctx.strokeStyle = COL.cyanMid;
                ctx.beginPath(); ctx.moveTo(px, ty - 3); ctx.lineTo(px, ty + 3); ctx.stroke();
                if (m % 100 === 0 && m !== 0) text(`${m}`, px, ty + 16, COL.dim, 9, 'center');
            }
            text('V-BAR  [m]', x + 16, ty - 8, COL.cyanMid, 10);
            text('R-BAR', tx + 8, ty - h * 0.3 + 12, COL.cyanMid, 10);
            ctx.strokeStyle = 'rgba(255, 177, 74, 0.25)';
            const cone = Math.tan(10 * DEG) * 280;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(...P([cone, -280])); ctx.moveTo(tx, ty); ctx.lineTo(...P([-cone, -280])); ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 90, 79, 0.6)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(tx, ty, 20 * sc, 0, TAU); ctx.stroke();
            ctx.setLineDash([]);
            text('KOS 20 m', tx + 20 * sc + 4, ty - 20 * sc, 'rgba(255, 90, 79, 0.85)', 9);

            HOLDS.forEach((hp, i) => {
                const [hx, hy] = P([0, hp.y]);
                const reached = s.leg > i || (s.leg === i && s.phase === 'hold');
                ctx.strokeStyle = reached ? COL.amber : COL.cyanMid;
                ctx.beginPath(); ctx.moveTo(hx, hy - 5); ctx.lineTo(hx + 5, hy); ctx.lineTo(hx, hy + 5); ctx.lineTo(hx - 5, hy); ctx.closePath(); ctx.stroke();
                text(hp.name, hx, hy - 9, reached ? COL.amber : COL.dim, 9, 'center');
            });

            if (s.phase === 'plan') {
                const reveal = clamp(s.t / 0.9, 0, 1);
                s.candidates.forEach((c) => {
                    const isBest = c === s.best && s.t > 1.0;
                    ctx.strokeStyle = isBest ? COL.amber : 'rgba(102, 126, 234, 0.28)';
                    ctx.lineWidth = isBest ? 1.6 : 1;
                    ctx.setLineDash(isBest ? [] : [2, 4]);
                    polyline(c.path.map(P), Math.ceil(reveal * c.path.length));
                });
                ctx.setLineDash([]);
                ctx.lineWidth = 1;
            } else if (s.phase === 'coast') {
                ctx.strokeStyle = 'rgba(255, 177, 74, 0.55)';
                ctx.setLineDash([5, 5]);
                polyline(s.best.path.map(P));
                ctx.setLineDash([]);
            }

            ctx.strokeStyle = 'rgba(102, 126, 234, 0.75)';
            ctx.lineWidth = 1.4;
            polyline(s.trail.map(P));
            ctx.lineWidth = 1;

            // target and chaser markers
            ctx.strokeStyle = COL.text;
            ctx.strokeRect(tx - 5, ty - 5, 10, 10);
            ctx.beginPath(); ctx.moveTo(tx - 13, ty); ctx.lineTo(tx - 5, ty); ctx.moveTo(tx + 5, ty); ctx.lineTo(tx + 13, ty); ctx.stroke();
            text('TGT', tx, ty + 22, COL.text, 9, 'center');
            const [cx, cy] = P(s.r);
            if (s.burn) {
                const m = hyp(s.burn.dir) || 1;
                const len = 30 * (1 - s.burn.t / 0.9);
                ctx.strokeStyle = COL.amber;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - (s.burn.dir[1] / m) * len, cy + (s.burn.dir[0] / m) * len); ctx.stroke();
                ctx.lineWidth = 1;
            }
            glowDot(cx, cy, 3, s.phase === 'capture' ? COL.amber : COL.cyan);
            ctx.strokeStyle = COL.cyanMid;
            ctx.strokeRect(cx - 7, cy - 7, 14, 14);
            text('CHASER', cx + 11, cy - 9, COL.cyan, 9);

            // camera insets
            const iw = small ? Math.min(150, (w - 40) / 2) : Math.min(230, w * 0.24);
            const ih = iw * 0.72;
            const ix = stage.safeX, iy = y + (small ? 128 : 72);
            const k = iw * 0.16 * clamp(150 / range(), 0.5, 1.1);   // apparent size grows as the range closes
            const fcx = ix + iw / 2, fcy = iy + ih / 2;

            insetFrame(ix, iy, iw, ih, 'NAV CAM · FRAME 10 Hz');
            ctx.save();
            ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
            s.ghosts.forEach((g, i) => drawWire(project(g, k, fcx, fcy), `rgba(216, 227, 236, ${0.18 / (i + 1)})`, 1));
            const pts = project(s.frameAtt || s.att, k, fcx, fcy);
            drawWire(pts, 'rgba(216, 227, 236, 0.75)', 1);
            const err = poseError();
            ctx.fillStyle = COL.cyan;
            KEYPOINTS.forEach((i) => {
                const jx = Math.sin(met * 7 + i) * err * 0.6, jy = Math.cos(met * 5 + i) * err * 0.6;
                ctx.strokeStyle = COL.cyan;
                ctx.strokeRect(pts[i][0] - 2.5 + jx, pts[i][1] - 2.5 + jy, 5, 5);
            });
            const m = rot(s.frameAtt || s.att);
            [[0, COL.amber], [1, COL.cyan], [2, '#ffffff']].forEach(([axis, color]) => {
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.moveTo(fcx, fcy); ctx.lineTo(fcx + m[0][axis] * k * 1.4, fcy + m[1][axis] * k * 1.4); ctx.stroke();
                ctx.lineWidth = 1;
            });
            ctx.restore();
            text(`POSE ERR ${err.toFixed(1)}° · ${(range() * 0.0008).toFixed(2)} m`, ix + 6, iy + ih - 6, COL.amber, small ? 8 : 9);

            // event camera: dots only where projected edges moved since the last frame
            const ex = small ? ix + iw + 12 : ix, ey = small ? iy : iy + ih + 26;
            insetFrame(ex, ey, iw, ih, 'EVENT CAM · ON / OFF');
            const ecx = ex + iw / 2, ecy = ey + ih / 2;
            const cur = project(s.att, k, ecx, ecy);
            let count = 0;
            if (s.prevEdges) {
                E.forEach(([a, b]) => {
                    for (let q = 0; q <= 8; q++) {
                        const u = q / 8;
                        const px = cur[a][0] + (cur[b][0] - cur[a][0]) * u, py = cur[a][1] + (cur[b][1] - cur[a][1]) * u;
                        const ox = s.prevEdges[a][0] + (s.prevEdges[b][0] - s.prevEdges[a][0]) * u;
                        const oy = s.prevEdges[a][1] + (s.prevEdges[b][1] - s.prevEdges[a][1]) * u;
                        const mx = px - ox, my = py - oy;
                        if (Math.hypot(mx, my) < 0.05) continue;
                        const nx = -(cur[b][1] - cur[a][1]), ny = cur[b][0] - cur[a][0];
                        s.evBuf.push({ x: px - ex + rand(-1, 1), y: py - ey + rand(-1, 1), on: mx * nx + my * ny > 0, age: 0 });
                        count++;
                    }
                });
            }
            ctx.save();
            ctx.beginPath(); ctx.rect(ex, ey, iw, ih); ctx.clip();
            s.evBuf.forEach((e) => {
                ctx.globalAlpha = 1 - e.age / EVENT_WINDOW;
                ctx.fillStyle = e.on ? COL.cyan : COL.amber;
                ctx.fillRect(ex + e.x - 0.8, ey + e.y - 0.8, 1.6, 1.6);
            });
            ctx.globalAlpha = 1;
            ctx.restore();
            s.prevEdges = cur;
            s.events = s.events * 0.9 + count * 0.1;
            text(`${(s.events * 0.06).toFixed(2)} Mev/s`, ex + 6, ey + ih - 6, COL.cyan, small ? 8 : 9);
        };

        scene.stats = function () {
            const rr = range() > 3.01 ? (s.r[0] * s.v[0] + s.r[1] * s.v[1]) / range() : 0;
            const mode = { plan: 'PLANNING', coast: 'COAST', hold: 'HOLD', final: 'FINAL APPROACH', capture: 'CAPTURED' }[s.phase];
            return [
                ['RANGE', `${range().toFixed(1)} m`],
                ['RANGE-RATE', `${s.phase === 'final' ? '-0.10' : (rr * MEAN_MOTION).toFixed(2)} m/s`],
                ['Δv USED', `${(s.dvUsed * MEAN_MOTION * 100).toFixed(1)} cm/s`],
                ['MODE', mode]
            ];
        };

        return scene;
    })();

    /* =====================================================================
     * 02  Earth tip-and-cue: optical satellites in sun-synchronous orbits detect a wildfire
     * or flood onboard ("tip") and cue the radar (SAR) satellite that will pass over the
     * area soonest; the SAR satellite images through smoke or cloud and downlinks the alert
     * to the nearest ground station. Ground tracks come from the orbits and Earth's rotation.
     * ===================================================================== */
    const earth = (function () {
        const scene = {
            id: 'earth',
            title: '02 // EARTH TIP-AND-CUE',
            subtitle: 'ONBOARD DETECTION · CUEING A RADAR SATELLITE · RAPID ALERTING',
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
        let lon0 = 0, spin = 0, spawnT = 0, nextEvent = 0, alerts = 0, cues = 0;
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

        /* Tip-and-cue: hand the event to the SAR satellite currently closest to it. */
        function cue(ev, tip) {
            const sar = sats.filter((s) => s.kind === 'SAR')
                .reduce((p, q) => (angDist(q.lat, q.lon, ev.lat, ev.lon) < angDist(p.lat, p.lon, ev.lat, ev.lon) ? q : p));
            ev.tip = tip;
            ev.sar = sar;
            ev.state = 'cueing';
            ev.cueAge = 0;
            cues++;
            send(() => project(tip.lat, tip.lon, 1.13), () => project(sar.lat, sar.lon, 1.13), 1.0, COL.cyan, () => {
                if (ev.state === 'cueing') ev.state = 'cued';
                pushLog(scene, `${tip.id} ⇢ ${sar.id} CUE · TASKED OVER ${ev.where}`);
            });
        }

        scene.reset = function () {
            sats = [];
            const planes = [
                { kind: 'OPT', inc: 97.6 * DEG, raan: 20 * DEG, n: 3 },
                { kind: 'OPT', inc: 97.6 * DEG, raan: 110 * DEG, n: 3 },
                { kind: 'SAR', inc: 97.4 * DEG, raan: 200 * DEG, n: 2 },
                { kind: 'SAR', inc: 53 * DEG, raan: 300 * DEG, n: 2 }
            ];
            const count = { OPT: 1, SAR: 1 };
            planes.forEach((pl) => {
                for (let k = 0; k < pl.n; k++) {
                    sats.push({ id: `${pl.kind}-${count[pl.kind]++}`, kind: pl.kind, inc: pl.inc, raan: pl.raan, u: (k / pl.n) * TAU + rand(0, 0.5), rate: TAU / 13, track: [], trackT: 0 });
                }
            });
            events = [];
            packets = [];
            tasks = [];
            nextEvent = Math.floor(rand(0, EVENTS.length));
            spawnT = 1.5;
            pushLog(scene, '6 OPTICAL + 4 SAR SPACECRAFT NOMINAL · CUEING LINK ONLINE');
        };

        scene.resize = function () {
            cx = stage.x + stage.w / 2;
            cy = stage.y + stage.h / 2 + (small ? 10 : 6);
            R = Math.max(40, Math.min(stage.w, stage.h) * (small ? 0.36 : 0.37));
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
                s.trackT += dt;
                if (s.trackT > 0.12) { s.trackT = 0; s.track.push([s.lat, s.lon]); if (s.track.length > 46) s.track.shift(); }
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
                    const tip = sats.find((s) => s.kind === 'OPT' && angDist(s.lat, s.lon, ev.lat, ev.lon) < 14);
                    if (!tip) return;
                    ev.state = 'tipped';
                    pushLog(scene, `${tip.id} ▸ ${ev.kind} DETECTED ONBOARD · ${ev.where} ${fmtLL(ev.lat, ev.lon)}`);
                    cue(ev, tip);
                } else if (ev.state === 'cued') {
                    ev.cueAge += dt;
                    const sar = ev.sar;
                    if (angDist(sar.lat, sar.lon, ev.lat, ev.lon) < 22) {
                        ev.state = 'imaged';
                        tasks.push({ sat: sar, ev, t: 0 });
                        pushLog(scene, `${sar.id} ▸ RADAR ACQUISITION · ${ev.kind === 'FLOOD' ? 'FLOOD EXTENT MAPPED THROUGH CLOUD' : 'BURN SCAR MAPPED THROUGH SMOKE'}`);
                        const gs = STATIONS.reduce((p, q) => (angDist(q.lat, q.lon, sar.lat, sar.lon) < angDist(p.lat, p.lon, sar.lat, sar.lon) ? q : p));
                        send(() => project(sar.lat, sar.lon, 1.13), () => project(gs.lat, gs.lon, 1), 1.1, COL.amber, () => {
                            ev.state = 'alerted';
                            ev.doneAge = ev.age;
                            alerts++;
                            pushLog(scene, `GS ${gs.name} ▸ ${ev.kind} ALERT DISPATCHED`);
                        });
                    } else if (ev.cueAge > 9) {
                        cue(ev, ev.tip);                 // pass missed: re-cue whichever SAR is closest now
                    }
                } else if (ev.state === 'alerted' && ev.age - ev.doneAge > 5) {
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
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

            // graticule
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.12)';
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
                ctx.fillStyle = `rgba(102, 126, 234, ${0.15 + 0.55 * p.z})`;
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
                    const tag = { tipped: 'DETECTED', cueing: 'CUEING SAR', cued: 'SAR TASKED', imaged: 'SAR IMAGED', alerted: 'ALERTED' }[ev.state];
                    text(`${ev.kind} · ${tag}`, p.x + 10, p.y - 8, color, 9, 'left', 600);
                }
            });

            // orbits (one per plane) and recent ground tracks; optical tracks show the imaging swath
            ctx.strokeStyle = 'rgba(216, 227, 236, 0.08)';
            sats.filter((s, i) => i === 0 || sats[i - 1].raan !== s.raan).forEach(drawOrbit);
            sats.forEach((s) => {
                const pts = s.track.map(([la, lo]) => project(la, lo));
                const draw = (width, color) => {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = width;
                    ctx.beginPath();
                    let started = false;
                    pts.forEach((p, i) => {
                        if (p.z <= 0 || (i > 0 && Math.abs(p.x - pts[i - 1].x) > R * 0.5)) { started = false; return; }
                        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
                    });
                    ctx.stroke();
                };
                if (s.kind === 'OPT') draw(small ? 5 : 8, 'rgba(102, 126, 234, 0.07)');
                draw(1, s.kind === 'OPT' ? 'rgba(102, 126, 234, 0.45)' : 'rgba(255, 177, 74, 0.45)');
            });
            ctx.lineWidth = 1;

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

            // satellites: optical as bars, SAR as diamonds
            sats.forEach((s) => {
                const p = project(s.lat, s.lon, 1.13);
                if (p.hidden) return;
                const busy = tasks.some((tk) => tk.sat === s);
                const color = s.kind === 'SAR' ? COL.amber : COL.cyan;
                ctx.strokeStyle = busy ? '#ffffff' : color;
                if (s.kind === 'SAR') {
                    ctx.beginPath(); ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x + 5, p.y); ctx.lineTo(p.x, p.y + 5); ctx.lineTo(p.x - 5, p.y); ctx.closePath(); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.moveTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y); ctx.stroke();
                }
                glowDot(p.x, p.y, 1.8, color);
                if (!small || s.kind === 'SAR') text(s.id, p.x + 8, p.y - 6, busy ? '#ffffff' : color, 8, 'left', 600);
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
                ['OPTICAL / SAR', `${sats.filter((s) => s.kind === 'OPT').length} / ${sats.filter((s) => s.kind === 'SAR').length}`],
                ['ACTIVE EVENTS', `${events.length}`],
                ['CUES SENT', `${cues}`],
                ['ALERTS', `${alerts}`]
            ];
        };

        return scene;
    })();

    /* =====================================================================
     * 04  Mars: three rovers and a helicopter share one map and split the
     * unexplored frontier between them; found sample sites get a rover assigned.
     * ===================================================================== */
    const mars = (function () {
        const scene = {
            id: 'mars',
            title: '04 // MARS SURFACE OPS',
            subtitle: 'MULTI-ROBOT EXPLORATION · SHARED MAP · FRONTIER ALLOCATION',
            logs: []
        };
        const GX = 72, GY = 44;
        let seed = 1, terrain = null, cells = null, FX = 0, FY = 0, cw = 0, ch = 0;
        let agents = [], sites = [], packets = [], links = [];
        let msgs = 0, explored = 0, packetT = 0, finished = -1;
        let cam = null;                       // R1 navigation camera: ground rocks ahead of the rover (m)
        const CAM_HEIGHT = 1.5;               // camera height above ground, m

        function newRock(far) {
            return { x: rand(-6, 6), z: far ? rand(24, 34) : rand(3, 34), r: rand(0.18, 0.7) };
        }

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
            cam = { travel: 0, rocks: Array.from({ length: 16 }, () => newRock(false)), warnT: 0, seed: rand(0, 100) };
            pushLog(scene, 'LANDED · 4 AGENTS ONLINE · MAP SYNC ESTABLISHED');
        };

        scene.resize = function () { scene.reset(); };

        scene.update = function (dt) {
            if (finished >= 0) {
                finished += dt;
                if (finished > 3) scene.reset();
                return;
            }
            const r1 = agents[0], r1x = r1.x, r1y = r1.y;
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

            // drive the navigation camera forward by the distance R1 actually moved (map px -> m)
            const moved = Math.hypot(r1.x - r1x, r1.y - r1y) * (60 / stage.w);
            cam.travel += moved;
            cam.warnT -= dt;
            cam.rocks.forEach((rk, i) => {
                rk.z -= moved;
                if (rk.z < 1.2) cam.rocks[i] = newRock(true);
                else if (rk.z < 4 && Math.abs(rk.x) < 1.2 && rk.r > 0.4 && cam.warnT <= 0) {
                    cam.warnT = 5;
                    pushLog(scene, `R1 ▸ HAZARD ${rk.z.toFixed(1)} m AHEAD · ROCK ${(rk.r * 100).toFixed(0)} cm · PATH ADJUSTED`);
                }
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
            ctx.fillStyle = 'rgba(102, 126, 234, 0.18)';
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
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.35)';
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
                ctx.fillStyle = a.kind === 'heli' ? 'rgba(255, 177, 74, 0.55)' : 'rgba(102, 126, 234, 0.55)';
                a.trail.forEach((p, i) => { if (i % 2 === 0) ctx.fillRect(x + p[0] - 0.7, y + p[1] - 0.7, 1.4, 1.4); });
                ctx.strokeStyle = 'rgba(102, 126, 234, 0.15)';
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
                    ctx.fillStyle = 'rgba(102, 126, 234, 0.25)';
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
            drawNavcam();
        };

        /* R1 navigation camera: left half is the image, right half the per-pixel terrain classes
         * a segmentation network would output (sand, bedrock, hazard). */
        function drawNavcam() {
            const iw = small ? Math.min(150, stage.w * 0.42) : Math.min(250, stage.w * 0.24);
            const ih = iw * 0.62;
            const ix = stage.x + 14, iy = stage.y + (small ? 52 : 70);
            insetBox(ix, iy, iw, ih, 'R1 NAVCAM · TERRAIN SEGMENTATION');
            const hz = iy + ih * 0.3, f = ih * 0.9, cxc = ix + iw / 2, mid = ix + iw / 2;
            const sky = ctx.createLinearGradient(0, iy, 0, hz);
            sky.addColorStop(0, 'rgb(70, 46, 38)');
            sky.addColorStop(1, 'rgb(150, 105, 80)');
            ctx.fillStyle = sky;
            ctx.fillRect(ix, iy, iw, hz - iy);
            const cols = 28, rows = 12;
            const cw2 = iw / cols, rh = (iy + ih - hz) / rows;
            for (let r = 0; r < rows; r++) {
                const sy = hz + (r + 0.5) * rh;
                const z = (f * CAM_HEIGHT) / (sy - hz);
                const haze = clamp(z / 40, 0, 0.6);
                for (let c = 0; c < cols; c++) {
                    const sx = ix + (c + 0.5) * cw2;
                    const wx = ((sx - cxc) * z) / f;
                    const n = tileNoise(wx * 0.55, (z + cam.travel) * 0.45, cam.seed);
                    if (sx < mid) {
                        const k = 0.55 + 0.6 * n;
                        ctx.fillStyle = `rgb(${(170 * k * (1 - haze) + 150 * haze) | 0}, ${(105 * k * (1 - haze) + 105 * haze) | 0}, ${(70 * k * (1 - haze) + 80 * haze) | 0})`;
                    } else {
                        ctx.fillStyle = n < 0.45 ? 'rgba(255, 177, 74, 0.75)' : n < 0.68 ? 'rgba(102, 126, 234, 0.6)' : 'rgba(255, 90, 79, 0.7)';
                    }
                    ctx.fillRect(ix + c * cw2, hz + r * rh, cw2 + 0.5, rh + 0.5);
                }
            }
            [[ix, mid, false], [mid, ix + iw, true]].forEach(([x0, x1, seg]) => {
                ctx.save();
                ctx.beginPath(); ctx.rect(x0, hz, x1 - x0, iy + ih - hz); ctx.clip();
                cam.rocks.slice().sort((a, b) => b.z - a.z).forEach((rk) => {
                    const sy = hz + (f * CAM_HEIGHT) / rk.z;
                    const sx = cxc + (f * rk.x) / rk.z;
                    const rr = (f * rk.r) / rk.z;
                    ctx.fillStyle = seg ? 'rgba(255, 90, 79, 0.95)' : 'rgb(48, 30, 24)';
                    ctx.beginPath(); ctx.ellipse(sx, sy - rr * 0.4, rr, rr * 0.6, 0, 0, TAU); ctx.fill();
                    if (seg && rk.z < 8 && Math.abs(rk.x) < 2) {
                        ctx.strokeStyle = '#ffffff';
                        ctx.strokeRect(sx - rr - 2, sy - rr - 2, rr * 2 + 4, rr * 1.4 + 4);
                    }
                });
                ctx.restore();
            });
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath(); ctx.moveTo(mid, iy); ctx.lineTo(mid, iy + ih); ctx.stroke();
            text('RGB', ix + 4, iy + 10, COL.text, 8, 'left', 600);
            text('SEG', mid + 4, iy + 10, COL.text, 8, 'left', 600);
            const ly = iy + ih + 12;
            text('■ SAND', ix, ly, COL.amber, 8);
            text('■ BEDROCK', ix + iw * 0.3, ly, COL.cyan, 8);
            text('■ HAZARD', ix + iw * 0.68, ly, COL.red, 8);
        }

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
     * Carousel scene viewer: one canvas in a framed slide. The rail buttons, arrows and
     * horizontal swipes pick the scene; it advances on its own until the visitor does.
     * ===================================================================== */
    const scenes = [rpo, earth, agents, mars];
    let current = 0, trans = null, running = false, last = 0, inView = false;
    let autoplay = !reduceMotion, autoClock = 0;

    function layout() {
        const r = pin.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.round(r.width);
        H = Math.round(r.height);
        small = W < 900;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        stars = Array.from({ length: Math.round((W * H) / 6000) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(0.3, 1.2), p: rand(0, TAU) }));
        stage = stageFor();
        scenes.forEach((sc) => sc.resize());
    }

    /* The stage fills the frame with a small margin; captions sit below the canvas, so the
     * whole width is free (safeX/safeR are the inner edges for HUD text and insets). */
    function stageFor() {
        const m = small ? 10 : 16;
        const w = Math.max(200, W - 2 * m), h = Math.max(240, H - 2 * m);
        return { x: m, y: m, w, h, safeX: m + 14, safeR: m + w - 14 };
    }

    function showScene(i) {
        current = i;
        stage = stageFor();
        scenes[i].resize();
        if (scenes[i] === rpo || scenes[i] === agents) scenes[i].reset(); // these tell a story from the start
    }

    function drawBackdrop() {
        for (let i = 0; i < stars.length; i++) {
            const st = stars[i];
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(met * 0.8 + st.p);
            ctx.fillStyle = '#cfe6ff';
            ctx.fillRect(st.x, st.y, st.r, st.r);
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(102, 126, 234, 0.06)';
        ctx.beginPath();
        const gs = small ? 40 : 64;
        for (let gx = gs; gx < W; gx += gs) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
        for (let gy = gs; gy < H; gy += gs) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
        ctx.stroke();
    }

    function drawHudOverlay(scene) {
        const { x, y, w, h } = stage;
        brackets(x, y, w, h, 18, 'rgba(102, 126, 234, 0.55)');
        const lx = stage.safeX;               // left edge not covered by a caption card
        text(scene.title, lx, y + 24, COL.cyan, small ? 11 : 13, 'left', 600);
        if (!small) text(scene.subtitle, lx, y + 41, COL.dim, 10);

        const stats = scene.stats();
        const pw = small ? 150 : 190, ph = stats.length * 16 + 12;
        const px = x + w - pw - 12, py = small ? y + 36 : y + 12;
        ctx.fillStyle = 'rgba(5, 8, 13, 0.72)';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
        ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
        stats.forEach(([k, v], i) => {
            text(k, px + 8, py + 19 + i * 16, COL.dim, small ? 9 : 10);
            text(v, px + pw - 8, py + 19 + i * 16, COL.text, small ? 9 : 10, 'right', 600);
        });

        const lines = scene.logs.slice(small ? -2 : -4);
        const lw = Math.min(x + w - lx - 12, small ? w - 24 : 470);
        const lh = lines.length * 15 + 10;
        if (lines.length) {
            ctx.fillStyle = 'rgba(5, 8, 13, 0.72)';
            ctx.fillRect(lx - 2, y + h - lh - 12, lw, lh);
        }
        lines.forEach((ln, i) => {
            const alpha = 0.45 + 0.55 * ((i + 1) / lines.length);
            text(`> ${ln}`, lx + 6, y + h - lh - 12 + 19 + i * 15, `rgba(216, 227, 236, ${alpha})`, small ? 9 : 10);
        });
        if (!small) text(`MET ${fmtClock(met)}`, x + w - 14, y + h - 16, COL.cyanMid, 10, 'right');
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        drawBackdrop();
        const scene = scenes[current];
        ctx.save();
        ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
        scene.draw();
        ctx.restore();
        drawHudOverlay(scene);
        if (trans) {
            const a = trans.t < FADE_SECONDS ? trans.t / FADE_SECONDS : 1 - (trans.t - FADE_SECONDS) / FADE_SECONDS;
            ctx.fillStyle = `rgba(5, 8, 13, ${clamp(a, 0, 1)})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    function markActive(i) {
        ticks.forEach((b, k) => {
            b.classList.toggle('active', k === i);
            b.setAttribute('aria-current', k === i ? 'step' : 'false');
        });
        panels.forEach((p, k) => { p.hidden = k !== i; });
    }

    /* dt drives the simulations (clamped); fadeDt is real elapsed time so a slow device
     * never leaves the crossfade half-finished. */
    function step(dt, fadeDt) {
        met += dt;
        if (trans) {
            const before = trans.t;
            trans.t += fadeDt === undefined ? dt : fadeDt;
            if (before < FADE_SECONDS && trans.t >= FADE_SECONDS) showScene(trans.to);
            if (trans.t >= FADE_SECONDS * 2) trans = null;
        }
        scenes[current].update(dt);
    }

    function setScene(i) {
        if (i === (trans ? trans.to : current)) return;
        markActive(i);
        autoClock = 0;
        if (reduceMotion || !running) {
            trans = null;
            showScene(i);
            if (reduceMotion) for (let k = 0; k < 240; k++) scenes[i].update(1 / 30);
            render();
            return;
        }
        trans = { to: i, t: 0 };
    }

    function frame(now) {
        if (!running) return;
        const elapsed = (now - last) / 1000;
        last = now;
        step(Math.min(0.05, elapsed), Math.min(FADE_SECONDS, elapsed));
        if (autoplay && !trans && (autoClock += elapsed) >= AUTO_SECONDS) setScene((current + 1) % scenes.length);
        render();
        requestAnimationFrame(frame);
    }

    function updateRunning() {
        const shouldRun = !reduceMotion && inView && !document.hidden;
        if (shouldRun && !running) {
            running = true;
            last = performance.now();
            requestAnimationFrame(frame);
        } else if (!shouldRun) {
            running = false;
        }
    }

    /* Any choice by the visitor stops the autoplay for good. */
    function pick(i) {
        autoplay = false;
        setScene((i + scenes.length) % scenes.length);
    }
    const target = () => (trans ? trans.to : current);

    ticks.forEach((b, i) => b.addEventListener('click', () => pick(i)));
    arrows.forEach((b) => b.addEventListener('click', () => pick(target() + (b.classList.contains('prev') ? -1 : 1))));
    block.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') pick(target() + (e.key === 'ArrowLeft' ? -1 : 1));
    });
    let swipeX = null, swipeY = 0;
    pin.addEventListener('pointerdown', (e) => { swipeX = e.clientX; swipeY = e.clientY; });
    pin.addEventListener('pointerup', (e) => {
        if (swipeX === null) return;
        const dx = e.clientX - swipeX, dy = e.clientY - swipeY;
        swipeX = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) pick(target() + (dx < 0 ? 1 : -1));
    });
    pin.addEventListener('pointercancel', () => { swipeX = null; });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { layout(); render(); }, 150);
    });
    document.addEventListener('visibilitychange', updateRunning);
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            inView = entries[0].isIntersecting;
            updateRunning();
        }).observe(block);
    } else {
        inView = true;
        updateRunning();
    }

    layout(); // each scene's resize() also seeds it on first call
    if (new URLSearchParams(location.search).has('simdebug')) window.__hero = { step, render, scenes, setScene, pick };
    if (reduceMotion) {
        // Still frames: advance each simulation a few seconds so every scene has something to show.
        for (let k = 0; k < 240; k++) scenes[current].update(1 / 30);
        render();
    } else {
        render();
        updateRunning();
    }
    loadLand();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!running) render(); });
})();
