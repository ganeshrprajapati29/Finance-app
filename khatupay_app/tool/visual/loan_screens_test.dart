import 'dart:ui' show Size;

import 'package:flutter_test/flutter_test.dart';
import 'package:khatupay_app/models/loan.dart';
import 'package:khatupay_app/providers/loan_providers.dart';
import 'package:khatupay_app/ui/screens/loan_apply_success_page.dart';
import 'package:khatupay_app/ui/screens/loan_apply_wizard_page.dart';
import 'package:khatupay_app/ui/screens/loan_dashboard_page.dart';

import 'render_harness.dart';

Loan _loan(String status, {Map<String, dynamic>? decision, List<Map<String, dynamic>> schedule = const []}) => Loan.fromJson({
      '_id': 'l1', 'loanAccountNumber': '32009967', 'status': status,
      'application': {'amountRequested': 50000, 'tenureMonths': 12, 'purpose': 'Personal', 'personal': {'name': 'Ramesh Kumar'}},
      if (decision != null) 'decision': decision,
      'schedule': schedule,
      'createdAt': '2026-10-01T10:00:00.000Z',
      'statusHistory': [
        {'status': 'PENDING', 'title': 'Application submitted', 'createdAt': '2026-10-01T10:00:00.000Z'},
      ],
    });

void main() {
  setUpAll(loadAppFonts);

  testWidgets('wizard step 1', (tester) async {
    await renderScreen(tester, 'loan_1_wizard', const LoanApplyWizardPage(), size: const Size(390, 1250));
  });

  testWidgets('loan dashboard', (tester) async {
    await renderScreen(tester, 'loan_2_dashboard', const LoanDashboardPage(), size: const Size(390, 1100), overrides: [
      myLoansProvider.overrideWith((ref) async => [
            _loan('APPROVED', decision: {'amountApproved': 50000, 'rateAPR': 18, 'tenureMonths': 12, 'agreementStatus': 'PENDING_SIGNATURE'}),
            _loan('REJECTED', decision: {'rejectionReason': 'Income could not be verified'}),
          ]),
    ]);
  });

  testWidgets('apply success', (tester) async {
    await renderScreen(tester, 'loan_3_success', const LoanApplySuccessPage(id: '32009967'), size: const Size(390, 1000));
  });
}
