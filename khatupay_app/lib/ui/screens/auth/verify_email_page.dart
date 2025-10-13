import 'package:flutter/material.dart';
import '../../../services/auth_service.dart';
import '../../../routes/app_router.dart';

class VerifyEmailPage extends StatefulWidget { const VerifyEmailPage({super.key}); @override State<VerifyEmailPage> createState()=>_S(); }
class _S extends State<VerifyEmailPage> {
  final e=TextEditingController(), o=TextEditingController(); String msg='';
  @override Widget build(BuildContext context)=> Scaffold(appBar: AppBar(title: const Text('Verify Email')), body: Padding(
    padding: const EdgeInsets.all(16), child: Column(children: [
      TextField(controller:e, decoration: const InputDecoration(hintText:'Email')),
      TextField(controller:o, decoration: const InputDecoration(hintText:'OTP')),
      const SizedBox(height: 8),
      ElevatedButton(onPressed: () async { await AuthService().verifyEmail(e.text,o.text); setState(()=>msg='Verified'); router.go('/login'); }, child: const Text('Verify')),
      if(msg.isNotEmpty) Text(msg)
    ]),
  ));
}
