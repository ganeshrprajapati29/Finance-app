import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../../services/user_service.dart';

class ProfilePage extends StatefulWidget { const ProfilePage({super.key}); @override State<ProfilePage> createState()=>_S(); }
class _S extends State<ProfilePage> {
  String info='';
  @override Widget build(BuildContext context)=> Scaffold(appBar: AppBar(title: const Text('Profile & KYC')),
    body: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
      ElevatedButton(onPressed: () async {
        final r = await FilePicker.platform.pickFiles(allowMultiple: true);
        if (r == null) return;
        final paths = r.files.where((f)=>f.path!=null).map((f)=>f.path!).toList();
        await UserService().uploadKyc(paths);
        setState(()=> info='KYC docs uploaded');
      }, child: const Text('Upload KYC Docs')),
      if(info.isNotEmpty) Text(info)
    ])),
  );
}
