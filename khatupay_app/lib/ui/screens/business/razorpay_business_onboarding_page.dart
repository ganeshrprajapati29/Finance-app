import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/app_theme.dart';
import '../../../core/friendly_error.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../routes/app_router.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/kp_widgets.dart';
import 'business_widgets.dart';

/// Step 4 of business setup: legal details needed to activate payments.
/// Whatever the payment provider answers, the server keeps the application, so
/// the owner never has to fill this form twice.
class RazorpayBusinessOnboardingPage extends ConsumerStatefulWidget {
  const RazorpayBusinessOnboardingPage({super.key});
  @override
  ConsumerState<RazorpayBusinessOnboardingPage> createState() =>
      _RazorpayBusinessOnboardingPageState();
}

const _businessTypes = <(String, String, String)>[
  ('proprietorship', 'Proprietorship', 'One owner, registered shop'),
  ('not_yet_registered', 'Individual', 'No business registration yet'),
  ('partnership', 'Partnership', 'Two or more partners'),
  ('private_limited', 'Private Limited', 'Registered company'),
  ('llp', 'LLP', 'Limited liability partnership'),
];

class _RazorpayBusinessOnboardingPageState
    extends ConsumerState<RazorpayBusinessOnboardingPage> {
  final formKey = GlobalKey<FormState>();
  final legalName = TextEditingController(),
      displayName = TextEditingController(),
      model = TextEditingController(),
      pan = TextEditingController(),
      gst = TextEditingController(),
      street = TextEditingController(),
      city = TextEditingController(),
      pin = TextEditingController();
  String businessType = 'proprietorship';
  String? state;
  bool termsAccepted = false, busy = false, prefilled = false;
  String termsUrl = 'https://razorpay.com/terms/';
  String? error;
  Map<String, dynamic>? submitted;

  @override
  void initState() {
    super.initState();
    _loadTerms();
  }

  // The terms link is only a convenience; failing to fetch it must never
  // block the form (a fixed public link is used instead).
  Future<void> _loadTerms() async {
    try {
      final data = await MerchantBusinessService().razorpayTerms();
      final url = data['terms']?.toString() ?? '';
      if (mounted && url.startsWith('http')) setState(() => termsUrl = url);
    } catch (_) {}
  }

  Future<void> _viewTerms() async {
    final uri = Uri.tryParse(termsUrl);
    if (uri == null ||
        !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        setState(() => error = 'Terms could not be opened. Please try again.');
      }
    }
  }

  @override
  void dispose() {
    for (final c in [legalName, displayName, model, pan, gst, street, city, pin]) {
      c.dispose();
    }
    super.dispose();
  }

  void _prefill() {
    if (prefilled) return;
    final dashboard = ref.read(merchantDashboardProvider).valueOrNull;
    final business = dashboard?.business;
    if (business == null) return;
    prefilled = true;
    final previous = business.onboardingRequest ?? const <String, dynamic>{};
    final address = previous['address'] is Map
        ? Map<String, dynamic>.from(previous['address'] as Map)
        : const <String, dynamic>{};
    legalName.text = (previous['legalBusinessName'] ?? business.businessName).toString();
    displayName.text =
        (previous['customerFacingBusinessName'] ?? business.businessName).toString();
    model.text = (previous['businessModel'] ?? '').toString();
    pan.text = (previous['legalPan'] ?? '').toString();
    gst.text = (previous['gstNumber'] ?? dashboard?.kyc?['gstNumber'] ?? '').toString();
    street.text = (address['street1'] ?? business.address).toString();
    city.text = (address['city'] ?? '').toString();
    pin.text = (address['postalCode'] ?? '').toString();
    final savedState = (address['state'] ?? '').toString();
    for (final item in indianStates) {
      if (item.toLowerCase() == savedState.toLowerCase()) state = item;
    }
    final savedType = (previous['businessType'] ?? '').toString();
    if (_businessTypes.any((t) => t.$1 == savedType)) businessType = savedType;
  }

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    final valid = formKey.currentState?.validate() ?? false;
    if (!valid || state == null || !termsAccepted) {
      setState(() => error = !valid
          ? 'Please fix the highlighted fields.'
          : state == null
              ? 'Select your state.'
              : 'Please accept the payment service terms to continue.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await MerchantBusinessService().submitRazorpayOnboarding({
        'legalBusinessName': legalName.text.trim(),
        'customerFacingBusinessName': displayName.text.trim(),
        'businessType': businessType,
        'businessModel': model.text.trim(),
        'legalPan': pan.text.trim().toUpperCase(),
        'gstNumber': gst.text.trim().toUpperCase(),
        'ownership': 100,
        'termsAccepted': true,
        'address': {
          'street1': street.text.trim(),
          'city': city.text.trim(),
          'state': state!.toUpperCase(),
          'postalCode': pin.text.trim(),
        },
      });
      ref.invalidate(merchantDashboardProvider);
      if (mounted) setState(() => submitted = result);
    } catch (e) {
      if (mounted) {
        setState(() => error = friendlyErrorMessage(e,
            fallback:
                'Business details could not be submitted. Please check them and try again.'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(merchantDashboardProvider);
    _prefill();
    final alreadyWithProvider =
        dashboard.valueOrNull?.business?.razorpay?['productId'] != null;

    if (submitted != null || alreadyWithProvider) {
      return KpAppShell(title: 'Business details', children: [
        _SubmittedCard(
            queued: submitted?['queued'] == true,
            onContinue: () => router.go('/business')),
      ]);
    }

    return KpAppShell(title: 'Business details', children: [
      const BusinessFormHeader(
        stepLabel: 'Business details',
        title: 'Details for payment activation',
        subtitle: 'Enter them exactly as on your business documents.',
        icon: Icons.fact_check_rounded,
      ),
      const SizedBox(height: 14),
      if (error != null) ...[
        KpErrorBanner(message: error!),
        const SizedBox(height: 12),
      ],
      Form(
        key: formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          KpCard(
            radius: KhatuRadius.lg,
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _FieldLabel('Business type'),
                  for (final type in _businessTypes)
                    _TypeOption(
                      title: type.$2,
                      subtitle: type.$3,
                      selected: businessType == type.$1,
                      onTap: busy
                          ? null
                          : () => setState(() => businessType = type.$1),
                    ),
                  const SizedBox(height: 8),
                  BusinessField(
                    controller: legalName,
                    label: 'Legal business name',
                    helper: 'As on PAN / registration. Individuals: your full name.',
                    icon: Icons.badge_outlined,
                    maxLength: 200,
                    validator: (v) => (v ?? '').trim().length < 4
                        ? 'Enter at least 4 characters'
                        : null,
                  ),
                  BusinessField(
                    controller: displayName,
                    label: 'Name customers will see',
                    icon: Icons.storefront_outlined,
                    maxLength: 100,
                    validator: (v) => (v ?? '').trim().isEmpty
                        ? 'Enter the name shown to customers'
                        : null,
                  ),
                  BusinessField(
                    controller: model,
                    label: 'What do you sell or provide?',
                    hint: 'e.g. Grocery and daily essentials retail shop',
                    icon: Icons.sell_outlined,
                    maxLines: 2,
                    maxLength: 255,
                    validator: (v) => (v ?? '').trim().length < 10
                        ? 'Describe your business in a few words (at least 10 characters)'
                        : null,
                  ),
                ]),
          ),
          const KpSectionHeader(title: 'Business address'),
          KpCard(
            radius: KhatuRadius.lg,
            child: Column(children: [
              BusinessField(
                controller: street,
                label: 'Shop no., building, street',
                icon: Icons.location_on_outlined,
                maxLength: 100,
                validator: (v) => (v ?? '').trim().length < 5
                    ? 'Enter your business address'
                    : null,
              ),
              BusinessField(
                controller: city,
                label: 'City',
                icon: Icons.location_city_outlined,
                maxLength: 100,
                validator: (v) =>
                    (v ?? '').trim().length < 2 ? 'Enter your city' : null,
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: DropdownButtonFormField<String>(
                  initialValue: state,
                  isExpanded: true,
                  menuMaxHeight: 360,
                  decoration: const InputDecoration(
                      labelText: 'State',
                      prefixIcon: Icon(Icons.map_outlined, size: 20)),
                  items: [
                    for (final item in indianStates)
                      DropdownMenuItem(value: item, child: Text(item)),
                  ],
                  validator: (v) => v == null ? 'Select your state' : null,
                  onChanged: busy ? null : (v) => setState(() => state = v),
                ),
              ),
              BusinessField(
                controller: pin,
                label: 'PIN code',
                icon: Icons.pin_drop_outlined,
                digitsOnly: true,
                maxLength: 6,
                textInputAction: TextInputAction.done,
                validator: (v) => RegExp(r'^\d{6}$').hasMatch((v ?? '').trim())
                    ? null
                    : 'Enter a 6-digit PIN code',
              ),
            ]),
          ),
          const KpSectionHeader(
              title: 'Tax details',
              subtitle: 'Optional - add them if your business has them'),
          KpCard(
            radius: KhatuRadius.lg,
            child: Column(children: [
              BusinessField(
                controller: pan,
                label: 'Business PAN (optional)',
                helper: 'Leave blank if you use your personal PAN.',
                icon: Icons.credit_card_outlined,
                caps: true,
                maxLength: 10,
                validator: (v) {
                  final value = (v ?? '').trim().toUpperCase();
                  if (value.isEmpty) return null;
                  return RegExp(r'^[A-Z]{5}\d{4}[A-Z]$').hasMatch(value)
                      ? null
                      : 'Enter a valid PAN, e.g. ABCDE1234F';
                },
              ),
              BusinessField(
                controller: gst,
                label: 'GSTIN (optional)',
                hint: '15 characters',
                icon: Icons.receipt_long_outlined,
                caps: true,
                maxLength: 15,
                textInputAction: TextInputAction.done,
                formatters: const [_AlphaNumericFormatter()],
                validator: (v) {
                  final value = (v ?? '').trim();
                  if (value.isEmpty) return null;
                  return value.length == 15
                      ? null
                      : 'GSTIN must be exactly 15 characters';
                },
              ),
            ]),
          ),
          const SizedBox(height: 6),
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: busy ? null : () => setState(() => termsAccepted = !termsAccepted),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Checkbox(
                    value: termsAccepted,
                    onChanged: busy
                        ? null
                        : (v) => setState(() => termsAccepted = v ?? false)),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 11),
                    child: Wrap(children: [
                      const Text(
                          'I confirm these details are correct and I accept the ',
                          style: TextStyle(
                              fontFamily: 'Roboto', fontSize: 13, height: 1.4)),
                      GestureDetector(
                        onTap: _viewTerms,
                        child: const Text('payment service terms',
                            style: TextStyle(
                                fontFamily: 'Roboto',
                                fontSize: 13,
                                height: 1.4,
                                color: KhatuColors.teal,
                                fontWeight: FontWeight.w800,
                                decoration: TextDecoration.underline)),
                      ),
                      const Text('.',
                          style: TextStyle(fontFamily: 'Roboto', fontSize: 13)),
                    ]),
                  ),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          BusinessPrimaryButton(
            label: 'Submit for activation',
            busyLabel: 'Submitting...',
            icon: Icons.send_rounded,
            busy: busy,
            onPressed: submit,
          ),
          const SizedBox(height: 12),
          const BusinessTrustRow(
              text:
                  'Your application is saved securely. You will not need to fill this again.'),
        ]),
      ),
    ]);
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text,
            style: const TextStyle(
                fontFamily: 'Roboto',
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: KhatuColors.muted)),
      );
}

