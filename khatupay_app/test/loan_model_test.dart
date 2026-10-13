import 'package:flutter_test/flutter_test.dart';
import 'package:khatupay_app/models/loan.dart';

void main() {
  test('Loan parsing tolerates optional API fields with unexpected shapes', () {
    final loan = Loan.fromJson({
      '_id': 12345,
      'status': 'DISBURSED',
      'application': {
        'amountRequested': '25000',
        'tenureMonths': '12',
        'personal': 'not-a-map',
        'references': 'not-a-list',
      },
      'decision': {
        'amountApproved': '25000.50',
        'rateAPR': '18',
        'tenureMonths': '12',
        'agreementSignedAt': '2026-10-11T10:00:00Z',
      },
      'schedule': {'not': 'a-list'},
      'transactions': [
        {'amount': '1000'},
        'unexpected-row',
      ],
      'statusHistory': null,
      'createdAt': 123,
    });

    expect(loan.id, '12345');
    expect(loan.application.amountRequested, 25000);
    expect(loan.application.tenureMonths, 12);
    expect(loan.application.personal, isNull);
    expect(loan.application.references, isEmpty);
    expect(loan.decision?.amountApproved, 25000.50);
    expect(loan.decision?.rateAPR, 18);
    expect(loan.decision?.tenureMonths, 12);
    expect(loan.decision?.agreementSignedAt, isNotNull);
    expect(loan.schedule, isEmpty);
    expect(loan.transactions, hasLength(1));
    expect(loan.statusHistory, isEmpty);
    expect(loan.createdAt, isNull);
  });
}
