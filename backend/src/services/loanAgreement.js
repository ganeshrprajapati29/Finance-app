import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import loanPolicy from '../config/loanPolicy.js';
import { allInclusiveApr, buildRepaymentSchedule } from '../utils/loanSchedule.js';

const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
// SignCare places the Aadhaar signature at Bottom_Right (signAppearance 4) of the
// LAST page (pageToBeSigned 2). This band is kept free of any other text.
const SIGNATURE_BAND = 150;
const COLORS = { brand: '#0f766e', ink: '#111827', muted: '#64748b', line: '#e2e8f0', soft: '#f1f5f9' };

const rupees = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const text = (value, fallback = 'N/A') => String(value ?? '').trim() || fallback;
const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const agreementSha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/** The numbers printed in the agreement, shared with the approval response. */
export function agreementTerms(loan) {
  const decision = loan.decision || {};
  const principal = Number(decision.amountApproved || 0);
  const rate = Number(decision.rateAPR || 0);
  const months = Number(decision.tenureMonths || 0);
  const upfrontCharges = Number(decision.processingFee || 0) + Number(decision.taxAmount || 0);
  const repayment = buildRepaymentSchedule({
    principal, annualRatePercent: rate, months, startDate: loan.disbursementDate || decision.decidedAt || new Date(),
  });
  return {
    principal,
    rate,
    months,
    processingFee: Number(decision.processingFee || 0),
    taxAmount: Number(decision.taxAmount || 0),
    upfrontCharges,
    netDisbursal: Math.max(0, principal - upfrontCharges),
    emi: repayment.emi,
    totalInterest: repayment.totalInterest,
    totalRepayment: repayment.totalRepayment,
    allInclusiveApr: allInclusiveApr({ principal, annualRatePercent: rate, months, upfrontCharges }),
    schedule: repayment.schedule,
  };
}

