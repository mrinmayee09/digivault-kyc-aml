// src/components/portals/rbi/MLPipelineEngine.jsx

import { useState, useEffect, useRef } from "react";
import {
  Cpu, Sliders, RefreshCw, ChevronRight, Activity, Zap,
  BarChart2, GitBranch, Layers, TrendingUp, Circle, CheckCircle2
} from "lucide-react";
import { Panel, SectionHeader, StatCard } from "../../shared";

// ── Constants ────────────────────────────────────────────────────────────────
const LIVE_FEATURES = [
  { name: "Velocity (txn/hr)",        value: 47,    max: 100, color: "#38bdf8", trend: "+3"    },
  { name: "Volume (₹ lakhs)",          value: 84.2,  max: 200, color: "#34d399", trend: "+12.1" },
  { name: "Degree Centrality",         value: 0.73,  max: 1,   color: "#f87171", trend: "+0.04" },
  { name: "Betweenness Centrality",    value: 0.41,  max: 1,   color: "#fbbf24", trend: "-0.02" },
  { name: "Hop Count (avg)",           value: 3.8,   max: 10,  color: "#a78bfa", trend: "+0.2"  },
  { name: "Fan-out Ratio",             value: 2.6,   max: 8,   color: "#fb923c", trend: "0.00"  },
];

const TREE_NODES = [
  { id: 1, label: "Velocity > 40?",    x: 50, y: 10, left: 2,  right: 3  },
  { id: 2, label: "Volume > 50L?",     x: 25, y: 35, left: 4,  right: 5  },
  { id: 3, label: "Degree > 0.6?",     x: 75, y: 35, left: 6,  right: 7  },
  { id: 4, label: "✓ Safe",            x: 12, y: 62, left: null, right: null, leaf: "safe"    },
  { id: 5, label: "⬡ Medium",         x: 38, y: 62, left: null, right: null, leaf: "medium"  },
  { id: 6, label: "⬡ Medium",         x: 62, y: 62, left: null, right: null, leaf: "medium"  },
  { id: 7, label: "✗ Flag",            x: 88, y: 62, left: null, right: null, leaf: "high"    },
];

const LEAF_COLORS = {
  safe:   { bg: "rgba(52,211,153,0.15)",  border: "#34d399", text: "#34d399" },
  medium: { bg: "rgba(251,191,36,0.12)",  border: "#fbbf24", text: "#fbbf24" },
  high:   { bg: "rgba(248,113,113,0.15)", border: "#f87171", text: "#f87171" },
};

// ── SMOTE Dot visual ─────────────────────────────────────────────────────────
function SmoteDot({ x, y, synthetic, color, size = 4 }) {
  return (
    <circle
      cx={`${x}%`}
      cy={`${y}%`}
      r={size}
      fill={color}
      opacity={synthetic ? 0.5 : 0.85}
      strokeWidth={synthetic ? 1 : 0}
      stroke={synthetic ? color : "none"}
      strokeDasharray={synthetic ? "2 2" : "none"}
    />
  );
}

// ── Tree edge ────────────────────────────────────────────────────────────────
function TreeEdge({ from, to, label }) {
  return (
    <g>
      <line
        x1={`${from.x}%`} y1={`${from.y + 6}%`}
        x2={`${to.x}%`}   y2={`${to.y - 4}%`}
        stroke="#334155" strokeWidth="1.5" strokeDasharray="4 3"
      />
      <text
        x={`${(from.x + to.x) / 2}%`}
        y={`${(from.y + to.y) / 2 + 1}%`}
        textAnchor="middle"
        fill="#64748b"
        fontSize="3"
        fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  );
}

