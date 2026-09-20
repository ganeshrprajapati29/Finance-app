import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../clubapi/models/clubapi_transaction.dart';

class PdfService {
  static const _companyName = 'KHATUPAY SECURITIES PRIVATE LIMITED';
  static const _gstin = '09AAMCK7213N1ZY';
  static const _address = 'S-216, Transport Nagar Road, Lucknow, Uttar Pradesh - 226012';

  Future<File> generateGeneralPaymentReceipt(Map<String, dynamic> payment) {
    final rows = <String, String>{
      'Receipt Type': 'General Payment',
      'Type': '${payment['type'] ?? 'Unknown'}',
      'Amount': 'Rs ${payment['amount'] ?? 0}',
      'Status': '${payment['status'] ?? 'Unknown'}',
      if (payment['createdAt'] != null) 'Date': _formatDate('${payment['createdAt']}'),
    };

    final payee = payment['payeeDetails'];
    if (payee is Map) {
      rows.addAll({
        if (payee['name'] != null) 'Payee Name': '${payee['name']}',
        if (payee['vpa'] != null) 'Payee VPA': '${payee['vpa']}',
      });
    }

    return _writeReceipt('general_payment_${DateTime.now().millisecondsSinceEpoch}.pdf', rows);
  }

  Future<File> generateKhatuPayChatReceipt(Map<String, dynamic> payment) {
    final payee = payment['payeeDetails'] is Map
        ? Map<String, dynamic>.from(payment['payeeDetails'])
        : <String, dynamic>{};
    final payer = payment['userId'] is Map
        ? Map<String, dynamic>.from(payment['userId'])
        : <String, dynamic>{};
    final rows = <String, String>{
      'Receipt Type': 'KhatuPay UPI Chat Payment',
      'KhatuPay Payment ID': '${payment['khatuPaymentId'] ?? payment['_id'] ?? ''}',
      'Gateway Reference': '${payment['gateway']?['paymentId'] ?? payment['reference'] ?? ''}',
      'Amount': 'Rs ${payment['amount'] ?? 0}',
      'Status': '${payment['status'] ?? 'Unknown'}',
      if (payment['createdAt'] != null) 'Date': _formatDate('${payment['createdAt']}'),
      if (payer['name'] != null) 'From': '${payer['name']}',
      if (payee['name'] != null) 'To': '${payee['name']}',
      if (payee['vpa'] != null) 'UPI ID': '${payee['vpa']}',
      if (payee['bankName'] != null) 'Bank': '${payee['bankName']}',
      if (payee['note'] != null) 'Note': '${payee['note']}',
    };
    return _writeReceipt('khatupay_${payment['khatuPaymentId'] ?? DateTime.now().millisecondsSinceEpoch}.pdf', rows);
  }

  Future<File> generateClubAPITransactionReceipt(ClubAPITransaction transaction) {
    final rows = <String, String>{
      'Receipt Type': 'Service Transaction',
      'Transaction ID': transaction.urid,
      'Type': transaction.type,
      'Amount': 'Rs ${transaction.amount}',
      'Status': transaction.status,
      if (transaction.provider != null) 'Provider': transaction.provider!,
      if (transaction.accountRef != null) 'Account': transaction.accountRef!,
      if (transaction.createdAt != null) 'Date': _formatDate(transaction.createdAt!.toIso8601String()),
    };

    return _writeReceipt('service_${transaction.urid.isNotEmpty ? transaction.urid : DateTime.now().millisecondsSinceEpoch}.pdf', rows);
  }

  Future<File> _writeReceipt(String fileName, Map<String, String> rows) async {
    final pdf = pw.Document();
    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (context) => pw.Padding(
          padding: const pw.EdgeInsets.all(24),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('KhatuPay Tax Invoice', style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold)),
                      pw.Text(_companyName, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                      pw.Text('GSTIN: $_gstin', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
                      pw.Text(_address, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
                    ],
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: pw.BoxDecoration(color: PdfColors.green50, borderRadius: pw.BorderRadius.circular(8)),
                    child: pw.Text('PAID', style: pw.TextStyle(color: PdfColors.green800, fontWeight: pw.FontWeight.bold)),
                  ),
                ],
              ),
              pw.SizedBox(height: 12),
              pw.Container(
                padding: const pw.EdgeInsets.all(10),
                decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.grey300), borderRadius: pw.BorderRadius.circular(8)),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('GST Registration Details', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.teal800)),
                    pw.Text('Legal Name: $_companyName'),
                    pw.Text('Trade Name: $_companyName'),
                    pw.Text('Constitution: Private Limited Company | Registration Type: Regular'),
                    pw.Text('Certificate Date: 17/04/2026'),
                  ],
                ),
              ),
              pw.SizedBox(height: 18),
              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.grey300),
                columnWidths: const {
                  0: pw.FlexColumnWidth(1.2),
                  1: pw.FlexColumnWidth(2),
                },
                children: rows.entries
                    .map(
                      (entry) => pw.TableRow(
                        children: [
                          _cell(entry.key, bold: true),
                          _cell(entry.value),
                        ],
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
        ),
      ),
    );

    final directory = await getApplicationDocumentsDirectory();
    final file = File('${directory.path}${Platform.pathSeparator}$fileName');
    await file.writeAsBytes(await pdf.save());
    return file;
  }

  pw.Widget _cell(String value, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(8),
      child: pw.Text(
        value,
        style: pw.TextStyle(fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal),
      ),
    );
  }

  String _formatDate(String value) {
    return value.split('T').first.split(' ').first;
  }
}
