import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/business/merchant_business.dart';
import '../../services/business/merchant_business_service.dart';

final merchantServiceProvider = Provider((_) => MerchantBusinessService());
final merchantDashboardProvider = FutureProvider<MerchantDashboard>((ref) => ref.read(merchantServiceProvider).dashboard());
final merchantPaymentsProvider = FutureProvider<List<MerchantPayment>>((ref) => ref.read(merchantServiceProvider).payments());
final merchantBalanceProvider = FutureProvider<Map<String, dynamic>>((ref) => ref.read(merchantServiceProvider).summary());
final merchantSettlementsProvider = FutureProvider<List<MerchantSettlement>>((ref) => ref.read(merchantServiceProvider).settlements());
