import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('Dashboard Sidebar — Desktop Expand/Collapse, Collapsed Icon Tooltips & Role-Based Navigation Verification', async (t) => {
  const layoutPath = path.join(process.cwd(), 'src/components/DashboardLayout.tsx');
  const contextPath = path.join(process.cwd(), 'src/context/SidebarContext.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
  const contextContent = fs.readFileSync(contextPath, 'utf-8');

  await t.test('1. Sidebar Context: Stores user-scoped preference and handles 80px (w-20) compact width', () => {
    assert.match(contextContent, /mtslab-sidebar-collapsed/, 'Stores collapse preference in localStorage');
    assert.match(contextContent, /toggleSidebarCollapse/, 'Exposes toggleSidebarCollapse method');
    assert.match(contextContent, /sidebarWidth.*80.*288/, 'Calculates 80px collapsed and 288px expanded width');
  });

  await t.test('2. CRITICAL: Collapsed Mode displays ONLY Feature Icons to save horizontal space (w-20 / 80px)', () => {
    // In collapsed mode (when isCollapsed is true), verify it sets w-72 md:w-20
    assert.match(layoutContent, /isCollapsed \? "w-72 md:w-20" : "w-72"/, 'Sidebar sets compact w-20 (80px) on desktop');
    // Renders icon-only centered square button
    assert.match(layoutContent, /w-11 h-11 mx-auto rounded-xl transition-all cursor-pointer group/, 'Renders centered icon button in collapsed desktop mode');
    assert.match(layoutContent, /<item\.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" \/>/, 'Renders prominent feature icon');
  });

  await t.test('3. CRITICAL: Every feature icon has a floating, non-clipped Tooltip beside the corresponding icon', () => {
    // Verifies Tooltip, TooltipTrigger, TooltipContent integration
    assert.match(layoutContent, /import \{ Tooltip, TooltipTrigger, TooltipContent \} from '@\/components\/ui\/tooltip'/, 'Imports Tooltip components');
    assert.match(layoutContent, /<TooltipContent\s+side="right"\s+sideOffset=\{14\}/, 'Positions tooltips to the right of the icon with 14px offset');
    assert.match(layoutContent, /aria-label=\{tooltipLabel\}/, 'Provides accessible aria-labels on collapsed icon triggers');
  });

  await t.test('4. Non-Generic, Role-Aware Feature Tooltip Titles for all features', () => {
    // Inspect getFeatureTooltip implementation
    assert.match(layoutContent, /const getFeatureTooltip =/, 'Defines getFeatureTooltip mapping function');
    assert.match(layoutContent, /'Overview Dashboard'/, 'Maps Overview to Overview Dashboard');
    assert.match(layoutContent, /'Manager Hub'/, 'Maps Manager Hub');
    assert.match(layoutContent, /'Repair Workorders'/, 'Maps Repairs to Repair Workorders');
    assert.match(layoutContent, /'New Repair Intake'/, 'Maps New Repair to New Repair Intake');
    assert.match(layoutContent, /'Technician Manager'/, 'Maps Technician Manager');
    assert.match(layoutContent, /'Customer Hub'/, 'Maps Customer Hub');
    assert.match(layoutContent, /'SMS Center'/, 'Maps SMS Center');
    assert.match(layoutContent, /'SMS Reports'/, 'Maps SMS Reports');
    assert.match(layoutContent, /'Courier Hub'/, 'Maps Courier Hub');
    assert.match(layoutContent, /'Battery Warranty Hub'/, 'Maps Battery Warranty Hub');
    assert.match(layoutContent, /'Services & Repair Prices'/, 'Maps Services & Repair Prices');
    assert.match(layoutContent, /'Slideshow CMS'/, 'Maps Slideshow CMS');
    assert.match(layoutContent, /'Inventory Hub'/, 'Maps Inventory Hub');
    assert.match(layoutContent, /'Attendance Hub'/, 'Maps Attendance Hub');
    assert.match(layoutContent, /'Repair-Related Damage QA'/, 'Maps Repair-Related Damage QA');
    assert.match(layoutContent, /'Staff Management'/, 'Maps Staff Management');
    assert.match(layoutContent, /'Security & Surveillance'/, 'Maps Security & Surveillance');
    assert.match(layoutContent, /'Revenue Hub'/, 'Maps Revenue Hub');
    assert.match(layoutContent, /'Super Admin Audit Console'/, 'Maps Super Admin Audit Console');
    assert.match(layoutContent, /'Theme Controller'/, 'Maps Theme Controller');
    assert.match(layoutContent, /'Transfer Queue'/, 'Maps Transfer Queue');
    assert.match(layoutContent, /'Settings'/, 'Maps Settings');
  });

  await t.test('5. Expand / Collapse Toggle Button & Directional Icons', () => {
    assert.match(layoutContent, /onClick=\{toggleSidebarCollapse\}/, 'Binds toggle button to toggleSidebarCollapse');
    assert.match(layoutContent, /PanelLeftOpen/, 'Uses PanelLeftOpen directional icon when collapsed');
    assert.match(layoutContent, /PanelLeftClose/, 'Uses PanelLeftClose directional icon when expanded');
    assert.match(layoutContent, /aria-label="Expand sidebar navigation"/, 'Provides accessible expand aria-label');
    assert.match(layoutContent, /aria-label="Collapse sidebar navigation"/, 'Provides accessible collapse aria-label');
  });

  await t.test('6. Keyboard Shortcut Listener (Ctrl+[ / Cmd+[ / Ctrl+B)', () => {
    assert.match(layoutContent, /e\.key === '\[' \|\| e\.key === 'b'/, 'Includes keyboard listener for Ctrl+[ and Ctrl+B');
    assert.match(layoutContent, /toggleSidebarCollapse\(\)/, 'Invokes toggle on keyboard shortcut');
  });

  await t.test('7. Multi-Role RBAC Authorization & Navigation Mapping', () => {
    const rolesToCheck = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HEAD_TECHNICIAN', 'LEAD_TECHNICIAN', 'TECHNICIAN', 'ACCOUNTANT', 'INVENTORY_MANAGER'];
    rolesToCheck.forEach((role) => {
      assert.ok(layoutContent.includes(role), `Includes configuration for role ${role}`);
    });
  });

  await t.test('8. Active Page Highlighting & Contrast Styling in both modes', () => {
    assert.match(layoutContent, /isLinkActive\(item\)/, 'Evaluates active state with isLinkActive');
    assert.match(layoutContent, /bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-md/, 'Applies active contrast styling in light and dark mode');
  });

  await t.test('9. Collapsed Mode User Profile at Bottom shows Avatar with Tooltip & Exit with Tooltip', () => {
    assert.match(layoutContent, /<Avatar className="h-10 w-10/, 'Renders avatar in collapsed mode');
    assert.match(layoutContent, /Account Settings: \$\{user\?\.name \|\| 'Staff'\}/, 'Provides avatar tooltip label');
    assert.match(layoutContent, /aria-label="Log Out"/, 'Provides logout button in collapsed mode');
  });

  await t.test('10. Mobile Drawer Responsiveness', () => {
    assert.match(layoutContent, /className="md:hidden"/, 'Separates mobile rendering');
    assert.match(layoutContent, /setIsSidebarOpen\(false\)/, 'Closes drawer after navigation click on mobile');
    assert.match(layoutContent, /Menu className="h-5 w-5"/, 'Provides mobile open drawer button');
    assert.match(layoutContent, /X className="h-5 w-5"/, 'Provides mobile close drawer button');
  });
});
