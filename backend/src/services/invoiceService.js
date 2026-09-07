import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Invoice from '../models/Invoice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logoPath = path.resolve(__dirname, '../../../assets/khatulogo-removebg-preview.png');

const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateText = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');
const company = {
  name: 'KHATUPAY SECURITIES PRIVATE LIMITED',
  tradeName: 'KHATUPAY SECURITIES PRIVATE LIMITED',
  gstin: '09AAMCK7213N1ZY',
  address: 'S-216, Transport Nagar Road, Lucknow, Uttar Pradesh - 226012',
  registrationType: 'Regular',
  constitution: 'Private Limited Company',
  certificateDate: '17/04/2026'
};
const statusColor = (status) => {
  if (status === 'PAID') return '#047857';
  if (status === 'OVERDUE') return '#b91c1c';
  return '#b45309';
};

const drawLabelValue = (doc, label, value, x, y, width = 170) => {
  doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, y, { width });
  doc.fillColor('#111827').font('Helvetica').fontSize(10).text(value || 'N/A', x, y + 14, { width });
};

const drawRoundedBox = (doc, x, y, width, height, fill = '#ffffff', stroke = '#e5e7eb') => {
  doc.save();
  doc.roundedRect(x, y, width, height, 10).fillAndStroke(fill, stroke);
  doc.restore();
};

const drawFooter = (doc) => {
  doc.moveTo(44, 744).lineTo(551, 744).strokeColor('#e5e7eb').stroke();
  doc
    .fillColor('#64748b')
    .font('Helvetica')
    .fontSize(8)
    .text('This is a system generated KhatuPay invoice. For support, contact KhatuPay admin team.', 44, 758, {
      width: 507,
      align: 'center'
    });
};

