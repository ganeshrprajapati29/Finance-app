class MerchantBusiness {
  const MerchantBusiness({required this.id, required this.publicId, required this.businessName, required this.ownerName, required this.category, required this.status});
  final String id, publicId, businessName, ownerName, category, status;
  factory MerchantBusiness.fromJson(Map<String, dynamic> json) => MerchantBusiness(
    id: (json['_id'] ?? '').toString(), publicId: (json['publicId'] ?? '').toString(),
    businessName: (json['businessName'] ?? '').toString(), ownerName: (json['ownerName'] ?? '').toString(),
    category: (json['category'] ?? '').toString(), status: (json['status'] ?? 'DRAFT').toString());
}

class MerchantDashboard {
  const MerchantDashboard({this.business, this.kyc, this.bank, this.qr});
  final MerchantBusiness? business;
  final Map<String, dynamic>? kyc, bank, qr;
  factory MerchantDashboard.fromJson(Map<String, dynamic>? json) => MerchantDashboard(
    business: json?['business'] is Map ? MerchantBusiness.fromJson(Map<String, dynamic>.from(json!['business'])) : null,
    kyc: json?['kyc'] is Map ? Map<String, dynamic>.from(json!['kyc']) : null,
    bank: json?['bank'] is Map ? Map<String, dynamic>.from(json!['bank']) : null,
    qr: json?['qr'] is Map ? Map<String, dynamic>.from(json!['qr']) : null);
}

class MerchantPayment {
  const MerchantPayment({required this.id, required this.orderId, required this.amount, required this.status, this.utr, this.createdAt});
  final String id, orderId, status; final num amount; final String? utr; final DateTime? createdAt;
  factory MerchantPayment.fromJson(Map<String, dynamic> json) => MerchantPayment(
    id: (json['_id'] ?? '').toString(), orderId: (json['orderId'] ?? '').toString(), amount: json['amount'] is num ? json['amount'] : num.tryParse('${json['amount']}') ?? 0,
    status: (json['status'] ?? 'PENDING').toString(), utr: json['utr']?.toString(), createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}'));
}

class MerchantSettlement {
  const MerchantSettlement({required this.id, required this.settlementId, required this.amount, required this.status, this.utr, this.createdAt});
  final String id, settlementId, status; final num amount; final String? utr; final DateTime? createdAt;
  factory MerchantSettlement.fromJson(Map<String, dynamic> json) => MerchantSettlement(
    id: (json['_id'] ?? '').toString(), settlementId: (json['settlementId'] ?? '').toString(), amount: json['amount'] is num ? json['amount'] : num.tryParse('${json['amount']}') ?? 0,
    status: (json['status'] ?? 'REQUESTED').toString(), utr: json['utr']?.toString(), createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}'));
}
