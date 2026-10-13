import '../core/api_client.dart';
import '../models/ticket.dart';

class SupportService {
  final _dio = ApiClient.client;

  Future<void> create(String subject, String message) async {
    await _dio.post('/support', data: {'subject': subject, 'message': message});
  }

  Future<List<Ticket>> myTickets() async {
    final r = await _dio.get('/support/me');
    final body = r.data;
    final rows = body is Map && body['data'] is List ? body['data'] as List : const [];
    return rows
        .whereType<Map>()
        .map((e) => Ticket.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
