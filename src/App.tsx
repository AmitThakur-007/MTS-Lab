import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from './store/authStore';
import { normalizeRole } from '@/lib/rbac';
import ScrollToTop from './components/common/ScrollToTop';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';

// Pages
import Home from './pages/Home';
import About from './pages/About';
import Tracking from './pages/Tracking';
import Services from './pages/Services';
import Contact from './pages/Contact';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PendingApproval from './pages/PendingApproval';
import RejectedAccess from './pages/RejectedAccess';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { user, token } = useAuthStore();
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const normUserRole = normalizeRole(user.role);
  if (user.role === 'CUSTOMER' || normUserRole === null) {
    return <Navigate to="/track" replace />;
  }

  if (roles) {
    const normRoles = roles.map(r => normalizeRole(r) || r);
    if (!normRoles.includes(normUserRole) && !roles.includes(user.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <TooltipProvider>
      <Router>
        <ScrollToTop />
        <div className="min-h-screen bg-background font-sans antialiased">
          <Routes>
            {/* Public Routes with Error Boundary Protection */}
            <Route path="/" element={<RouteErrorBoundary fallbackTitle="Home Page Error"><Home /></RouteErrorBoundary>} />
            <Route path="/services" element={<RouteErrorBoundary fallbackTitle="Services Catalog Error"><Services /></RouteErrorBoundary>} />
            <Route path="/price-finder" element={<RouteErrorBoundary fallbackTitle="Price Finder Error"><Services /></RouteErrorBoundary>} />
            <Route path="/about" element={<RouteErrorBoundary fallbackTitle="About Page Error"><About /></RouteErrorBoundary>} />
            <Route path="/track" element={<RouteErrorBoundary fallbackTitle="Repair Tracker Error"><Tracking /></RouteErrorBoundary>} />
            <Route path="/track-repair" element={<RouteErrorBoundary fallbackTitle="Repair Tracker Error"><Tracking /></RouteErrorBoundary>} />
            <Route path="/tracking" element={<RouteErrorBoundary fallbackTitle="Repair Tracker Error"><Tracking /></RouteErrorBoundary>} />
            <Route path="/contact" element={<RouteErrorBoundary fallbackTitle="Contact Page Error"><Contact /></RouteErrorBoundary>} />
            <Route path="/terms" element={<RouteErrorBoundary fallbackTitle="Terms of Service Error"><Terms /></RouteErrorBoundary>} />
            <Route path="/privacy" element={<RouteErrorBoundary fallbackTitle="Privacy Policy Error"><Privacy /></RouteErrorBoundary>} />
            <Route path="/login" element={<RouteErrorBoundary fallbackTitle="Authentication Portal Error"><Login /></RouteErrorBoundary>} />
            <Route path="/forgot-password" element={<RouteErrorBoundary fallbackTitle="Password Reset Error"><ForgotPassword /></RouteErrorBoundary>} />
            <Route path="/reset-password" element={<RouteErrorBoundary fallbackTitle="Password Reset Error"><ResetPassword /></RouteErrorBoundary>} />
            <Route path="/pending-approval" element={<RouteErrorBoundary fallbackTitle="Security Clearance Error"><PendingApproval /></RouteErrorBoundary>} />
            <Route path="/rejected-access" element={<RouteErrorBoundary fallbackTitle="Security Clearance Error"><RejectedAccess /></RouteErrorBoundary>} />

            {/* Role & Dashboard Navigation Aliases */}
            <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
            <Route path="/technician" element={<Navigate to="/dashboard" replace />} />
            <Route path="/manager" element={<Navigate to="/dashboard" replace />} />
            <Route path="/receptionist" element={<Navigate to="/dashboard" replace />} />

            {/* Protected Dashboard Routes */}
            <Route 
              path="/dashboard/*" 
              element={
                <ProtectedRoute>
                  <RouteErrorBoundary fallbackTitle="Dashboard Module Error" returnUrl="/dashboard" returnLabel="Return to Overview">
                    <Dashboard />
                  </RouteErrorBoundary>
                </ProtectedRoute>
              } 
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </div>
      </Router>
    </TooltipProvider>
  );
}
