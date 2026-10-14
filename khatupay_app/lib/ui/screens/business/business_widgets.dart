import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/app_theme.dart';
import '../../../models/business/merchant_business.dart';

/// Shared building blocks for the business (merchant) screens, so setup,
/// bank, details, activation and QR all look and behave the same way.

const indianStates = <String>[
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

const businessCategories = <(String, IconData)>[
  ('Retail store', Icons.storefront_rounded),
  ('Food and beverages', Icons.restaurant_rounded),
  ('Professional services', Icons.work_outline_rounded),
  ('Fashion and lifestyle', Icons.checkroom_rounded),
  ('Recharge and bill payments', Icons.bolt_rounded),
];

/// Route for each checklist step.
String businessStepRoute(String key) => switch (key) {
      'profile' => '/business/register',
      'personalKyc' => '/kyc',
      'bank' => '/business/bank',
      'businessDetails' => '/business/onboarding',
      'activation' => '/business/verification',
      'qr' => '/business/qr',
      _ => '/business',
    };

String businessStepAction(MerchantStep step) => switch (step.key) {
      'profile' => 'Create profile',
      'personalKyc' => 'Verify identity',
      'bank' => step.status == 'FAILED' ? 'Update bank account' : 'Add bank account',
      'businessDetails' => 'Add business details',
      'activation' => step.status == 'FAILED'
          ? 'View details'
          : step.title.contains('Razorpay')
              ? 'Connect Razorpay'
              : 'Complete verification',
      'qr' => 'Create my QR',
      _ => 'Continue',
    };

({Color color, Color tint, IconData icon, String label}) businessStepStyle(
        String status) =>
    switch (status) {
      'DONE' => (
          color: KhatuColors.success,
          tint: KhatuColors.softGreen,
          icon: Icons.check_rounded,
          label: 'Done'
        ),
      'CURRENT' => (
          color: KhatuColors.teal,
          tint: KhatuColors.softTeal,
          icon: Icons.arrow_forward_rounded,
          label: 'Next'
        ),
      'REVIEW' => (
          color: KhatuColors.warning,
          tint: KhatuColors.softSaffron,
          icon: Icons.schedule_rounded,
          label: 'In review'
        ),
      'FAILED' => (
          color: KhatuColors.danger,
          tint: KhatuColors.softRed,
          icon: Icons.priority_high_rounded,
          label: 'Action needed'
        ),
      _ => (
          color: KhatuColors.faint,
          tint: KhatuColors.surfaceAlt,
          icon: Icons.lock_outline_rounded,
          label: 'Locked'
        ),
    };

/// One row of the setup checklist: numbered marker, connector line, title,
/// status chip, helper text and (for the step to do now) a button.
class BusinessStepTile extends StatelessWidget {
  const BusinessStepTile({
    super.key,
    required this.index,
    required this.step,
    required this.isLast,
    this.highlight = false,
    this.onAction,
  });

  final int index;
  final MerchantStep step;
  final bool isLast;
  final bool highlight;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final style = businessStepStyle(step.status);
    final locked = step.status == 'LOCKED';
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Column(children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: step.isDone ? style.color : style.tint,
              shape: BoxShape.circle,
              border: Border.all(
                  color: locked ? KhatuColors.line : style.color, width: 1.5),
            ),
            child: step.isDone || step.status == 'REVIEW' || step.status == 'FAILED'
                ? Icon(style.icon,
                    size: 18,
                    color: step.isDone ? Colors.white : style.color)
                : Text('${index + 1}',
                    style: TextStyle(
                        fontFamily: 'Roboto',
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                        color: locked ? KhatuColors.faint : style.color)),
          ),
          if (!isLast)
            Expanded(
              child: Container(
                width: 2,
                margin: const EdgeInsets.symmetric(vertical: 4),
                color: step.isDone
                    ? KhatuColors.success.withValues(alpha: 0.45)
                    : KhatuColors.line,
              ),
            ),
        ]),
        const SizedBox(width: 14),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 18, top: 5),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(step.title,
                          style: TextStyle(
                              fontFamily: 'Roboto',
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: locked
                                  ? KhatuColors.muted
                                  : KhatuColors.text)),
                    ),
                    if (!locked) BusinessChip(label: style.label, color: style.color, tint: style.tint),
                  ]),
                  if (step.message.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(step.message,
                        style: TextStyle(
                            fontFamily: 'Roboto',
                            fontSize: 12.5,
                            height: 1.4,
                            color: step.status == 'FAILED'
                                ? KhatuColors.danger
                                : KhatuColors.muted)),
                  ],
                  if (highlight && onAction != null) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 44,
                      child: FilledButton.icon(
                        onPressed: onAction,
                        style: FilledButton.styleFrom(
                          backgroundColor: step.status == 'FAILED'
                              ? KhatuColors.danger
                              : KhatuColors.teal,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                        label: Text(businessStepAction(step),
                            style: const TextStyle(
                                fontFamily: 'Roboto',
                                fontWeight: FontWeight.w800,
                                fontSize: 14)),
                      ),
                    ),
                  ],
                ]),
          ),
        ),
      ]),
    );
  }
}