export const generateInvoicePDF = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId).populate('userId', 'name email mobile');
  if (!invoice) throw new Error('Invoice not found');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 44, size: 'A4' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.rect(0, 0, 595, 842).fill('#ffffff');
    doc.rect(0, 0, 595, 126).fill('#f0fdfa');
    doc.rect(0, 0, 595, 8).fill('#0f766e');

    if (fs.existsSync(logoPath)) {
      drawRoundedBox(doc, 44, 28, 78, 78, '#ffffff', '#d7eeea');
      doc.image(logoPath, 53, 37, { width: 60, height: 60, fit: [60, 60] });
    }

    doc
      .fillColor('#0f766e')
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('KhatuPay', 138, 36);
    doc
      .fillColor('#334155')
      .fontSize(10)
      .font('Helvetica')
      .text(company.name, 140, 70)
      .text(`GSTIN: ${company.gstin}`, 140, 86)
      .text(company.address, 140, 102, { width: 240 });

    doc
      .fillColor('#111827')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('INVOICE', 394, 36, { width: 156, align: 'right' });
    doc
      .fillColor('#64748b')
      .fontSize(10)
      .font('Helvetica')
      .text(invoice.invoiceNumber, 394, 65, { width: 156, align: 'right' });

    doc.save();
    doc.roundedRect(458, 86, 92, 24, 12).fill(statusColor(invoice.status));
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(invoice.status || 'PENDING', 458, 93, { width: 92, align: 'center' });
    doc.restore();

    drawRoundedBox(doc, 44, 150, 238, 104, '#ffffff', '#e5e7eb');
    doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(11).text('BILL TO', 62, 168);
    doc
      .fillColor('#111827')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(invoice.userId?.name || 'Customer', 62, 190, { width: 200 });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#475569')
      .text(invoice.userId?.email || 'N/A', 62, 214, { width: 200 })
      .text(invoice.userId?.mobile || 'N/A', 62, 232, { width: 200 });

    drawRoundedBox(doc, 312, 150, 239, 104, '#ffffff', '#e5e7eb');
    drawLabelValue(doc, 'Invoice Date', dateText(invoice.date || invoice.createdAt), 330, 168, 92);
    drawLabelValue(doc, 'Due Date', dateText(invoice.dueDate), 444, 168, 88);
    drawLabelValue(doc, 'Invoice No.', invoice.invoiceNumber, 330, 214, 202);

    drawRoundedBox(doc, 44, 272, 507, 86, '#f8fafc', '#eef2f7');
    doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(10).text('SUPPLIER GST DETAILS', 62, 286);
    doc.fillColor('#111827').font('Helvetica').fontSize(9)
      .text(`Legal Name: ${invoice.companyName || company.name}`, 62, 304, { width: 225 })
      .text(`Trade Name: ${company.tradeName}`, 62, 319, { width: 225 })
      .text(`GSTIN: ${invoice.gstin || company.gstin}`, 62, 334, { width: 225 })
      .text(`Registration: ${company.registrationType}`, 318, 304, { width: 200 })
      .text(`Constitution: ${company.constitution}`, 318, 319, { width: 200 })
      .text(`Certificate Date: ${company.certificateDate}`, 318, 334, { width: 200 });

    if (invoice.description) {
      drawRoundedBox(doc, 44, 372, 507, 42, '#ffffff', '#e5e7eb');
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text('DESCRIPTION', 62, 384);
      doc.fillColor('#111827').font('Helvetica').fontSize(10).text(invoice.description, 62, 398, { width: 470 });
    }

    const tableTop = invoice.description ? 438 : 378;
    doc.roundedRect(44, tableTop, 507, 34, 8).fill('#0f766e');
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('ITEM DESCRIPTION', 60, tableTop + 12)
      .text('QTY', 318, tableTop + 12, { width: 45, align: 'right' })
      .text('RATE', 380, tableTop + 12, { width: 70, align: 'right' })
      .text('TOTAL', 468, tableTop + 12, { width: 66, align: 'right' });

    let y = tableTop + 46;
    const items = invoice.items?.length
      ? invoice.items
      : [{ description: invoice.description || 'Invoice amount', quantity: 1, rate: invoice.amount, total: invoice.amount }];

    items.forEach((item, index) => {
      if (y > 690) {
        drawFooter(doc);
        doc.addPage();
        y = 64;
      }

      const fill = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.roundedRect(44, y - 9, 507, 32, 6).fill(fill);
      doc
        .fillColor('#111827')
        .font('Helvetica')
        .fontSize(10)
        .text(item.description || 'Invoice item', 60, y, { width: 230 })
        .text(String(item.quantity || 0), 318, y, { width: 45, align: 'right' })
        .text(money(item.rate), 380, y, { width: 70, align: 'right' })
        .font('Helvetica-Bold')
        .text(money(item.total), 468, y, { width: 66, align: 'right' });
      y += 36;
    });

    const totalBoxY = Math.max(y + 16, tableTop + 132);
    drawRoundedBox(doc, 326, totalBoxY, 225, 112, '#f0fdfa', '#bdeee8');
    const taxable = Number(invoice.taxableAmount || 0);
    doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(9)
      .text('Taxable Value', 344, totalBoxY + 16)
      .text(money(taxable), 448, totalBoxY + 16, { width: 82, align: 'right' })
      .text('CGST', 344, totalBoxY + 34)
      .text(money(invoice.cgst), 448, totalBoxY + 34, { width: 82, align: 'right' })
      .text('SGST', 344, totalBoxY + 52)
      .text(money(invoice.sgst), 448, totalBoxY + 52, { width: 82, align: 'right' })
      .text('IGST', 344, totalBoxY + 70)
      .text(money(invoice.igst), 448, totalBoxY + 70, { width: 82, align: 'right' });
    doc.moveTo(344, totalBoxY + 88).lineTo(530, totalBoxY + 88).strokeColor('#99d8d0').stroke();
    doc.fillColor('#053c3b').fontSize(15).text('GRAND TOTAL', 344, totalBoxY + 94);
    doc.fontSize(16).text(money(invoice.amount), 448, totalBoxY + 94, { width: 82, align: 'right' });

    if (invoice.notes) {
      drawRoundedBox(doc, 44, totalBoxY, 260, 112, '#ffffff', '#e5e7eb');
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text('NOTES', 62, totalBoxY + 16);
      doc.fillColor('#374151').font('Helvetica').fontSize(10).text(invoice.notes, 62, totalBoxY + 32, { width: 224 });
    }

    drawFooter(doc);
    doc.end();
  });
};

export const generateInvoiceCSV = async () => {
  const invoices = await Invoice.find().populate('userId', 'name email mobile');
  const fields = ['invoiceNumber', 'userId.name', 'userId.email', 'userId.mobile', 'amount', 'date', 'dueDate', 'status'];
  const parser = new Parser({ fields });
  return parser.parse(invoices);
};
