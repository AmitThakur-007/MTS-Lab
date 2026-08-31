import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import staffRoutes from './routes/staff';
import repairsRoutes from './routes/repairs';
import repairTransfersRoutes from './routes/repairTransfers';
import customersRoutes from './routes/customers';
import inventoryRoutes from './routes/inventory';
import couriersRoutes from './routes/couriers';
import batteryWarrantiesRoutes from './routes/batteryWarranties';
import attendanceRoutes from './routes/attendance';
import repairDamageRoutes from './routes/repairDamage';
import repairPricesRoutes from './routes/repairPrices';
import repairPriceFoldersRoutes from './routes/repairPriceFolders';
import slidesRoutes from './routes/slides';
import productsRoutes from './routes/products';
import notificationsRoutes from './routes/notifications';
import superAdminRoutes from './routes/superAdmin';
import securityRoutes from './routes/security';
import uploadRoutes from './routes/upload';
import eventsRoutes from './routes/events';
import publicRoutes from './routes/public';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/user', usersRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/security', securityRoutes);
  app.use('/api/repairs', repairsRoutes);
  // Transfer requests intentionally share the /api/repairs namespace because
  // the technician client submits POST /api/repairs/:repairId/transfer-request.
  // The transfer router owns only transfer-specific paths, so there is one
  // transfer implementation and no duplicate assignment mechanism.
  app.use('/api/repairs', repairTransfersRoutes);
  app.use('/api/repair', repairsRoutes);
  app.use('/api/repair-transfers', repairTransfersRoutes);
  app.use('/api/repair-transfer', repairTransfersRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/customer', customersRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/couriers', couriersRoutes);
  app.use('/api/courier', couriersRoutes);
  app.use('/api/battery-warranties', batteryWarrantiesRoutes);
  app.use('/api/battery-warranty', batteryWarrantiesRoutes);
  app.use('/api/warranties', batteryWarrantiesRoutes);
  app.use('/api/warranty', batteryWarrantiesRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/repair-damage', repairDamageRoutes);
  app.use('/api/repair-prices', repairPricesRoutes);
  app.use('/api/repair-prices/folders', repairPriceFoldersRoutes);
  app.use('/api/public/repair-prices', repairPricesRoutes);
  app.use('/api/slides', slidesRoutes);
  app.use('/api/admin/slides', slidesRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/public/products', productsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/admin', superAdminRoutes);
  app.use('/api/share', superAdminRoutes);
  app.use('/api/access-requests', securityRoutes);
  app.use('/api/approved-devices', securityRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api', publicRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  return app;
}

export default createApp();
