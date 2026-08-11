class ClubAPIBill {
  final String urid;
  final String customerName;
  final double amount;
  final String dueDate;
  final String billNumber;
  final String? billDate;
  final String? billPeriod;
  final Map<String, dynamic>? additionalInfo;

  ClubAPIBill({
    this.urid = '',
    required this.customerName,
    required this.amount,
    required this.dueDate,
    required this.billNumber,
    this.billDate,
    this.billPeriod,
    this.additionalInfo,
  });

  factory ClubAPIBill.fromJson(Map<String, dynamic> json) {
    final source = json['billData'] is Map
        ? Map<String, dynamic>.from(json['billData'])
        : json['data'] is Map
            ? Map<String, dynamic>.from(json['data'])
            : json;
    final rawAmount = source['amount'] ??
        source['dueAmount'] ??
        source['billAmount'] ??
        source['billNetAmount'] ??
        source['billnetamount'] ??
        0;
    return ClubAPIBill(
      urid: source['urid'] ?? json['urid'] ?? source['billId'] ?? json['billId'] ?? json['_id'] ?? '',
      customerName: source['customerName'] ?? source['name'] ?? source['consumerName'] ?? '',
      amount: rawAmount is num ? rawAmount.toDouble() : double.tryParse(rawAmount.toString()) ?? 0,
      dueDate: source['dueDate'] ?? source['billDueDate'] ?? '',
      billNumber: source['billNumber'] ?? source['billNo'] ?? source['billId'] ?? '',
      billDate: source['billDate'],
      billPeriod: source['billPeriod'],
      additionalInfo: source['additionalInfo'] is Map ? Map<String, dynamic>.from(source['additionalInfo']) : source,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'customerName': customerName,
      'urid': urid,
      'amount': amount,
      'dueDate': dueDate,
      'billNumber': billNumber,
      'billDate': billDate,
      'billPeriod': billPeriod,
      'additionalInfo': additionalInfo,
    };
  }
}
