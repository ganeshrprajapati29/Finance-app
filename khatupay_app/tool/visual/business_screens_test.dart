import 'dart:ui' show Size;

import 'package:flutter_test/flutter_test.dart';
import 'package:khatupay_app/models/business/merchant_business.dart';
import 'package:khatupay_app/models/user.dart';
import 'package:khatupay_app/providers/auth_providers.dart';
import 'package:khatupay_app/providers/business/merchant_business_provider.dart';
import 'package:khatupay_app/ui/screens/business/business_bank_page.dart';
import 'package:khatupay_app/ui/screens/business/business_home_page.dart';
import 'package:khatupay_app/ui/screens/business/business_registration_page.dart';
import 'package:khatupay_app/ui/screens/business/business_verification_page.dart';
import 'package:khatupay_app/ui/screens/business/merchant_qr_page.dart';
import 'package:khatupay_app/ui/screens/business/razorpay_business_onboarding_page.dart';

import 'render_harness.dart';

List<Map<String, dynamic>> _steps(List<String> statuses) {
  const titles = ['Business profile', 'Owner PAN & Aadhaar', 'Settlement bank account', 'Business details', 'Payment activation', 'Business QR'];
  const keys = ['profile', 'personalKyc', 'bank', 'businessDetails', 'activation', 'qr'];
  const messages = [
    'Shree Balaji Kirana Store',
    'Verify your PAN and Aadhaar once. It takes about 2 minutes.',
    'Add the bank account where your collections will be settled.',
    'Legal name, business type and address for payment activation.',
    'Starts automatically after you submit business details.',
    'Available right after payment activation.',
  ];
  return [
    for (var i = 0; i < 6; i++)
      {'key': keys[i], 'title': titles[i], 'status': statuses[i], 'message': messages[i]},
  ];
}

MerchantDashboard _dashboard(List<String> statuses,
    {String? next, int progress = 17, bool qrActive = false, bool canCreateQr = false, Map<String, dynamic>? qr, List<Map<String, dynamic>> requirements = const [], Map<String, dynamic>? bank, String status = 'DRAFT'}) {
  final steps = _steps(statuses);
  if (statuses[4] == 'REVIEW') {
    steps[4]['message'] = 'Your application is with the KhatuPay team. We will notify you as soon as payments are activated.';
  }
  if (statuses[4] == 'CURRENT') steps[4]['message'] = '2 more details needed to finish verification.';
  if (statuses[1] == 'DONE') steps[1]['message'] = 'Your identity is verified.';
  if (statuses[2] == 'DONE') steps[2]['message'] = 'HDFC Bank account ending 9012';
  if (statuses[3] == 'DONE') steps[3]['message'] = 'Legal name, address and terms submitted.';
  return MerchantDashboard.fromJson({
    'business': {
      '_id': 'b1', 'publicId': 'KPB1760000000123', 'businessName': 'Shree Balaji Kirana Store',
      'ownerName': 'Ramesh Kumar', 'category': 'Retail store', 'status': status,
      'mobile': '9876543210', 'email': 'ramesh@example.com', 'address': '12 MG Road, Jaipur',
      if (statuses[3] == 'DONE') 'onboardingRequest': {'businessType': 'proprietorship'},
    },
    'kyc': null, 'bank': bank, 'qr': qr,
    'personalKyc': {'panVerified': statuses[1] == 'DONE', 'aadhaarVerified': statuses[1] == 'DONE', 'name': 'Ramesh Kumar'},
    'onboarding': {
      'steps': steps, 'nextStep': next, 'progress': progress, 'canCreateQr': canCreateQr,
      'qrActive': qrActive, 'requirements': requirements, 'providerState': 'QUEUED',
    },
  });
}

final _me = KPUser.fromJson({'_id': 'u1', 'name': 'Ramesh Kumar', 'email': 'ramesh@example.com', 'mobile': '9876543210'});

