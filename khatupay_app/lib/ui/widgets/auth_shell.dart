import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pin_code_fields/pin_code_fields.dart';

const kpAuthTeal = Color(0xFF0F766E);
const kpAuthInk = Color(0xFF172033);
const kpAuthMuted = Color(0xFF667085);
const kpAuthMint = Color(0xFFEAF8F5);
const kpAuthLine = Color(0xFFDDE8E6);

class AuthShell extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Widget child;
  final String footerText;
  final VoidCallback? onFooterTap;
  final String? illustrationAsset;
  final bool compactIllustration;
  final bool showBack;

  const AuthShell({super.key, required this.title, required this.subtitle, required this.icon, required this.child, required this.footerText, this.onFooterTap, this.illustrationAsset, this.compactIllustration = false, this.showBack = false});

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.fromLTRB(20, showBack ? 8 : 18, 20, 20),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (showBack)
                      IconButton(tooltip: 'Back', onPressed: () => Navigator.of(context).maybePop(), icon: const Icon(Icons.arrow_back_rounded)),
                    Row(children: [
                      Image.asset('assets/khatulogo-removebg-preview.png', height: 48, width: 48, fit: BoxFit.contain),
                      const SizedBox(width: 10),
                      const Text('KhatuPay', style: TextStyle(color: kpAuthInk, fontSize: 24, fontWeight: FontWeight.w800)),
                      const Spacer(),
                      Container(width: 36, height: 36, decoration: BoxDecoration(color: kpAuthMint, borderRadius: BorderRadius.circular(8)), child: Icon(icon, color: kpAuthTeal, size: 20)),
                    ]),
                    if (illustrationAsset != null) ...[
                      const SizedBox(height: 14),
                      Center(child: SizedBox(height: compactIllustration ? 112 : (constraints.maxHeight * .19).clamp(120.0, 168.0), width: compactIllustration ? 112 : double.infinity, child: Image.asset(illustrationAsset!, fit: BoxFit.contain))),
                    ],
                    const SizedBox(height: 16),
                    Text(title, style: const TextStyle(color: kpAuthInk, fontSize: 26, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text(subtitle, style: const TextStyle(color: kpAuthMuted, fontSize: 14, height: 1.45)),
                    const SizedBox(height: 22),
                    child,
                    const SizedBox(height: 14),
                    Center(child: TextButton(onPressed: onFooterTap, child: Text(footerText, style: const TextStyle(color: kpAuthTeal, fontWeight: FontWeight.w700)))),
                    const Center(child: Text('Protected with secure authentication', style: TextStyle(color: kpAuthMuted, fontSize: 12))),
                  ]),
                ),
              ),
            ),
          ),
        ),
      );
}

class AuthTextField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType keyboardType;
  final bool obscure;
  final int? maxLength;
  final bool enabled;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final String? Function(String value)? validator;
  const AuthTextField({super.key, required this.controller, required this.label, required this.icon, this.keyboardType = TextInputType.text, this.obscure = false, this.maxLength, this.enabled = true, this.textInputAction, this.inputFormatters, this.validator});
  @override
  State<AuthTextField> createState() => _AuthTextFieldState();
}

class _AuthTextFieldState extends State<AuthTextField> {
  late bool _hidden = widget.obscure;
  @override
  Widget build(BuildContext context) => TextFormField(
        controller: widget.controller,
        enabled: widget.enabled,
        keyboardType: widget.keyboardType,
        textInputAction: widget.textInputAction,
        obscureText: widget.obscure && _hidden,
        maxLength: widget.maxLength,
        inputFormatters: widget.inputFormatters,
        validator: (value) => widget.validator?.call(value?.trim() ?? ''),
        style: const TextStyle(color: kpAuthInk, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          labelText: widget.label,
          counterText: '',
          prefixIcon: Icon(widget.icon, color: kpAuthTeal, size: 21),
          suffixIcon: widget.obscure ? IconButton(tooltip: _hidden ? 'Show password' : 'Hide password', onPressed: () => setState(() => _hidden = !_hidden), icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined)) : null,
          filled: true,
          fillColor: const Color(0xFFF8FAFA),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kpAuthLine)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kpAuthTeal, width: 1.5)),
          errorMaxLines: 2,
        ),
      );
}

