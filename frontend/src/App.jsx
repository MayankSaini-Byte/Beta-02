import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Freshness from './pages/Freshness.jsx';
import Recipes from './pages/Recipes.jsx';
import RecipeDetail from './pages/RecipeDetail.jsx';
import Planner from './pages/Planner.jsx';
import MessMenu from './pages/MessMenu.jsx';
import Nutrition from './pages/Nutrition.jsx';
import Shopping from './pages/Shopping.jsx';
import PriceCompare from './pages/PriceCompare.jsx';
import Scan from './pages/Scan.jsx';
import Analytics from './pages/Analytics.jsx';
import Profile from './pages/Profile.jsx';
import Devices from './pages/Devices.jsx';
import VendorRestocking from './pages/VendorRestocking.jsx';
import { getAccountType, isPgAccount } from './utils/accountType.js';

function Protected({ children, allowOnboarding = false }) {
  const { token, user } = useApp();
  if (!token) return <Navigate to="/login" replace />;
  if (!allowOnboarding && user?.onboardingComplete === false) return <Navigate to="/onboarding" replace />;
  return children;
}

function SegmentOnly({ types, children }) {
  const { user } = useApp();
  return types.includes(getAccountType(user)) ? children : <Navigate to="/" replace />;
}

function PgOnly({ children }) {
  const { user } = useApp();
  return isPgAccount(user) ? children : <Navigate to="/" replace />;
}

function NonPgOnly({ children }) {
  const { user } = useApp();
  return isPgAccount(user) ? <Navigate to="/mess-menu" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Protected allowOnboarding><Onboarding /></Protected>} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="freshness" element={<Freshness />} />
        <Route path="recipes" element={<NonPgOnly><Recipes /></NonPgOnly>} />
        <Route path="recipes/:key" element={<NonPgOnly><RecipeDetail /></NonPgOnly>} />
        <Route path="planner" element={<SegmentOnly types={['household']}><Planner /></SegmentOnly>} />
        <Route path="mess-menu" element={<PgOnly><MessMenu /></PgOnly>} />
        <Route path="nutrition" element={<SegmentOnly types={['household']}><Nutrition /></SegmentOnly>} />
        <Route path="shopping" element={<Shopping />} />
        <Route path="price-compare" element={<SegmentOnly types={['household']}><PriceCompare /></SegmentOnly>} />
        <Route path="scan" element={<Scan />} />
        <Route path="devices" element={<SegmentOnly types={['commercial', 'service']}><Devices /></SegmentOnly>} />
        <Route path="analytics" element={<SegmentOnly types={['commercial', 'service']}><Analytics /></SegmentOnly>} />
        <Route path="vendors" element={<SegmentOnly types={['commercial', 'service']}><VendorRestocking /></SegmentOnly>} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Navigate to="/profile" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppProvider><AppRoutes /></AppProvider>;
}
