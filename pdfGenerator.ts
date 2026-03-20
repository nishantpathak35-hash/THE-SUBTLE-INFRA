import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CompanySettings {
  companyName: string;
  address: string;
  logoUrl?: string;
  gstNumber?: string;
  panNumber?: string;
  poTerms?: string;
}

interface POItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

interface POData {
  poNumber: string;
  createdAt: string;
  terms?: string;
  vendor?: {
    name?: string;
    email?: string;
    address?: string;
    gstNumber?: string;
  };
  items: POItem[];
  subTotal: number;
  gstAmount: number;
  totalAmount: number;
}

export const generatePOPDF = (po: POData, settings: CompanySettings) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Professional Border
    try {
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.5);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
    } catch (e) {
      console.warn("Failed to add border to PDF", e);
    }

    // Header Section with subtle background
    try {
      doc.setFillColor(249, 250, 251);
      doc.rect(5, 5, pageWidth - 10, 40, 'F');
    } catch (e) {}

    if (settings.logoUrl && (settings.logoUrl.startsWith('data:') || settings.logoUrl.startsWith('http'))) {
      try {
        doc.addImage(settings.logoUrl, 'PNG', 15, 12, 25, 25);
      } catch (e) {
        console.warn("Failed to add logo to PDF", e);
      }
    }

    // Company Name
    try {
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(settings.companyName || 'THE SUBTLE INFRA - Business Intelligence', settings.logoUrl ? 45 : 15, 22);
    } catch (e) {
      console.warn("Failed to add company name to PDF", e);
    }

    // Company Details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const infoX = settings.logoUrl ? 45 : 15;
    const addressLines = doc.splitTextToSize(settings.address || '', 80);
    doc.text(addressLines, infoX, 30);
    
    let currentY = 30 + (addressLines.length * 5);
    if (settings.gstNumber) {
      doc.text(`GSTIN: ${settings.gstNumber}`, infoX, currentY);
      currentY += 5;
    }
    if (settings.panNumber) {
      doc.text(`PAN: ${settings.panNumber}`, infoX, currentY);
    }

    // Document Title & Number (Top Right)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text('PURCHASE ORDER', pageWidth - 15, 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text(`PO No: ${po.poNumber || 'DRAFT'}`, pageWidth - 15, 30, { align: 'right' });
    doc.text(`Date: ${new Date(po.createdAt || Date.now()).toLocaleDateString()}`, pageWidth - 15, 36, { align: 'right' });

    // Divider
    doc.setDrawColor(229, 231, 235);
    doc.line(15, 55, pageWidth - 15, 55);

    // Vendor Details
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text('VENDOR DETAILS', 15, 65);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(po.vendor?.name || 'N/A', 15, 72);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const vendorAddressLines = doc.splitTextToSize(po.vendor?.address || 'N/A', 80);
    doc.text(vendorAddressLines, 15, 78);
    
    currentY = 78 + (vendorAddressLines.length * 5);
    doc.text(`Email: ${po.vendor?.email || 'N/A'}`, 15, currentY);
    if (po.vendor?.gstNumber) {
      doc.text(`GSTIN: ${po.vendor.gstNumber}`, 15, currentY + 5);
    }

    // Items Table
    const tableData = (po.items || []).map((item, index) => {
      const amountExclGst = (item.quantity || 0) * (item.rate || 0);
      return [
        index + 1,
        item.description || 'N/A',
        item.quantity || 0,
        item.unit || 'Nos',
        (item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        amountExclGst.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        `${item.gstRate || 0}%`,
        (item.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        (item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ];
    });

    autoTable(doc, {
      startY: 105,
      head: [['#', 'Description', 'Qty', 'Unit', 'Rate', 'Amount', 'GST %', 'GST Amt', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 15, halign: 'center' },
        7: { cellWidth: 22, halign: 'right' },
        8: { cellWidth: 25, halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;

    // Summary and Totals
    const summaryX = pageWidth - 80;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    
    doc.text('Subtotal:', summaryX, finalY + 15);
    doc.text((po.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 15, finalY + 15, { align: 'right' });

    doc.text('Total GST:', summaryX, finalY + 22);
    doc.text((po.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 15, finalY + 22, { align: 'right' });

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(summaryX, finalY + 26, pageWidth - 15, finalY + 26);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Grand Total:', summaryX, finalY + 34);
    doc.text(`INR ${(po.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 15, finalY + 34, { align: 'right' });

    // Terms and Signature Area
    if (finalY + 80 > pageHeight) doc.addPage();

    const termsToDisplay = po.terms || settings.poTerms;
    if (termsToDisplay) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text('TERMS & CONDITIONS', 15, finalY + 55);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      const termsLines = doc.splitTextToSize(termsToDisplay, 110);
      doc.text(termsLines, 15, finalY + 62);
    }

    // Authorized Signature
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Authorized Signatory', pageWidth - 60, finalY + 85);
    doc.setDrawColor(200);
    doc.line(pageWidth - 70, finalY + 80, pageWidth - 15, finalY + 80);

    // Bottom Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('This is a computer-generated document. No signature is required.', pageWidth / 2, pageHeight - 12, { align: 'center' });

    const fileName = `PO_${(po.poNumber || 'Draft').replace(/[^a-z0-9]/gi, '_')}.pdf`;
    doc.save(fileName);
  } catch (err: any) {
    console.error("Critical PO PDF generation error:", err);
    alert("Failed to generate PO PDF: " + err.message);
  }
};

interface BOQItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
  gstAmount: number;
  amount: number;
}

interface BOQData {
  title: string;
  client?: {
    name?: string;
    email?: string;
  };
  lineItems: BOQItem[];
  subTotal: number;
  gstAmount: number;
  totalValue: number;
  createdAt: string;
}

export const generateBOQPDF = (boq: BOQData, settings: CompanySettings) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Professional Border
    try {
      doc.setDrawColor(31, 41, 55);
      doc.setLineWidth(0.5);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
    } catch (e) {
      console.warn("Failed to add border to BOQ PDF", e);
    }

    // Header Section with subtle background
    try {
      doc.setFillColor(249, 250, 251);
      doc.rect(5, 5, pageWidth - 10, 40, 'F');
    } catch (e) {}

    if (settings.logoUrl && (settings.logoUrl.startsWith('data:') || settings.logoUrl.startsWith('http'))) {
      try {
        doc.addImage(settings.logoUrl, 'PNG', 15, 12, 25, 25);
      } catch (e) {
        console.warn("Failed to add logo to BOQ PDF", e);
      }
    }

    // Company Name
    try {
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(settings.companyName || 'THE SUBTLE INFRA - Business Intelligence', settings.logoUrl ? 45 : 15, 22);
    } catch (e) {
      console.warn("Failed to add company name to BOQ PDF", e);
    }

    // Company Details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const infoX = settings.logoUrl ? 45 : 15;
    const addressLines = doc.splitTextToSize(settings.address || '', 80);
    doc.text(addressLines, infoX, 30);
    
    let currentY = 30 + (addressLines.length * 5);
    if (settings.gstNumber) {
      doc.text(`GSTIN: ${settings.gstNumber}`, infoX, currentY);
      currentY += 5;
    }

    // Document Title (Top Right)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('BILL OF QUANTITIES', pageWidth - 15, 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(boq.createdAt || Date.now()).toLocaleDateString()}`, pageWidth - 15, 30, { align: 'right' });

    // Divider
    doc.setDrawColor(229, 231, 235);
    doc.line(15, 50, pageWidth - 15, 50);

    // Client & Project Details
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('CLIENT DETAILS', 15, 60);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(boq.client?.name || 'N/A', 15, 67);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Email: ${boq.client?.email || 'N/A'}`, 15, 72);

    // Project Info (Right Side)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('PROJECT DETAILS', pageWidth - 15, 60, { align: 'right' });
    
    doc.setFontSize(10);
    doc.text(boq.title || 'Draft BOQ', pageWidth - 15, 67, { align: 'right' });

    // Items Table
    const tableData = (boq.lineItems || []).map((item, index) => {
      const qty = item.quantity || 0;
      const rate = item.rate || 0;
      const amountExclGst = qty * rate;
      return [
        index + 1,
        item.description || 'N/A',
        qty,
        item.unit || 'Nos',
        rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        amountExclGst.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        `${item.gstRate || 0}%`,
        (item.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        (item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ];
    });

    autoTable(doc, {
      startY: 85,
      head: [['#', 'Description', 'Qty', 'Unit', 'Rate', 'Amount', 'GST %', 'GST Amt', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 15, halign: 'center' },
        7: { cellWidth: 22, halign: 'right' },
        8: { cellWidth: 25, halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;

    // Totals Section
    const summaryX = pageWidth - 80;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    
    doc.text('Subtotal:', summaryX, finalY + 15);
    doc.text((boq.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 15, finalY + 15, { align: 'right' });

    doc.text('Total GST:', summaryX, finalY + 22);
    doc.text((boq.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 15, finalY + 22, { align: 'right' });

    doc.setDrawColor(31, 41, 55);
    doc.setLineWidth(0.5);
    doc.line(summaryX, finalY + 26, pageWidth - 15, finalY + 26);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Total Project Value:', summaryX, finalY + 34);
    doc.text(`INR ${(boq.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 15, finalY + 34, { align: 'right' });

    // Authorized Signature
    if (finalY + 60 > pageHeight) doc.addPage();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Authorized Signatory', pageWidth - 60, finalY + 75);
    doc.line(pageWidth - 70, finalY + 70, pageWidth - 15, finalY + 70);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by Business Intelligence - THE SUBTLE INFRA', pageWidth / 2, pageHeight - 12, { align: 'center' });

    const fileName = `BOQ_${(boq.title || 'Draft').replace(/[^a-z0-9]/gi, '_')}.pdf`;
    doc.save(fileName);
  } catch (err: any) {
    console.error("Critical BOQ PDF generation error:", err);
    alert("Failed to generate BOQ PDF: " + err.message);
  }
};

export const generatePTSPDF = (data: any[], settings: CompanySettings) => {
  try {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Professional Border
    try {
      doc.setDrawColor(31, 41, 55);
      doc.setLineWidth(0.5);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
    } catch (e) {
      console.warn("Failed to add border to PTS PDF", e);
    }

    // Header Section with subtle background
    try {
      doc.setFillColor(249, 250, 251);
      doc.rect(5, 5, pageWidth - 10, 25, 'F');
    } catch (e) {}

    // Company Name
    try {
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(settings.companyName || 'THE SUBTLE INFRA - Business Intelligence', 15, 22);
    } catch (e) {
      console.warn("Failed to add company name to PTS PDF", e);
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth - 15, 22, { align: 'right' });

    const tableData = data.map((item, index) => [
      index + 1,
      item.vendor || 'N/A',
      item.project || 'N/A',
      item.poNumber || 'N/A',
      (item.poValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      (item.certifiedValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      (item.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      (item.balancePayment || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      item.status || 'N/A'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Vendor', 'Project', 'PO #', 'PO Value', 'Certified', 'Paid', 'Balance', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 8, cellPadding: 3, textColor: [31, 41, 55] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' }
      }
    });

    doc.save(`Payment_Tracking_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (err: any) {
    console.error("Critical PTS PDF generation error:", err);
    alert("Failed to generate PTS PDF: " + err.message);
  }
};
