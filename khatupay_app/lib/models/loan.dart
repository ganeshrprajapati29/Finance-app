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
        amountRequested: json['amountRequested'] ?? 0,
        tenureMonths: json['tenureMonths'] ?? 0,
        purpose: json['purpose'] ?? '',
        personal: json['personal'],
        qualification: json['qualification'],
        employment: json['employment'],
        documents: json['documents'],
        bankDetails: json['bankDetails'],
        references: json['references'],
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

  LoanDecision({this.amountApproved, this.rateAPR, this.tenureMonths, this.processingFee,
    this.taxAmount, this.netDisbursalAmount, this.rejectionReason, this.lenderName,
    this.kfsUrl, this.agreementUrl});

  factory LoanDecision.fromJson(Map<String, dynamic>? json) => LoanDecision(
        amountApproved: json?['amountApproved'],
        rateAPR: json?['rateAPR'],
        tenureMonths: json?['tenureMonths'],
        processingFee: json?['processingFee'],
        taxAmount: json?['taxAmount'],
        netDisbursalAmount: json?['netDisbursalAmount'],
        rejectionReason: json?['rejectionReason']?.toString(),
        lenderName: json?['lenderName']?.toString(),
        kfsUrl: json?['kfsUrl']?.toString(),
        agreementUrl: json?['agreementUrl']?.toString(),
      );
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

  factory Loan.fromJson(Map<String, dynamic> json) => Loan(
        id: json['_id'] ?? json['id'] ?? '',
        loanAccountNumber: json['loanAccountNumber']?.toString() ?? '',
        status: json['status'] ?? 'PENDING',
        application: LoanApplication.fromJson(json['application'] ?? {}),
        decision:
            json['decision'] != null ? LoanDecision.fromJson(json['decision']) : null,
        schedule: (json['schedule'] as List<dynamic>?)?.map((e) => Map<String, dynamic>.from(e)).toList() ?? [],
        transactions: (json['transactions'] as List<dynamic>?)?.map((e) => Map<String, dynamic>.from(e)).toList() ?? [],
        statusHistory: (json['statusHistory'] as List<dynamic>?)?.map((e) => Map<String, dynamic>.from(e)).toList() ?? [],
        disbursement: json['disbursement'] is Map
            ? Map<String, dynamic>.from(json['disbursement']) : null,
        disbursementDate: json['disbursementDate'] != null
            ? DateTime.tryParse(json['disbursementDate'])
            : null,
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'])
            : null,
        updatedAt: json['updatedAt'] != null
            ? DateTime.tryParse(json['updatedAt'])
            : null,
      );

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
