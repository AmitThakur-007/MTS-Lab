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
import accessRequestsCompatRoutes from './routes/accessRequestsCompat';
import slidesRoutes from './routes/slides';
import productsRoutes from './routes/products';
import notificationsRoutes from './routes/notifications';
import superAdminRoutes from './routes/superAdmin';
import backupsRoutes from './routes/backups';
import uploadRoutes from './routes/upload';
import eventsRoutes from './routes/events';
import publicRoutes from './routes/public';

export function createApp() {
  const app = express();

  // Support pre-parsed bodies (e.g. Vercel Serverless Function runtime)
  app.use((req, _res, next) => {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch (_) {}
    }
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      (req as any)._body = true;
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/user', usersRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/repairs', repairsRoutes);
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
  app.use('/api/repair-prices/folders', repairPriceFoldersRoutes);
  app.use('/api/repair-prices', repairPricesRoutes);
  app.use('/api/public/repair-prices', repairPricesRoutes);
  app.use('/api/slides', slidesRoutes);
  app.use('/api/admin/slides', slidesRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/public/products', productsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  // The backups router defines /backups, /backups/:id, etc.; mount it at the
  // admin namespace so the public API contract is /api/admin/backups/*.
  app.use('/api/admin', backupsRoutes);
  app.use('/api/admin', superAdminRoutes);
  app.use('/api/share', superAdminRoutes);
  app.use('/api/access-requests', accessRequestsCompatRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api', publicRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Global Express error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[EXPRESS UNHANDLED ERROR]', err);
    if (!res.headersSent) {
      res.status(err?.status || 500).json({
        error: err?.name || 'InternalServerError',
        message: err?.message || 'An unexpected server error occurred.',
      });
    }
  });

  return app;
}

export default createApp();
