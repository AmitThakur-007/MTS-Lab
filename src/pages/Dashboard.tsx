import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import InactivityGuard from '@/components/InactivityGuard';
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

export default function Dashboard() {
  const { user } = useAuthStore();
  const isTechnician = user?.role === 'TECHNICIAN';
  const isManager = user?.role === 'MANAGER';

  const defaultElement = isTechnician
    ? <TechnicianDashboard />
    : isManager
    ? <ManagerDashboard />
    : <Overview />;

  return (
    // InactivityGuard wraps all authenticated dashboard content.
    // It monitors user activity and enforces 2-hour inactivity session expiration.
    <InactivityGuard>
      <DashboardLayout>
        <Routes>
          <Route index element={defaultElement} />
          <Route path="manager" element={<ManagerDashboard />} />
          <Route path="repairs" element={isTechnician ? <TechnicianDashboard /> : <Repairs />} />
          <Route path="repairs/new" element={<NewRepair />} />
          <Route path="repairs/:id" element={<RepairDetails />} />
          <Route path="courier" element={<CourierManagement />} />
          <Route path="couriers" element={<CourierManagement />} />
          <Route path="battery-warranty" element={<BatteryWarrantyManagement />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="repair-damage" element={<RepairRelatedDamage />} />
          <Route path="repair-related-damage" element={<RepairRelatedDamage />} />
          <Route
            path="customers"
            element={['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(user?.role || '') ? <CustomerHub /> : defaultElement}
          />
          <Route
            path="customers/:id"
            element={['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'].includes(user?.role || '') ? <CustomerProfile /> : defaultElement}
          />
          <Route path="damage" element={<RepairRelatedDamage />} />
          <Route path="staff" element={<Staff />} />
          <Route path="repair-prices" element={<RepairPrices />} />
          <Route path="slides" element={<SlideshowManagement />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="products" element={<Inventory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="super-admin" element={<SuperAdmin />} />
          {user?.role === 'SUPER_ADMIN' && <Route path="access-requests" element={<AccessRequests />} />}
          <Route path="*" element={defaultElement} />
        </Routes>
      </DashboardLayout>
    </InactivityGuard>
  );
}