// ── Mini Feature Bar ─────────────────────────────────────────────────────────
function FeatureBar({ feature }) {
  const pct = Math.min(100, (feature.value / feature.max) * 100);
  const positive = feature.trend.startsWith("+");
  const neutral  = feature.trend === "0.00";
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <p className="text-slate-400 text-[11px] font-mono truncate">{feature.name}</p>
      </div>
      <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: feature.color }}
        />
      </div>
      <span className="text-[11px] font-mono font-bold w-14 text-right" style={{ color: feature.color }}>
        {feature.value}
      </span>
      <span
        className={`text-[10px] font-mono w-12 text-right ${
          neutral ? "text-slate-500" : positive ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {feature.trend}
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MLPipelineEngine() {
  const [smoteActive, setSmoteActive]     = useState(true);
  const [estimators,  setEstimators]      = useState(120);
  const [maxDepth,    setMaxDepth]        = useState(15);
  const [threshold,   setThreshold]       = useState(0.72);
  const [processing,  setProcessing]      = useState(false);
  const [pipelineTick, setPipelineTick]   = useState(0);
  const [dots, setDots]                   = useState([]);

  // Generate SMOTE scatter dots
  useEffect(() => {
    const rawDots = Array.from({ length: 30 }, (_, i) => ({
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      synthetic: false,
      // illicit cluster near top-right (< 2%)
      ...(i < 2 ? { x: 70 + Math.random() * 20, y: 10 + Math.random() * 20 } : {}),
    }));
    const synthDots = smoteActive
      ? Array.from({ length: 18 }, () => ({
          x: 60 + Math.random() * 30,
          y: 5  + Math.random() * 30,
          synthetic: true,
        }))
      : [];
    setDots([...rawDots, ...synthDots]);
  }, [smoteActive]);

  // Simulate pipeline ticks
  useEffect(() => {
    const t = setInterval(() => setPipelineTick(n => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const handleRerun = () => {
    setProcessing(true);
    setTimeout(() => setProcessing(false), 1800);
  };

  const riskColor = threshold >= 0.8 ? "#34d399" : threshold >= 0.6 ? "#fbbf24" : "#f87171";

  return (
    <>
      <style>{`
        @keyframes pipelineFlow {
          0%   { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes nodePop {
          0%   { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        .pipeline-edge {
          stroke-dasharray: 6 4;
          animation: pipelineFlow 1.2s linear infinite;
        }
        .tree-node-anim {
          animation: nodePop 0.4s ease both;
        }
      `}</style>

      <div className="space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-[10px] font-mono uppercase tracking-widest">
                RBI · Data Science
              </span>
            </div>
            <h2 className="text-white text-2xl font-bold tracking-tight">ML Pipeline & Rule Engine</h2>
            <p className="text-slate-400 text-sm">
              Real-time SMOTE pre-processing and Random Forest anomaly detection
            </p>
          </div>
          <button
            onClick={handleRerun}
            disabled={processing}
            className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-lg hover:bg-amber-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={processing ? "animate-spin" : ""} />
            {processing ? "Running…" : "Re-run Pipeline"}
          </button>
        </div>

        {/* ── Pipeline status bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-hidden border border-amber-500/20 rounded-xl bg-amber-500/5 px-4 py-2.5">
          {["Raw TXN Data", "SMOTE Balancing", "Feature Extraction", "RF Scoring", "Alert Engine"].map((step, i) => (
            <div key={step} className="flex items-center gap-2 shrink-0">
              <div className={`w-2 h-2 rounded-full ${i <= (pipelineTick % 5) ? "bg-amber-400" : "bg-slate-600"} transition-all`} />
              <span className={`text-[11px] font-mono ${i <= (pipelineTick % 5) ? "text-amber-300" : "text-slate-500"} transition-all`}>
                {step}
              </span>
              {i < 4 && <ChevronRight size={12} className="text-slate-600" />}
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <Zap size={12} className="text-emerald-400" />
            <span className="text-emerald-400 text-[11px] font-mono">LIVE</span>
          </div>
        </div>

        {/* ── Top stat cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Layers}    label="Illicit Nodes (Raw)" value="< 2%"  sub="Elliptic dataset baseline"  color="rose"    />
          <StatCard icon={GitBranch} label="RF Estimators"        value={estimators} sub="Decision trees in ensemble" color="amber"   />
          <StatCard icon={Activity}  label="Txns Scored / min"    value="1,240" sub="Real-time pipeline throughput" color="emerald" />
        </div>

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* ─── LEFT: SMOTE Pre-processing ──────────────────────────────── */}
          <Panel>
            <SectionHeader
              title="Pre-processing & SMOTE Engine"
              subtitle="Synthetic Minority Over-sampling before classification"
              actions={
                <button
                  onClick={() => setSmoteActive(v => !v)}
                  className={`flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all ${
                    smoteActive
                      ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
                      : "text-slate-500 bg-slate-800 border-slate-700"
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${smoteActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                  SMOTE {smoteActive ? "ON" : "OFF"}
                </button>
              }
            />

            {/* Imbalance Metric */}
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg shrink-0">
                <BarChart2 size={16} className="text-rose-400" />
              </div>
              <div className="flex-1">
                <p className="text-rose-400 text-xs font-mono uppercase tracking-wider mb-1">Raw Class Imbalance</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: "98%", background: "#38bdf8" }} />
                  </div>
                  <span className="text-sky-400 text-xs font-mono font-bold w-10 text-right">98%</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: "2%", background: "#f87171" }} />
                  </div>
                  <span className="text-rose-400 text-xs font-mono font-bold w-10 text-right">&lt; 2%</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-mono text-slate-500">Licit transactions</span>
                  <span className="text-[10px] font-mono text-slate-500">Illicit transactions</span>
                </div>
              </div>
            </div>

            {/* SMOTE Scatter Plot */}
            <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden" style={{ height: 200 }}>
              <div className="absolute top-2 left-3 text-[10px] font-mono text-slate-500">Feature Space (PCA)</div>
              <svg className="absolute inset-0 w-full h-full">
                {/* Grid */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={`g${i}`} x1={`${i * 25}%`} y1="0" x2={`${i * 25}%`} y2="100%"
                    stroke="#1e293b" strokeWidth="1" />
                ))}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={`${i * 25}%`} x2="100%" y2={`${i * 25}%`}
                    stroke="#1e293b" strokeWidth="1" />
                ))}

                {/* Licit dots */}
                {dots.filter(d => !d.synthetic && d.x < 60).map((d, i) => (
                  <SmoteDot key={`licit-${i}`} x={d.x} y={d.y} synthetic={false} color="#38bdf8" size={3} />
                ))}
                {/* Raw illicit dots */}
                {dots.filter(d => !d.synthetic && d.x >= 60).map((d, i) => (
                  <SmoteDot key={`illicit-${i}`} x={d.x} y={d.y} synthetic={false} color="#f87171" size={4} />
                ))}
                {/* Synthetic dots */}
                {dots.filter(d => d.synthetic).map((d, i) => (
                  <SmoteDot key={`synth-${i}`} x={d.x} y={d.y} synthetic={true} color="#fb923c" size={3} />
                ))}

                {/* Boundary label */}
                {smoteActive && (
                  <>
                    <line x1="55%" y1="0" x2="55%" y2="100%"
                      stroke="#334155" strokeWidth="1" strokeDasharray="4 3" />
                    <text x="57%" y="8%" fill="#64748b" fontSize="3.5" fontFamily="monospace">SMOTE zone</text>
                  </>
                )}
              </svg>

              {/* Legend */}
              <div className="absolute bottom-2 right-2 flex flex-col gap-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-sky-400" />
                  <span className="text-[10px] font-mono text-slate-400">Licit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="text-[10px] font-mono text-slate-400">Illicit (raw)</span>
                </div>
                {smoteActive && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-orange-400 opacity-60" />
                    <span className="text-[10px] font-mono text-slate-400">Synthetic (SMOTE)</span>
                  </div>
                )}
              </div>
            </div>

            {/* SMOTE stats */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Minority Samples", value: "892",   color: "text-rose-400"    },
                { label: "Synthetic Added",  value: smoteActive ? "3,214" : "0", color: "text-orange-400"  },
                { label: "Balance Ratio",    value: smoteActive ? "1:1.2" : "1:49", color: "text-emerald-400" },
              ].map(s => (
                <div key={s.label} className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
                  <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-slate-500 text-[10px] font-mono mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </Panel>

          {/* ─── RIGHT: Random Forest Classifier ──────────────────────────── */}
          <Panel>
            <SectionHeader
              title="Random Forest Classifier"
              subtitle="Ensemble model parameters & live feature aggregation"
            />

            {/* Tree mini-visualization */}
            <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden mb-4" style={{ height: 180 }}>
              <div className="absolute top-2 left-3 flex items-center gap-1.5">
                <GitBranch size={11} className="text-amber-400" />
                <span className="text-[10px] font-mono text-slate-500">Decision Tree (Sample)</span>
              </div>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 80" preserveAspectRatio="none">
                {/* Edges */}
                <TreeEdge from={TREE_NODES[0]} to={TREE_NODES[1]} label="Yes" />
                <TreeEdge from={TREE_NODES[0]} to={TREE_NODES[2]} label="No"  />
                <TreeEdge from={TREE_NODES[1]} to={TREE_NODES[3]} label="No"  />
                <TreeEdge from={TREE_NODES[1]} to={TREE_NODES[4]} label="Yes" />
                <TreeEdge from={TREE_NODES[2]} to={TREE_NODES[5]} label="No"  />
                <TreeEdge from={TREE_NODES[2]} to={TREE_NODES[6]} label="Yes" />

                {/* Nodes */}
                {TREE_NODES.map(node => {
                  const col = node.leaf ? LEAF_COLORS[node.leaf] : null;
                  return (
                    <g key={node.id} className="tree-node-anim">
                      <rect
                        x={`${node.x - 10}%`} y={`${node.y - 4}%`}
                        width="20%" height="10%"
                        rx="2"
                        fill={col ? col.bg : "rgba(30,41,59,0.9)"}
                        stroke={col ? col.border : "#334155"}
                        strokeWidth="0.8"
                      />
                      <text
                        x={`${node.x}%`} y={`${node.y + 2}%`}
                        textAnchor="middle"
                        fill={col ? col.text : "#94a3b8"}
                        fontSize="3.2"
                        fontFamily="monospace"
                        fontWeight={node.leaf ? "bold" : "normal"}
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Parameter controls */}
            <div className="space-y-4 mb-4">
              {/* Estimators */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 text-xs font-mono">Number of Estimators</label>
                  <span className="text-amber-400 text-xs font-mono font-bold">{estimators}</span>
                </div>
                <input
                  type="range" min="10" max="500" step="10"
                  value={estimators}
                  onChange={e => setEstimators(+e.target.value)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "#fbbf24" }}
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-0.5">
                  <span>10</span><span>500</span>
                </div>
              </div>

              {/* Max Depth */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 text-xs font-mono">Max Depth</label>
                  <span className="text-sky-400 text-xs font-mono font-bold">{maxDepth}</span>
                </div>
                <input
                  type="range" min="2" max="40" step="1"
                  value={maxDepth}
                  onChange={e => setMaxDepth(+e.target.value)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "#38bdf8" }}
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-0.5">
                  <span>2</span><span>40</span>
                </div>
              </div>

              {/* Risk Threshold */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 text-xs font-mono">Risk Score Threshold</label>
                  <span className="text-xs font-mono font-bold" style={{ color: riskColor }}>
                    {threshold.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range" min="0.3" max="0.99" step="0.01"
                  value={threshold}
                  onChange={e => setThreshold(+e.target.value)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: riskColor }}
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-0.5">
                  <span>0.30 (lenient)</span><span>0.99 (strict)</span>
                </div>
              </div>
            </div>

            {/* Live Feature Aggregation */}
            <div className="border-t border-slate-700/50 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-emerald-400" />
                <span className="text-slate-300 text-xs font-mono uppercase tracking-wider">
                  Live Feature Aggregation
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-400">REAL-TIME</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {LIVE_FEATURES.map(f => (
                  <FeatureBar key={f.name} feature={f} />
                ))}
              </div>
            </div>
          </Panel>

        </div>

        {/* ── Pipeline throughput footer ───────────────────────────────────── */}
        <Panel className="!py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-700/50 rounded-lg">
                <Cpu size={14} className="text-amber-400" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Pipeline Status</p>
                <p className="text-slate-500 text-[11px] font-mono">
                  SMOTE → Feature Extraction → RF ({estimators} trees, depth {maxDepth}) → Score &gt; {threshold.toFixed(2)} → Alert
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: "Precision", value: "94.2%", color: "text-emerald-400" },
                { label: "Recall",    value: "91.7%", color: "text-sky-400"     },
                { label: "F1 Score",  value: "0.929",  color: "text-amber-400"  },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <p className={`text-lg font-bold font-mono ${m.color}`}>{m.value}</p>
                  <p className="text-slate-500 text-[10px] font-mono">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

      </div>
    </>
  );
}
