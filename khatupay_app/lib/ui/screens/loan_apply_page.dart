import 'package:flutter/material.dart';
import '../../services/loan_service.dart';
import '../../routes/app_router.dart';

class LoanApplyPage extends StatefulWidget { const LoanApplyPage({super.key}); @override State<LoanApplyPage> createState()=>_S(); }
class _S extends State<LoanApplyPage> {
  final a=TextEditingController(), t=TextEditingController(text:'12'), p=TextEditingController(text:'Personal');
  String msg='';
  @override Widget build(BuildContext context)=> Scaffold(appBar: AppBar(title: const Text('Apply Loan')), body: Padding(
    padding: const EdgeInsets.all(16),
    child: Column(children:[
      TextField(controller:a, decoration: const InputDecoration(hintText:'Amount (₹)')), const SizedBox(height: 8),
      TextField(controller:t, decoration: const InputDecoration(hintText:'Tenure (months)')), const SizedBox(height: 8),
      TextField(controller:p, decoration: const InputDecoration(hintText:'Purpose')), const SizedBox(height: 12),
      ElevatedButton(onPressed: () async {
        final id = await LoanService().apply(num.parse(a.text), int.parse(t.text), purpose: p.text);
        setState(()=>msg='Submitted. LoanId: $id'); router.go('/loans');
      }, child: const Text('Submit'))
    ]),
  ));
}
