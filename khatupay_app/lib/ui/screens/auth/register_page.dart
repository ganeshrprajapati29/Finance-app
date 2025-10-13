import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../services/auth_service.dart';
import '../../../routes/app_router.dart';

class RegisterPage extends ConsumerStatefulWidget { const RegisterPage({super.key}); @override ConsumerState<RegisterPage> createState()=>_S(); }
class _S extends ConsumerState<RegisterPage> {
  final n=TextEditingController(), e=TextEditingController(), m=TextEditingController(), p=TextEditingController();
  String info='';
  @override Widget build(BuildContext context){
    return Scaffold(appBar: AppBar(title: const Text('Register')), body: Padding(
      padding: const EdgeInsets.all(16), child: Column(children: [
        TextField(controller:n, decoration: const InputDecoration(hintText:'Name')),
        TextField(controller:e, decoration: const InputDecoration(hintText:'Email')),
        TextField(controller:m, decoration: const InputDecoration(hintText:'Mobile')),
        TextField(controller:p, obscureText:true, decoration: const InputDecoration(hintText:'Password')),
        const SizedBox(height: 12),
        ElevatedButton(onPressed: () async {
          await AuthService().register(n.text,e.text,m.text,p.text);
          setState(()=>info='OTP sent to email'); router.go('/verify');
        }, child: const Text('Register')),
        if(info.isNotEmpty) Text(info)
      ]),
    ));
  }
}
