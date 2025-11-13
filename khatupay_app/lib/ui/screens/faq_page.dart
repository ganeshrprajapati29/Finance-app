import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/faq_providers.dart';
import '../../routes/app_router.dart';

class FAQPage extends ConsumerWidget {
  const FAQPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final faqs = ref.watch(faqsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('FAQs'),
        leading: IconButton(
          icon: const Icon(Icons.home),
          onPressed: () => router.go('/'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(faqsProvider),
        child: faqs.when(
          data: (list) => list.isEmpty
            ? const Center(child: Text('No FAQs available'))
            : ListView(
                children: list
                    .map((f) => Card(
                          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          child: ExpansionTile(
                            title: Text(f.question, style: const TextStyle(fontWeight: FontWeight.bold)),
                            children: [
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Text(f.answer),
                              )
                            ],
                          ),
                        ))
                    .toList(),
              ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Error: $e')),
        ),
      ),
    );
  }
}
