import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/faq_providers.dart';

class FAQPage extends ConsumerWidget { const FAQPage({super.key});
  @override Widget build(BuildContext context, WidgetRef ref){
    final faqs = ref.watch(faqsProvider);
    return Scaffold(appBar: AppBar(title: const Text('FAQs')),
      body: faqs.when(
        data: (list)=> ListView(children: list.map((f)=> ExpansionTile(title: Text(f.question), children:[Padding(padding: const EdgeInsets.all(12), child: Text(f.answer))])).toList()),
        loading: ()=> const Center(child:CircularProgressIndicator()),
        error: (e,_)=> Center(child: Text('Error: $e'))
      ),
    );
  }
}
