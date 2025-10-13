import '../core/api_client.dart';
import '../models/ticket.dart';

class SupportService {
  final _dio = ApiClient.client;
  Future<void> create(String subject, String message) async {
    await _dio.post('/support', data:{'subject':subject, 'message':message});
  }
  Future<List<Ticket>> myTickets() async {
    final r = await _dio.get('/support/me');
    return (r.data['data'] as List).map((e)=>Ticket.fromJson(e)).toList();
  }
}
