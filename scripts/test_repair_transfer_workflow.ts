import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'api/_server/app.ts'), 'utf8');
const transferRoutes = fs.readFileSync(path.join(root, 'api/_server/routes/repairTransfers.ts'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'src/pages/dashboard/TechnicianDashboard.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260831_repair_transfer_workflow.sql'), 'utf8');

function assertIncludes(source: string, value: string, label: string) {
  if (!source.includes(value)) throw new Error(`FAIL: ${label} — missing ${value}`);
  console.log(`PASS: ${label}`);
}

assertIncludes(app, "app.use('/api/repairs', repairTransfersRoutes);", 'transfer router mounted under /api/repairs');
assertIncludes(transferRoutes, "router.post('/:repairId/transfer-request'", 'transfer request endpoint');
assertIncludes(transferRoutes, "router.get('/my-requests'", 'transfer request listing endpoint');
assertIncludes(transferRoutes, "router.post('/:id/respond'", 'accept/reject endpoint');
assertIncludes(transferRoutes, "router.post('/:id/cancel'", 'cancel endpoint');
assertIncludes(transferRoutes, "p_sender_technician_id: req.user!.id", 'sender identity comes from authenticated user');
assertIncludes(transferRoutes, "p_receiver_technician_id: req.user!.id", 'receiver identity comes from authenticated user');
assertIncludes(dashboard, "api.post(`/repairs/${selectedRepair.id}/transfer-request'", 'frontend calls transfer request endpoint');
assertIncludes(dashboard, "api.post(`/repair-transfers/${transferId}/respond'", 'frontend calls response endpoint');
assertIncludes(migration, 'RepairTransferRequest_one_pending_per_repair_idx', 'one pending transfer per repair constraint');
assertIncludes(migration, 'create_repair_transfer_request', 'atomic request RPC');
assertIncludes(migration, 'respond_repair_transfer_request', 'atomic response RPC');
assertIncludes(migration, 'cancel_repair_transfer_request', 'atomic cancellation RPC');
assertIncludes(migration, "v_repair.\"technicianId\" is distinct from v_request.\"senderTechnicianId\"", 'accept validates original assignment');
assertIncludes(migration, 'update "Repair"', 'accept updates repair assignment');
assertIncludes(migration, "'TRANSFER_ACCEPTED'", 'accept history event');
assertIncludes(migration, "'TRANSFER_REJECTED'", 'reject history event');
assertIncludes(migration, "'TRANSFER_REQUEST'", 'receiver notification');

console.log('Repair transfer workflow contract checks passed.');
