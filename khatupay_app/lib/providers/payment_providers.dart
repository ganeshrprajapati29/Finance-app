import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/payment_service.dart';
final paymentServiceProvider = Provider((_) => PaymentService());
