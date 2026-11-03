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
import ThemeController from './dashboard/ThemeController';
import AccessRequests from './dashboard/AccessRequests';
import SecuritySurveillance from './dashboard/SecuritySurveillance';
import TechnicianDashboard from './dashboard/TechnicianDashboard';
import TechnicianOverview from '@/pages/technician/TechnicianOverview';
import TechnicianRepairs from '@/pages/technician/TechnicianRepairs';
import TechnicianTransfers from '@/pages/technician/TechnicianTransfers';
import ManagerDashboard from './dashboard/ManagerDashboard';
import Attendance from './dashboard/Attendance';
import CourierManagement from './dashboard/CourierManagement';
import RepairRelatedDamage from './dashboard/RepairRelatedDamage';
import SmsCenter from './dashboard/SmsCenter';
import SmsReports from './dashboard/SmsReports';
import CustomerHub from './dashboard/CustomerHub';
import CustomerProfile from './dashboard/CustomerProfile';
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
    if (isTechnician) return <TechnicianOverview />;
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

          {/* Dedicated Technician Workspace Destinations */}
          <Route path="technician" element={<TechnicianOverview />} />
          <Route path="technician/overview" element={<TechnicianOverview />} />
          <Route path="technician/repairs" element={<TechnicianRepairs />} />
          <Route path="technician/transfers" element={<TechnicianTransfers />} />
          <Route path="transfers" element={isTechnician ? <TechnicianTransfers /> : <Repairs />} />

          {/* Core Analytics & Operational Dashboards */}
          <Route path="overview" element={isTechnician ? <TechnicianOverview /> : <Overview />} />
          <Route path="manager" element={<ManagerDashboard />} />

          {/* Repair Workorders */}
          <Route path="repairs" element={isTechnician ? <TechnicianRepairs /> : <Repairs />} />
          <Route path="repairs/new" element={<NewRepair />} />
          <Route path="repairs/:id" element={<RepairDetails />} />

          {/* Customer Hub & Customer Profiles */}
          <Route path="customers" element={<CustomerHub />} />
          <Route path="customers/:id" element={<CustomerProfile />} />

          {/* SMS Notification Center & Reports */}
          <Route path="sms-center" element={<SmsCenter />} />
          <Route path="sms-reports" element={<SmsReports />} />
          <Route path="sms" element={<SmsCenter />} />

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
            <>
              <Route path="theme-controller" element={<ThemeController />} />
              <Route path="access-requests" element={<SecuritySurveillance />} />
              <Route path="security-surveillance" element={<SecuritySurveillance />} />
              <Route path="security" element={<SecuritySurveillance />} />
              <Route path="theme-controller" element={<ThemeController />} />
            </>
          )}

          {/* Catch-All Fallback Route */}
          <Route path="*" element={defaultElement} />
        </Routes>
      </DashboardLayout>
    </InactivityGuard>
  );
}