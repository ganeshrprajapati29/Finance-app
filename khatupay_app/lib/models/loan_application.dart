class LoanReference {
  String name;
  String relation;
  String mobile;
  LoanReference({required this.name, required this.relation, required this.mobile});

  Map<String, dynamic> toJson() => {
    'name': name, 'relation': relation, 'mobile': mobile,
  };
}

class LoanApplicationDraft {
  // Step 1: Personal
  String name = '';
  String email = '';
  String mobile = '';
  String address = '';
  String fatherName = '';
  String motherName = '';

  // Step 2: Qualification
  String highestEducation = ''; // 10th/12th/Graduate/PostGraduate/Other
  String stream = '';           // Commerce/Arts/Science/etc.
  String institution = '';

  // Step 3: Employment / Income
  String employmentType = ''; // Salaried/Self-Employed/Student/Housewife/Unemployed
  num monthlyIncome = 0;
  String employerOrBusiness = '';
  int experienceYears = 0;

  // Step 4: Documents (local file paths or uploaded URLs)
  String aadhaarFrontPath = '';
  String aadhaarBackPath = '';
  String panPath = '';
  String selfiePath = '';

  // After upload to backend -> store URLs (optional)
  String? aadhaarFrontUrl;
  String? aadhaarBackUrl;
  String? panUrl;
  String? selfieUrl;

  // Step 5: References (min 3)
  List<LoanReference> references = [
    LoanReference(name: '', relation: '', mobile: ''),
    LoanReference(name: '', relation: '', mobile: ''),
    LoanReference(name: '', relation: '', mobile: ''),
  ];

  // Requested loan
  num amountRequested = 0;
  int tenureMonths = 12;
  String purpose = 'Personal';

  Map<String, dynamic> toJson() => {
    'personal': {
      'name': name, 'email': email, 'mobile': mobile, 'address': address,
      'fatherName': fatherName, 'motherName': motherName,
    },
    'qualification': {
      'highestEducation': highestEducation, 'stream': stream, 'institution': institution,
    },
    'employment': {
      'employmentType': employmentType, 'monthlyIncome': monthlyIncome,
      'employerOrBusiness': employerOrBusiness, 'experienceYears': experienceYears,
    },
    'documents': {
      'aadhaarFrontUrl': aadhaarFrontUrl, 'aadhaarBackUrl': aadhaarBackUrl,
      'panUrl': panUrl, 'selfieUrl': selfieUrl,
    },
    'references': references.map((r)=>r.toJson()).toList(),
    'amountRequested': amountRequested,
    'tenureMonths': tenureMonths,
    'purpose': purpose,
  };
}
