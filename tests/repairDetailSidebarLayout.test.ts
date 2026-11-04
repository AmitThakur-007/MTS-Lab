import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. SidebarContext exists, exports useDashboardSidebar and SidebarProvider', () => {
  const sidebarContextFile = path.resolve(process.cwd(), 'src/context/SidebarContext.tsx');
  assert.ok(fs.existsSync(sidebarContextFile), 'SidebarContext.tsx should exist');
  
  const content = fs.readFileSync(sidebarContextFile, 'utf8');
  assert.ok(content.includes('export function SidebarProvider'), 'Must export SidebarProvider');
  assert.ok(content.includes('export function useDashboardSidebar'), 'Must export useDashboardSidebar');
  assert.ok(content.includes('sidebarWidth'), 'Must track sidebar width');
  assert.ok(content.includes('mtslab-sidebar-collapsed'), 'Must preserve user persistence key');
});

test('2. DashboardLayout wraps views with SidebarProvider and optimizes main padding', () => {
  const layoutFile = path.resolve(process.cwd(), 'src/components/DashboardLayout.tsx');
  const content = fs.readFileSync(layoutFile, 'utf8');

  assert.ok(content.includes('SidebarProvider'), 'DashboardLayout must wrap in SidebarProvider');
  assert.ok(content.includes('useDashboardSidebar'), 'DashboardLayout must consume useDashboardSidebar');
  assert.ok(content.includes('isCollapsed ? "lg:p-7 xl:p-8" : "lg:p-5 xl:p-6"'), 'Must dynamically adapt viewport padding for collapsed vs expanded sidebar');
});

test('3. RepairRecordDetail adapts layout to desktop sidebar expansion with container width tracking', () => {
  const detailFile = path.resolve(process.cwd(), 'src/components/repair/RepairRecordDetail.tsx');
  const content = fs.readFileSync(detailFile, 'utf8');

  // Verify container width tracking
  assert.ok(content.includes('useDashboardSidebar'), 'Must consume useDashboardSidebar');
  assert.ok(content.includes('containerRef'), 'Must use containerRef to measure available width');
  assert.ok(content.includes('ResizeObserver'), 'Must use ResizeObserver for real-time sidebar expand/collapse detection');
  assert.ok(content.includes('sectionGridClass'), 'Must compute adaptive sectionGridClass');

  // Verify adaptive column reduction when sidebar is expanded
  assert.ok(content.includes('grid-cols-1 md:grid-cols-2'), 'Must support 2-column layout when space is limited by expanded sidebar');
  assert.ok(content.includes('@container'), 'Must include Tailwind @container for container query resilience');
});

test('4. RepairRecordDetail Top Header Toolbar gracefully wraps action buttons when sidebar expands', () => {
  const detailFile = path.resolve(process.cwd(), 'src/components/repair/RepairRecordDetail.tsx');
  const content = fs.readFileSync(detailFile, 'utf8');

  // Verify header toolbar layout adaptation
  assert.ok(content.includes('containerWidth >= 1180 && isCollapsed'), 'Must check both containerWidth and isCollapsed for toolbar layout');
  assert.ok(content.includes('flex flex-col gap-4'), 'Must stack header and action bar when sidebar is expanded on laptops');
  assert.ok(content.includes('flex-wrap items-center gap-2 min-w-0 max-w-full'), 'Action buttons must wrap cleanly with gap-2 and zero clipping');
});

test('5. All 6 Detail sections protect against overflow with min-w-0, shrink-0, and truncate', () => {
  const detailFile = path.resolve(process.cwd(), 'src/components/repair/RepairRecordDetail.tsx');
  const content = fs.readFileSync(detailFile, 'utf8');

  // Section 1: Device Specifications
  assert.ok(content.includes('Device Specifications'), 'Must render Device Specifications');
  assert.ok(content.includes('title="Copy IMEI"') && content.includes('shrink-0 cursor-pointer'), 'Copy IMEI button must have shrink-0');
  assert.ok(content.includes('Identified Device Model'), 'Must render Identified Device Model');

  // Section 2: Customer Information
  assert.ok(content.includes('Customer Information'), 'Must render Customer Information');
  assert.ok(content.includes('Call Client'), 'Must render Call Client button');
  assert.ok(content.includes('WhatsApp'), 'Must render WhatsApp button');

  // Section 3: Repair Information
  assert.ok(content.includes('Repair Information'), 'Must render Repair Information');

  // Section 4: Financial Details
  assert.ok(content.includes('Financial Details'), 'Must render Financial Details');
  assert.ok(content.includes('Record Payment'), 'Must render Record Payment button');

  // Section 5: Technician Details
  assert.ok(content.includes('Technician Details'), 'Must render Technician Details');
  assert.ok(content.includes('Choose specialist...'), 'Must render specialist select dropdown');

  // Section 6: Issue Diagnostics
  assert.ok(content.includes('Issue Diagnostics'), 'Must render Issue Diagnostics');
  assert.ok(content.includes('Customer Reported Issue'), 'Must render Customer Reported Issue');
  assert.ok(content.includes('break-words'), 'Must use break-words to prevent text clipping');
});

test('6. Operations and Courier sections adapt dynamically to reduced sidebar width', () => {
  const detailFile = path.resolve(process.cwd(), 'src/components/repair/RepairRecordDetail.tsx');
  const content = fs.readFileSync(detailFile, 'utf8');

  // Operations workflow priority grid
  assert.ok(content.includes('Operations & Workflow Management'), 'Must render Operations & Workflow Management');
  assert.ok(content.includes('containerWidth < 768 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"'), 'Priority grid must adapt based on container width');

  // Courier logistics grid
  assert.ok(content.includes('Courier Logistics Details'), 'Must render Courier Logistics Details');
  assert.ok(content.includes('containerWidth < 1140'), 'Courier grid must adapt columns for expanded sidebar');
});
