import 'package:flutter/material.dart';

class KField extends StatelessWidget {
  final TextEditingController c;
  final String hint;
  final bool obscure;
  final IconData? icon;
  final TextInputType? keyboardType;

  const KField({
    super.key,
    required this.c,
    required this.hint,
    this.obscure = false,
    this.icon,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: c,
      obscureText: obscure,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: hint,
        hintText: hint,
        prefixIcon: icon == null ? null : Icon(icon),
      ),
    );
  }
}
