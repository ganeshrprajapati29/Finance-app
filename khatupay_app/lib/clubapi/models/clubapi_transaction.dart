class ClubAPITransaction {
  final String urid;
  final String type;
  final String service;
  final String status;
  final double amount;
  final String? message;
  final String? provider;
  final String? accountRef;
  final String? billId;
  final String? customerMobile;
  final String? paymentId;
  final Map<String, dynamic>? refund;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final Map<String, dynamic>? response;

  ClubAPITransaction({
    required this.urid,
    required this.type,
    this.service = '',
    required this.status,
    required this.amount,
    this.message,
    this.provider,
    this.accountRef,
    this.billId,
    this.customerMobile,
    this.paymentId,
    this.refund,
    this.createdAt,
    this.updatedAt,
    this.response,
  });

  factory ClubAPITransaction.fromJson(Map<String, dynamic> json) {
    final rawAmount = json['amount'] ?? 0;
    return ClubAPITransaction(
      urid: json['urid'] ?? '',
      type: json['type'] ?? '',
      service: (json['service'] ?? json['serviceKey'] ?? '').toString(),
      status: json['status'] ?? 'PENDING',
      amount: rawAmount is num
          ? rawAmount.toDouble()
          : double.tryParse(rawAmount.toString()) ?? 0,
      message: json['message'],
      provider: json['provider'] ?? json['operatorId'],
      accountRef: json['accountRef'],
      billId: json['billId']?.toString(),
      customerMobile: json['customerMobile']?.toString(),
      paymentId: json['paymentId']?.toString(),
      refund: json['refund'] is Map
          ? Map<String, dynamic>.from(json['refund'])
          : null,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
      response: json['response'] is Map
          ? Map<String, dynamic>.from(json['response'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'urid': urid,
      'type': type,
      'service': service,
      'status': status,
      'amount': amount,
      'message': message,
      'provider': provider,
      'accountRef': accountRef,
      'billId': billId,
      'customerMobile': customerMobile,
      'paymentId': paymentId,
      'refund': refund,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'response': response,
    };
  }
}
