import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/bill.dart';
import '../services/bill_service.dart';

final billServiceProvider = Provider((_) => BillService());
final billsProvider = FutureProvider<List<Bill>>((ref) async => ref.read(billServiceProvider).list());
