import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/bill.dart';
import '../services/bill_service.dart';

final billServiceProvider = Provider((_) => BillService());

class BillsNotifier extends StateNotifier<AsyncValue<List<Bill>>> {
  BillsNotifier(this.ref) : super(const AsyncValue.loading()) {
    fetch();
  }

  final Ref ref;

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final bills = await ref.read(billServiceProvider).list();
      state = AsyncValue.data(bills);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  Future<void> refresh() => fetch();
}

final billsProvider = StateNotifierProvider<BillsNotifier, AsyncValue<List<Bill>>>((ref) => BillsNotifier(ref));
