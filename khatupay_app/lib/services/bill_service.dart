import '../core/api_client.dart';
import '../models/bill.dart';

class BillService {
  final _dio = ApiClient.client;

  Future<List<Bill>> list() async {
    final response = await _dio.get('/bills');
    return (response.data['data'] as List)
        .map((item) => Bill.fromJson(item))
        .toList();
  }

  Future<Bill> add({
    required String type,
    required String provider,
    required String accountRef,
    required num amount,
    required DateTime due,
    String? notes,
  }) async {
    final response = await _dio.post('/bills', data: {
      'type': type,
      'provider': provider,
      'accountRef': accountRef,
      'amount': amount,
      'dueDate': due.toIso8601String(),
      'notes': notes,
    });
    return Bill.fromJson(response.data['data']);
  }

  Future<void> markPaid(String id) async {
    await _dio.put('/bills/$id/pay');
  }
}
