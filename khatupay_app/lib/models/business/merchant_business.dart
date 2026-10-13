class MerchantBusiness {
  const MerchantBusiness(
      {required this.id,
      required this.publicId,
      required this.businessName,
      required this.ownerName,
      required this.category,
      required this.status,
      this.mobile = '',
      this.email = '',
      this.address = '',
      this.razorpay,
      this.onboardingRequest});
  final String id, publicId, businessName, ownerName, category, status;
  final String mobile, email, address;
  final Map<String, dynamic>? razorpay;

  /// What the owner already submitted for payment activation.
  final Map<String, dynamic>? onboardingRequest;
  factory MerchantBusiness.fromJson(Map<String, dynamic> json) =>
      MerchantBusiness(
          id: (json['_id'] ?? '').toString(),
          publicId: (json['publicId'] ?? '').toString(),
          businessName: (json['businessName'] ?? '').toString(),
          ownerName: (json['ownerName'] ?? '').toString(),
          category: (json['category'] ?? '').toString(),
          status: (json['status'] ?? 'DRAFT').toString(),
          mobile: (json['mobile'] ?? '').toString(),
          email: (json['email'] ?? '').toString(),
          address: (json['address'] ?? '').toString(),
          razorpay: json['razorpay'] is Map
              ? Map<String, dynamic>.from(json['razorpay'])
              : null,
          onboardingRequest: json['onboardingRequest'] is Map
              ? Map<String, dynamic>.from(json['onboardingRequest'])
              : null);
}

/// One row of the business setup checklist, computed by the server so the app
/// and the admin panel always agree on what is done and what is next.
class MerchantStep {
  const MerchantStep(
      {required this.key,
      required this.title,
      required this.status,
      this.message = ''});

  /// profile | personalKyc | bank | businessDetails | activation | qr
  final String key;
  final String title;

  /// DONE | CURRENT | REVIEW | FAILED | LOCKED
  final String status;
  final String message;

  bool get isDone => status == 'DONE';
  bool get needsAction => status == 'CURRENT' || status == 'FAILED';

  factory MerchantStep.fromJson(Map<String, dynamic> json) => MerchantStep(
      key: (json['key'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      status: (json['status'] ?? 'LOCKED').toString(),
      message: (json['message'] ?? '').toString());
}

class MerchantRequirement {
  const MerchantRequirement(
      {required this.field,
      required this.label,
      required this.kind,
      this.reason = ''});
  final String field, label;

  /// DOCUMENT | BANK | DETAIL
  final String kind;
  final String reason;
  factory MerchantRequirement.fromJson(Map<String, dynamic> json) =>
      MerchantRequirement(
          field: (json['field'] ?? '').toString(),
          label: (json['label'] ?? '').toString(),
          kind: (json['kind'] ?? 'DETAIL').toString(),
          reason: (json['reason'] ?? '').toString());
}

class MerchantOnboarding {
  const MerchantOnboarding(
      {this.steps = const [],
      this.nextStep,
      this.progress = 0,
      this.canCreateQr = false,
      this.qrActive = false,
      this.requirements = const [],
      this.providerState = 'NOT_STARTED'});
  final List<MerchantStep> steps;
  final String? nextStep;
  final int progress;
  final bool canCreateQr, qrActive;
  final List<MerchantRequirement> requirements;
  final String providerState;

  MerchantStep? step(String key) {
    for (final item in steps) {
      if (item.key == key) return item;
    }
    return null;
  }

  factory MerchantOnboarding.fromJson(Map<String, dynamic>? json) {
    List<T> list<T>(dynamic value, T Function(Map<String, dynamic>) parse) =>
        value is List
            ? value
                .whereType<Map>()
                .map((e) => parse(Map<String, dynamic>.from(e)))
                .toList()
            : <T>[];
    return MerchantOnboarding(
        steps: list(json?['steps'], MerchantStep.fromJson),
        nextStep: json?['nextStep']?.toString(),
        progress: (json?['progress'] as num?)?.toInt() ?? 0,
        canCreateQr: json?['canCreateQr'] == true,
        qrActive: json?['qrActive'] == true,
        requirements: list(json?['requirements'], MerchantRequirement.fromJson),
        providerState: (json?['providerState'] ?? 'NOT_STARTED').toString());
  }
}

class MerchantDashboard {
  const MerchantDashboard(
      {this.business,
      this.kyc,
      this.bank,
      this.qr,
      this.personalKyc,
      this.onboarding = const MerchantOnboarding()});
  final MerchantBusiness? business;
  final Map<String, dynamic>? kyc, bank, qr, personalKyc;
  final MerchantOnboarding onboarding;

  bool get ownerVerified =>
      personalKyc?['panVerified'] == true &&
      personalKyc?['aadhaarVerified'] == true;

  factory MerchantDashboard.fromJson(Map<String, dynamic>? json) {
    Map<String, dynamic>? map(String key) => json?[key] is Map
        ? Map<String, dynamic>.from(json![key] as Map)
        : null;
    final business = map('business');
    return MerchantDashboard(
        business: business == null ? null : MerchantBusiness.fromJson(business),
        kyc: map('kyc'),
        bank: map('bank'),
        qr: map('qr'),
        personalKyc: map('personalKyc'),
        onboarding: MerchantOnboarding.fromJson(map('onboarding')));
  }
}

class MerchantPayment {
  const MerchantPayment(
      {required this.id,
      required this.orderId,
      required this.amount,
      required this.status,
      this.utr,
      this.createdAt});
  final String id, orderId, status;
  final num amount;
  final String? utr;
  final DateTime? createdAt;
  factory MerchantPayment.fromJson(Map<String, dynamic> json) =>
      MerchantPayment(
          id: (json['_id'] ?? '').toString(),
          orderId: (json['orderId'] ?? '').toString(),
          amount: json['amount'] is num
              ? json['amount']
              : num.tryParse('${json['amount']}') ?? 0,
          status: (json['status'] ?? 'PENDING').toString(),
          utr: json['utr']?.toString(),
          createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}'));
}

class MerchantSettlement {
  const MerchantSettlement(
      {required this.id,
      required this.settlementId,
      required this.amount,
      required this.status,
      this.utr,
      this.createdAt});
  final String id, settlementId, status;
  final num amount;
  final String? utr;
  final DateTime? createdAt;
  factory MerchantSettlement.fromJson(Map<String, dynamic> json) =>
      MerchantSettlement(
          id: (json['_id'] ?? '').toString(),
          settlementId: (json['settlementId'] ?? '').toString(),
          amount: json['amount'] is num
              ? json['amount']
              : num.tryParse('${json['amount']}') ?? 0,
          status: (json['status'] ?? 'REQUESTED').toString(),
          utr: json['utr']?.toString(),
          createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}'));
}
