import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/loan.dart';
import '../services/loan_service.dart';

final loanServiceProvider = Provider((_) => LoanService());
final myLoansProvider = FutureProvider<List<Loan>>((ref) async => ref.read(loanServiceProvider).myLoans());
