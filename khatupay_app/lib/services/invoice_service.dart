import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../core/api_client.dart';

class InvoiceService {
  final Dio _dio = ApiClient.client;

  Future<Map<String, dynamic>> invoiceForPayment(String paymentId) async {
    final response = await _dio.get('/invoices/payment/$paymentId');
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<File> downloadInvoicePdf(String invoiceId, {String? invoiceNumber}) async {
    final response = await _dio.get<List<int>>(
      '/invoices/$invoiceId/pdf',
      options: Options(responseType: ResponseType.bytes),
    );
    final dir = await getApplicationDocumentsDirectory();
    final safeName = (invoiceNumber == null || invoiceNumber.isEmpty ? invoiceId : invoiceNumber).replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    final file = File('${dir.path}${Platform.pathSeparator}$safeName.pdf');
    await file.writeAsBytes(response.data ?? const []);
    return file;
  }

  Future<File> downloadClubApiInvoicePdf(String urid) async {
    final response = await _dio.get<List<int>>(
      '/invoices/clubapi/$urid/pdf',
      options: Options(responseType: ResponseType.bytes),
    );
    final dir = await getApplicationDocumentsDirectory();
    final safeName = urid.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    final file = File('${dir.path}${Platform.pathSeparator}clubapi_invoice_$safeName.pdf');
    await file.writeAsBytes(response.data ?? const []);
    return file;
  }
}
