import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';

// Domain Route Modules
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import repairsRoutes from './routes/repairs';
import customersRoutes from './routes/customers';
import inventoryRoutes from './routes/inventory';
import couriersRoutes from './routes/couriers';
import batteryWarrantiesRoutes from './routes/batteryWarranties';
import attendanceRoutes from './routes/attendance';
import repairDamageRoutes from './routes/repairDamage';
import repairPricesRoutes from './routes/repairPrices';
import slidesRoutes from './routes/slides';
import productsRoutes from './routes/products';
import notificationsRoutes from './routes/notifications';
import superAdminRoutes from './routes/superAdmin';
import uploadRoutes from './routes/upload';
import publicRoutes from './routes/public';
import eventsRoutes from './routes/events';

export function createApp(): Express {
  const app = express();

  // Basic Middleware
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(cookieParser());

  // Global CORS Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Mount API Domain Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/staff', usersRoutes);
  app.use('/api/repairs', repairsRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/couriers', couriersRoutes);

  // Battery Warranties (all path aliases)
  app.use('/api/battery-warranties', batteryWarrantiesRoutes);
  app.use('/api/battery-warranty', batteryWarrantiesRoutes);
  app.use('/api/warranties', batteryWarrantiesRoutes);

  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/repair-damage', repairDamageRoutes);
  app.use('/api/repair-prices', repairPricesRoutes);
  app.use('/api/public/repair-prices', repairPricesRoutes);
  app.use('/api/slides', slidesRoutes);
  app.use('/api/admin/slides', slidesRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/public/products', productsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/admin', superAdminRoutes);

  // SuperAdmin & Access alias mounts
  app.use('/api/share', superAdminRoutes);
  app.use('/api/access-requests', superAdminRoutes);
  app.use('/api/approved-devices', superAdminRoutes);

  // Fallback stubs for inventory & repair-prices folder structures
  app.get('/api/inventory/folders', (req: Request, res: Response) => res.json([]));
  app.get('/api/inventory/suppliers', (req: Request, res: Response) => res.json([]));
  app.get('/api/inventory/locations', (req: Request, res: Response) => res.json([]));
  app.get('/api/repair-prices/folders', (req: Request, res: Response) => res.json([]));
  app.get('/api/access-requests', (req: Request, res: Response) => res.json([]));
  app.get('/api/approved-devices', (req: Request, res: Response) => res.json([]));

  app.use('/api/upload', uploadRoutes);
  app.use('/api/events', eventsRoutes);

  // Public Tracking & Info Routes (Mounted with explicit path aliases to prevent 404s)
  app.use('/api', publicRoutes);
  app.use('/api/public', publicRoutes);

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // 404 handler for unmatched API routes
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
  });

  // Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[API UNHANDLED ERROR]', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred.',
    });
  });

  return app;
}

export default createApp;