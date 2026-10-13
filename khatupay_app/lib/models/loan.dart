class LoanApplication {
  final num amountRequested;
  final int tenureMonths;
  final String purpose;
  final Map<String, dynamic>? personal;
  final Map<String, dynamic>? qualification;
  final Map<String, dynamic>? employment;
  final Map<String, dynamic>? documents;
  final Map<String, dynamic>? bankDetails;
  final List<dynamic>? references;

  LoanApplication({
    required this.amountRequested,
    required this.tenureMonths,
    required this.purpose,
    this.personal,
    this.qualification,
    this.employment,
    this.documents,
    this.bankDetails,
    this.references,
  });

  factory LoanApplication.fromJson(Map<String, dynamic> json) => LoanApplication(
        amountRequested: _numValue(json['amountRequested']),
        tenureMonths: _numValue(json['tenureMonths']).toInt(),
        purpose: json['purpose']?.toString() ?? '',
        personal: _mapValue(json['personal']),
        qualification: _mapValue(json['qualification']),
        employment: _mapValue(json['employment']),
        documents: _mapValue(json['documents']),
        bankDetails: _mapValue(json['bankDetails']),
        references: json['references'] is List ? json['references'] as List : const [],
      );

  Map<String, dynamic> toJson() => {
        'amountRequested': amountRequested,
        'tenureMonths': tenureMonths,
        'purpose': purpose,
        'personal': personal,
        'qualification': qualification,
        'employment': employment,
        'documents': documents,
        'bankDetails': bankDetails,
        'references': references,
      };

  static num _numValue(dynamic value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;

  static Map<String, dynamic>? _mapValue(dynamic value) => value is Map
      ? Map<String, dynamic>.from(value)
      : null;
}

class LoanDecision {
  final num? amountApproved;
  final num? rateAPR;
  final int? tenureMonths;
  final num? processingFee;
  final num? taxAmount;
  final num? netDisbursalAmount;
  final String? rejectionReason;
  final String? lenderName;
  final String? kfsUrl;
  final String? agreementUrl;
  final String? signedAgreementUrl;
  final String? agreementStatus;
  final String? agreementDocumentId;
  final DateTime? agreementSignedAt;

  LoanDecision({this.amountApproved, this.rateAPR, this.tenureMonths, this.processingFee,
    this.taxAmount, this.netDisbursalAmount, this.rejectionReason, this.lenderName,
    this.kfsUrl, this.agreementUrl, this.signedAgreementUrl,
    this.agreementStatus, this.agreementDocumentId, this.agreementSignedAt});

  factory LoanDecision.fromJson(Map<String, dynamic>? json) => LoanDecision(
        amountApproved: _numValue(json?['amountApproved']),
        rateAPR: _numValue(json?['rateAPR']),
        tenureMonths: _intValue(json?['tenureMonths']),
        processingFee: _numValue(json?['processingFee']),
        taxAmount: _numValue(json?['taxAmount']),
        netDisbursalAmount: _numValue(json?['netDisbursalAmount']),
        rejectionReason: json?['rejectionReason']?.toString(),
        lenderName: json?['lenderName']?.toString(),
        kfsUrl: json?['kfsUrl']?.toString(),
        agreementUrl: json?['agreementUrl']?.toString(),
        signedAgreementUrl: json?['signedAgreementUrl']?.toString(),
        agreementStatus: json?['agreementStatus']?.toString(),
        agreementDocumentId: json?['agreementDocumentId']?.toString(),
        agreementSignedAt: _dateValue(json?['agreementSignedAt']),
      );

  static num? _numValue(dynamic value) {
    if (value == null) return null;
    return value is num ? value : num.tryParse(value.toString());
  }

  static int? _intValue(dynamic value) => _numValue(value)?.toInt();

  static DateTime? _dateValue(dynamic value) => value is DateTime
      ? value
      : DateTime.tryParse(value?.toString() ?? '');
}

class Loan {
  final String id;
  final String loanAccountNumber;
  final String status;
  final LoanApplication application;
  final LoanDecision? decision;
  final List<Map<String, dynamic>> schedule;
  final List<Map<String, dynamic>> transactions;
  final List<Map<String, dynamic>> statusHistory;
  final Map<String, dynamic>? disbursement;
  final DateTime? disbursementDate;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Loan({
    required this.id,
    this.loanAccountNumber = '',
    required this.status,
    required this.application,
    this.decision,
    this.schedule = const [],
    this.transactions = const [],
    this.statusHistory = const [],
    this.disbursement,
    this.disbursementDate,
    this.createdAt,
    this.updatedAt,
  });

  /// Agreement state as the server mirrors it on the decision
  /// (PENDING_SIGNATURE / SIGNED / FAILED). The detail screen refines it with
  /// GET /loans/:id/agreement, which also reports SIGNING.
  String? get agreementStatus => decision?.agreementStatus;

  factory Loan.fromJson(Map<String, dynamic> json) => Loan(
        id: (json['_id'] ?? json['id'] ?? '').toString(),
        loanAccountNumber: json['loanAccountNumber']?.toString() ?? '',
        status: json['status']?.toString() ?? 'PENDING',
        application: LoanApplication.fromJson(_map(json['application'])),
        decision: json['decision'] is Map
            ? LoanDecision.fromJson(Map<String, dynamic>.from(json['decision']))
            : null,
        schedule: _mapList(json['schedule']),
        transactions: _mapList(json['transactions']),
        statusHistory: _mapList(json['statusHistory']),
        disbursement: _mapOrNull(json['disbursement']),
        disbursementDate: _date(json['disbursementDate']),
        createdAt: _date(json['createdAt']),
        updatedAt: _date(json['updatedAt']),
      );

  static Map<String, dynamic> _map(dynamic value) => value is Map
      ? Map<String, dynamic>.from(value)
      : const <String, dynamic>{};

  static Map<String, dynamic>? _mapOrNull(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : null;

  static List<Map<String, dynamic>> _mapList(dynamic value) => value is List
      ? value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList()
      : const <Map<String, dynamic>>[];

  static DateTime? _date(dynamic value) => value is DateTime
      ? value
      : DateTime.tryParse(value?.toString() ?? '');

  Map<String, dynamic> toJson() => {
        '_id': id,
        'loanAccountNumber': loanAccountNumber,
        'status': status,
        'application': application.toJson(),
        'decision': decision != null
            ? {
                'amountApproved': decision?.amountApproved,
                'rateAPR': decision?.rateAPR,
                'tenureMonths': decision?.tenureMonths,
                'agreementUrl': decision?.agreementUrl,
                'signedAgreementUrl': decision?.signedAgreementUrl,
                'agreementStatus': decision?.agreementStatus,
                'agreementDocumentId': decision?.agreementDocumentId,
                'agreementSignedAt': decision?.agreementSignedAt?.toIso8601String(),
              }
            : null,
        'schedule': schedule,
        'transactions': transactions,
        'statusHistory': statusHistory,
        'disbursement': disbursement,
        'disbursementDate': disbursementDate?.toIso8601String(),
        'createdAt': createdAt?.toIso8601String(),
        'updatedAt': updatedAt?.toIso8601String(),
      };

  num get approvedAmount => decision?.amountApproved ?? application.amountRequested;

  Iterable<Map<String, dynamic>> get paidInstallments =>
      schedule.where((s) => s['paid'] == true);

  Iterable<Map<String, dynamic>> get pendingInstallments =>
      schedule.where((s) => s['paid'] != true);

  num get paidAmount => paidInstallments.fold<num>(
        0,
        (sum, s) => sum + _numValue(s['total']),
      );

  num get outstandingAmount => pendingInstallments.fold<num>(
        0,
        (sum, s) => sum + _numValue(s['total']),
      );

  double get repaymentProgress {
    if (schedule.isEmpty) return status == 'CLOSED' ? 1 : 0;
    return paidInstallments.length / schedule.length;
  }

  Map<String, dynamic>? get nextInstallment {
    final pending = pendingInstallments.toList()
      ..sort((a, b) => _dateValue(a['dueDate']).compareTo(_dateValue(b['dueDate'])));
    return pending.isEmpty ? null : pending.first;
  }

  static num _numValue(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  static DateTime _dateValue(dynamic value) {
    if (value is DateTime) return value;
    return DateTime.tryParse(value?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
  }
}
