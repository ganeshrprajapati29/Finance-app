class LoanApplication {
  final num amountRequested;
  final int tenureMonths;
  final String purpose;
  final Map<String, dynamic>? personal;
  final Map<String, dynamic>? qualification;
  final Map<String, dynamic>? employment;
  final Map<String, dynamic>? documents;
  final List<dynamic>? references;

  LoanApplication({
    required this.amountRequested,
    required this.tenureMonths,
    required this.purpose,
    this.personal,
    this.qualification,
    this.employment,
    this.documents,
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
        'references': references,
      };

  void operator [](String other) {}
}

class LoanDecision {
  final num? amountApproved;
  final num? rateAPR;
  final int? tenureMonths;

  LoanDecision({this.amountApproved, this.rateAPR, this.tenureMonths});

  factory LoanDecision.fromJson(Map<String, dynamic>? json) => LoanDecision(
        amountApproved: json?['amountApproved'],
        rateAPR: json?['rateAPR'],
        tenureMonths: json?['tenureMonths'],
      );
}

class Loan {
  final String id;
  final String status;
  final LoanApplication application;
  final LoanDecision? decision;
  final List<Map<String, dynamic>> schedule;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Loan({
    required this.id,
    required this.status,
    required this.application,
    this.decision,
    this.schedule = const [],
    this.createdAt,
    this.updatedAt,
  });

  factory Loan.fromJson(Map<String, dynamic> json) => Loan(
        id: json['_id'] ?? json['id'] ?? '',
        status: json['status'] ?? 'PENDING',
        application: LoanApplication.fromJson(json['application'] ?? {}),
        decision:
            json['decision'] != null ? LoanDecision.fromJson(json['decision']) : null,
        schedule: (json['schedule'] as List<dynamic>?)?.map((e) => Map<String, dynamic>.from(e)).toList() ?? [],
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'])
            : null,
        updatedAt: json['updatedAt'] != null
            ? DateTime.tryParse(json['updatedAt'])
            : null,
      );

  Map<String, dynamic> toJson() => {
        '_id': id,
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
        'createdAt': createdAt?.toIso8601String(),
        'updatedAt': updatedAt?.toIso8601String(),
      };
}
