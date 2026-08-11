class ClubAPITransaction {
  final String urid;
  final String type;
  final String status;
  final double amount;
  final String? message;
  final String? provider;
  final String? accountRef;
  final DateTime? createdAt;
  final Map<String, dynamic>? response;

  ClubAPITransaction({
    required this.urid,
    required this.type,
    required this.status,
    required this.amount,
    this.message,
    this.provider,
    this.accountRef,
    this.createdAt,
    this.response,
  });

  factory ClubAPITransaction.fromJson(Map<String, dynamic> json) {
    final rawAmount = json['amount'] ?? 0;
    return ClubAPITransaction(
      urid: json['urid'] ?? '',
      type: json['type'] ?? '',
      status: json['status'] ?? 'PENDING',
      amount: rawAmount is num ? rawAmount.toDouble() : double.tryParse(rawAmount.toString()) ?? 0,
      message: json['message'],
      provider: json['provider'] ?? json['operatorId'],
      accountRef: json['accountRef'],
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      response: json['response'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'urid': urid,
      'type': type,
      'status': status,
      'amount': amount,
      'message': message,
      'provider': provider,
      'accountRef': accountRef,
      'createdAt': createdAt?.toIso8601String(),
      'response': response,
    };
  }
}
