import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/faq.dart';
import '../services/faq_service.dart';

final faqServiceProvider = Provider((_) => FAQService());
final faqsProvider = FutureProvider<List<FAQ>>((ref) async => ref.read(faqServiceProvider).list());
