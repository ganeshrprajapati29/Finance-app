import 'package:flutter_test/flutter_test.dart';
import 'package:khatupay_app/models/business/merchant_business.dart';
import 'package:khatupay_app/ui/screens/business/business_widgets.dart';

void main() {
  test('dashboard without a business still carries the first setup step', () {
    final dashboard = MerchantDashboard.fromJson({
      'business': null,
      'personalKyc': {'panVerified': false, 'aadhaarVerified': false},
      'onboarding': {
        'steps': [
          {'key': 'profile', 'title': 'Create business profile', 'status': 'CURRENT', 'message': 'Tell us about your shop.'},
        ],
        'nextStep': 'profile',
        'progress': 0,
      },
    });
    expect(dashboard.business, isNull);
    expect(dashboard.ownerVerified, isFalse);
    expect(dashboard.onboarding.nextStep, 'profile');
    expect(dashboard.onboarding.step('profile')!.needsAction, isTrue);
  });

  test('queued application parses as in review with nothing to do', () {
    final dashboard = MerchantDashboard.fromJson({
      'business': {
        '_id': 'b1', 'publicId': 'KPB1', 'businessName': 'Balaji Kirana', 'ownerName': 'Ramesh',
        'category': 'Retail store', 'status': 'SUBMITTED',
        'onboardingRequest': {'businessType': 'proprietorship', 'address': {'state': 'RAJASTHAN'}},
      },
      'personalKyc': {'panVerified': true, 'aadhaarVerified': true},
      'onboarding': {
        'steps': [
          {'key': 'profile', 'title': 'Business profile', 'status': 'DONE'},
          {'key': 'activation', 'title': 'Payment activation', 'status': 'REVIEW', 'message': 'With the KhatuPay team.'},
          {'key': 'qr', 'title': 'Business QR', 'status': 'LOCKED'},
        ],
        'nextStep': null,
        'progress': 33,
        'canCreateQr': false,
        'qrActive': false,
        'requirements': [
          {'field': 'business_proof_url', 'label': 'Business proof document', 'kind': 'DOCUMENT', 'reason': 'document missing'},
        ],
        'providerState': 'QUEUED',
      },
    });
    expect(dashboard.ownerVerified, isTrue);
    expect(dashboard.onboarding.nextStep, isNull);
    expect(dashboard.onboarding.canCreateQr, isFalse);
    expect(dashboard.onboarding.requirements.single.kind, 'DOCUMENT');
    expect(dashboard.business!.onboardingRequest!['businessType'], 'proprietorship');
  });

  test('older servers without a checklist do not break the app', () {
    final dashboard = MerchantDashboard.fromJson({
      'business': {'_id': 'b1', 'publicId': 'KPB1', 'businessName': 'Shop', 'ownerName': 'A', 'category': 'Retail store'},
    });
    expect(dashboard.onboarding.steps, isEmpty);
    expect(dashboard.onboarding.qrActive, isFalse);
    expect(dashboard.business!.status, 'DRAFT');
  });

  test('every checklist step has a route and an action label', () {
    for (final key in ['profile', 'personalKyc', 'bank', 'businessDetails', 'activation', 'qr']) {
      expect(businessStepRoute(key), startsWith('/'));
      expect(businessStepAction(MerchantStep(key: key, title: key, status: 'CURRENT')), isNotEmpty);
    }
    expect(indianStates.length, 36);
  });
}
