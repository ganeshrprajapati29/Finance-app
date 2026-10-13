import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../models/loan.dart';
import '../models/loan_application.dart';

/// A loan submit that the server refused, with the verification stages (if
/// any) the customer still has to finish, so the wizard can jump to them.
class LoanSubmitException implements Exception {
  LoanSubmitException(this.message, {this.code, this.stages = const []});

  final String message;
  final String? code;
  final List<String> stages;

  @override
  String toString() => message;
}

/// Per-endpoint waits. Each is a little longer than the server's own provider
/// budget (backend/src/services/signcare.js SIGNCARE_TIMEOUTS), so the app
/// hears the server's real answer instead of giving up first.
class _LoanTimeouts {
  static const pan = Duration(seconds: 50);
  static const digilocker = Duration(seconds: 50);
  static const face = Duration(seconds: 45);
  static const bank = Duration(seconds: 45);
  static const upi = Duration(seconds: 35);
  static const statementUpload = Duration(seconds: 70);
  static const statementStatus = Duration(seconds: 45);
  static const credit = Duration(seconds: 75);
  static const submit = Duration(seconds: 90);
  static const agreementSign = Duration(seconds: 60);
  static const agreementStatus = Duration(seconds: 45);
}

class LoanService {
  final _dio = ApiClient.client;

  static Options _wait(Duration receive, {Duration send = const Duration(seconds: 30)}) =>
      Options(receiveTimeout: receive, sendTimeout: send);

  /// A random key that identifies one application draft. The server returns
  /// the same loan for every submit that carries it.
  static String newIdempotencyKey() {
    final random = Random.secure();
    return List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  }

  static bool isTransportFailure(Object error) =>
      error is DioException &&
      error.response == null &&
      (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout ||
          error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.unknown);

  Future<Map<String, dynamic>> verificationStatus() async {
    final r = await _dio.get('/loan-verification/me');
    return _dataOf(r.data);
  }

  /// The server keeps working after the app stops waiting. When a request is
  /// lost in transit, read the stage back instead of guessing its result.
  Future<Map<String, dynamic>?> recoverStage(String stage) async {
    try {
      final status = await verificationStatus();
      final stages = status['stages'];
      if (stages is Map && stages[stage] is Map) {
        final value = Map<String, dynamic>.from(stages[stage] as Map);
        if ((value['status'] ?? 'NOT_STARTED') == 'NOT_STARTED') return null;
        if (value['status'] == 'PENDING') {
          value['message'] =
              'Verification is still running. Please check again in a moment.';
        }
        return value;
      }
    } catch (_) {
      // Report the original failure instead.
    }
    return null;
  }

