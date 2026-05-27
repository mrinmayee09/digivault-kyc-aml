// src/utils/constants.js

import {
  User, Building2, Landmark,
  LayoutDashboard, Fingerprint, Activity,
  Inbox, GitCompare, Radio,
  Globe, BookOpen,
  Upload, FileText, Camera, Shield,
  Network, Cpu, Sliders,
} from "lucide-react";

// ── KYC Stepper ──────────────────────────────────────────────────────────────
export const KYC_STEPS = [
  { label: "Profile",    icon: User     },
  { label: "Upload",     icon: Upload   },
  { label: "Sign Verify",icon: FileText },
  { label: "Face Match", icon: Camera   },
  { label: "Blockchain", icon: Shield   },
];

// ── Portal / Section Definitions ─────────────────────────────────────────────
export const PORTALS = [
  {
    id: "user",
    label: "User Portal",
    icon: User,
    color: "emerald",
    sections: [
      { id: "dashboard", label: "Dashboard",     icon: LayoutDashboard },
      { id: "kyc",       label: "KYC Center",    icon: Fingerprint     },
      { id: "aml",       label: "AML Simulator", icon: Activity        },
    ],
  },
  {
    id: "bank",
    label: "Bank Analyst",
    icon: Building2,
    color: "sky",
    sections: [
      { id: "queue",         label: "Review Queue",    icon: Inbox      },
      { id: "detail",        label: "Detail View",     icon: GitCompare },
      { id: "alerts",        label: "Alert Hub",       icon: Radio      },
      { id: "investigation", label: "Investigation",   icon: Network    },
    ],
  },
  {
    id: "rbi",
    label: "RBI Portal",
    icon: Landmark,
    color: "amber",
    sections: [
      { id: "network",      label: "Network Overview", icon: Globe    },
      { id: "institutions", label: "Institution Mgmt", icon: BookOpen },
      { id: "ml-pipeline",  label: "ML Pipeline",      icon: Cpu      },
    ],
  },
];

// ── Tailwind colour tokens per portal ────────────────────────────────────────
export const PORTAL_COLORS = {
  emerald: {
    text:   "text-emerald-400",
    bg:     "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot:    "bg-emerald-400",
  },
  sky: {
    text:   "text-sky-400",
    bg:     "bg-sky-500/10",
    border: "border-sky-500/20",
    dot:    "bg-sky-400",
  },
  amber: {
    text:   "text-amber-400",
    bg:     "bg-amber-500/10",
    border: "border-amber-500/20",
    dot:    "bg-amber-400",
  },
};
