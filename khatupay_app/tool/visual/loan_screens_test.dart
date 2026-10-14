import 'dart:ui' show Size;

import 'package:flutter_test/flutter_test.dart';
import 'package:khatupay_app/ui/screens/loan_apply_success_page.dart';
import 'package:khatupay_app/ui/screens/loan_apply_wizard_page.dart';

import 'render_harness.dart';

void main() {
  setUpAll(loadAppFonts);
  tearDown(() => LoanApplyWizardPage.debugInitialStep = 0);

  for (final entry in const {0: 'loan', 1: 'income', 2: 'kyc', 3: 'bank', 4: 'review'}.entries) {
    testWidgets('wizard step ${entry.value}', (tester) async {
      LoanApplyWizardPage.debugInitialStep = entry.key;
      await renderScreen(tester, 'loan_w${entry.key}_${entry.value}', const LoanApplyWizardPage(), size: const Size(390, 1500));
    });
  }

  testWidgets('apply success', (tester) async {
    await renderScreen(tester, 'loan_success', const LoanApplySuccessPage(id: '32009967'), size: const Size(390, 1000));
  });
}