  Future<Map<String, dynamic>> _withStageRecovery(
      String stage, Future<Response<dynamic>> Function() request) async {
    try {
      final r = await request();
      return _dataOf(r.data);
    } on DioException catch (error) {
      if (!isTransportFailure(error)) rethrow;
      final recovered = await recoverStage(stage);
      if (recovered == null) rethrow;
      return recovered;
    }
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
  }) =>
      _withStageRecovery(
        'pan',
        () => _dio.post('/loan-verification/pan', data: {
          'pan': pan,
          'name': name,
          if (dob.isNotEmpty) 'dob': dob,
        }, options: _wait(_LoanTimeouts.pan)),
      );

  Future<Map<String, dynamic>> startAadhaarOvse(
      {String channel = 'web'}) async {
    final r = await _dio.post('/loan-verification/aadhaar/init',
        data: {'channel': channel}, options: _wait(_LoanTimeouts.digilocker));
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> aadhaarOvseResult(String txnId) async {
    final r = await _dio.get('/loan-verification/aadhaar/result/$txnId',
        options: _wait(_LoanTimeouts.digilocker));
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> verifyLiveness(String imageBase64) =>
      _withStageRecovery(
        'liveness',
        () => _dio.post('/loan-verification/liveness',
            data: {'imageBase64': imageBase64},
            options: _wait(_LoanTimeouts.face, send: const Duration(seconds: 45))),
      );

  Future<Map<String, dynamic>> verifyFaceMatch(
          {required String selfieBase64, String? identityPhotoBase64}) =>
      _withStageRecovery(
        'faceMatch',
        () => _dio.post('/loan-verification/face-match', data: {
          'selfieBase64': selfieBase64,
          if (identityPhotoBase64 != null)
            'identityPhotoBase64': identityPhotoBase64,
        }, options: _wait(_LoanTimeouts.face, send: const Duration(seconds: 45))),
      );

  /// Penny drop with SignCare (ClubAPI fallback on the server). The server
  /// already turns provider outages into REVIEW, so the app never invents one.
  Future<Map<String, dynamic>> verifyBankWithSignCare(
          {required String accountNumber, required String ifsc}) =>
      _withStageRecovery(
        'bank',
        () => _dio.post(
          '/loan-verification/bank',
          data: {'accountNumber': accountNumber, 'ifsc': ifsc},
          options: _wait(_LoanTimeouts.bank),
        ),
      );

  Future<Map<String, dynamic>> verifyUpiWithSignCare(String upiId) =>
      _withStageRecovery(
        'upi',
        () => _dio.post('/loan-verification/upi',
            data: {'upiId': upiId}, options: _wait(_LoanTimeouts.upi)),
      );

  /// Pulls the Experian report. The bureau round-trip is slow (the server allows
  /// itself 50s), so the default 20s client timeout would abandon a call that
  /// has already been billed. The server reuses a recent report for the same
  /// identity, so calling this again is safe and free.
  Future<Map<String, dynamic>> fetchExperian() => _withStageRecovery(
        'credit',
        () => _dio.post('/loan-verification/credit-report',
            options: _wait(_LoanTimeouts.credit)),
      );

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
    return _withStageRecovery(
      'bankStatement',
      () => _dio.post('/loan-verification/bank-statement/analyse',
          data: form,
          options: _wait(_LoanTimeouts.statementUpload,
              send: const Duration(seconds: 90))),
    );
  }

  Future<Map<String, dynamic>> bankStatementAnalysisStatus(
      String orderId) async {
    final r = await _dio.post('/loan-verification/bank-statement/status',
        data: {'orderId': orderId}, options: _wait(_LoanTimeouts.statementStatus));
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
  //
  // Every attempt carries the draft's Idempotency-Key, so a retry after a
  // dropped connection returns the loan the first attempt created instead of
  // a duplicate application.
  Future<String> applyDraft(LoanApplicationDraft draft) async {
    if (draft.idempotencyKey.isEmpty) {
      draft.idempotencyKey = newIdempotencyKey();
    }
    final documents = <MapEntry<String, String>>[];
    void addDocument(String path, String filename) {
      final cleanedPath = path.trim();
      if (cleanedPath.isEmpty || !File(cleanedPath).existsSync()) return;
      documents.add(MapEntry(cleanedPath, filename));
    }

    addDocument(draft.aadhaarFrontPath, 'aadhaar_front.jpg');
    addDocument(draft.aadhaarBackPath, 'aadhaar_back.jpg');
    addDocument(draft.panPath, 'pan_card.jpg');
    addDocument(draft.selfiePath, 'selfie.jpg');
    if (draft.incomeProofPath.trim().isNotEmpty) {
      final ext = draft.incomeProofPath.contains('.')
          ? draft.incomeProofPath.split('.').last.toLowerCase()
          : 'pdf';
      addDocument(draft.incomeProofPath, 'income_proof.$ext');
    }

    final options = Options(
      receiveTimeout: _LoanTimeouts.submit,
      sendTimeout: const Duration(seconds: 60),
      headers: {'Idempotency-Key': draft.idempotencyKey},
    );

    // A MultipartFile can be sent only once, so each attempt builds its form.
    Future<Response<dynamic>> send(bool withFiles) async {
      if (!withFiles || documents.isEmpty) {
        return _dio.post('/loans', data: draft.toJson(), options: options);
      }
      final form = FormData()
        ..fields.add(MapEntry('payload', jsonEncode(draft.toJson())));
      for (final document in documents) {
        form.files.add(MapEntry(
          'files',
          await MultipartFile.fromFile(document.key, filename: document.value),
        ));
      }
      return _dio.post('/loans', data: form, options: options);
    }

    var withFiles = documents.isNotEmpty;
    DioException? lastError;
    for (var attempt = 0; attempt < 4; attempt++) {
      try {
        final r = await send(withFiles);
        return _requireLoanId(r.data);
      } on DioException catch (e) {
        lastError = e;
        final status = e.response?.statusCode;
        final code = _codeOf(e);
        if (code == 'APPLICATION_IN_PROGRESS') {
          // The first tap is still being processed; wait for its result.
          await Future<void>.delayed(const Duration(seconds: 3));
          continue;
        }
        if (isTransportFailure(e) || (status != null && status >= 500)) {
          await Future<void>.delayed(Duration(seconds: 2 + attempt * 2));
          continue;
        }
        // Some proxies or Android network stacks reject multipart uploads
        // before Express reaches the loan route. Documents are optional, so
        // resend the same application as JSON.
        if (withFiles && (status == 413 || status == 415)) {
          withFiles = false;
          continue;
        }
        throw _submitException(e);
      }
    }
    if (lastError != null && _codeOf(lastError) == 'APPLICATION_IN_PROGRESS') {
      throw LoanSubmitException(
        'Your application is still being processed. Please check My Loans in a minute.',
        code: 'APPLICATION_IN_PROGRESS',
      );
    }
    throw LoanSubmitException(
      'We could not confirm your application because the network is unstable. Please check My Loans before applying again.',
      code: 'SUBMIT_UNCONFIRMED',
    );
  }

  String? _codeOf(DioException e) {
    final data = e.response?.data;
    return data is Map ? data['code']?.toString() : null;
  }

  LoanSubmitException _submitException(DioException e) {
    final data = e.response?.data;
    final payload = data is Map ? data['data'] : null;
    final stages = payload is Map && payload['stages'] is List
        ? (payload['stages'] as List).map((stage) => stage.toString()).toList()
        : const <String>[];
    return LoanSubmitException(
      _friendlyError(e, fallback: 'Loan application failed. Please review your details and try again.'),
      code: _codeOf(e),
      stages: stages,
    );
  }

  /// Pulls the loan id out of the standard envelope without assuming any part
  /// of the shape exists. A 2xx with an unexpected body is treated as a
  /// failure rather than crashing on a null subscript.
  String _requireLoanId(dynamic body) {
    final data = _dataOf(body);
    final id = (data['applicationId'] ??
        data['loanAccountNumber'] ??
        data['loanId'] ??
        data['_id'] ??
        data['id'])
      ?.toString()
      .trim();
    if (id == null || id.isEmpty) {
      throw LoanSubmitException(
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

  /// The server caps each SignCare DigiLocker call at 20s with one retry, so
  /// 60s is enough for a real answer without leaving the user on a spinner.
  Future<Map<String, dynamic>> startDigiLocker() async {
    final r = await _dio.post(
      '/loan-verification/digilocker/init',
      options: Options(
        receiveTimeout: _LoanTimeouts.digilocker,
        sendTimeout: const Duration(seconds: 30),
      ),
    );
    return _dataOf(r.data);
  }

  Future<Map<String, dynamic>> digilockerResult(String transactionId) async {
    final r = await _dio.get(
      '/loan-verification/digilocker/result/${Uri.encodeComponent(transactionId)}',
      options: Options(
        receiveTimeout: _LoanTimeouts.digilocker,
        sendTimeout: const Duration(seconds: 30),
      ),
    );
    return _dataOf(r.data);
  }

  /// DigiLocker hands the eAadhaar to SignCare a few seconds after the user
  /// finishes consent, so the first check right after the WebView closes is
  /// often still pending. Re-check briefly before telling the user to retry.
  Future<Map<String, dynamic>> digilockerResultAfterConsent(
      String transactionId) async {
    var result = await digilockerResult(transactionId);
    for (var attempt = 0;
        attempt < 3 && result['status'] != 'VERIFIED';
        attempt++) {
      await Future<void>.delayed(const Duration(seconds: 3));
      result = await digilockerResult(transactionId);
    }
    return result;
  }

  Future<Map<String, dynamic>> agreement(String loanId) async {
    try {
      final r = await _dio.get('/loans/$loanId/agreement');
      return _dataOf(r.data);
    } on DioException catch (e) {
      throw Exception(_friendlyError(e,
          fallback: 'Agreement details could not be loaded.'));
    }
  }

  /// Creates (or resumes) the Aadhaar eSign session. The server reuses a
  /// still-valid signing link, so tapping again never creates a second one.
  Future<Map<String, dynamic>> startAgreementSigning(String loanId) async {
    try {
      final r = await _dio.post('/loans/$loanId/agreement/sign',
          data: {'accepted': true}, options: _wait(_LoanTimeouts.agreementSign));
      return _dataOf(r.data);
    } on DioException catch (e) {
      throw Exception(
          _friendlyError(e, fallback: 'Secure signing could not be started.'));
    }
  }

  Future<Map<String, dynamic>> refreshAgreementStatus(String loanId) async {
    try {
      final r = await _dio.post('/loans/$loanId/agreement/status',
          options: _wait(_LoanTimeouts.agreementStatus));
      return _dataOf(r.data);
    } on DioException catch (e) {
      throw Exception(_friendlyError(e,
          fallback: 'Signing status could not be refreshed.'));
    }
  }

  /// SignCare needs a few seconds after the signer finishes before it reports
  /// the document as signed, so check a few times before giving up.
  Future<Map<String, dynamic>> agreementStatusAfterSigning(String loanId) async {
    var result = await refreshAgreementStatus(loanId);
    for (var attempt = 0;
        attempt < 3 && result['status'] != 'SIGNED';
        attempt++) {
      await Future<void>.delayed(const Duration(seconds: 3));
      result = await refreshAgreementStatus(loanId);
    }
    return result;
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
