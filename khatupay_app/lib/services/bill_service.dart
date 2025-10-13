import '../core/api_client.dart';
import '../models/bill.dart';

class BillService {
  final _dio = ApiClient.client;
  Future<List<Bill>> list() async {
    final r = await _dio.get('/bills');
    return (r.data['data'] as List).map((e)=>Bill.fromJson(e)).toList();
  }
  Future<Bill> add({required String type, required String provider, required String accountRef, required num amount, required DateTime due}) async {
    final r = await _dio.post('/bills', data: {'type':type,'provider':provider,'accountRef':accountRef,'amount':amount,'dueDate': due.toIso8601String() });
    return Bill.fromJson(r.data['data']);
  }
  Future<void> markPaid(String id) async { await _dio.put('/bills/$id/pay'); }
}