class BusinessChip extends StatelessWidget {
  const BusinessChip(
      {super.key, required this.label, required this.color, required this.tint});
  final String label;
  final Color color, tint;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
            color: tint, borderRadius: BorderRadius.circular(999)),
        child: Text(label,
            style: TextStyle(
                fontFamily: 'Roboto',
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w800)),
      );
}

/// Labelled text input used by every business form.
class BusinessField extends StatelessWidget {
  const BusinessField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.helper,
    this.icon,
    this.keyboardType,
    this.maxLength,
    this.maxLines = 1,
    this.caps = false,
    this.digitsOnly = false,
    this.enabled = true,
    this.obscure = false,
    this.validator,
    this.formatters,
    this.textInputAction = TextInputAction.next,
  });

  final TextEditingController controller;
  final String label;
  final String? hint, helper;
  final IconData? icon;
  final TextInputType? keyboardType;
  final int? maxLength;
  final int maxLines;
  final bool caps, digitsOnly, enabled, obscure;
  final String? Function(String?)? validator;
  final List<TextInputFormatter>? formatters;
  final TextInputAction textInputAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextFormField(
          controller: controller,
          enabled: enabled,
          obscureText: obscure,
          maxLines: maxLines,
          keyboardType: digitsOnly ? TextInputType.number : keyboardType,
          textInputAction: maxLines > 1 ? TextInputAction.newline : textInputAction,
          textCapitalization:
              caps ? TextCapitalization.characters : TextCapitalization.words,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          inputFormatters: [
            if (digitsOnly) FilteringTextInputFormatter.digitsOnly,
            if (caps) const UpperCaseFormatter(),
            if (maxLength != null) LengthLimitingTextInputFormatter(maxLength),
            ...?formatters,
          ],
          validator: validator,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            helperText: helper,
            helperMaxLines: 2,
            errorMaxLines: 2,
            prefixIcon: icon == null ? null : Icon(icon, size: 20),
          ),
        ),
      );
}

class UpperCaseFormatter extends TextInputFormatter {
  const UpperCaseFormatter();
  @override
  TextEditingValue formatEditUpdate(
          TextEditingValue oldValue, TextEditingValue newValue) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}

/// Full-width primary action with a built-in busy state, so a second tap can
/// never send the same request twice.
class BusinessPrimaryButton extends StatelessWidget {
  const BusinessPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.busyLabel,
    this.icon = Icons.arrow_forward_rounded,
  });
  final String label;
  final String? busyLabel;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData icon;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity,
        height: 52,
        child: FilledButton(
          onPressed: busy ? null : onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: KhatuColors.teal,
            disabledBackgroundColor: KhatuColors.teal.withValues(alpha: 0.45),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (busy)
              const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2.2, color: Colors.white))
            else
              Icon(icon, size: 19, color: Colors.white),
            const SizedBox(width: 10),
            Text(busy ? (busyLabel ?? 'Please wait...') : label,
                style: const TextStyle(
                    fontFamily: 'Roboto',
                    color: Colors.white,
                    fontSize: 15.5,
                    fontWeight: FontWeight.w800)),
          ]),
        ),
      );
}

/// Small "why we ask" / reassurance row shown under forms.
class BusinessTrustRow extends StatelessWidget {
  const BusinessTrustRow({super.key, required this.text, this.icon = Icons.lock_outline_rounded});
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: KhatuColors.muted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    fontFamily: 'Roboto',
                    color: KhatuColors.muted,
                    fontSize: 12,
                    height: 1.4)),
          ),
        ],
      );
}

/// Section title + optional step counter used at the top of each setup form.
class BusinessFormHeader extends StatelessWidget {
  const BusinessFormHeader(
      {super.key, required this.title, required this.subtitle, required this.icon, this.stepLabel});
  final String title, subtitle;
  final IconData icon;
  final String? stepLabel;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: KhatuColors.heroGradient,
          borderRadius: BorderRadius.circular(KhatuRadius.lg),
        ),
        child: Row(children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(14)),
            child: Icon(icon, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (stepLabel != null)
                    Text(stepLabel!.toUpperCase(),
                        style: const TextStyle(
                            fontFamily: 'Roboto',
                            color: Colors.white70,
                            fontSize: 10.5,
                            letterSpacing: 0.8,
                            fontWeight: FontWeight.w800)),
                  Text(title,
                      style: const TextStyle(
                          fontFamily: 'Roboto',
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      style: const TextStyle(
                          fontFamily: 'Roboto',
                          color: Colors.white70,
                          fontSize: 12.5,
                          height: 1.35)),
                ]),
          ),
        ]),
      );
}
