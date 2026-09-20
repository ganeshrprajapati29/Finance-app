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

String _clean(String message) {
  final trimmed = message.replaceFirst(RegExp(r'^Exception:\s*'), '').trim();
  final lower = trimmed.toLowerCase();
  if (lower.contains('clubapi') ||
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
