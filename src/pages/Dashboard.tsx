import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import InactivityGuard from '@/components/InactivityGuard';
import RouteErrorBoundary from '@/components/common/RouteErrorBoundary';
import Overview from './dashboard/Overview';
import Repairs from './dashboard/Repairs';
import RepairDetails from './dashboard/RepairDetails';
import NewRepair from './dashboard/NewRepair';
import BatteryWarrantyManagement from './dashboard/BatteryWarrantyManagement';
import Staff from './dashboard/Staff';
import Inventory from './dashboard/Inventory';
import RepairPrices from './dashboard/RepairPrices';
import SlideshowManagement from './dashboard/SlideshowManagement';
import Settings from './dashboard/Settings';
import Revenue from './dashboard/Revenue';
import SuperAdmin from './dashboard/SuperAdmin';
import AccessRequests from './dashboard/AccessRequests';
import TechnicianDashboard from './dashboard/TechnicianDashboard';
import ManagerDashboard from './dashboard/ManagerDashboard';
import Attendance from './dashboard/Attendance';
import CourierManagement from './dashboard/CourierManagement';
import RepairRelatedDamage from './dashboard/RepairRelatedDamage';
import CustomerHub from './dashboard/CustomerHub';
import CustomerProfile from './dashboard/CustomerProfile';
import { useAuthStore } from '@/store/authStore';
import { normalizeRole } from '@/lib/rbac';

export default function Dashboard() {
  const { user } = useAuthStore();
  const role = normalizeRole(user?.role) || 'RECEPTIONIST';

  const isTechnician = role === 'TECHNICIAN' || role === 'HEAD_TECHNICIAN';
  const isManager = role === 'MANAGER';
  const isSuperAdmin = role === 'SUPERADMIN';

  const defaultElement = isTechnician
    ? <TechnicianDashboard />
    : isManager
    ? <ManagerDashboard />
    : <Overview />;

  const canAccessCustomers = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HEAD_TECHNICIAN', 'TECHNICIAN', 'RECEPTIONIST'].includes(role);
  const canAccessStaff = ['SUPERADMIN', 'ADMIN'].includes(role);
  const canAccessRevenue = ['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(role);
  const canAccessSlides = ['SUPERADMIN', 'ADMIN'].includes(role);
  const canAccessSuperAdmin = isSuperAdmin;

  return (
    // InactivityGuard wraps all authenticated dashboard content.
    // It monitors user activity and enforces session expiration.
    <InactivityGuard>
      <DashboardLayout>
        <RouteErrorBoundary>
          <Routes>
            <Route index element={defaultElement} />
            <Route path="manager" element={isManager || isSuperAdmin || role === 'ADMIN' ? <ManagerDashboard /> : defaultElement} />
            <Route path="repairs" element={isTechnician ? <TechnicianDashboard /> : <Repairs />} />
            <Route path="repairs/new" element={<NewRepair />} />
            <Route path="repairs/:id" element={<RepairDetails />} />
            <Route path="courier" element={<CourierManagement />} />
            <Route path="couriers" element={<CourierManagement />} />
            <Route path="battery-warranty" element={<BatteryWarrantyManagement />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="repair-damage" element={<RepairRelatedDamage />} />
            <Route path="repair-related-damage" element={<RepairRelatedDamage />} />
            <Route path="damage" element={<RepairRelatedDamage />} />
            <Route
              path="customers"
              element={canAccessCustomers ? <CustomerHub /> : defaultElement}
            />
            <Route
              path="customers/:id"
              element={canAccessCustomers ? <CustomerProfile /> : defaultElement}
            />
            <Route path="staff" element={canAccessStaff ? <Staff /> : defaultElement} />
            <Route path="repair-prices" element={<RepairPrices />} />
            <Route path="slides" element={canAccessSlides ? <SlideshowManagement /> : defaultElement} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="products" element={<Inventory />} />
            <Route path="settings" element={<Settings />} />
            <Route path="revenue" element={canAccessRevenue ? <Revenue /> : defaultElement} />
            <Route path="super-admin" element={canAccessSuperAdmin ? <SuperAdmin /> : defaultElement} />
            <Route path="access-requests" element={canAccessSuperAdmin ? <AccessRequests /> : defaultElement} />
            <Route path="*" element={defaultElement} />
          </Routes>
        </RouteErrorBoundary>
      </DashboardLayout>
    </InactivityGuard>
  );
}
