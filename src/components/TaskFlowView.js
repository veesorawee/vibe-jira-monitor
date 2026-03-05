import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, Sankey, Layer, Rectangle, Tooltip as RechartsTooltip } from 'recharts';
import { Network, User, Users } from 'lucide-react';
import { formatAssigneeName } from '../utils/helpers';

const FOCUS_CATEGORIES = [
    'Product Spec. Tracking [D]',
    'Product Analysis [D]',
    'Product Report/Ad-Hoc [D]',
    'Product Investigation [D]',
    'Initiation/Idea [D]'
];

const CATEGORY_DISPLAY_MAP = {
    'Product Spec. Tracking [D]': 'Spec',
    'Product Analysis [D]': 'Analysis',
    'Product Report/Ad-Hoc [D]': 'Report',
    'Product Investigation [D]': 'Investigate',
    'Initiation/Idea [D]': 'Idea',
    'Other': 'Other'
};

// ─── Inject animating linearGradient into the recharts SVG's <defs> ──────────
function useSvgGradient(containerRef, gradId, color, enabled) {
    useEffect(() => {
        if (!enabled || !containerRef?.current) return;
        const svg = containerRef.current.querySelector('svg');
        if (!svg) return;

        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svg.prepend(defs);
        }

        [`${gradId}`, `${gradId}-b`].forEach(id => defs.querySelector(`#${id}`)?.remove());

        const ns = 'http://www.w3.org/2000/svg';

        const makeGrad = (id, stops) => {
            const g = document.createElementNS(ns, 'linearGradient');
            g.setAttribute('id', id);
            g.setAttribute('gradientUnits', 'userSpaceOnUse');
            g.setAttribute('y1', '0%');
            g.setAttribute('y2', '0%');
            stops.forEach(({ offset, opacity }) => {
                const s = document.createElementNS(ns, 'stop');
                s.setAttribute('offset', offset);
                s.setAttribute('stop-color', color);
                s.setAttribute('stop-opacity', '0'); // ← เริ่มต้น invisible ทั้งหมด
                g.appendChild(s);
            });
            defs.appendChild(g);
            return g;
        };

        const stopsA = [
            { offset: '0%',   opacity: '0.0' },
            { offset: '30%',  opacity: '0.4' },
            { offset: '50%',  opacity: '1.0' },
            { offset: '70%',  opacity: '0.4' },
            { offset: '100%', opacity: '0.0' },
        ];
        const stopsB = [
            { offset: '0%',   opacity: '0.0' },
            { offset: '25%',  opacity: '0.2' },
            { offset: '50%',  opacity: '0.5' },
            { offset: '75%',  opacity: '0.2' },
            { offset: '100%', opacity: '0.0' },
        ];

        const gradA = makeGrad(gradId,        stopsA);
        const gradB = makeGrad(`${gradId}-b`, stopsB);

        const svgWidth = svg.viewBox?.baseVal?.width || svg.clientWidth || 800;
        const SPREAD_A = 1500;
        const SPREAD_B = 1600;
        const DURATION = 8000;
        const PAUSE    = 10000;
        const CYCLE    = DURATION + PAUSE;

        const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const setOpacity = (grad, stops) =>
            Array.from(grad.querySelectorAll('stop')).forEach((s, i) =>
                s.setAttribute('stop-opacity', stops[i].opacity));

        const show = () => { setOpacity(gradA, stopsA); setOpacity(gradB, stopsB); };
        const hide = () => {
            setOpacity(gradA, stopsA.map(s => ({ ...s, opacity: '0' })));
            setOpacity(gradB, stopsB.map(s => ({ ...s, opacity: '0' })));
        };

        // set position เริ่มต้นที่ขอบซ้าย ก่อน show — ไม่ต้องกระโดด
        const initPos = () => {
            gradA.setAttribute('x1', `${-SPREAD_A}`); gradA.setAttribute('x2', '0');
            gradB.setAttribute('x1', `${-SPREAD_B}`); gradB.setAttribute('x2', '0');
        };
        initPos();

        let rafId;
        let startTime = null;

        const tick = (timestamp) => {
            if (startTime === null) startTime = timestamp;
            const elapsed = (timestamp - startTime) % CYCLE;

            if (elapsed < DURATION) {
                show();
                const t = ease(elapsed / DURATION);

                const totalA = svgWidth + SPREAD_A * 2;
                const x1A = -SPREAD_A + t * totalA;
                gradA.setAttribute('x1', `${x1A}`);
                gradA.setAttribute('x2', `${x1A + SPREAD_A}`);

                const totalB = svgWidth + SPREAD_B * 2;
                const x1B = -SPREAD_B + t * totalB;
                gradB.setAttribute('x1', `${x1B}`);
                gradB.setAttribute('x2', `${x1B + SPREAD_B}`);
            } else {
                hide();
                initPos(); // reset position ตอน pause ให้พร้อมวิ่งใหม่
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafId);
            [`${gradId}`, `${gradId}-b`].forEach(id => defs.querySelector(`#${id}`)?.remove());
        };
    }, [enabled, color, gradId, containerRef]);
}
// ─── SankeyLink ───────────────────────────────────────────────────────────────
const SankeyLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX,
    linkWidth, index, payload, containerRef, chartKey, openTaskDrawer, ...rest }) => {

    const [isHovered, setIsHovered] = useState(false);
    const [pulse, setPulse] = useState(0.22);

    const raw    = payload.source?.color || '#10b981';
    const color  = raw.startsWith('var(') ? '#10b981' : raw;
    const gradId = `sg-${chartKey}-${index}`;
    const w      = Math.max(2, linkWidth);
    const midX   = (sourceX + targetX) / 2;
    const midY   = (sourceY + targetY) / 2;
    const pct    = (((payload.value || 0) / (payload.source?.value || 1)) * 100).toFixed(1);
    const d      = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;

    useEffect(() => {
        if (!isHovered) { setPulse(0.22); return; }
        let rafId;
        const animate = (ts) => {
            setPulse(0.3 + 0.12 * Math.sin(ts / 600));
            rafId = requestAnimationFrame(animate);
        };
        rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId);
    }, [isHovered]);

    useSvgGradient(containerRef, gradId, color, isHovered);

    return (
        <g>
            {/* Base path — pulse */}
            <path d={d} fill="none"
                stroke={isHovered ? color : '#64748b'}
                strokeWidth={w}
                strokeOpacity={pulse}
            />

            {/* Glow — drop-shadow ตามรูปร่างเส้น ไม่แบนเหมือน blur */}
            {isHovered && (
                <path d={d} fill="none"
                    stroke={`url(#${gradId}-b)`}
                    strokeWidth={w}
                    strokeOpacity={0.85}
                    style={{ filter: `drop-shadow(0 0 ${Math.max(4, w * 0.35)}px ${color}88) drop-shadow(0 0 ${Math.max(8, w * 0.6)}px ${color}44)` }}
                />
            )}

            {/* Shimmer A — bright หลัก */}
            {isHovered && (
                <path d={d} fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth={w}
                    strokeOpacity={1}
                />
            )}

            {/* Wide invisible hit area */}
            <path d={d} fill="none" stroke="transparent"
                strokeWidth={Math.max(18, w + 14)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => { setIsHovered(true);  rest.onMouseEnter?.(e); }}
                onMouseLeave={e => { setIsHovered(false); rest.onMouseLeave?.(e); }}
                onClick={e => {
                    e.stopPropagation();
                    const cs = payload.source.name.replace(/^(Dept|Req|Cat|Asg): /, '');
                    const ct = payload.target.name.replace(/^(Dept|Req|Cat|Asg): /, '');
                    if (typeof openTaskDrawer === 'function' && payload.tasks)
                        openTaskDrawer(`Flow: ${CATEGORY_DISPLAY_MAP[cs] || cs} ➔ ${CATEGORY_DISPLAY_MAP[ct] || ct}`, payload.tasks);
                }}
            />

            {/* Tooltip */}
            {isHovered && (
                <g style={{ pointerEvents: 'none' }}>
                    <rect x={midX - 52} y={midY - 26} width={104} height={48}
                        rx={10} fill="var(--surface)" stroke={color} strokeWidth={1.5}
                        filter="drop-shadow(0 4px 12px rgba(0,0,0,0.6))" />
                    <text x={midX} y={midY - 6}  textAnchor="middle" fill="var(--text)" fontSize={12} fontWeight="700">{payload.value} Tasks</text>
                    <text x={midX} y={midY + 11} textAnchor="middle" fill={color}        fontSize={10} fontWeight="600">{pct}% of source</text>
                </g>
            )}
        </g>
    );
};
// ─── SankeyNode ───────────────────────────────────────────────────────────────
const SankeyNode = ({ x, y, width, height, index, payload }) => {
    const isReq  = payload.name.startsWith('Req:');
    const isAsg  = payload.name.startsWith('Asg:');
    const isCat  = payload.name.startsWith('Cat:');
    const isDept = payload.name.startsWith('Dept:');

    const raw     = payload.name.replace(/^(Dept|Req|Cat|Asg): /, '');
    const display = isCat ? (CATEGORY_DISPLAY_MAP[raw] || raw) : raw;
    const nc      = payload.color || '#10b981';
    const accent  = nc.startsWith('var(') ? '#10b981' : nc;

    const MAX   = isDept ? 15 : 13;
    const label = display.length > MAX ? display.slice(0, MAX - 1) + '…' : display;

    const GAP = 7;
    let lx, ly, anchor, dominant;
    if (isReq)      { lx = x + width + GAP; ly = y + height / 2; anchor = 'start';  dominant = 'central'; }
    else if (isAsg) { lx = x - GAP;          ly = y + height / 2; anchor = 'end';    dominant = 'central'; }
    else            { lx = x + width / 2;    ly = y - 6;          anchor = 'middle'; dominant = 'auto'; }

    return (
        <Layer key={`n${index}`}>
            <Rectangle x={x} y={y} width={width} height={height} fill={nc} fillOpacity={1} rx={3} />
            <Rectangle x={x} y={y} width={2}     height={height} fill="#fff" fillOpacity={0.2} rx={1} />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline={dominant}
                fontSize={11} fontWeight={600}
                style={{ textShadow: '0 1px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,1)' }}>
                <tspan fill="var(--text)">{label}</tspan>
                <tspan fill={accent} fontWeight={700}> ({payload.value})</tspan>
            </text>
        </Layer>
    );
};