class AuthPrimaryButton extends StatelessWidget {
  final String label;
  final bool loading;
  final VoidCallback? onPressed;
  final IconData? icon;
  const AuthPrimaryButton({super.key, required this.label, this.loading = false, this.onPressed, this.icon});
  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity,
        height: 52,
        child: FilledButton.icon(
          onPressed: loading ? null : onPressed,
          icon: loading ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Icon(icon ?? Icons.arrow_forward_rounded, size: 20),
          label: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          style: FilledButton.styleFrom(backgroundColor: kpAuthTeal, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
        ),
      );
}

class AuthMessage extends StatelessWidget {
  final String message;
  final bool success;
  const AuthMessage({super.key, required this.message, this.success = false});
  @override
  Widget build(BuildContext context) {
    final color = success ? const Color(0xFF067647) : const Color(0xFFB42318);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: color.withOpacity(.07), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(.22))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(success ? Icons.check_circle_rounded : Icons.warning_amber_rounded, color: color, size: 20), const SizedBox(width: 9), Expanded(child: Text(message, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600)))]),
    );
  }
}

class AuthOtpInput extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String>? onCompleted;
  const AuthOtpInput({super.key, required this.controller, this.onCompleted});
  @override
  Widget build(BuildContext context) => PinCodeTextField(
        appContext: context,
        length: 6,
        controller: controller,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        animationType: AnimationType.fade,
        autoFocus: true,
        enableActiveFill: true,
        onChanged: (_) {},
        onCompleted: onCompleted,
        pinTheme: PinTheme(shape: PinCodeFieldShape.box, borderRadius: BorderRadius.circular(8), fieldHeight: 50, fieldWidth: 43, activeFillColor: const Color(0xFFF8FAFA), inactiveFillColor: const Color(0xFFF8FAFA), selectedFillColor: kpAuthMint, activeColor: kpAuthTeal, inactiveColor: kpAuthLine, selectedColor: kpAuthTeal),
      );
}

class PasswordRequirements extends StatelessWidget {
  final String password;
  const PasswordRequirements({super.key, required this.password});
  @override
  Widget build(BuildContext context) {
    final rules = <(String, bool)>[('At least 8 characters', password.length >= 8), ('Contains a letter', RegExp('[A-Za-z]').hasMatch(password)), ('Contains a number', RegExp('[0-9]').hasMatch(password))];
    return Wrap(spacing: 12, runSpacing: 6, children: rules.map((rule) => Row(mainAxisSize: MainAxisSize.min, children: [Icon(rule.$2 ? Icons.check_circle_rounded : Icons.circle_outlined, size: 15, color: rule.$2 ? kpAuthTeal : kpAuthMuted), const SizedBox(width: 4), Text(rule.$1, style: const TextStyle(fontSize: 12, color: kpAuthMuted))])).toList());
  }
}

String friendlyAuthError(Object error, {String fallback = 'Something went wrong. Please try again.'}) {
  final value = error.toString().replaceFirst('Exception: ', '').trim();
  final lower = value.toLowerCase();
  if (lower.contains('invalid credentials')) return 'The email, mobile number, or password is incorrect.';
  if (lower.contains('already registered') || lower.contains('user_exists')) return 'An account with this email or mobile number already exists.';
  if (lower.contains('expired')) return 'This verification code has expired. Request a new code.';
  if (lower.contains('invalid otp')) return 'The verification code is incorrect. Please check and try again.';
  if (lower.contains('too many')) return 'Too many attempts. Please wait and try again.';
  if (lower.contains('network') || lower.contains('connection') || lower.contains('socket')) return 'Please check your internet connection and try again.';
  if (value.isNotEmpty && value.length <= 120 && !lower.contains('dio') && !lower.contains('exception')) return value;
  return fallback;
}
