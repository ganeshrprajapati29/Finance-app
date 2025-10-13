class Bill {
  final String id, type, provider, accountRef, status;
  final num amount;

  Bill({required this.id, required this.type, required this.provider, required this.accountRef, required this.status, required this.amount});

  factory Bill.fromJson(Map j) => Bill(
    id: j['_id'],
    type: j['type'] ?? 'OTHER',
    provider: j['provider'] ?? '',
    accountRef: j['accountRef'] ?? '',
    status: j['status'] ?? 'PENDING',
    amount: j['amount'] ?? 0,
  );
}
