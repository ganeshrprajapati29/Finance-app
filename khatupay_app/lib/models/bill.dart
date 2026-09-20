class Bill {
  final String id, type, provider, accountRef, status;
  final num amount;
  final DateTime? dueDate;
  final DateTime? paidAt;
  final DateTime? createdAt;

  Bill({
    required this.id,
    required this.type,
    required this.provider,
    required this.accountRef,
    required this.status,
    required this.amount,
    this.dueDate,
    this.paidAt,
    this.createdAt,
  });

  factory Bill.fromJson(Map j) => Bill(
    id: j['_id']?.toString() ?? j['id']?.toString() ?? '',
    type: j['type'] ?? 'OTHER',
    provider: j['provider'] ?? '',
    accountRef: j['accountRef'] ?? '',
    status: j['status'] ?? 'PENDING',
    amount: j['amount'] ?? 0,
    dueDate: j['dueDate'] != null ? DateTime.tryParse(j['dueDate'].toString()) : null,
    paidAt: j['paidAt'] != null ? DateTime.tryParse(j['paidAt'].toString()) : null,
    createdAt: j['createdAt'] != null ? DateTime.tryParse(j['createdAt'].toString()) : null,
  );
}
