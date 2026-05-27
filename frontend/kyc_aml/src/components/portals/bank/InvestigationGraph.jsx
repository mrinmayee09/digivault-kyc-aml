// src/components/portals/bank/InvestigationGraph.jsx

import { useState } from "react";
import {
  Network, Users, AlertTriangle, DollarSign, ChevronRight,
  Clock, ArrowRight, Shield, Zap, Eye
} from "lucide-react";
import { Panel, SectionHeader, StatCard, Badge } from "../../shared";
import { INVESTIGATION_NODES } from "../../../data/mockData";

// ── Risk score color ──────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 0.8) return { text: "text-rose-400",   bg: "bg-rose-500/15",   border: "border-rose-500/30"   };
  if (score >= 0.5) return { text: "text-amber-400",  bg: "bg-amber-500/15",  border: "border-amber-500/30"  };
  return              { text: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
}

// ── Flow arrow between graph columns ─────────────────────────────────────────
function FlowArrow() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-1">
      <div className="flex items-center gap-0.5">
        <div className="w-8 h-px bg-gradient-to-r from-slate-600 to-rose-500/60" />
        <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-rose-500/60" />
      </div>
      <span className="text-[9px] font-mono text-slate-600">flow</span>
    </div>
  );
}

// ── Single graph node card ────────────────────────────────────────────────────
function GraphNode({ node, isActive, onClick, showRfBadge }) {
  const col    = scoreColor(node.score);
  const active = isActive;

  return (
    <button
      onClick={() => onClick(node)}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 relative ${
        active
          ? `${col.bg} ${col.border} shadow-lg ring-1 ring-rose-500/20`
          : "bg-slate-900/60 border-slate-700/60 hover:border-slate-600"
      }`}
    >
      {/* RF Badge */}
      {showRfBadge && (
        <div className="absolute -top-2.5 -right-1">
          <span className="flex items-center gap-1 text-[9px] font-mono font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full shadow">
            <Zap size={8} /> RF Flagged: {node.score.toFixed(2)}
          </span>
        </div>
      )}

      {/* Node type icon ring */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono border ${col.bg} ${col.border} ${col.text}`}>
          {node.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[11px] font-semibold truncate">{node.label}</p>
          <p className="text-slate-500 text-[10px] font-mono truncate">{node.account}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${col.bg} ${col.border} ${col.text}`}>
          {node.type}
        </span>
        <span className={`text-[11px] font-mono font-bold ${col.text}`}>
          ₹{node.amount.toLocaleString("en-IN")}
        </span>
      </div>
    </button>
  );
}

// ── Transaction trail item ────────────────────────────────────────────────────
function TrailItem({ hop, index }) {
  const col = scoreColor(hop.score);
  return (
    <div className="flex items-start gap-3 relative">
      {/* Vertical connector */}
      {index > 0 && (
        <div className="absolute left-3.5 -top-4 w-px h-4 bg-slate-700" />
      )}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${col.bg} ${col.border} ${col.text}`}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-white text-[11px] font-semibold truncate">{hop.label}</p>
          <span className={`text-[10px] font-mono font-bold ${col.text}`}>
            {hop.score.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-0.5">
          <span>{hop.account}</span>
          <span>·</span>
          <span>₹{hop.amount.toLocaleString("en-IN")}</span>
          <span>·</span>
          <Clock size={9} className="inline" />
          <span>{hop.time}</span>
        </div>
        {hop.flag && (
          <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded-full">
            <AlertTriangle size={9} /> {hop.flag}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InvestigationGraph() {
  const [activeNode, setActiveNode] = useState(null);

  // Partition nodes by role
  const origins       = INVESTIGATION_NODES.filter(n => n.role === "origin");
  const intermediaries = INVESTIGATION_NODES.filter(n => n.role === "intermediary");
  const destinations  = INVESTIGATION_NODES.filter(n => n.role === "destination");

  // Derive top-level stats
  const totalVolume   = INVESTIGATION_NODES.reduce((s, n) => s + n.amount, 0);
  const maxScore      = Math.max(...INVESTIGATION_NODES.map(n => n.score));
  const entityCount   = INVESTIGATION_NODES.length;

  // Trail = sorted by time (all hops)
  const trail = [...INVESTIGATION_NODES].sort((a, b) => a.trailOrder - b.trailOrder);

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-sky-400 text-[10px] font-mono uppercase tracking-widest">
              Bank Analyst · AML Investigation
            </span>
          </div>
          <h2 className="text-white text-2xl font-bold tracking-tight">AML Investigation Graph</h2>
          <p className="text-slate-400 text-sm">Node-based transaction network analysis · RF-flagged money flow</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg">
            <AlertTriangle size={12} />
            ACTIVE INVESTIGATION
          </span>
          <button className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg hover:bg-slate-700 transition-all">
            <Eye size={13} /> Full Report
          </button>
        </div>
      </div>

      {/* ── Top Stat Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Users}         label="Linked Entities"   value={entityCount}                        sub="Across origin & intermediaries" color="sky"     />
        <StatCard icon={Shield}        label="RF Risk Score"      value={maxScore.toFixed(2)}               sub="Peak anomaly score in graph"    color="rose"    />
        <StatCard icon={DollarSign}    label="Transaction Volume" value={`₹${(totalVolume / 100000).toFixed(1)}L`} sub="Total illicit flow detected"    color="amber"   />
      </div>

      {/* ── Main graph + side panel ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6">

        {/* ─── Graph canvas (2/3 width) ─────────────────────────────────── */}
        <div className="col-span-2">
          <Panel className="!pb-4">
            <SectionHeader
              title="Money Flow Network"
              subtitle="Origin → Intermediaries → Destination · Click a node to inspect"
            />

            {/* Column labels */}
            <div className="grid grid-cols-5 gap-0 mb-3">
              <div className="col-span-1 text-center">
                <span className="text-[10px] font-mono text-sky-400 uppercase tracking-widest">Origin</span>
              </div>
              <div className="col-span-1" />
              <div className="col-span-1 text-center">
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">Intermediaries</span>
              </div>
              <div className="col-span-1" />
              <div className="col-span-1 text-center">
                <span className="text-[10px] font-mono text-rose-400 uppercase tracking-widest">Destination</span>
              </div>
            </div>

            {/* Node-graph area */}
            <div className="grid grid-cols-5 gap-0 items-center min-h-64">

              {/* Origins column */}
              <div className="col-span-1 flex flex-col gap-3">
                {origins.map(node => (
                  <GraphNode
                    key={node.id}
                    node={node}
                    isActive={activeNode?.id === node.id}
                    onClick={setActiveNode}
                    showRfBadge={node.score >= 0.8}
                  />
                ))}
              </div>

              {/* Arrow 1 */}
              <div className="col-span-1 flex flex-col items-center gap-2 py-2">
                {origins.map((_, i) => <FlowArrow key={i} />)}
              </div>

              {/* Intermediaries column */}
              <div className="col-span-1 flex flex-col gap-3">
                {intermediaries.map(node => (
                  <GraphNode
                    key={node.id}
                    node={node}
                    isActive={activeNode?.id === node.id}
                    onClick={setActiveNode}
                    showRfBadge={false}
                  />
                ))}
              </div>

              {/* Arrow 2 */}
              <div className="col-span-1 flex flex-col items-center gap-2 py-2">
                {intermediaries.map((_, i) => <FlowArrow key={i} />)}
              </div>

              {/* Destination column */}
              <div className="col-span-1 flex flex-col gap-3">
                {destinations.map(node => (
                  <div key={node.id} className="relative">
                    {/* Destination glow ring */}
                    <div className="absolute -inset-1 rounded-xl bg-rose-500/10 blur-sm pointer-events-none" />
                    <GraphNode
                      node={node}
                      isActive={activeNode?.id === node.id}
                      onClick={setActiveNode}
                      showRfBadge={false}
                    />
                    {/* "END POINT" label */}
                    <div className="mt-1 text-center">
                      <span className="text-[9px] font-mono text-rose-500 uppercase tracking-widest">
                        ▲ End Point
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Graph legend */}
            <div className="flex items-center gap-4 pt-4 mt-2 border-t border-slate-700/50">
              {[
                { color: "bg-sky-400",     label: "Low Risk (< 0.5)"    },
                { color: "bg-amber-400",   label: "Medium Risk (0.5–0.79)" },
                { color: "bg-rose-400",    label: "High Risk (≥ 0.80)"   },
                { color: "bg-orange-400",  label: "RF Flagged node"      },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-[10px] font-mono text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Selected node detail */}
          {activeNode && (
            <div className="mt-4 p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl backdrop-blur flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${scoreColor(activeNode.score).bg} ${scoreColor(activeNode.score).border} border`}>
                <Network size={20} className={scoreColor(activeNode.score).text} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-bold">{activeNode.label}</p>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${scoreColor(activeNode.score).bg} ${scoreColor(activeNode.score).border} ${scoreColor(activeNode.score).text}`}>
                    RF Score: {activeNode.score.toFixed(2)}
                  </span>
                  <Badge status={activeNode.score >= 0.8 ? "flagged" : activeNode.score >= 0.5 ? "medium" : "safe"} />
                </div>
                <p className="text-slate-500 text-[11px] font-mono mt-1">
                  {activeNode.account} · ₹{activeNode.amount.toLocaleString("en-IN")} · {activeNode.type} · Role: {activeNode.role}
                </p>
                {activeNode.notes && (
                  <p className="text-slate-400 text-xs mt-1 italic">{activeNode.notes}</p>
                )}
              </div>
              <button
                onClick={() => setActiveNode(null)}
                className="text-slate-600 hover:text-slate-400 text-xs font-mono transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* ─── Transaction Trail (1/3 width) ────────────────────────────── */}
        <div className="col-span-1">
          <Panel className="h-full">
            <SectionHeader
              title="Transaction Trail"
              subtitle={`${trail.length} hops detected`}
            />
            <div className="space-y-5">
              {trail.map((hop, i) => (
                <TrailItem key={hop.id} hop={hop} index={i} />
              ))}
            </div>

            {/* Total */}
            <div className="mt-5 pt-4 border-t border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-mono">Total Moved</span>
                <span className="text-rose-400 text-sm font-bold font-mono">
                  ₹{totalVolume.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-500 text-xs font-mono">Peak RF Score</span>
                <span className="text-rose-400 text-sm font-bold font-mono">{maxScore.toFixed(2)}</span>
              </div>
              <button className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/30 py-2.5 rounded-lg hover:bg-rose-500/20 transition-all">
                <AlertTriangle size={13} /> File SAR Report
              </button>
            </div>
          </Panel>
        </div>

      </div>
    </div>
  );
}
