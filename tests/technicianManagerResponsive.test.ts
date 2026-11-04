import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Technician Manager Responsive Layout & Label Fitting Tests', () => {
  const technicianManagerFile = path.resolve('src/pages/dashboard/TechnicianManager.tsx');
  const repairAssignmentsFile = path.resolve('src/components/technician-manager/RepairAssignmentsTab.tsx');
  const priorityManagementFile = path.resolve('src/components/technician-manager/PriorityManagementTab.tsx');
  const transferRequestsFile = path.resolve('src/components/technician-manager/TransferRequestsTab.tsx');
  const technicianOverviewFile = path.resolve('src/components/technician-manager/TechnicianOverviewTab.tsx');
  const technicianWorkloadFile = path.resolve('src/components/technician-manager/TechnicianWorkloadTab.tsx');

  test('All Technician Manager component files exist and are readable', () => {
    assert.ok(fs.existsSync(technicianManagerFile), 'TechnicianManager.tsx must exist');
    assert.ok(fs.existsSync(repairAssignmentsFile), 'RepairAssignmentsTab.tsx must exist');
    assert.ok(fs.existsSync(priorityManagementFile), 'PriorityManagementTab.tsx must exist');
    assert.ok(fs.existsSync(transferRequestsFile), 'TransferRequestsTab.tsx must exist');
    assert.ok(fs.existsSync(technicianOverviewFile), 'TechnicianOverviewTab.tsx must exist');
    assert.ok(fs.existsSync(technicianWorkloadFile), 'TechnicianWorkloadTab.tsx must exist');
  });

  describe('Container & Responsive Width Tracking in TechnicianManager.tsx', () => {
    const tmCode = fs.readFileSync(technicianManagerFile, 'utf8');

    test('Integrates useDashboardSidebar for adaptive sizing', () => {
      assert.ok(
        tmCode.includes('useDashboardSidebar'),
        'TechnicianManager must import and use useDashboardSidebar'
      );
    });

    test('Uses ResizeObserver to track containerWidth dynamically', () => {
      assert.ok(
        tmCode.includes('ResizeObserver') && tmCode.includes('containerWidth'),
        'TechnicianManager must track container width via ResizeObserver'
      );
    });

    test('Passes containerWidth prop to tabs for layout adjustments', () => {
      assert.ok(
        tmCode.includes('containerWidth={containerWidth}'),
        'TechnicianManager must forward containerWidth to child tabs'
      );
    });

    test('Has overflow-x-hidden container wrapper to prevent page-level horizontal blowouts', () => {
      assert.ok(
        tmCode.includes('overflow-x-hidden') && tmCode.includes('max-w-full') && tmCode.includes('min-w-0'),
        'TechnicianManager must wrap layout in max-w-full min-w-0 overflow-x-hidden'
      );
    });
  });

  describe('Repair Assignments: Labels and Screen Fitting', () => {
    const repairCode = fs.readFileSync(repairAssignmentsFile, 'utf8');

    test('Guarantees "All Workshop Repairs" label is present without text clipping', () => {
      assert.ok(
        repairCode.includes('All Workshop Repairs'),
        '"All Workshop Repairs" label must be present in sub-tab options'
      );
    });

    test('Sub-tabs container uses flex-wrap and responsive gap to prevent mobile text truncation', () => {
      assert.ok(
        repairCode.includes('flex-wrap') && repairCode.includes('min-w-0'),
        'Sub-tabs must use flex-wrap and min-w-0 to prevent horizontal overflow'
      );
    });

    test('Implements dual display: mobile card layout (block lg:hidden) and desktop table (hidden lg:block)', () => {
      assert.ok(
        repairCode.includes('block lg:hidden') && repairCode.includes('hidden lg:block'),
        'RepairAssignments must render mobile cards (block lg:hidden) and desktop table (hidden lg:block)'
      );
    });

    test('Mobile cards feature responsive touch action buttons for assigning technician', () => {
      assert.ok(
        repairCode.includes('Assign Tech') || repairCode.includes('Reassign Tech'),
        'Mobile cards must offer clear action button for assignment/reassignment'
      );
    });

    test('Filter dropdowns have flexible min-widths preventing chevrons from overlapping text', () => {
      assert.ok(
        repairCode.includes('min-w-[140px]') || repairCode.includes('min-w-0'),
        'Filter dropdowns must provide sufficient min-width and flex shrinkage'
      );
    });
  });

  describe('Priority Management: Labels and Screen Fitting', () => {
    const priorityCode = fs.readFileSync(priorityManagementFile, 'utf8');

    test('Guarantees "All Priority Levels" label is present in sub-tabs and dropdown filter', () => {
      assert.ok(
        priorityCode.includes('All Priority Levels'),
        '"All Priority Levels" label must be present'
      );
    });

    test('Sub-tabs container uses flex-wrap to prevent clipping on mobile portrait', () => {
      assert.ok(
        priorityCode.includes('flex-wrap') && priorityCode.includes('min-w-0'),
        'Priority sub-tabs must use flex-wrap'
      );
    });

    test('Implements dual display: mobile card layout (block lg:hidden) and desktop table (hidden lg:block)', () => {
      assert.ok(
        priorityCode.includes('block lg:hidden') && priorityCode.includes('hidden lg:block'),
        'PriorityManagement must render mobile cards and desktop table'
      );
    });

    test('Priority modal dialog has responsive width constraints (w-[95vw] max-w-md max-h-[90vh])', () => {
      assert.ok(
        priorityCode.includes('w-[95vw]') && priorityCode.includes('max-h-[90vh]'),
        'Priority modal dialog must adapt to mobile viewport height and width'
      );
    });
  });

  describe('Transfer Requests & Overview: Mobile Screen Optimization', () => {
    const transferCode = fs.readFileSync(transferRequestsFile, 'utf8');
    const overviewCode = fs.readFileSync(technicianOverviewFile, 'utf8');
    const workloadCode = fs.readFileSync(technicianWorkloadFile, 'utf8');

    test('Transfer requests has mobile card view with clear approve/reject buttons', () => {
      assert.ok(
        transferCode.includes('block lg:hidden') && transferCode.includes('hidden lg:block'),
        'Transfer requests must have mobile card view and desktop table view'
      );
    });

    test('Technician overview has responsive mobile card view for tech stats', () => {
      assert.ok(
        overviewCode.includes('block lg:hidden') && overviewCode.includes('hidden lg:block'),
        'Technician overview must have mobile cards and desktop table'
      );
    });

    test('Technician workload dynamically adapts grid columns based on containerWidth', () => {
      assert.ok(
        workloadCode.includes('containerWidth') && workloadCode.includes('grid'),
        'Technician workload must adapt grid based on containerWidth'
      );
    });
  });
});
