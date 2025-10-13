import 'package:flutter/material.dart';
class KField extends StatelessWidget {
  final TextEditingController c; final String hint; final bool obscure;
  const KField({super.key, required this.c, required this.hint, this.obscure=false});
  @override Widget build(BuildContext context)=> TextField(controller:c, obscureText:obscure, decoration: InputDecoration(hintText: hint));
}
