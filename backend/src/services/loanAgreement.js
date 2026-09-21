import PDFDocument from 'pdfkit';

const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const text = (value, fallback = 'N/A') => String(value || '').trim() || fallback;

export function generateLoanAgreementPdf(loan, borrower) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const decision = loan.decision || {};
    const bank = loan.application?.bankDetails || {};
    const personal = loan.application?.personal || {};
    const date = new Date().toLocaleDateString('en-IN');

    doc.rect(0, 0, 595, 842).fill('#ffffff');
    doc.rect(0, 0, 595, 9).fill('#0f766e');
    doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(24).text('KhatuPay', 48, 38);
    doc.fillColor('#111827').fontSize(18).text('LOAN AGREEMENT', 48, 76, { align: 'center' });
    doc.fillColor('#64748b').font('Helvetica').fontSize(9)
      .text(`Agreement reference: ${loan.loanAccountNumber || loan._id}`, 48, 106, { align: 'center' })
      .text(`Generated: ${date}`, 48, 120, { align: 'center' });

    const row = (label, value) => {
      const y = doc.y + 6;
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text(label, 58, y, { width: 180 });
      doc.fillColor('#111827').font('Helvetica').fontSize(10).text(text(value), 238, y, { width: 300 });
      doc.moveDown(0.8);
    };

    doc.moveDown(3);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text('Borrower and loan terms');
    row('Borrower', borrower?.name || personal.name);
    row('Mobile', borrower?.mobile || personal.mobile);
    row('Email', borrower?.email || personal.email);
    row('Address', personal.address);
    row('Lending partner', decision.lenderName || 'Partner lender');
    row('Approved amount', money(decision.amountApproved));
    row('Annual percentage rate', `${Number(decision.rateAPR || 0).toFixed(2)}%`);
    row('Tenure', `${decision.tenureMonths || 0} months`);
    row('Processing fee', money(decision.processingFee));
    row('Taxes', money(decision.taxAmount));
    row('Net disbursal', money(decision.netDisbursalAmount));
    row('Disbursal account', bank.accountNumber ? `XXXX${String(bank.accountNumber).slice(-4)}` : 'N/A');

    doc.moveDown(1.3);
    doc.font('Helvetica-Bold').fontSize(13).text('Borrower declarations');
    doc.moveDown(0.5);
    const clauses = [
      'I confirm that the application and verification information supplied by me is accurate.',
      'I accept the approved amount, interest rate, fees, taxes, tenure and repayment obligations shown above.',
      'I authorise verification, lawful credit reporting, electronic communication and disbursal to my verified bank account.',
      'I understand that disbursal occurs only after successful digital signature and final lender checks.',
      'I consent to execute this agreement electronically using Aadhaar eSign through SignCare.',
    ];
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    for (const clause of clauses) {
      doc.text(`- ${clause}`, { indent: 8, paragraphGap: 7, lineGap: 2 });
    }

    doc.moveDown(2);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11)
      .text('Borrower digital signature', 58, doc.y, { width: 220 })
      .text('Authorised lender signature', 330, doc.y - 13, { width: 210 });
    doc.moveDown(3);
    doc.moveTo(58, doc.y).lineTo(260, doc.y).strokeColor('#94a3b8').stroke();
    doc.moveTo(330, doc.y).lineTo(537, doc.y).strokeColor('#94a3b8').stroke();
    doc.moveDown(1);
    doc.fillColor('#64748b').font('Helvetica').fontSize(8)
      .text('The borrower signature is captured through SignCare Aadhaar eSign. The final signed copy and audit trail form part of this agreement.', 48, doc.y, { align: 'center' });

    doc.end();
  });
}
