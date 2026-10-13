import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from './store/authStore';
import ScrollToTop from './components/common/ScrollToTop';
import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import Home from './pages/Home';
import About from './pages/About';
import Tracking from './pages/Tracking';
import Shop from './pages/Shop';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
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
import { RouteSeo } from '@/components/Seo';

function ProtectedRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { user, token } = useAuthStore();
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'CUSTOMER') {
    return <Navigate to="/track" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <TooltipProvider>
      <Router>
        <RouteSeo />
        <ScrollToTop />
        <div className="min-h-screen bg-background font-sans antialiased">
          <ErrorBoundary>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:slug" element={<ServiceDetail />} />
              <Route path="/price-finder" element={<Services />} />
              <Route path="/about" element={<About />} />
              <Route path="/track" element={<Tracking />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/rejected-access" element={<RejectedAccess />} />

              {/* Protected Dashboard Routes */}
              <Route 
                path="/dashboard/*" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
          <Toaster position="top-right" richColors />
        </div>
      </Router>
    </TooltipProvider>
  );
}
