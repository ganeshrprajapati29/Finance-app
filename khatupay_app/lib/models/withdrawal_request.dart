class WithdrawalRequest {
  final String id;
  final num amount;
  final Map<String, dynamic> bankDetails;
  final String status;
  final DateTime? createdAt;
  final DateTime? decidedAt;
  final String? txnId;
  final String? notes;

  WithdrawalRequest({
    required this.id,
    required this.amount,
    required this.bankDetails,
    required this.status,
    this.createdAt,
    this.decidedAt,
    this.txnId,
    this.notes,
  });

  factory WithdrawalRequest.fromJson(Map<String, dynamic> json) => WithdrawalRequest(
    id: json['_id'] ?? json['id'] ?? '',
    amount: json['amount'] ?? 0,
    bankDetails: json['bankDetails'] ?? {},
    status: json['status'] ?? 'PENDING',
    createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
    decidedAt: json['decidedAt'] != null ? DateTime.tryParse(json['decidedAt']) : null,
    txnId: json['txnId'],
    notes: json['notes'],
  );
}
