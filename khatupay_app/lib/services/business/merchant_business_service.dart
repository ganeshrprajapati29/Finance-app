import 'package:dio/dio.dart';

import '../../core/api_client.dart';
import '../../core/friendly_error.dart';
import '../../models/business/merchant_business.dart';

class MerchantBusinessService {
  final _api = ApiClient.client;

  // Provider-backed calls (bank penny drop, Razorpay onboarding, document
  // upload) take longer than the app's default 20s wait.
  static Options _wait(int seconds, {int send = 30}) => Options(
        receiveTimeout: Duration(seconds: seconds),
        sendTimeout: Duration(seconds: send),
      );

  dynamic _data(dynamic response) =>
      response.data is Map ? response.data['data'] : null;

  Map<String, dynamic> _map(dynamic response) {
    final data = _data(response);
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  List<dynamic> _list(dynamic response) {
    final data = _data(response);
    return data is List ? data : const [];
  }

  Future<MerchantDashboard> dashboard() async =>
      MerchantDashboard.fromJson(_map(await _api.get('/merchant-business/me')));

  Future<void> create(Map<String, dynamic> payload) async =>
      _api.post('/merchant-business', data: payload);

  Future<void> updateProfile(Map<String, dynamic> payload) async =>
      _api.patch('/merchant-business/me', data: payload);

  /// Clears the application so the owner can fill it again. Allowed only
  /// before the business is linked to Razorpay.
  Future<MerchantDashboard> restartApplication() async => MerchantDashboard.fromJson(
      _map(await _api.post('/merchant-business/me/restart')));

  Future<void> submitKyc(Map<String, dynamic> payload) async =>
      _api.post('/merchant-business/kyc', data: payload, options: _wait(45));

  Future<String> uploadBusinessDocument(String path) async {
    final response = await _api.post('/upload/cloudinary/business-document',
        data: FormData.fromMap({
          'file': await MultipartFile.fromFile(path),
        }),
        options: _wait(90, send: 90));
    return (_map(response)['url'] ?? '').toString();
  }

  /// Returns the saved bank row; `status` is VERIFIED, or REVIEW when the
  /// verification provider is unavailable and KhatuPay will verify it.
  Future<Map<String, dynamic>> submitBank(Map<String, dynamic> payload) async =>
      _map(await _api.post('/merchant-business/bank-account',
          data: payload, options: _wait(45)));

  /// Submits business details. `queued: true` means the application is saved
  /// and KhatuPay will activate payments - it is not an error.
  Future<Map<String, dynamic>> submitRazorpayOnboarding(
          Map<String, dynamic> payload) async =>
      _map(await _api.post('/merchant-business/razorpay/onboard',
          data: payload, options: _wait(75)));

  Future<Map<String, dynamic>> syncRazorpayOnboarding() async =>
      _map(await _api.post('/merchant-business/razorpay/sync',
          options: _wait(75)));

  Future<Map<String, dynamic>> updateRazorpayProduct(
          Map<String, dynamic> payload) async =>
      _map(await _api.patch('/merchant-business/razorpay/product',
          data: payload, options: _wait(60)));

  Future<int> submitRazorpayDocuments(
      List<Map<String, dynamic>> documents) async {
    final response = await _api.post('/merchant-business/razorpay/documents',
        data: {'documents': documents}, options: _wait(90));
    return (_map(response)['uploaded'] as num?)?.toInt() ?? 0;
  }

  Future<Map<String, dynamic>> razorpayTerms() async =>
      _map(await _api.get('/merchant-business/razorpay/terms',
          options: _wait(30)));

  Future<String> startRazorpayOAuth() async {
    final response = await _api.post('/merchant-business/razorpay/oauth/start');
    return (_map(response)['authorizationUrl'] ?? '').toString();
  }

  Future<Map<String, dynamic>> createQr() async {
    try {
      return _map(await _api.post('/merchant-qr', options: _wait(45)));
    } catch (error) {
      throw friendlyErrorMessage(error,
          fallback: 'Business QR could not be generated. Please try again.');
    }
  }

  Future<int> syncQrPayments() async {
    final response =
        await _api.post('/merchant-qr/sync-payments', options: _wait(45));
    return (_map(response)['synced'] as num?)?.toInt() ?? 0;
  }

  Future<void> closeQr() async => _api.post('/merchant-qr/close');

  Future<int> syncSettlements() async {
    final response =
        await _api.post('/merchant-settlements/sync', options: _wait(45));
    return (_map(response)['synced'] as num?)?.toInt() ?? 0;
  }

  Future<List<MerchantPayment>> payments() async {
    final rows = _list(await _api.get('/merchant-payments'));
    return rows
        .whereType<Map>()
        .map((e) => MerchantPayment.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Map<String, dynamic>> summary() async =>
      _map(await _api.get('/merchant-payments/summary'));

  Future<List<MerchantSettlement>> settlements() async {
    final rows = _list(await _api.get('/merchant-settlements'));
    return rows
        .whereType<Map>()
        .map((e) => MerchantSettlement.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> requestSettlement(num amount) async =>
      _api.post('/merchant-settlements/request', data: {'amount': amount});
}
