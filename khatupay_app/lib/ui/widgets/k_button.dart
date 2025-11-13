import 'package:flutter/material.dart';
class KButton extends StatelessWidget {
  final String text; final VoidCallback onPressed; final bool isLoading;
  const KButton({super.key, required this.text, required this.onPressed, this.isLoading = false});
  @override Widget build(BuildContext context)=> ElevatedButton(onPressed: isLoading ? null : onPressed, child: isLoading ? const CircularProgressIndicator() : Text(text));
}
