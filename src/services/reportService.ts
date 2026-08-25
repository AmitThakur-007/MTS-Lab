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
