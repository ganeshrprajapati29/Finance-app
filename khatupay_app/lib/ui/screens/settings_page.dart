import 'package:flutter/material.dart';
import '../../core/fcm.dart';
import '../../services/user_service.dart';

class SettingsPage extends StatefulWidget { const SettingsPage({super.key}); @override State<SettingsPage> createState()=>_S(); }
class _S extends State<SettingsPage> {
  String token='';
  @override Widget build(BuildContext context)=> Scaffold(appBar: AppBar(title: const Text('Settings')), body: Padding(
    padding: const EdgeInsets.all(16), child: Column(children: [
      ElevatedButton(onPressed: () async {
        final t = await FCM.token();
        setState(()=> token = t ?? '');
        await UserService().registerFcmToken(token);
      }, child: const Text('Register Push Token')),
      if(token.isNotEmpty) SelectableText('FCM: $token', maxLines: 2)
    ]),
  ));
}
