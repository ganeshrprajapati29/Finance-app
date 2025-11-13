class KPUser {
  final String id, name, email, mobile;
  final bool emailVerified;
  final List roles;
  final num loanLimit;
  final num? walletBalance;

  KPUser({required this.id, required this.name, required this.email, required this.mobile, required this.emailVerified, required this.roles, required this.loanLimit, this.walletBalance});

  factory KPUser.fromJson(Map j) => KPUser(
    id: j['id']?.toString() ?? j['_id']?.toString() ?? '',
    name: j['name'] ?? '',
    email: j['email'] ?? '',
    mobile: j['mobile'] ?? '',
    emailVerified: j['emailVerified'] ?? false,
    roles: (j['roles'] ?? []) as List,
    loanLimit: (j['loanLimit']?['amount'] ?? 0) as num,
    walletBalance: j['walletBalance'] as num?,
  );
}
