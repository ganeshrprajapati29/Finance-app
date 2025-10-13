import 'package:flutter/material.dart';
import '../../services/support_service.dart';

class SupportPage extends StatefulWidget { const SupportPage({super.key}); @override State<SupportPage> createState()=>_S(); }
class _S extends State<SupportPage> {
  final s=TextEditingController(), m=TextEditingController(); String msg='';
  @override Widget build(BuildContext context)=> Scaffold(appBar: AppBar(title: const Text('Support')), body: Padding(
    padding: const EdgeInsets.all(16), child: Column(children:[
      TextField(controller:s, decoration: const InputDecoration(hintText:'Subject')),
      TextField(controller:m, decoration: const InputDecoration(hintText:'Message'), minLines:3, maxLines:5),
      const SizedBox(height: 8),
      ElevatedButton(onPressed: () async { await SupportService().create(s.text, m.text); setState(()=>msg='Ticket created'); }, child: const Text('Submit')),
      if(msg.isNotEmpty) Text(msg)
    ]),
  ));
}
