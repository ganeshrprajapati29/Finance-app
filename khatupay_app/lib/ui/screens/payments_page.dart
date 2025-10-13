import 'package:flutter/material.dart';
import '../../services/payment_service.dart';

class PaymentsPage extends StatefulWidget { const PaymentsPage({super.key}); @override State<PaymentsPage> createState()=>_S(); }
class _S extends State<PaymentsPage> {
  final amt=TextEditingController(text:'100'), loanId=TextEditingController(), billId=TextEditingController();
  String msg='';
  @override Widget build(BuildContext context)=> Scaffold(appBar: AppBar(title: const Text('Payments')), body: Padding(
    padding: const EdgeInsets.all(16), child: Column(children: [
      TextField(controller: amt, decoration: const InputDecoration(hintText:'Amount ₹')),
      TextField(controller: loanId, decoration: const InputDecoration(hintText:'LoanId (optional)')),
      TextField(controller: billId, decoration: const InputDecoration(hintText:'BillId (optional)')),
      const SizedBox(height: 8),
      ElevatedButton(onPressed: () async {
        final ps = PaymentService();
        final data = await ps.createRazorpayOrder(num.parse(amt.text), loanId: loanId.text.isEmpty? null: loanId.text, billId: billId.text.isEmpty? null: billId.text);
        final order = data['order'];
        ps.newCheckout(
          amount: num.parse(amt.text),
          orderId: order['id'],
          onSuccess: (oid,pid,sig) async {
            await ps.verifyRazorpay(oid,pid,sig);
            if (mounted) setState(()=> msg='Payment verified!');
          },
          onFail: (m) { if (mounted) setState(()=> msg='Failed: $m'); }
        );
      }, child: const Text('Pay via Razorpay (Test)')),
      if(msg.isNotEmpty) Padding(padding: const EdgeInsets.all(8), child: Text(msg))
    ]),
  ));
}