// ─── SankeyChartBlock ─────────────────────────────────────────────────────────
const SankeyChartBlock = ({ data, title, subtitle, color, chartKey, viewMode, openTaskDrawer }) => {
    const containerRef = useRef(null);
    if (!data) return null;

    const minH = viewMode === 'merged'
        ? Math.max(600, data.nodes.length * 15)
        : Math.max(320, data.nodes.length * 28);

    const BoundLink = (props) => (
        <SankeyLink {...props} containerRef={containerRef} chartKey={chartKey} openTaskDrawer={openTaskDrawer} />
    );

    return (
        <div className="bg-[color:var(--surface)] p-5 rounded-3xl border border-[color:var(--border)] shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                {color ? (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#0d0d12] shadow-md font-syne shrink-0" style={{ backgroundColor: color }}>
                        {title.substring(0, 2).toUpperCase()}
                    </div>
                ) : (
                    <div className="w-9 h-9 rounded-full bg-[color:var(--surface2)] flex items-center justify-center border border-[color:var(--border)] text-[color:var(--accent)] shrink-0">
                        <Network size={16} />
                    </div>
                )}
                <div className="min-w-0">
                    <h4 className="text-base font-bold text-[color:var(--text)] font-syne leading-tight truncate">{formatAssigneeName(title)}</h4>
                    <p className="text-[11px] text-[color:var(--muted)] mt-0.5">{subtitle}</p>
                </div>
            </div>

            <div className="grid grid-cols-4 text-[9px] font-bold text-[color:var(--muted)] uppercase tracking-widest mb-2 px-1 border-b border-[color:var(--border)] pb-2">
                <span>Requester</span>
                <span className="text-center">Department</span>
                <span className="text-center">Task Type</span>
                <span className="text-right">Assignee</span>
            </div>

            <div ref={containerRef} style={{ height: `${minH}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                    <Sankey data={data} node={<SankeyNode />} link={<BoundLink />}
                        nodePadding={12} nodeWidth={10}
                        margin={{ left: 10, right: 10, top: 20, bottom: 10 }}
                        sort={false}
                    >
                        <RechartsTooltip content={({ payload }) => {
                            if (payload?.length && !payload[0].payload.source) {
                                const d  = payload[0];
                                const rn = d.name.replace(/^(Dept|Req|Cat|Asg): /, '');
                                const cn = d.name.startsWith('Cat:') ? (CATEGORY_DISPLAY_MAP[rn] || rn) : rn;
                                return (
                                    <div className="bg-[color:var(--surface)] border border-[color:var(--border)] p-3 rounded-xl shadow-lg text-sm">
                                        <p className="font-bold text-[color:var(--text)]">{cn}</p>
                                        <p className="text-[color:var(--muted)] mt-1">Total: <span className="font-black text-[color:var(--text)]">{d.value} tasks</span></p>
                                    </div>
                                );
                            }
                            return null;
                        }} />
                    </Sankey>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
const TaskFlowView = ({ tasks, departmentColors, biCategoryColors, assigneeColors, openTaskDrawer }) => {
    const [viewMode, setViewMode] = useState('merged');

    const generateSankeyData = (filteredTasks, isMergedMode = false) => {
        if (!filteredTasks || filteredTasks.length === 0) return null;

        const requesters = {}, depts = {}, categories = {}, assignees = {};
        const reqToDept = {}, deptToCat = {}, catToAsg = {};
        const initialReqCounts = {};

        filteredTasks.forEach(t => {
            const emailLabel = (t.labels || []).find(l => l.includes('@'));
            const req = emailLabel ? emailLabel.split('@')[0] : 'Unknown Req';
            initialReqCounts[req] = (initialReqCounts[req] || 0) + 1;
        });

        filteredTasks.forEach(t => {
            const emailLabel = (t.labels || []).find(l => l.includes('@'));
            let req = emailLabel ? emailLabel.split('@')[0] : 'Unknown Req';
            if (isMergedMode && initialReqCounts[req] < 2) req = 'Other';
            const dept     = t.department  || 'Unknown Dept';
            const assignee = t.assignee    || 'Unassigned';
            const rawCat   = t.biCategory  || 'Uncategorized';
            const cat      = FOCUS_CATEGORIES.includes(rawCat) ? rawCat : 'Other';

            requesters[req]     = (requesters[req]     || 0) + 1;
            depts[dept]         = (depts[dept]         || 0) + 1;
            categories[cat]     = (categories[cat]     || 0) + 1;
            assignees[assignee] = (assignees[assignee] || 0) + 1;

            const push = (map, key) => { if (!map[key]) map[key] = { value: 0, tasks: [] }; map[key].value++; map[key].tasks.push(t); };
            push(reqToDept, `${req}|${dept}`);
            push(deptToCat, `${dept}|${cat}`);
            push(catToAsg,  `${cat}|${assignee}`);
        });

        const nodes = [], nodeMap = {};
        let ni = 0;
        const addNode = (name, color) => { if (nodeMap[name] === undefined) { nodes.push({ name, color }); nodeMap[name] = ni++; } };
        const sortDesc = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(e => e[0]);

        sortDesc(requesters).forEach(r => addNode(`Req: ${r}`,  r === 'Other' ? '#94a3b8' : 'var(--accent)'));
        sortDesc(depts)     .forEach(d => addNode(`Dept: ${d}`, departmentColors?.[d]  || '#f472b6'));
        sortDesc(categories).forEach(c => addNode(`Cat: ${c}`,  c === 'Other' ? '#94a3b8' : (biCategoryColors?.[c] || '#8884d8')));
        sortDesc(assignees) .forEach(a => addNode(`Asg: ${a}`,  assigneeColors?.[a]    || '#82ca9d'));

        const links = [];
        const mkLinks = (map, p1, p2) => Object.entries(map).forEach(([k, d]) => {
            const [a, b] = k.split('|');
            links.push({ source: nodeMap[`${p1}: ${a}`], target: nodeMap[`${p2}: ${b}`], value: d.value, tasks: d.tasks });
        });
        mkLinks(reqToDept, 'Req',  'Dept');
        mkLinks(deptToCat, 'Dept', 'Cat');
        mkLinks(catToAsg,  'Cat',  'Asg');
        links.sort((a, b) => b.value - a.value);

        return { nodes, links, totalTasks: filteredTasks.length };
    };

    const mergedData     = useMemo(() => generateSankeyData(tasks, true),  [tasks, departmentColors, biCategoryColors, assigneeColors]);
    const individualData = useMemo(() => {
        const map = {};
        tasks.forEach(t => { const a = t.assignee || 'Unassigned'; if (!map[a]) map[a] = []; map[a].push(t); });
        return Object.entries(map)
            .map(([assignee, ts]) => ({ assignee, data: generateSankeyData(ts, false) }))
            .sort((a, b) => b.data.totalTasks - a.data.totalTasks);
    }, [tasks, departmentColors, biCategoryColors, assigneeColors]);

    if (!tasks || tasks.length === 0) return (
        <div className="p-12 text-center text-[color:var(--muted)] font-syne text-lg bg-[color:var(--surface)] border border-[color:var(--border)] rounded-2xl mt-2">
            No task flow data available.
        </div>
    );

    return (
        <div className="font-sans mt-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="font-syne">
                    <h2 className="text-xl font-bold text-[color:var(--text)] flex items-center gap-2">
                        <Network className="text-[#10b981]" size={20} /> Task Assignment Flow
                    </h2>
                    <p className="text-xs text-[color:var(--muted)] mt-1 font-medium">Hover a link to inspect · click to view tasks</p>
                </div>
                <div className="bg-[color:var(--surface)] p-1 rounded-xl flex text-xs font-bold border border-[color:var(--border)] shadow-sm shrink-0">
                    <button onClick={() => setViewMode('individual')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${viewMode === 'individual' ? 'bg-[color:var(--surface2)] shadow-sm text-[color:var(--text)] border border-[color:var(--border)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>
                        <User size={13} /> Individual
                    </button>
                    <button onClick={() => setViewMode('merged')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${viewMode === 'merged' ? 'bg-[color:var(--accent)] shadow-sm text-[color:var(--bg)] border border-[color:var(--accent)]' : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'}`}>
                        <Users size={13} /> Merged
                    </button>
                </div>
            </div>

            {viewMode === 'merged' ? (
                <div className="animate-in zoom-in-95 duration-300">
                    <SankeyChartBlock
                        data={mergedData} title="Merged Team Flow"
                        subtitle={`All ${mergedData.totalTasks} tasks across the team`}
                        color={null} chartKey="merged"
                        viewMode={viewMode} openTaskDrawer={openTaskDrawer}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-in fade-in duration-300">
                    {individualData.map((p, i) => (
                        <SankeyChartBlock key={p.assignee}
                            data={p.data} title={p.assignee}
                            subtitle={`${p.data.totalTasks} tasks assigned`}
                            color={assigneeColors[p.assignee] || 'var(--accent)'}
                            chartKey={`ind-${i}`}
                            viewMode={viewMode} openTaskDrawer={openTaskDrawer}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TaskFlowView;