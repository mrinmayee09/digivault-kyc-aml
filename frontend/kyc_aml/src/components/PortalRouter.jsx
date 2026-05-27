// src/components/PortalRouter.jsx

import { useApp } from "../context/AppContext";

// User Portal
import UserDashboard        from "./portals/user/UserDashboard";
import KYCCenter            from "./portals/user/KYCCenter";
import AMLSimulator         from "./portals/user/AMLSimulator";

// Bank Analyst Portal
import ReviewQueue          from "./portals/bank/ReviewQueue";
import DetailView           from "./portals/bank/DetailView";
import AlertHub             from "./portals/bank/AlertHub";
import InvestigationGraph   from "./portals/bank/InvestigationGraph";

// RBI Portal
import NetworkOverview      from "./portals/rbi/NetworkOverview";
import InstitutionManagement from "./portals/rbi/InstitutionManagement";
import MLPipelineEngine     from "./portals/rbi/MLPipelineEngine";

/** Maps [portalId][sectionId] → component */
const ROUTES = {
  user: {
    dashboard: <UserDashboard />,
    kyc:       <KYCCenter />,
    aml:       <AMLSimulator />,
  },
  bank: {
    queue:         <ReviewQueue />,
    detail:        <DetailView />,
    alerts:        <AlertHub />,
    investigation: <InvestigationGraph />,
  },
  rbi: {
    network:      <NetworkOverview />,
    institutions: <InstitutionManagement />,
    "ml-pipeline": <MLPipelineEngine />,
  },
};

export default function PortalRouter() {
  const { activePortal, activeSection } = useApp();
  return ROUTES[activePortal]?.[activeSection] ?? null;
}