void main() {
  setUpAll(loadAppFonts);

  final balance = merchantBalanceProvider.overrideWith((ref) async => <String, dynamic>{'available': 12450, 'pending': 800, 'settled': 98200});
  final me = meProvider.overrideWith((ref) async => _me);

  testWidgets('home welcome', (tester) async {
    await renderScreen(tester, 'biz_1_welcome', const BusinessHomePage(), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => const MerchantDashboard()), balance,
    ]);
  });

  testWidgets('home checklist', (tester) async {
    await renderScreen(tester, 'biz_2_home_checklist', const BusinessHomePage(), size: const Size(390, 1150), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'CURRENT', 'LOCKED', 'LOCKED', 'LOCKED'], next: 'bank', progress: 33)), balance,
    ]);
  });

  testWidgets('home in review', (tester) async {
    await renderScreen(tester, 'biz_3_home_review', const BusinessHomePage(), size: const Size(390, 1150), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'DONE', 'DONE', 'REVIEW', 'LOCKED'], progress: 67, status: 'SUBMITTED')), balance,
    ]);
  });

  testWidgets('home live', (tester) async {
    await renderScreen(tester, 'biz_4_home_live', const BusinessHomePage(), size: const Size(390, 900), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'DONE', 'DONE', 'DONE', 'DONE'], progress: 100, qrActive: true, status: 'APPROVED')), balance,
    ]);
  });

  testWidgets('registration', (tester) async {
    await renderScreen(tester, 'biz_5_registration', const BusinessRegistrationPage(), size: const Size(390, 1100), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => const MerchantDashboard()), me,
    ]);
  });

  testWidgets('bank form', (tester) async {
    await renderScreen(tester, 'biz_6_bank', const BusinessBankPage(), size: const Size(390, 980), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'CURRENT', 'LOCKED', 'LOCKED', 'LOCKED'], next: 'bank', progress: 33)),
    ]);
  });

  testWidgets('bank verified', (tester) async {
    await renderScreen(tester, 'biz_7_bank_done', const BusinessBankPage(), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'DONE', 'CURRENT', 'LOCKED', 'LOCKED'], next: 'businessDetails', progress: 50,
          bank: {'status': 'VERIFIED', 'accountHolderName': 'Ramesh Kumar', 'accountNumber': '****9012', 'ifscCode': 'HDFC0001234', 'bankName': 'HDFC Bank'})),
    ]);
  });

  testWidgets('business details', (tester) async {
    await renderScreen(tester, 'biz_8_details', const RazorpayBusinessOnboardingPage(), size: const Size(390, 1900), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'DONE', 'CURRENT', 'LOCKED', 'LOCKED'], next: 'businessDetails', progress: 50)),
    ]);
  });

  testWidgets('activation review', (tester) async {
    await renderScreen(tester, 'biz_9_activation_review', const BusinessVerificationPage(), size: const Size(390, 1250), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'DONE', 'DONE', 'REVIEW', 'LOCKED'], progress: 67, status: 'SUBMITTED')),
    ]);
  });

  testWidgets('activation needs details', (tester) async {
    await renderScreen(tester, 'biz_10_activation_action', const BusinessVerificationPage(), size: const Size(390, 1400), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'DONE', 'DONE', 'CURRENT', 'LOCKED'], next: 'activation', progress: 67, status: 'NEEDS_CLARIFICATION', requirements: [
            {'field': 'business_proof_url', 'label': 'Business proof document', 'kind': 'DOCUMENT', 'reason': 'document missing'},
            {'field': 'settlements.account_number', 'label': 'Settlement bank account number', 'kind': 'BANK', 'reason': 'field missing'},
          ])),
    ]);
  });

  testWidgets('qr waiting', (tester) async {
    await renderScreen(tester, 'biz_11_qr_waiting', const MerchantQrPage(), size: const Size(390, 1050), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'DONE', 'DONE', 'REVIEW', 'LOCKED'], progress: 67, status: 'SUBMITTED')),
    ]);
  });

  testWidgets('qr create', (tester) async {
    await renderScreen(tester, 'biz_12_qr_create', const MerchantQrPage(), overrides: [
      merchantDashboardProvider.overrideWith((ref) async => _dashboard(['DONE', 'DONE', 'DONE', 'DONE', 'DONE', 'CURRENT'], next: 'qr', progress: 83, canCreateQr: true, status: 'APPROVED')),
    ]);
  });
}
