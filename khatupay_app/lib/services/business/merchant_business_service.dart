import '../../core/api_client.dart';
import '../../models/business/merchant_business.dart';

class MerchantBusinessService {
  final _api = ApiClient.client;
  dynamic _data(dynamic response) => response.data is Map ? response.data['data'] : null;
  Future<MerchantDashboard> dashboard() async => MerchantDashboard.fromJson(Map<String, dynamic>.from(_data(await _api.get('/merchant-business/me')) ?? {}));
  Future<void> create(Map<String, dynamic> payload) async => _api.post('/merchant-business', data: payload);
  Future<void> submitKyc(Map<String, dynamic> payload) async => _api.post('/merchant-business/kyc', data: payload);
  Future<void> submitBank(Map<String, dynamic> payload) async => _api.post('/merchant-business/bank-account', data: payload);
  Future<Map<String, dynamic>> createQr() async => Map<String, dynamic>.from(_data(await _api.post('/merchant-qr')) ?? {});
  Future<List<MerchantPayment>> payments() async {
    final rows = _data(await _api.get('/merchant-payments')) as List? ?? const [];
    return rows.whereType<Map>().map((e) => MerchantPayment.fromJson(Map<String, dynamic>.from(e))).toList();
  }
  Future<Map<String, dynamic>> summary() async => Map<String, dynamic>.from(_data(await _api.get('/merchant-payments/summary')) ?? {});
  Future<List<MerchantSettlement>> settlements() async {
    final rows = _data(await _api.get('/merchant-settlements')) as List? ?? const [];
    return rows.whereType<Map>().map((e) => MerchantSettlement.fromJson(Map<String, dynamic>.from(e))).toList();
  }
  Future<void> requestSettlement(num amount) async => _api.post('/merchant-settlements/request', data: {'amount': amount});
}