class _TypeOption extends StatelessWidget {
  const _TypeOption(
      {required this.title, required this.subtitle, required this.selected, this.onTap});
  final String title, subtitle;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: selected ? KhatuColors.softTeal : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: selected ? KhatuColors.teal : KhatuColors.line,
                  width: selected ? 1.5 : 1),
            ),
            child: Row(children: [
              Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  size: 20,
                  color: selected ? KhatuColors.teal : KhatuColors.faint),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontFamily: 'Roboto',
                              fontSize: 14,
                              fontWeight: FontWeight.w800)),
                      Text(subtitle,
                          style: const TextStyle(
                              fontFamily: 'Roboto',
                              fontSize: 12,
                              color: KhatuColors.muted)),
                    ]),
              ),
            ]),
          ),
        ),
      );
}

class _SubmittedCard extends StatelessWidget {
  const _SubmittedCard({required this.queued, required this.onContinue});
  final bool queued;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) => KpCard(
        radius: KhatuRadius.xl,
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
        child: Column(children: [
          Container(
            width: 76,
            height: 76,
            decoration: const BoxDecoration(
                color: KhatuColors.softGreen, shape: BoxShape.circle),
            child: const Icon(Icons.check_rounded,
                color: KhatuColors.success, size: 42),
          ),
          const SizedBox(height: 16),
          const Text('Application submitted',
              style: TextStyle(
                  fontFamily: 'Roboto',
                  fontSize: 21,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Text(
              queued
                  ? 'Your business details are saved. The KhatuPay team will activate payments for you and notify you - nothing more is needed right now.'
                  : 'Your business is now under verification. This usually takes 1-3 working days. We will notify you when your QR is ready.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontFamily: 'Roboto',
                  color: KhatuColors.muted,
                  fontSize: 13.5,
                  height: 1.5)),
          const SizedBox(height: 20),
          BusinessPrimaryButton(label: 'Back to business home', onPressed: onContinue),
        ]),
      );
}

class _AlphaNumericFormatter extends TextInputFormatter {
  const _AlphaNumericFormatter();
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final cleaned = newValue.text.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    return TextEditingValue(
        text: cleaned, selection: TextSelection.collapsed(offset: cleaned.length));
  }
}
