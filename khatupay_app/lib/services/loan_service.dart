import '../core/api_client.dart';
import '../models/loan.dart';
import '../models/loan_application.dart';

class LoanService {
  final _dio = ApiClient.client;

  // ✳️ old simple apply kept (optional)
  Future<String> apply(num amount, int tenureMonths, {String? purpose, List<String>? docs}) async {
    final r = await _dio.post('/loans', data: {
      'amountRequested': amount,
      'tenureMonths': tenureMonths,
      'purpose': purpose,
      'docs': docs ?? []
    });
    return r.data['data']['loanId'].toString();
  }

  // ✅ new full payload apply (wizard)
  Future<String> applyDraft(LoanApplicationDraft draft) async {
    final r = await _dio.post('/loans', data: draft.toJson());
    return r.data['data']['loanId'].toString();
  }

  Future<List<Loan>> myLoans() async {
    final r = await _dio.get('/loans');
    return (r.data['data'] as List).map((e)=>Loan.fromJson(e)).toList();
  }

  Future<Loan> detail(String id) async {
    final r = await _dio.get('/loans/$id');
    return Loan.fromJson(r.data['data']);
  }
}
