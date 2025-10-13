import 'package:flutter/material.dart';
import '../../services/qr_service.dart';

class QRPage extends StatefulWidget { const QRPage({super.key}); @override State<QRPage> createState()=>_S(); }
class _S extends State<QRPage> {
  String? imgUrl; final amt=TextEditingController(text:'100'), note=TextEditingController(text:'Repayment');
  @override Widget build(BuildContext context)=> Scaffold(appBar: AppBar(title: const Text('UPI QR')), body: Padding(
    padding: const EdgeInsets.all(16), child: Column(children:[
      TextField(controller:amt, decoration: const InputDecoration(hintText:'Amount')), const SizedBox(height: 8),
      TextField(controller:note, decoration: const InputDecoration(hintText:'Note')), const SizedBox(height: 8),
      ElevatedButton(onPressed: () async {
        final r = await QRService().generate(amount: num.parse(amt.text), note: note.text);
        setState(()=> imgUrl = r['imagePath']); // backend serves /uploads/*
      }, child: const Text('Generate')),
      const SizedBox(height: 12),
      if (imgUrl!=null) Image.network(imgUrl!.startsWith('http')? imgUrl!: 'http://192.168.29.124:8080${imgUrl!}')
    ]),
  ));
}
