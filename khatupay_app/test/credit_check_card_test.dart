// ignore_for_file: depend_on_referenced_packages

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khatupay_app/ui/widgets/credit_check_card.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

CreditCheckCard _card({
  bool checking = false,
  String status = '',
  Map<String, dynamic>? summary,
  String? message,
  bool enabled = true,
  Future<bool> Function()? onCheck,
}) =>
    CreditCheckCard(
      checking: checking,
      status: status,
      summary: summary,
      message: message,
      enabled: enabled,
      onCheck: onCheck ?? () async => true,
    );

void main() {
  testWidgets('idle: offers a manual check, disabled until consent is given',
      (tester) async {
    var taps = 0;
    await tester.pumpWidget(_host(_card(
      enabled: false,
      onCheck: () async {
        taps++;
        return true;
      },
    )));
    expect(find.text('Credit check'), findsOneWidget);
    await tester.tap(find.text('Check now'));
    await tester.pump();
    expect(taps, 0, reason: 'button is disabled without consent');

    await tester.pumpWidget(_host(_card(
      onCheck: () async {
        taps++;
        return true;
      },
    )));
    await tester.tap(find.text('Check now'));
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('checking: shows progress and no action', (tester) async {
    await tester.pumpWidget(_host(_card(checking: true)));
    expect(find.text('Checking your credit report'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byType(TextButton), findsNothing);
  });

  testWidgets('verified: shows score, band and account count', (tester) async {
    await tester.pumpWidget(_host(_card(
      status: 'VERIFIED',
      summary: {'score': 628, 'scoreBand': 'Low', 'accountCount': 3},
    )));
    expect(find.text('Credit report received'), findsOneWidget);
    expect(find.textContaining('Experian score 628 - Low'), findsOneWidget);
    expect(find.textContaining('3 credit accounts on file'), findsOneWidget);
  });

  testWidgets('verified without a score or summary still reads cleanly',
      (tester) async {
    await tester.pumpWidget(_host(_card(status: 'VERIFIED')));
    expect(find.text('Report received from Experian.'), findsOneWidget);

    await tester.pumpWidget(_host(_card(
      status: 'VERIFIED',
      summary: {'score': null, 'accountCount': 1},
    )));
    expect(find.textContaining('Report received from Experian.'), findsOneWidget);
    expect(find.textContaining('1 credit account on file'), findsOneWidget);
  });

  testWidgets('review: explains manual review and never blocks',
      (tester) async {
    await tester.pumpWidget(_host(_card(status: 'REVIEW')));
    expect(find.text('No credit history found'), findsOneWidget);
    expect(find.textContaining('You can still submit'), findsOneWidget);
    expect(find.byType(TextButton), findsNothing);
  });

  testWidgets('failed: shows the message with a working retry', (tester) async {
    var taps = 0;
    await tester.pumpWidget(_host(_card(
      message: 'Please check your internet connection and try again.',
      onCheck: () async {
        taps++;
        return true;
      },
    )));
    expect(find.text('Credit report not available'), findsOneWidget);
    expect(find.textContaining('internet connection'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    await tester.pump();
    expect(taps, 1);
  });
}