export function generateLoanAgreementPdf(loan, borrower) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true, info: { Title: 'KhatuPay Loan Agreement' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const decision = loan.decision || {};
    const bank = loan.application?.bankDetails || {};
    const personal = loan.application?.personal || {};
    const terms = agreementTerms(loan);
    const policy = loanPolicy.agreement;
    const bottom = PAGE.height - PAGE.margin;

    const ensureSpace = (height) => {
      if (doc.y + height > bottom) doc.addPage();
    };

    const heading = (title) => {
      ensureSpace(40);
      doc.moveDown(0.8);
      doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(12).text(title.toUpperCase(), PAGE.margin, doc.y, { characterSpacing: 0.5 });
      doc.moveTo(PAGE.margin, doc.y + 3).lineTo(PAGE.margin + CONTENT_WIDTH, doc.y + 3).strokeColor(COLORS.line).lineWidth(1).stroke();
      doc.moveDown(0.6);
    };

    // Two-column key/value table that breaks cleanly across pages.
    const keyValues = (rows) => {
      for (const [label, value] of rows) {
        const valueText = text(value);
        const height = Math.max(
          doc.font('Helvetica').fontSize(9.5).heightOfString(valueText, { width: CONTENT_WIDTH - 200 }),
          12,
        ) + 8;
        ensureSpace(height);
        const y = doc.y;
        doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8.5).text(label, PAGE.margin + 6, y + 4, { width: 185 });
        doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.5).text(valueText, PAGE.margin + 200, y + 4, { width: CONTENT_WIDTH - 206 });
        doc.moveTo(PAGE.margin, y + height).lineTo(PAGE.margin + CONTENT_WIDTH, y + height).strokeColor(COLORS.line).lineWidth(0.5).stroke();
        doc.y = y + height;
      }
    };

    const bullets = (items) => {
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
      for (const item of items) {
        ensureSpace(doc.heightOfString(item, { width: CONTENT_WIDTH - 14 }) + 6);
        doc.text(`•  ${item}`, PAGE.margin + 4, doc.y, { width: CONTENT_WIDTH - 8, paragraphGap: 5, lineGap: 1.5 });
      }
    };

    // Header
    doc.rect(0, 0, PAGE.width, 8).fill(COLORS.brand);
    doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(22).text('KhatuPay', PAGE.margin, 30);
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(16).text('LOAN AGREEMENT & KEY FACT STATEMENT', PAGE.margin, 62, { width: CONTENT_WIDTH, align: 'center' });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5)
      .text(`Agreement reference: ${loan.loanAccountNumber || loan._id}    |    Generated: ${formatDate(new Date())}`, PAGE.margin, 84, { width: CONTENT_WIDTH, align: 'center' });
    doc.y = 104;

    heading('Part A - Key Fact Statement');
    keyValues([
      ['Lender (Regulated Entity)', decision.lenderName || policy.lenderName],
      ['Lending Service Provider', policy.lspName],
      ['Sanctioned loan amount', rupees(terms.principal)],
      ['Processing fee', rupees(terms.processingFee)],
      ['Taxes (GST on fees)', rupees(terms.taxAmount)],
      ['Net amount disbursed', rupees(terms.netDisbursal)],
      ['Rate of interest', `${terms.rate.toFixed(2)}% per annum, reducing balance`],
      ['Annual Percentage Rate (all-inclusive)', `${terms.allInclusiveApr.toFixed(2)}% per annum (includes fees and taxes)`],
      ['Tenure', `${terms.months} months`],
      ['Number of instalments', `${terms.schedule.length} monthly instalments`],
      ['Equated Monthly Instalment (EMI)', rupees(terms.emi)],
      ['Total interest payable', rupees(terms.totalInterest)],
      ['Total amount payable', rupees(terms.totalRepayment)],
      ['Penal / late payment charges', policy.penalChargesText],
      ['Cooling-off / look-up period', `${policy.coolingOffDays} days from disbursal. You may exit by repaying the principal and the proportionate APR, without any prepayment penalty.`],
      ['Disbursal account', bank.accountNumber ? `${text(bank.bankName, 'Bank')} - XXXX${String(bank.accountNumber).slice(-4)} (${text(bank.ifscCode)})` : 'N/A'],
    ]);

    heading('Borrower details');
    keyValues([
      ['Borrower name', borrower?.name || personal.name],
      ['Mobile', borrower?.mobile || personal.mobile],
      ['Email', borrower?.email || personal.email],
      ['Address', personal.address],
    ]);

    heading('Repayment schedule (indicative)');
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text('Due dates are final from the date of disbursal; amounts do not change.', PAGE.margin, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.4);
    const columns = [
      { title: 'No.', width: 40, value: (row) => String(row.installmentNo) },
      { title: 'Due date', width: 90, value: (row) => formatDate(row.dueDate) },
      { title: 'Opening balance', width: 100, value: (row) => rupees(row.openingBalance) },
      { title: 'Principal', width: 85, value: (row) => rupees(row.principal) },
      { title: 'Interest', width: 85, value: (row) => rupees(row.interest) },
      { title: 'EMI', width: CONTENT_WIDTH - 400, value: (row) => rupees(row.total) },
    ];
    const tableHeader = () => {
      const y = doc.y;
      doc.rect(PAGE.margin, y, CONTENT_WIDTH, 18).fill(COLORS.soft);
      let x = PAGE.margin;
      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(8);
      for (const column of columns) {
        doc.text(column.title, x + 4, y + 5, { width: column.width - 8 });
        x += column.width;
      }
      doc.y = y + 18;
    };
    tableHeader();
    for (const row of terms.schedule) {
      if (doc.y + 16 > bottom) {
        doc.addPage();
        tableHeader();
      }
      const y = doc.y;
      let x = PAGE.margin;
      doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8);
      for (const column of columns) {
        doc.text(column.value(row), x + 4, y + 4, { width: column.width - 8 });
        x += column.width;
      }
      doc.moveTo(PAGE.margin, y + 16).lineTo(PAGE.margin + CONTENT_WIDTH, y + 16).strokeColor(COLORS.line).lineWidth(0.5).stroke();
      doc.y = y + 16;
    }

    heading('Part B - Terms and borrower declarations');
    bullets([
      'I confirm that the application and verification information supplied by me is accurate and complete.',
      'I accept the sanctioned amount, interest rate, fees, taxes, tenure and repayment schedule shown in this agreement.',
      'Fees and taxes are deducted from the sanctioned amount before disbursal. No charge that is not listed in this Key Fact Statement will be levied.',
      'Disbursal happens only to my verified bank account shown above and only after this agreement is signed with Aadhaar eSign.',
      'I may prepay the loan at any time. Penal charges apply only to overdue amounts and are not added to the interest rate.',
      'I authorise verification of my identity, bank account and credit information, lawful reporting to credit bureaus, and electronic communication.',
      'I consent to execute this agreement electronically using Aadhaar eSign through SignCare. The signed copy and its audit trail form part of this agreement.',
    ]);

    heading('Grievance redressal');
    keyValues([
      ['Grievance officer', policy.grievanceName],
      ['Email', policy.grievanceEmail],
      ...(policy.grievancePhone ? [['Phone', policy.grievancePhone]] : []),
      ['Escalation', 'If a complaint is not resolved within 30 days, you may approach the RBI Integrated Ombudsman at https://cms.rbi.org.in.'],
    ]);

    // Signature block: always on the last page with the bottom band free for the
    // SignCare signature stamp at the bottom-right corner.
    if (doc.y + SIGNATURE_BAND + 40 > bottom) doc.addPage();
    const bandTop = bottom - SIGNATURE_BAND;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10)
      .text('For the Lender', PAGE.margin, bandTop, { width: 200 });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(decision.lenderName || policy.lenderName, PAGE.margin, bandTop + 14, { width: 200 })
      .text('Authorised signatory', PAGE.margin, bandTop + 90, { width: 200 });
    doc.moveTo(PAGE.margin, bandTop + 86).lineTo(PAGE.margin + 190, bandTop + 86).strokeColor('#94a3b8').lineWidth(0.8).stroke();
    const signX = PAGE.margin + CONTENT_WIDTH - 220;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10)
      .text('Borrower (Aadhaar eSign)', signX, bandTop, { width: 220, align: 'right' });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(text(borrower?.name || personal.name), signX, bandTop + 14, { width: 220, align: 'right' });

    // Page footer on every page.
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      // Writing below the bottom margin would otherwise make pdfkit add a page.
      doc.page.margins.bottom = 0;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
        .text(`KhatuPay loan agreement ${loan.loanAccountNumber || loan._id}  |  Page ${index + 1} of ${range.count}`,
          PAGE.margin, PAGE.height - 30, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}
