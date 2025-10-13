import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/loan_providers.dart';
import '../../routes/app_router.dart';

class LoansPage extends ConsumerWidget { const LoansPage({super.key});
  @override Widget build(BuildContext context, WidgetRef ref){
    final loans = ref.watch(myLoansProvider);
    return Scaffold(appBar: AppBar(title: const Text('My Loans')),
      body: loans.when(
        data: (list)=> ListView.builder(itemCount:list.length, itemBuilder: (c,i){
          final l = list[i];
          return ListTile(title: Text('₹${l.application.amountRequested} • ${l.status}'), subtitle: Text('Tenure: ${l.application.tenureMonths} mo'), onTap: ()=>router.go('/loan/${l.id}'));
        }),
        loading: ()=> const Center(child: CircularProgressIndicator()),
        error: (e,_)=> Center(child: Text('Error: $e'))
      ),
    );
  }
}
