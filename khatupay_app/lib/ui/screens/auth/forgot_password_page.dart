import 'package:flutter/material.dart';
import '../../../services/auth_service.dart';

class ForgotPasswordPage extends StatefulWidget { const ForgotPasswordPage({super.key}); @override State<ForgotPasswordPage> createState()=>_S(); }
class _S extends State<ForgotPasswordPage> {
  final e=TextEditingController(), o=TextEditingController(), p=TextEditingController(); String msg='';
  @override Widget build(BuildContext ctx)=> Scaffold(appBar: AppBar(title: const Text('Reset Password')), body: Padding(
    padding: const EdgeInsets.all(16), child: Column(children: [
      TextField(controller:e, decoration: const InputDecoration(hintText:'Email')),
      Row(children:[
        Expanded(child: TextField(controller:o, decoration: const InputDecoration(hintText:'OTP'))),
        TextButton(onPressed: () async { await AuthService().forgot(e.text); setState(()=>msg='OTP sent'); }, child: const Text('Send OTP'))
      ]),
      TextField(controller:p, decoration: const InputDecoration(hintText:'New Password')),
      const SizedBox(height: 8),
      ElevatedButton(onPressed: () async { await AuthService().reset(e.text,o.text,p.text); setState(()=>msg='Updated'); }, child: const Text('Update')),
      if(msg.isNotEmpty) Text(msg)
    ]),
  ));
}
