import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

// Extending jsPDF with autotable type
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generateRepairReport = (data: any[], title: string) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const timestamp = format(new Date(), 'dd MMM yyyy, HH:mm');

  // Page setup
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Company Logo (Stylized)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('MTS LAB', 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('PREMIUM SMARTPHONE RESTORATION', 20, 33);
  
  // Report Meta (Header Right)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SYSTEM REPORT', 150, 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${timestamp}`, 150, 26);
  doc.text(`Total Records: ${data.length}`, 150, 32);

  // Title Section
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 20, 60);
  
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(20, 65, pageWidth - 20, 65);

  // Table Data Preparation
  const tableRows = data.map(repair => [
    repair.repairNumber || 'N/A',
    repair.customerName,
    repair.customerPhone,
    `${repair.deviceBrand} ${repair.deviceModel}`,
    repair.problemDescription?.substring(0, 40) + (repair.problemDescription?.length > 40 ? '...' : ''),
    { content: repair.status, styles: { fontStyle: 'bold' } }
  ]);

  doc.autoTable({
    startY: 75,
    head: [['JOB ID', 'CUSTOMER', 'PHONE', 'DEVICE/MODEL', 'PROBLEM', 'STATUS']],
    body: tableRows,
    theme: 'striped',
    headStyles: { 
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 4
    },
    bodyStyles: { 
      fontSize: 8,
      cellPadding: 4,
      textColor: [51, 65, 85] // slate-700
    },
    alternateRowStyles: { 
      fillColor: [248, 250, 252] // slate-50
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap'
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 40 },
      4: { cellWidth: 40 },
      5: { cellWidth: 20 }
    },
    margin: { left: 20, right: 20 },
    didDrawPage: (data) => {
      // Footer on every page
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} | MTS Lab Official Document`,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 10
      );
    }
  });

  // Final Summary Box
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const summaryBoxW = 100;
  
  if (finalY + 40 < doc.internal.pageSize.getHeight()) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(pageWidth - summaryBoxW - 20, finalY, summaryBoxW, 30, 3, 3, 'FD');
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    const totalCost = data.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);
    const totalPaid = data.reduce((sum, r) => sum + (r.totalPaid || 0), 0);
    
    doc.text('Financial Summary', pageWidth - summaryBoxW - 10, finalY + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total Estimated: Rs. ${totalCost.toLocaleString()}`, pageWidth - summaryBoxW - 10, finalY + 18);
    doc.text(`Total Collected: Rs. ${totalPaid.toLocaleString()}`, pageWidth - summaryBoxW - 10, finalY + 24);
  }

  // Save/Download
  doc.save(`MTS_LAB_REPORT_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
};

/**
 * Generate Comprehensive Financial & Profit/Loss (P&L) PDF Report
 */
export const generateFinancialPLReport = (
  summary: any,
  categoryBreakdown: any[],
  brandBreakdown: any[],
  technicianPerformance: any[],
  timeframeLabel: string
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const timestamp = format(new Date(), 'dd MMM yyyy, HH:mm');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Company Logo (Stylized)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('MTS LAB', 20, 24);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('OFFICIAL FINANCIAL STATEMENT & P&L REPORT', 20, 32);

  // Report Meta (Header Right)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FINANCIAL INTELLIGENCE', 140, 18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Period: ${timeframeLabel}`, 140, 24);
  doc.text(`Generated: ${timestamp}`, 140, 30);
  doc.text(`Currency: Nepalese Rupee (NPR)`, 140, 36);

  // Executive Summary Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('1. EXECUTIVE FINANCIAL SUMMARY', 20, 58);

  const summaryRows = [
    ['Gross Revenue (Actual Collections)', `Rs. ${(summary?.grossRevenue || 0).toLocaleString()}`],
    ['Total Quoted / Estimated Billing', `Rs. ${(summary?.estimatedBilled || 0).toLocaleString()}`],
    ['Outstanding Receivables (Pending Balance)', `Rs. ${(summary?.outstandingReceivables || 0).toLocaleString()}`],
    ['Parts & Inventory Cost (COGS)', `Rs. ${(summary?.totalPartsCost || 0).toLocaleString()}`],
    ['Workshop Damage & Loss Deductions', `Rs. ${(summary?.totalDamageLoss || 0).toLocaleString()}`],
    ['Net Profit (After Parts & Losses)', `Rs. ${(summary?.netProfit || 0).toLocaleString()}`],
    ['Profit Margin', `${summary?.profitMargin || 0}%`],
    ['Average Ticket Value', `Rs. ${(summary?.averageTicket || 0).toLocaleString()}`],
    ['Total Repair Jobs in Period', `${summary?.totalRepairsCount || 0} (${summary?.completedRepairsCount || 0} Delivered/Ready)`],
  ];

  doc.autoTable({
    startY: 63,
    head: [['METRIC', 'AUTHORITATIVE VALUE']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85] },
    columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' }, 1: { cellWidth: 70, halign: 'right' } },
    margin: { left: 20, right: 20 },
  });

  // Category Breakdown Table
  let currentY = (doc as any).lastAutoTable.finalY + 12;
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. SERVICE & REPAIR CATEGORY PERFORMANCE', 20, currentY);

  const categoryRows = (categoryBreakdown || []).map((c) => [
    c.category,
    `${c.count} jobs`,
    `Rs. ${(c.revenue || 0).toLocaleString()}`,
    `Rs. ${(c.cost || 0).toLocaleString()}`,
    `Rs. ${(c.profit || 0).toLocaleString()}`,
    `${c.margin || 0}%`,
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [['SERVICE CATEGORY', 'VOLUME', 'REVENUE', 'PARTS COST', 'GROSS PROFIT', 'MARGIN']],
    body: categoryRows.length > 0 ? categoryRows : [['No category data', '-', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85] },
    margin: { left: 20, right: 20 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
    },
  });

  // Technician Performance Table
  currentY = (doc as any).lastAutoTable.finalY + 12;
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. TECHNICIAN REVENUE CONTRIBUTION', 20, currentY);

  const techRows = (technicianPerformance || []).map((t) => [
    t.name,
    t.role?.replace(/_/g, ' ') || 'Staff',
    `${t.completedCount || 0} completed`,
    `Rs. ${(t.revenue || 0).toLocaleString()}`,
    `Rs. ${(t.profit || 0).toLocaleString()}`,
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [['STAFF NAME', 'ROLE', 'COMPLETED JOBS', 'REVENUE GENERATED', 'NET CONTRIBUTION']],
    body: techRows.length > 0 ? techRows : [['No staff data', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85] },
    margin: { left: 20, right: 20 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} | MTS Lab Financial Statement`,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 10
      );
    },
  });

  doc.save(`MTS_LAB_FINANCIAL_REPORT_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
};

/**
 * Generate Repair-Level Profitability PDF Report
 */
export const generateRepairProfitabilityReport = (repairs: any[], title: string) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const timestamp = format(new Date(), 'dd MMM yyyy, HH:mm');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MTS LAB', 20, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('REPAIR-LEVEL FINANCIAL & PROFITABILITY LEDGER', 20, 28);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`Generated: ${timestamp}`, 145, 20);
  doc.text(`Total Records: ${repairs.length}`, 145, 26);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 20, 52);

  const tableRows = repairs.map((r) => [
    r.repairNumber || 'N/A',
    `${r.customerName}\n${r.deviceBrand} ${r.deviceModel}`,
    `Rs. ${(r.estimatedCost || 0).toLocaleString()}`,
    `Rs. ${(r.totalPaid || 0).toLocaleString()}`,
    `Rs. ${(r.partsCost || 0).toLocaleString()}`,
    `Rs. ${(r.damageCost || 0).toLocaleString()}`,
    `Rs. ${(r.grossProfit || 0).toLocaleString()}`,
    `${r.profitMargin || 0}%`,
    r.paymentStatus || 'UNPAID',
  ]);

  doc.autoTable({
    startY: 58,
    head: [['JOB #', 'CUSTOMER / DEVICE', 'QUOTED', 'COLLECTED', 'PARTS', 'DAMAGE', 'PROFIT', 'MARGIN', 'PAYMENT']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 2, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 36 },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 14, halign: 'right' },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 16, halign: 'right' },
      7: { cellWidth: 14, halign: 'right' },
      8: { cellWidth: 16, halign: 'center' },
    },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} | MTS Lab Official Profitability Audit`,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 8
      );
    },
  });

  doc.save(`MTS_LAB_PROFITABILITY_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
};

/**
 * Universal CSV Export Helper with UTF-8 BOM
 */
export const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const escapeCell = (cell: any) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCell).join(',')).join('\n');
  const csvContent = '\uFEFF' + headerLine + '\n' + rowLines;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

