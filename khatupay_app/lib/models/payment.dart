class Payment {
  final String id, type, status, method, reference;
  final num amount;

  Payment({required this.id, required this.type, required this.status, required this.method, required this.reference, required this.amount});

  factory Payment.fromJson(Map j) => Payment(
    id: j['_id'],
    type: j['type'] ?? 'OTHER',
    status: j['status'] ?? 'PENDING',
    method: j['method'] ?? '',
    reference: j['reference'] ?? '',
    amount: j['amount'] ?? 0,
  );
}
