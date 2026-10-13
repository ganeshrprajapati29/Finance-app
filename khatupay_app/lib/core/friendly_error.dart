import 'package:dio/dio.dart';

/// Turns any caught error into a short, user-friendly message.
///
/// Server error payloads (`{message, error, resText}`) are preferred when
/// present. Raw technical exception types (DioException, SocketException,
/// TimeoutException, etc.) are mapped to a generic English sentence instead
/// of being shown verbatim, so users never see stack-trace-shaped text like
/// "DioException [connection error]: ...".
String friendlyErrorMessage(
  Object error, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map) {
      final code = data['code']?.toString().trim();
      final serverMessage = _serverMessage(data);
      // The server's own text is specific (which step is missing, what to fix)
      // and already written for customers, so it beats the generic fallback.
      if (_serverMessageFirst.contains(code) && serverMessage != null) {
        return serverMessage;
      }
      final byCode = _messageForCode(code);
      if (byCode != null) return byCode;
      if (serverMessage != null) return serverMessage;
    }
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'The service is responding slowly. Please try again in a moment.';
      case DioExceptionType.connectionError:
        return 'Please check your internet connection and try again.';
      default:
        return fallback;
    }
  }

  final text = _clean(error.toString());
  if (text.isEmpty) return fallback;
  final lower = text.toLowerCase();
  if (lower.contains('dioexception') ||
      lower.contains('socketexception') ||
      lower.contains('timeoutexception') ||
      lower.contains('handshakeexception') ||
      lower.contains('formatexception')) {
    return 'The service is unavailable right now. Please try again in a moment.';
  }
  return text;
}

const _serverMessageFirst = {
  'BANK_VERIFICATION_FAILED',
  'BANK_VERIFICATION_TEMPORARY',
  'SIGNCARE_VERIFICATION_REQUIRED',
  'SIGNCARE_REQUEST_FAILED',
  'CREDIT_PROFILE_INCOMPLETE',
  'CREDIT_REPORT_IN_PROGRESS',
  'BANK_STATEMENT_REJECTED',
  'EMAIL_REQUIRED',
  'NAME_REQUIRED',
  'AGREEMENT_BUSY',
  'ESIGN_START_FAILED',
  'ESIGN_NOT_STARTED',
  'AGREEMENT_UNAVAILABLE',
  'AGREEMENT_CHANGED',
  'ACTIVE_LOAN_EXISTS',
  'APPLICATION_IN_PROGRESS',
};

String? _messageForCode(String? code) {
  switch (code) {
    case 'EMAIL_REQUIRED':
      return 'Add a valid email address in your profile before signing the agreement.';
    case 'AGREEMENT_BUSY':
      return 'Your signing page is being prepared. Please wait a few seconds and try again.';
    case 'ESIGN_START_FAILED':
      return 'The signing page could not be created. Please try again in a moment.';
    case 'APPLICATION_IN_PROGRESS':
      return 'Your application is already being submitted. Please wait a moment.';
    case 'BANK_STATEMENT_REJECTED':
      return 'This bank statement could not be analysed. Check the PDF and password and upload it again.';
    case 'CONSENT_REQUIRED':
      return 'Please accept verification consent to continue.';
    case 'IDENTITY_PHOTO_REQUIRED':
      return 'Please complete Aadhaar/DigiLocker verification before face match.';
    case 'BANK_VERIFICATION_FAILED':
      return 'Bank account could not be verified. Please check the account number and IFSC.';
    case 'BANK_VERIFICATION_TEMPORARY':
      return 'Bank verification is busy right now. Please try again in a few minutes.';
    case 'UPI_VERIFICATION_FAILED':
      return 'UPI ID could not be verified. Please check the UPI ID and try again.';
    case 'SIGNCARE_VERIFICATION_REQUIRED':
      return 'Please complete all required verification steps before submitting.';
    case 'BANK_STATEMENT_ANALYSIS_REQUIRED':
      return 'Please complete bank statement analysis before submitting.';
    case 'CREDIT_REPORT_REVIEW_REQUIRED':
      return 'Credit report could not be verified automatically. Please try again or contact support.';
    case 'SIGNCARE_REQUEST_FAILED':
      return 'Verification service is temporarily unavailable. Please try again in a moment.';
    case 'APPROVAL_REQUIRED':
      return 'Business approval is required before generating a QR.';
    case 'KYC_REQUIRED':
      return 'Business KYC is required before approval.';
    case 'BANK_VERIFICATION_REQUIRED':
      return 'Verify your settlement bank account before generating a QR.';
    case 'BUSINESS_QR_DETAILS_MISSING':
      return 'Business QR details are incomplete. Please refresh and try again.';
    case 'DUPLICATE_ENTRY':
      return 'This business QR is already active. Please refresh the page.';
    default:
      return null;
  }
}

String? _serverMessage(Map data) {
  for (final key in ['message', 'error', 'resText']) {
    final value = data[key];
    if (value != null && value.toString().trim().isNotEmpty) {
      return _clean(value.toString());
    }
  }
  final nested = data['data'];
  if (nested is Map) {
    for (final key in ['message', 'error', 'resText', 'statusMessage']) {
      final value = nested[key];
      if (value != null && value.toString().trim().isNotEmpty) {
        return _clean(value.toString());
      }
    }
  }
  return null;
}

String _clean(String message) {
  final trimmed = message.replaceFirst(RegExp(r'^Exception:\s*'), '').trim();
  final lower = trimmed.toLowerCase();
  if (lower.contains('route not found') ||
      lower.contains('not_found') ||
      lower.contains('clubapi') ||
      lower.contains('decentro') ||
      lower.contains('razorpay') ||
      lower.contains('firebase') ||
      lower.contains('mongo') ||
      lower.contains('socket') ||
      lower.contains('xmlhttprequest') ||
      lower.contains('status code') ||
      lower.contains('http status') ||
      lower.contains('java.io') ||
      lower.contains('service not available')) {
    return 'Service is temporarily unavailable. Please try again in a moment.';
  }
  return trimmed;
}
