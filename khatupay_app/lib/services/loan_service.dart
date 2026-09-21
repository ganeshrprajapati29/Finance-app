import 'dart:convert';

import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../models/loan.dart';
import '../models/loan_application.dart';

class LoanService {
  final _dio = ApiClient.client;

  Future<Map<String, dynamic>> verificationStatus() async {
    final r = await _dio.get('/loan-verification/me');
    return _dataOf(r.data);
  }

  Future<void> acceptVerificationConsent() async {
    await _dio.post('/loan-verification/consent', data: {
      'accepted': true,
      'version': '2026-09',
    });
  }

  Future<Map<String, dynamic>> verifyPanWithSignCare({
    required String pan,
    required String name,
    String dob = '',
  }) async {
    final r = await _dio.post('/loan-verification/pan', data: {
      'pan': pan,
      'name': name,
      if (dob.isNotEmpty) 'dob': dob,
    });
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> startAadhaarOvse(
      {String channel = 'web'}) async {
    final r = await _dio
        .post('/loan-verification/aadhaar/init', data: {'channel': channel});
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> aadhaarOvseResult(String txnId) async {
    final r = await _dio.get('/loan-verification/aadhaar/result/$txnId');
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> verifyLiveness(String imageBase64) async {
    final r = await _dio.post('/loan-verification/liveness',
        data: {'imageBase64': imageBase64});
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> verifyFaceMatch(
      {required String selfieBase64, String? identityPhotoBase64}) async {
    final r = await _dio.post('/loan-verification/face-match', data: {
      'selfieBase64': selfieBase64,
      if (identityPhotoBase64 != null)
        'identityPhotoBase64': identityPhotoBase64,
    });
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> verifyBankWithSignCare(
      {required String accountNumber, required String ifsc}) async {
    final r = await _dio.post('/loan-verification/bank',
        data: {'accountNumber': accountNumber, 'ifsc': ifsc});
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> fetchExperian() async {
    final r = await _dio.post('/loan-verification/credit-report');
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> analyseBankStatement({
    required String filePath,
    String password = '',
    String accountType = 'SALARIED',
  }) async {
    final form = FormData.fromMap({
      'statement': await MultipartFile.fromFile(filePath,
          filename: 'bank_statement.pdf'),
      'password': password,
      'accountType': accountType,
    });
    final r = await _dio.post('/loan-verification/bank-statement/analyse',
        data: form);
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> bankStatementAnalysisStatus(
      String orderId) async {
    final r = await _dio.post('/loan-verification/bank-statement/status',
        data: {'orderId': orderId});
    return _dataOf(r.data);
  }

  // Old simple apply kept for compatibility.
  Future<String> apply(num amount, int tenureMonths,
      {String? purpose, List<String>? docs}) async {
    try {
      final r = await _dio.post('/loans', data: {
        'amountRequested': amount,
        'tenureMonths': tenureMonths,
        'purpose': purpose,
        'docs': docs ?? []
      });
      return _requireLoanId(r.data);
    } on DioException catch (e) {
      throw Exception(_friendlyError(e, fallback: 'Loan application failed'));
    }
  }

  // Full wizard apply with document image upload.
  Future<String> applyDraft(LoanApplicationDraft draft) async {
    try {
      final files = <MapEntry<String, MultipartFile>>[];

      Future<void> addDocument(String path, String filename) async {
        final cleanedPath = path.trim();
        if (cleanedPath.isEmpty) return;
        files.add(MapEntry(
          'files',
          await MultipartFile.fromFile(cleanedPath, filename: filename),
        ));
      }

      await addDocument(draft.aadhaarFrontPath, 'aadhaar_front.jpg');
      await addDocument(draft.aadhaarBackPath, 'aadhaar_back.jpg');
      await addDocument(draft.panPath, 'pan_card.jpg');
      await addDocument(draft.selfiePath, 'selfie.jpg');
      if (draft.incomeProofPath.trim().isNotEmpty) {
        final ext = draft.incomeProofPath.contains('.')
            ? draft.incomeProofPath.split('.').last.toLowerCase()
            : 'pdf';
        await addDocument(draft.incomeProofPath, 'income_proof.$ext');
      }

      Response<dynamic> r;
      if (files.isEmpty) {
        r = await _dio.post('/loans', data: draft.toJson());
      } else {
        final form = FormData()
          ..fields.add(MapEntry('payload', jsonEncode(draft.toJson())))
          ..files.addAll(files);

        r = await _dio.post('/loans', data: form);
      }
      return _requireLoanId(r.data);
    } on DioException catch (e) {
      throw Exception(_friendlyError(e, fallback: 'Loan application failed'));
    }
  }

  /// Pulls the loan id out of the standard envelope without assuming any part
  /// of the shape exists. A 2xx with an unexpected body is treated as a
  /// failure rather than crashing on a null subscript.
  String _requireLoanId(dynamic body) {
    final data = _dataOf(body);
    final id = (data['loanId'] ?? data['_id'] ?? data['id'])?.toString().trim();
    if (id == null || id.isEmpty) {
      throw Exception(
        'Your application was sent but we could not read the reference number. '
        'Please check My Loans before applying again.',
      );
    }
    return id;
  }

  Map<String, dynamic> _dataOf(dynamic body) {
    if (body is Map && body['data'] is Map) {
      return Map<String, dynamic>.from(body['data'] as Map);
    }
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> eligibility() async {
    final r = await _dio.get('/loans/eligibility/status');
    return _dataOf(r.data);
  }

  Future<List<Loan>> myLoans() async {
    final r = await _dio.get('/loans');
    final rows = r.data is Map ? r.data['data'] : null;
    if (rows is! List) return const [];
    return rows
        .whereType<Map>()
        .map((e) => Loan.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Loan> detail(String id) async {
    final r = await _dio.get('/loans/$id');
    final data = r.data is Map ? r.data['data'] : null;
    if (data is! Map) {
      throw Exception('This loan could not be loaded. Please try again.');
    }
    return Loan.fromJson(Map<String, dynamic>.from(data));
  }

  Future<List<Map<String, dynamic>>> repaymentHistory(String loanId) async {
    final r = await _dio.get('/repayments/$loanId');
    final rows = r.data is Map ? r.data['data'] : null;
    if (rows is! List) return const [];
    return rows
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// Prefers the server's own `message` (the backend already writes these for
  /// users) and falls back to a generic sentence - never the raw Dio text.
  String _friendlyError(DioException e, {required String fallback}) {
    final data = e.response?.data;
    if (data is Map) {
      final message = data['message'];
      if (message != null && message.toString().trim().isNotEmpty) {
        return message.toString().trim();
      }
    }
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'The request timed out. Please check your connection and try again.';
      case DioExceptionType.connectionError:
        return 'Please check your internet connection and try again.';
      default:
        return fallback;
    }
  }
}
