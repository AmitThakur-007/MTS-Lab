import React, { useMemo } from 'react';
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
import { useAuthStore } from '@/store/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();

  const isTechnician = useMemo(() => {
    return [
      'TECHNICIAN',
      'LEAD_TECHNICIAN',
      'HEAD_TECHNICIAN',
      'TECHNICAL_ASSISTANT'
    ].includes(user?.role || '');
  }, [user?.role]);

  const isManager = user?.role === 'MANAGER';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Compute default landing component based on authenticated role
  const defaultElement = useMemo(() => {
    if (isTechnician) return <TechnicianDashboard />;
    if (isManager) return <ManagerDashboard />;
    return <Overview />;
  }, [isTechnician, isManager]);

  return (
    // InactivityGuard monitors user interaction and manages session expiration
    <InactivityGuard>
      <DashboardLayout>
        <Routes>
          {/* Default Role-Based Index Landing */}
          <Route index element={defaultElement} />

          {/* Core Analytics & Operational Dashboards */}
          <Route path="overview" element={<Overview />} />
          <Route path="manager" element={<ManagerDashboard />} />
          <Route path="technician" element={<TechnicianDashboard />} />

          {/* Repair Workorders */}
          <Route path="repairs" element={isTechnician ? <TechnicianDashboard /> : <Repairs />} />
          <Route path="repairs/new" element={<NewRepair />} />
          <Route path="repairs/:id" element={<RepairDetails />} />

          {/* Courier & Logistics Tracking */}
          <Route path="courier" element={<CourierManagement />} />
          <Route path="couriers" element={<CourierManagement />} />

          {/* Battery Warranty Management */}
          <Route path="battery-warranty" element={<BatteryWarrantyManagement />} />
          <Route path="battery-warranties" element={<BatteryWarrantyManagement />} />
          <Route path="warranties" element={<BatteryWarrantyManagement />} />

          {/* HR, Attendance & QC Damage Reports */}
          <Route path="attendance" element={<Attendance />} />
          <Route path="staff" element={<Staff />} />
          <Route path="repair-damage" element={<RepairRelatedDamage />} />
          <Route path="repair-related-damage" element={<RepairRelatedDamage />} />
          <Route path="damage" element={<RepairRelatedDamage />} />

          {/* Pricing & Display CMS */}
          <Route path="repair-prices" element={<RepairPrices />} />
          <Route path="slides" element={<SlideshowManagement />} />

          {/* Inventory & Parts Stock */}
          <Route path="inventory" element={<Inventory />} />
          <Route path="products" element={<Inventory />} />

          {/* Accounting, Finance & Config */}
          <Route path="revenue" element={<Revenue />} />
          <Route path="settings" element={<Settings />} />

          {/* Super Admin Privileged Access */}
          <Route path="super-admin" element={<SuperAdmin />} />
          {isSuperAdmin && (
            <Route path="access-requests" element={<AccessRequests />} />
          )}

          {/* Catch-All Fallback Route */}
          <Route path="*" element={defaultElement} />
        </Routes>
      </DashboardLayout>
    </InactivityGuard>
  );
}