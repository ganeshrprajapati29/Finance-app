class KPUser {
  final String id, name, email, mobile, upiId, khatuUpiId;
  final bool emailVerified;
  final List roles;
  final num loanLimit;
  final num? walletBalance;
  final Map<String, dynamic>? kyc;

  KPUser({
    required this.id,
    required this.name,
    required this.email,
    required this.mobile,
    required this.upiId,
    required this.khatuUpiId,
    required this.emailVerified,
    required this.roles,
    required this.loanLimit,
    this.walletBalance,
    this.kyc,
  });

  factory KPUser.fromJson(Map j) => KPUser(
    id: j['id']?.toString() ?? j['_id']?.toString() ?? '',
    name: j['name'] ?? '',
    email: j['email'] ?? '',
    mobile: j['mobile'] ?? '',
    upiId: j['upiId'] ?? '',
    khatuUpiId: j['khatuUpiId'] ?? '',
    emailVerified: j['emailVerified'] ?? false,
    roles: (j['roles'] ?? []) as List,
    loanLimit: (j['loanLimit']?['amount'] ?? 0) as num,
    walletBalance: j['walletBalance'] as num?,
    kyc: j['kyc'] is Map ? Map<String, dynamic>.from(j['kyc']) : null,
  );
}
