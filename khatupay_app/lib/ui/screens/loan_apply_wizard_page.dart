import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:image_picker/image_picker.dart';

import '../../clubapi/services/clubapi_service_updated.dart';
import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../models/loan_application.dart';
import '../../routes/app_router.dart';
import '../../services/loan_service.dart';
import '../../services/user_service.dart';
import '../widgets/app_back_button.dart';
import '../widgets/kp_widgets.dart';
import '../widgets/offer_banner_carousel.dart';

const _kLoanTypes = [
  'Personal',
  'Business',
  'Medical',
  'Education',
  'Home Renovation',
  'Wedding',
  'Vehicle',
  'Other',
];

const _kEmploymentTypes = [
  'Salaried',
  'Self-Employed',
  'Business Owner',
  'Student',
  'Homemaker',
  'Unemployed',
  'Other',
];

const _kIncomeProofTypes = [
  ('SALARY_SLIP', 'Salary Slip'),
  ('BANK_STATEMENT', 'Bank Statement'),
  ('OTHER', 'Other'),
];

class LoanApplyWizardPage extends StatefulWidget {
  const LoanApplyWizardPage({super.key});

  @override
  State<LoanApplyWizardPage> createState() => _LoanApplyWizardPageState();
}

/// Ordered step labels. The last entry is the read-only review screen, which
/// has no form of its own - it renders what the previous four collected.
const _kStepTitles = ['Loan', 'Income', 'KYC', 'Bank', 'Review'];

class _LoanApplyWizardPageState extends State<LoanApplyWizardPage> {
  final _pageController = PageController();
  final _formKeys = List.generate(5, (_) => GlobalKey<FormState>());
  final _draft = LoanApplicationDraft();

  /// Index of the read-only review step.
  static const int _reviewStep = 4;

  int _step = 0;
  bool _submitting = false;
  bool _checkingEligibility = true;
  bool _canApply = true;
  bool _consentAccepted = false;
  String? _eligibilityMessage;
  String? _submitError;

  final nameC = TextEditingController();
  final emailC = TextEditingController();
  final mobileC = TextEditingController();
  final addressC = TextEditingController();
  final amountC = TextEditingController(text: '10000');
  final tenureC = TextEditingController(text: '12');
  String _loanType = _kLoanTypes.first;

  String _employmentType = _kEmploymentTypes.first;
  final monthlyIncomeC = TextEditingController();
  final employerC = TextEditingController();
  String _incomeProofType = _kIncomeProofTypes.first.$1;
  String _incomeProofPath = '';
  String _incomeProofFileName = '';
  bool _pickingIncomeProof = false;
  final _imagePicker = ImagePicker();
  String _selfiePath = '';
  bool _capturingSelfie = false;

  final bankNameC = TextEditingController();
  final accountNumberC = TextEditingController();
  final ifscC = TextEditingController();
  final accountHolderC = TextEditingController();
  final upiIdC = TextEditingController();
  final upiNameC = TextEditingController();
  final aadhaarNumberC = TextEditingController();
  final aadhaarMobileC = TextEditingController();
  final aadhaarOtpC = TextEditingController();
  final panNumberC = TextEditingController();

  bool _aadhaarOtpSending = false;
  bool _aadhaarOtpVerifying = false;
  bool _aadhaarEkycVerified = false;
  bool _panVerified = false;
  bool _panVerifying = false;
  bool _bankVerified = false;
  bool _bankValidating = false;
  bool _upiVerified = false;
  bool _upiValidating = false;
  Timer? _panAutoVerifyTimer;
  bool _panListenerPaused = false;
  String _lastPanAutoVerified = '';
  String? _aadhaarOtpSessionId;
  Map<String, dynamic>? _aadhaarEkyc;
  Map<String, dynamic>? _panVerification;
  Map<String, dynamic>? _bankValidation;
  Map<String, dynamic>? _upiValidation;
  String? _aadhaarMessage;
  String? _panMessage;
  String? _panName;
  String? _bankValidationMessage;
  String? _upiValidationMessage;

  @override
  void initState() {
    super.initState();
    panNumberC.addListener(_onPanChanged);
    _loadEligibility();
    _loadSavedAadhaarEkyc();
  }

  Future<void> _loadSavedAadhaarEkyc() async {
    try {
      final user = await UserService().me();
      final kyc = user.kyc ?? {};
      final aadhaarVerified = kyc['aadhaarVerified'] == true;
      final panVerified = kyc['panVerified'] == true;
      if (!mounted || (!aadhaarVerified && !panVerified)) return;
      setState(() {
        if (aadhaarVerified) {
          _aadhaarEkycVerified = true;
          aadhaarNumberC.text = (kyc['aadhaarNumber'] ?? '').toString();
          aadhaarMobileC.text =
              (kyc['aadhaarMobile'] ?? user.mobile).toString();
          _aadhaarEkyc = {
            'verified': true,
            'aadhaarData': kyc['aadhaarData'],
            'response': kyc['aadhaarVerification']?['response'],
          };
          final data = kyc['aadhaarData'] is Map
              ? Map<String, dynamic>.from(kyc['aadhaarData'])
              : const <String, dynamic>{};
          final savedName = (data['fullName'] ?? '').toString();
          final savedAddress = _extractAadhaarAddress(data);
          if (savedName.isNotEmpty && nameC.text.trim().isEmpty) {
            nameC.text = savedName;
          }
          if (savedAddress.isNotEmpty && addressC.text.trim().isEmpty) {
            addressC.text = savedAddress;
          }
          _aadhaarMessage = savedName.isEmpty
              ? 'Saved Aadhaar eKYC found.'
              : 'Saved Aadhaar eKYC found for $savedName.';
        }
        if (panVerified) {
          _panVerified = true;
          _panListenerPaused = true;
          panNumberC.text = (kyc['panNumber'] ?? '').toString().toUpperCase();
          _panListenerPaused = false;
          _panVerification = {
            'verified': true,
            'panData': kyc['panData'],
            'response': kyc['panVerification']?['response'],
          };
          _lastPanAutoVerified = panNumberC.text.trim();
          final panName = _extractPanName(_panVerification!);
          _panName = panName;
          _panMessage = panName.isEmpty
              ? 'Saved PAN verification found.'
              : 'Saved PAN verified for $panName.';
        }
      });
    } catch (_) {
      // Loan can still proceed after fresh Aadhaar OTP verification.
    }
  }

  Future<void> _loadEligibility() async {
    try {
      final result = await LoanService().eligibility();
      if (!mounted) return;
      setState(() {
        _canApply = result['eligible'] == true;
        _eligibilityMessage = result['message']?.toString();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _canApply = true;
        _eligibilityMessage = null;
      });
    } finally {
      if (mounted) setState(() => _checkingEligibility = false);
    }
  }

  @override
  void dispose() {
    _panAutoVerifyTimer?.cancel();
    panNumberC.removeListener(_onPanChanged);
    _pageController.dispose();
    for (final controller in [
      nameC,
      emailC,
      mobileC,
      addressC,
      amountC,
      tenureC,
      monthlyIncomeC,
      employerC,
      bankNameC,
      accountNumberC,
      ifscC,
      accountHolderC,
      upiIdC,
      upiNameC,
      aadhaarNumberC,
      aadhaarMobileC,
      aadhaarOtpC,
      panNumberC,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _onPanChanged() {
    if (_panListenerPaused) return;
    final raw = panNumberC.text;
    final pan = raw.trim().toUpperCase();
    if (raw != pan) {
      _panListenerPaused = true;
      panNumberC.value = TextEditingValue(
        text: pan,
        selection: TextSelection.collapsed(offset: pan.length),
      );
      _panListenerPaused = false;
      _onPanChanged();
      return;
    }

    _panAutoVerifyTimer?.cancel();
    if (pan != _lastPanAutoVerified && (_panVerified || _panName != null)) {
      setState(() {
        _panVerified = false;
        _panVerification = null;
        _panName = null;
        _panMessage = null;
      });
    }

    if (pan.isEmpty) {
      setState(() {
        _panMessage = null;
        _panName = null;
      });
      return;
    }

    if (pan.length < 10) {
      if (_panMessage != null || _panName != null) {
        setState(() {
          _panMessage = null;
          _panName = null;
        });
      }
      return;
    }

    if (!RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]$').hasMatch(pan)) {
      setState(() {
        _panVerified = false;
        _panName = null;
        _panMessage = 'PAN format sahi nahi hai. Example: ABCDE1234F';
      });
      return;
    }

    if (pan == _lastPanAutoVerified || _panVerifying) return;
    _panAutoVerifyTimer = Timer(
      const Duration(milliseconds: 550),
      () => _verifyPan(showInvalidError: false),
    );
  }

  String _extractPanName(Map<String, dynamic> result) {
    final panData = result['panData'] is Map
        ? Map<String, dynamic>.from(result['panData'])
        : const <String, dynamic>{};
    final direct = (panData['name'] ??
            panData['fullName'] ??
            panData['panName'] ??
            result['name'] ??
            result['panName'] ??
            '')
        .toString()
        .trim();
    if (direct.isNotEmpty) return direct;
    return [
      panData['firstName'],
      panData['middleName'],
      panData['lastName'],
    ]
        .where((part) => part != null && part.toString().trim().isNotEmpty)
        .map((part) => part.toString().trim())
        .join(' ');
  }

  String _firstText(List<dynamic> values) {
    for (final value in values) {
      final text = (value ?? '').toString().trim();
      if (text.isNotEmpty && text != 'null') return text;
    }
    return '';
  }

  String _joinAddressParts(List<dynamic> values) {
    final seen = <String>{};
    final parts = <String>[];
    for (final value in values) {
      final text = (value ?? '').toString().trim();
      if (text.isEmpty || text == 'null') continue;
      final key = text.toLowerCase();
      if (seen.add(key)) parts.add(text);
    }
    return parts.join(', ');
  }

  String _extractAadhaarAddress(Map<String, dynamic> data) {
    final rawAddress = data['address'];
    if (rawAddress is String && rawAddress.trim().isNotEmpty) {
      return rawAddress.trim();
    }
    final address = rawAddress is Map
        ? Map<String, dynamic>.from(rawAddress)
        : const <String, dynamic>{};
    final careOf = _firstText(
        [address['careOf'], address['co'], address['c_o'], data['careOf']]);
    final house = _firstText([
      address['house'],
      address['houseNo'],
      address['houseNumber'],
      data['house']
    ]);
    final street = _firstText([
      address['street'],
      address['landmark'],
      address['lm'],
      data['street']
    ]);
    final locality = _firstText([
      address['vtc'],
      address['village'],
      address['locality'],
      address['po'],
      data['locality']
    ]);
    final district =
        _firstText([address['dist'], address['district'], data['district']]);
    final state = _firstText([address['state'], data['state']]);
    final pincode = _firstText([
      address['pc'],
      address['pincode'],
      address['pinCode'],
      data['pincode']
    ]);
    return _firstText([
      data['fullAddress'],
      _joinAddressParts(
          [careOf, house, street, locality, district, state, pincode]),
    ]);
  }

  Future<void> _sendAadhaarOtp() async {
    final aadhaar = aadhaarNumberC.text.trim();
    final mobile = aadhaarMobileC.text.trim();
    if (!RegExp(r'^\d{12}$').hasMatch(aadhaar)) {
      _showError('Enter valid 12 digit Aadhaar number.');
      return;
    }
    if (mobile.isNotEmpty && !RegExp(r'^\d{10}$').hasMatch(mobile)) {
      _showError('Enter valid 10 digit Aadhaar linked mobile.');
      return;
    }
    setState(() {
      _aadhaarOtpSending = true;
      _aadhaarMessage = null;
      _aadhaarEkycVerified = false;
    });
    try {
      final result = await UserService().sendAadhaarOtp(
        aadhaarNumber: aadhaar,
        aadhaarMobile: mobile.isEmpty ? null : mobile,
      );
      if (!mounted) return;
      setState(() {
        _aadhaarOtpSessionId = (result['otpSessionId'] ??
                result['sessionId'] ??
                result['aadhaarData']?['otpSessionId'] ??
                result['data']?['otpSessionId'] ??
                '')
            .toString();
        _aadhaarMessage = 'OTP sent to Aadhaar linked mobile.';
      });
    } catch (e) {
      if (mounted) {
        setState(() => _aadhaarMessage =
            friendlyErrorMessage(e, fallback: 'Could not send Aadhaar OTP.'));
      }
    } finally {
      if (mounted) setState(() => _aadhaarOtpSending = false);
    }
  }

  Future<void> _verifyAadhaarOtp() async {
    final aadhaar = aadhaarNumberC.text.trim();
    final otp = aadhaarOtpC.text.trim();
    if (!RegExp(r'^\d{12}$').hasMatch(aadhaar) || otp.length < 4) {
      _showError('Enter Aadhaar number and OTP.');
      return;
    }
    setState(() {
      _aadhaarOtpVerifying = true;
      _aadhaarMessage = null;
    });
    try {
      final result = await UserService().verifyAadhaarOtp(
        aadhaarNumber: aadhaar,
        aadhaarMobile: aadhaarMobileC.text.trim().isEmpty
            ? null
            : aadhaarMobileC.text.trim(),
        otp: otp,
        otpSessionId: _aadhaarOtpSessionId,
      );
      final verified = result['verified'] == true;
      if (!mounted) return;
      setState(() {
        _aadhaarEkycVerified = verified;
        _aadhaarEkyc = result;
        final data = result['aadhaarData'] is Map
            ? Map<String, dynamic>.from(result['aadhaarData'])
            : const <String, dynamic>{};
        final name = (data['fullName'] ?? '').toString();
        final address = _extractAadhaarAddress(data);
        if (name.isNotEmpty && nameC.text.trim().isEmpty) nameC.text = name;
        if (address.isNotEmpty && addressC.text.trim().isEmpty) {
          addressC.text = address;
        }
        _aadhaarMessage = verified
            ? (name.isEmpty
                ? 'Aadhaar eKYC verified.'
                : 'Aadhaar eKYC verified for $name.')
            : 'Aadhaar eKYC could not be verified.';
      });
    } catch (e) {
      if (mounted) {
        setState(() => _aadhaarMessage = friendlyErrorMessage(e,
            fallback: 'Aadhaar could not be verified.'));
      }
    } finally {
      if (mounted) setState(() => _aadhaarOtpVerifying = false);
    }
  }

  Future<void> _verifyPan({bool showInvalidError = true}) async {
    final pan = panNumberC.text.trim().toUpperCase();
    if (!RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]$').hasMatch(pan)) {
      if (showInvalidError) {
        _showError('Enter valid PAN number.');
      } else if (mounted) {
        setState(() =>
            _panMessage = 'PAN format sahi nahi hai. Example: ABCDE1234F');
      }
      return;
    }
    setState(() {
      _panVerifying = true;
      _panMessage = null;
      _panVerified = false;
      _panName = null;
    });
    try {
      final result = await UserService().verifyPan(pan);
      final verified = result['verified'] == true;
      if (!mounted) return;
      setState(() {
        _panVerified = verified;
        _panVerification = result;
        _lastPanAutoVerified = pan;
        final panName = _extractPanName(result);
        _panName = panName.isEmpty ? null : panName;
        _panMessage = verified
            ? (panName.isEmpty
                ? 'PAN details verified.'
                : 'PAN verified for $panName.')
            : 'PAN details match nahi ho rahe. PAN number check karke dobara try karein.';
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _panVerified = false;
          _panName = null;
          _panMessage = friendlyErrorMessage(
            e,
            fallback:
                'PAN details verify nahi ho paya. PAN number check karke dobara try karein.',
          );
        });
      }
    } finally {
      if (mounted) setState(() => _panVerifying = false);
    }
  }

  Future<void> _validateBankAccount() async {
    final mobile = mobileC.text.trim();
    final account = accountNumberC.text.trim();
    final ifsc = ifscC.text.trim().toUpperCase();
    if (!RegExp(r'^\d{10}$').hasMatch(mobile) ||
        account.length < 6 ||
        !RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(ifsc)) {
      _showError('Enter valid mobile, account number and IFSC.');
      return;
    }
    setState(() {
      _bankValidating = true;
      _bankValidationMessage = null;
    });
    try {
      final result = await ClubAPIService().validateBankAccount(
        customerMobile: mobile,
        accountNumber: account,
        ifscCode: ifsc,
      );
      final name =
          (result['accountName'] ?? result['beneficiaryName'] ?? '').toString();
      if (!mounted) return;
      setState(() {
        _bankVerified = true;
        _bankValidation = result;
        if (name.isNotEmpty) accountHolderC.text = name;
        _bankValidationMessage = name.isEmpty
            ? 'Bank response received, name not returned.'
            : 'Bank account validated for $name.';
      });
    } catch (e) {
      if (mounted) {
        setState(() => _bankValidationMessage = friendlyErrorMessage(e,
            fallback: 'Bank account could not be validated.'));
      }
    } finally {
      if (mounted) setState(() => _bankValidating = false);
    }
  }

  Future<void> _validateUpi() async {
    final upi = upiIdC.text.trim();
    if (!RegExp(r'^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$').hasMatch(upi)) {
      _showError('Enter valid UPI ID.');
      return;
    }
    setState(() {
      _upiValidating = true;
      _upiValidationMessage = null;
      _upiVerified = false;
    });
    try {
      final result = await ClubAPIService().validateUpi(upi);
      final name = (result['accountName'] ??
              result['upiName'] ??
              result['beneficiaryName'] ??
              '')
          .toString();
      if (!mounted) return;
      setState(() {
        _upiVerified = true;
        _upiValidation = result;
        if (name.isNotEmpty) upiNameC.text = name;
        _upiValidationMessage = name.isEmpty
            ? 'UPI response received, name not returned.'
            : 'UPI name validated for $name.';
      });
    } catch (e) {
      if (mounted) {
        setState(() => _upiValidationMessage =
            friendlyErrorMessage(e, fallback: 'UPI could not be validated.'));
      }
    } finally {
      if (mounted) setState(() => _upiValidating = false);
    }
  }

  Future<void> _pickIncomeProofFile() async {
    setState(() => _pickingIncomeProof = true);
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );
      final file = picked?.files.firstOrNull;
      if (file?.path == null) return;
      setState(() {
        _incomeProofPath = file!.path!;
        _incomeProofFileName = file.name;
      });
    } catch (e) {
      if (mounted) {
        _showError(friendlyErrorMessage(e,
            fallback: 'Could not open file picker. Please try again.'));
      }
    } finally {
      if (mounted) setState(() => _pickingIncomeProof = false);
    }
  }

  Future<void> _captureLiveSelfie() async {
    setState(() => _capturingSelfie = true);
    try {
      final picked = await _imagePicker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 82,
        maxWidth: 1400,
      );
      if (picked == null) return;
      setState(() => _selfiePath = picked.path);
    } catch (e) {
      if (mounted) {
        _showError(friendlyErrorMessage(e,
            fallback: 'Camera open nahi ho paya. Please permission allow karke try karein.'));
      }
    } finally {
      if (mounted) setState(() => _capturingSelfie = false);
    }
  }

  /// Blocking requirements for a step, in the order the user should fix them.
  /// Returns null when the step is complete. Shared by [_next] and [_submit]
  /// so the two can never disagree about what "complete" means.
  String? _stepBlocker(int step) {
    switch (step) {
      case 0:
        final amount = num.tryParse(amountC.text.trim()) ?? 0;
        final tenure = int.tryParse(tenureC.text.trim()) ?? 0;
        if (amount < 1000) return 'Minimum loan amount is Rs. 1,000.';
        if (amount > 500000) return 'Maximum loan amount is Rs. 5,00,000.';
        if (tenure < 3 || tenure > 60) {
          return 'Tenure must be between 3 and 60 months.';
        }
        return null;
      case 1:
        final income = num.tryParse(monthlyIncomeC.text.trim()) ?? 0;
        if (income <= 0) return 'Please enter your monthly income.';
        if (_incomeProofPath.isEmpty) {
          return 'Please upload your income proof document.';
        }
        return null;
      case 2:
        if (!_aadhaarEkycVerified) {
          return 'Please complete Aadhaar Offline eKYC OTP verification.';
        }
        if (!_panVerified) return 'Please verify your PAN details.';
        if (_selfiePath.isEmpty) {
          return 'Please capture your live photo to continue.';
        }
        return null;
      case 3:
        if (!_bankVerified) {
          return 'Please validate your bank account details.';
        }
        if (!_upiVerified) return 'Please validate your UPI ID.';
        return null;
      default:
        return null;
    }
  }

  void _next() {
    // The review step has no form key of its own to validate.
    if (_step != _reviewStep &&
        _formKeys[_step].currentState?.validate() != true) {
      return;
    }

    final blocker = _stepBlocker(_step);
    if (blocker != null) {
      _showError(blocker);
      return;
    }

    if (_step >= _formKeys.length - 1) return;
    setState(() {
      _step++;
      _submitError = null;
    });
    _pageController.nextPage(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  void _goToStep(int step) {
    if (step < 0 || step > _reviewStep || step == _step) return;
    setState(() => _step = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  void _back() {
    if (_step == 0) return;
    setState(() {
      _step--;
      _submitError = null;
    });
    _pageController.previousPage(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _submit() async {
    if (_submitting) return;

    if (!_canApply) {
      _showError(_eligibilityMessage ??
          'A new loan can be applied for only after your existing loan is cleared.');
      return;
    }

    if (!_consentAccepted) {
      setState(() => _submitError =
          'Please accept the terms and credit-bureau consent to submit.');
      return;
    }
    _draft.creditReportConsent = true;
    _draft.termsAccepted = true;
    _draft.privacyAccepted = true;

    // Re-run every step's blockers, not just the current one - a user can jump
    // back to the review screen after clearing a field on an earlier step.
    for (var step = 0; step < _reviewStep; step++) {
      final blocker = _stepBlocker(step);
      if (blocker != null) {
        setState(() => _submitError = blocker);
        _goToStep(step);
        return;
      }
    }

    _bindDraft();
    setState(() {
      _submitting = true;
      _submitError = null;
    });

    try {
      final id = await LoanService().applyDraft(_draft);
      if (!mounted) return;
      router.go('/apply-success/$id');
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitError = friendlyErrorMessage(e,
          fallback:
              'Your application could not be submitted. Please try again.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Flat-rate EMI estimate used purely to set expectations on the review
  /// screen. The binding schedule is always the one the backend generates on
  /// approval, which is why this is labelled as an estimate in the UI.
  ({num emi, num total, num interest})? get _emiEstimate {
    final amount = num.tryParse(amountC.text.trim()) ?? 0;
    final tenure = int.tryParse(tenureC.text.trim()) ?? 0;
    if (amount <= 0 || tenure <= 0) return null;

    const annualRate = 0.18;
    const monthlyRate = annualRate / 12;
    final factor = _pow(1 + monthlyRate, tenure);
    final emi = amount * monthlyRate * factor / (factor - 1);
    final total = emi * tenure;
    return (emi: emi, total: total, interest: total - amount);
  }

  static double _pow(double base, int exponent) {
    var result = 1.0;
    for (var i = 0; i < exponent; i++) {
      result *= base;
    }
    return result;
  }

  void _bindDraft() {
    _draft
      ..name = nameC.text.trim()
      ..email = emailC.text.trim()
      ..mobile = mobileC.text.trim()
      ..address = addressC.text.trim()
      ..amountRequested = num.tryParse(amountC.text.trim()) ?? 0
      ..tenureMonths = int.tryParse(tenureC.text.trim()) ?? 12
      ..purpose = _loanType
      ..employmentType = _employmentType
      ..monthlyIncome = num.tryParse(monthlyIncomeC.text.trim()) ?? 0
      ..employerOrBusiness = employerC.text.trim()
      ..incomeProofType = _incomeProofType
      ..incomeProofPath = _incomeProofPath
      ..aadhaarEkycVerified = _aadhaarEkycVerified
      ..aadhaarEkyc = _aadhaarEkyc
      ..panVerified = _panVerified
      ..panVerification = _panVerification
      ..selfiePath = _selfiePath
      ..references = []
      ..bankName = bankNameC.text.trim()
      ..accountNumber = accountNumberC.text.trim()
      ..ifscCode = ifscC.text.trim().toUpperCase()
      ..accountHolderName = accountHolderC.text.trim()
      ..upiId = upiIdC.text.trim()
      ..upiAccountName = upiNameC.text.trim()
      ..bankValidation = _bankValidation
      ..upiValidation = _upiValidation;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Loan Application'),
        leading: _step == 0
            ? const AppBackButton(fallbackRoute: '/loans')
            : IconButton(icon: const Icon(Icons.arrow_back), onPressed: _back),
      ),
      body: Column(
        children: [
          _ProgressHeader(step: _step, totalSteps: _formKeys.length),
          if (_step == 0)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: OfferBannerCarousel(placement: 'LOAN_APPLY', height: 130),
            ),
          if (_checkingEligibility ||
              (_eligibilityMessage != null && !_canApply))
            _LoanEligibilityBanner(
              loading: _checkingEligibility,
              message: _eligibilityMessage ?? 'Checking loan eligibility...',
              allowed: _canApply,
            ),
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _stepPersonal(),
                _stepIncome(),
                _stepDocuments(),
                _stepBank(),
                _stepReview(),
              ],
            ),
          ),
          _BottomActions(
            step: _step,
            maxStep: _reviewStep,
            submitting: _submitting,
            canSubmit: _canApply && !_checkingEligibility,
            onBack: _back,
            onNext: _next,
            onSubmit: _submit,
          ),
        ],
      ),
    );
  }

  Widget _stepPersonal() {
    final estimate = _emiEstimate;

    return _StepScaffold(
      title: 'Loan details',
      subtitle:
          'Choose how much you need and tell us who you are. KYC comes next.',
      formKey: _formKeys[0],
      children: [
        const _SectionLabel("How much do you need?"),
        Row(
          children: [
            Expanded(
              flex: 3,
              child: _field(amountC, 'Loan amount', Icons.currency_rupee,
                  required: true, number: true,
                  onChanged: (_) => setState(() {})),
            ),
            SizedBox(width: 10.w),
            Expanded(
              flex: 2,
              child: _field(tenureC, 'Months', Icons.calendar_month,
                  required: true, number: true,
                  onChanged: (_) => setState(() {})),
            ),
          ],
        ),
        Wrap(
          spacing: 8.w,
          runSpacing: 8.h,
          children: [10000, 25000, 50000, 100000]
              .map((amount) => ActionChip(
                    label: Text('Rs. ${amount ~/ 1000}k'),
                    onPressed: () => setState(() {
                      amountC.text = '$amount';
                    }),
                  ))
              .toList(),
        ),
        SizedBox(height: 12.h),
        if (estimate != null)
          _EstimateStrip(
            emi: estimate.emi,
            tenure: int.tryParse(tenureC.text.trim()) ?? 0,
          ),
        SizedBox(height: 14.h),
        _dropdownField(
          label: 'Loan purpose',
          icon: Icons.category_outlined,
          value: _loanType,
          items: _kLoanTypes,
          onChanged: (value) => setState(() => _loanType = value ?? _loanType),
        ),
        SizedBox(height: 16.h),
        const _SectionLabel("Your details"),
        _field(nameC, 'Full name (as on PAN)', Icons.person_outline,
            required: true),
        _field(mobileC, 'Mobile number', Icons.phone_outlined,
            required: true, phone: true),
        _field(emailC, 'Email address', Icons.mail_outline, email: true),
        _field(addressC, 'Current address', Icons.home_outlined, lines: 2),
      ],
    );
  }

  Widget _stepIncome() {
    return _StepScaffold(
      title: 'Income details',
      subtitle:
          'Tell us about your work and income so we can process your loan faster.',
      formKey: _formKeys[1],
      children: [
        _dropdownField(
          label: 'Employment Type',
          icon: Icons.work_outline,
          value: _employmentType,
          items: _kEmploymentTypes,
          onChanged: (value) =>
              setState(() => _employmentType = value ?? _employmentType),
        ),
        SizedBox(height: 12.h),
        _field(monthlyIncomeC, 'Monthly income (Rs.)', Icons.currency_rupee,
            required: true, number: true),
        _field(employerC, 'Employer / business name', Icons.apartment_outlined),
        SizedBox(height: 4.h),
        _IncomeProofPanel(
          selectedType: _incomeProofType,
          fileName: _incomeProofFileName,
          picking: _pickingIncomeProof,
          onTypeChanged: (value) => setState(() => _incomeProofType = value),
          onPick: _pickIncomeProofFile,
        ),
      ],
    );
  }

  Widget _stepDocuments() {
    return _StepScaffold(
      title: 'KYC Verify',
      subtitle:
          'Verify your PAN and Aadhaar OTP to continue with your application.',
      formKey: _formKeys[2],
      children: [
        _AadhaarEkycPanel(
          aadhaarNumberController: aadhaarNumberC,
          aadhaarMobileController: aadhaarMobileC,
          otpController: aadhaarOtpC,
          sending: _aadhaarOtpSending,
          verifying: _aadhaarOtpVerifying,
          verified: _aadhaarEkycVerified,
          message: _aadhaarMessage,
          onSendOtp: _sendAadhaarOtp,
          onVerifyOtp: _verifyAadhaarOtp,
        ),
        SizedBox(height: 12.h),
        _PanVerifyPanel(
          panController: panNumberC,
          verifying: _panVerifying,
          verified: _panVerified,
          panName: _panName,
          message: _panMessage,
          onVerify: () => _verifyPan(),
        ),
        SizedBox(height: 12.h),
        _LiveSelfiePanel(
          selfiePath: _selfiePath,
          capturing: _capturingSelfie,
          onCapture: _captureLiveSelfie,
        ),
      ],
    );
  }

  Widget _stepBank() {
    return _StepScaffold(
      title: 'Bank Details',
      subtitle: 'Loan amount will be disbursed to this account after approval.',
      formKey: _formKeys[3],
      children: [
        _field(bankNameC, 'Bank name', Icons.account_balance),
        _field(accountNumberC, 'Account number', Icons.numbers,
            required: true, number: true),
        _field(ifscC, 'IFSC code', Icons.pin_outlined, required: true),
        _field(accountHolderC, 'Account holder name', Icons.person_pin,
            required: true),
        OutlinedButton.icon(
          onPressed: _bankValidating ? null : _validateBankAccount,
          icon: _bankValidating
              ? SizedBox(
                  width: 16.w,
                  height: 16.w,
                  child: const CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.verified_outlined),
          label:
              Text(_bankValidating ? 'Validating...' : 'Validate Account Name'),
        ),
        if (_bankValidationMessage != null) ...[
          SizedBox(height: 8.h),
          Text(_bankValidationMessage!,
              style: const TextStyle(
                  color: KhatuColors.teal, fontWeight: FontWeight.w800)),
        ],
        SizedBox(height: 14.h),
        _field(upiIdC, 'UPI ID', Icons.alternate_email, required: true),
        _field(upiNameC, 'UPI account name', Icons.person_search_outlined,
            required: true),
        OutlinedButton.icon(
          onPressed: _upiValidating ? null : _validateUpi,
          icon: _upiValidating
              ? SizedBox(
                  width: 16.w,
                  height: 16.w,
                  child: const CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.verified_outlined),
          label: Text(_upiValidating ? 'Validating...' : 'Validate UPI Name'),
        ),
        if (_upiValidationMessage != null) ...[
          SizedBox(height: 8.h),
          Text(_upiValidationMessage!,
              style: const TextStyle(
                  color: KhatuColors.teal, fontWeight: FontWeight.w800)),
        ],
        SizedBox(height: 12.h),
        _ReviewCard(
          amount: amountC.text,
          tenure: tenureC.text,
          purpose: _loanType,
        ),
      ],
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    IconData icon, {
    bool required = false,
    bool email = false,
    bool number = false,
    bool phone = false,
    int lines = 1,
    ValueChanged<String>? onChanged,
  }) {
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: TextFormField(
        controller: controller,
        maxLines: lines,
        onChanged: onChanged,
        textCapitalization:
            email ? TextCapitalization.none : TextCapitalization.words,
        keyboardType: number
            ? const TextInputType.numberWithOptions(decimal: false)
            : phone
                ? TextInputType.phone
                : email
                    ? TextInputType.emailAddress
                    : TextInputType.text,
        validator: (value) {
          final text = value?.trim() ?? '';
          if (required && text.isEmpty) return 'This field is required';
          if (email &&
              text.isNotEmpty &&
              !RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$').hasMatch(text)) {
            return 'Enter a valid email address';
          }
          if (number && text.isNotEmpty && num.tryParse(text) == null) {
            return 'Enter numbers only';
          }
          if (phone &&
              text.isNotEmpty &&
              !RegExp(r'^[6-9]\d{9}$').hasMatch(text)) {
            return 'Enter a valid 10-digit mobile number';
          }
          return null;
        },
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: KhatuColors.teal),
        ),
      ),
    );
  }

  /// Read-only summary of everything collected, plus the consent gate. Each
  /// block links back to the step that produced it so a correction never
  /// means restarting the wizard.
  Widget _stepReview() {
    final estimate = _emiEstimate;
    final amount = num.tryParse(amountC.text.trim()) ?? 0;
    final tenure = int.tryParse(tenureC.text.trim()) ?? 0;

    return Form(
      key: _formKeys[_reviewStep],
      child: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 18.h, 16.w, 24.h),
        children: [
          Text(
            'Review & submit',
            style: TextStyle(
              color: KhatuColors.text,
              fontSize: 22.sp,
              fontWeight: FontWeight.w900,
            ),
          ),
          SizedBox(height: 6.h),
          Text(
            'Check everything below. Once submitted, our credit team reviews your application and updates you.',
            style: TextStyle(
              color: KhatuColors.muted,
              fontSize: 13.sp,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: 18.h),
          Container(
            padding: EdgeInsets.all(18.w),
            decoration: BoxDecoration(
              gradient: KhatuColors.brandGradient,
              borderRadius: BorderRadius.circular(18.r),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'YOU ARE APPLYING FOR',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.78),
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                SizedBox(height: 6.h),
                Text(kpMoney(amount), style: KhatuText.amountLarge),
                SizedBox(height: 4.h),
                Text(
                  '$tenure months • $_loanType',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (estimate != null) ...[
                  SizedBox(height: 14.h),
                  Container(
                    padding: EdgeInsets.all(12.w),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12.r),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.16)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _heroStat(
                              'Estimated EMI', kpMoney(estimate.emi)),
                        ),
                        Container(
                          width: 1,
                          height: 28,
                          color: Colors.white.withValues(alpha: 0.18),
                        ),
                        Expanded(
                          child: _heroStat(
                              'Total payable', kpMoney(estimate.total)),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 8.h),
                  Text(
                    'Indicative at 18% p.a. Final rate and schedule are confirmed on approval.',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.72),
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          SizedBox(height: 16.h),
          _ReviewSection(
            title: 'Personal details',
            icon: Icons.person_outline_rounded,
            onEdit: () => _goToStep(0),
            rows: [
              ('Full name', nameC.text.trim()),
              ('Mobile', mobileC.text.trim()),
              ('Email', emailC.text.trim()),
              ('Address', addressC.text.trim()),
            ],
          ),
          SizedBox(height: 12.h),
          _ReviewSection(
            title: 'Income & employment',
            icon: Icons.work_outline_rounded,
            onEdit: () => _goToStep(1),
            rows: [
              ('Employment', _employmentType),
              ('Monthly income', kpMoney(num.tryParse(monthlyIncomeC.text.trim()) ?? 0)),
              ('Employer / business', employerC.text.trim()),
              ('Income proof', _incomeProofFileName),
            ],
          ),
          SizedBox(height: 12.h),
          _ReviewSection(
            title: 'KYC verification',
            icon: Icons.verified_user_outlined,
            onEdit: () => _goToStep(2),
            rows: [
              ('Aadhaar eKYC', _aadhaarEkycVerified ? 'Verified' : 'Pending'),
              ('PAN', _panVerified ? (_panName ?? 'Verified') : 'Pending'),
              ('Live photo', _selfiePath.isEmpty ? 'Pending' : 'Captured'),
            ],
            statuses: [
              _aadhaarEkycVerified,
              _panVerified,
              _selfiePath.isNotEmpty,
            ],
          ),
          SizedBox(height: 12.h),
          _ReviewSection(
            title: 'Disbursement account',
            icon: Icons.account_balance_outlined,
            onEdit: () => _goToStep(3),
            rows: [
              ('Bank', bankNameC.text.trim()),
              ('Account', _maskAccount(accountNumberC.text.trim())),
              ('IFSC', ifscC.text.trim().toUpperCase()),
              ('Account holder', accountHolderC.text.trim()),
              ('UPI ID', upiIdC.text.trim()),
            ],
          ),
          SizedBox(height: 16.h),
          Container(
            padding: EdgeInsets.all(14.w),
            decoration: BoxDecoration(
              color: _consentAccepted
                  ? KhatuColors.softTeal
                  : KhatuColors.surfaceAlt,
              borderRadius: BorderRadius.circular(14.r),
              border: Border.all(
                color: _consentAccepted
                    ? KhatuColors.teal.withValues(alpha: 0.35)
                    : KhatuColors.line,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: _consentAccepted,
                  onChanged: (value) => setState(() {
                    _consentAccepted = value ?? false;
                    if (_consentAccepted) _submitError = null;
                  }),
                ),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(top: 10.h),
                    child: const Text(
                      "I confirm the information above is correct and I authorise Khatu Pay to verify my details and fetch my credit report from licensed credit bureaus.",
                      style: TextStyle(
                        color: KhatuColors.text,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        height: 1.35,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (_submitError != null) ...[
            SizedBox(height: 12.h),
            KpErrorBanner(message: _submitError!),
          ],
          SizedBox(height: 12.h),
          const KpNoticeBanner(
            icon: Icons.lock_outline_rounded,
            message:
                'Your documents are encrypted in transit and used only to assess this loan application.',
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.75),
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        SizedBox(height: 3.h),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }

  static String _maskAccount(String value) {
    if (value.length < 4) return value;
    return '•••• ${value.substring(value.length - 4)}';
  }

  Widget _dropdownField({
    required String label,
    required IconData icon,
    required String value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      items: items
          .map((item) => DropdownMenuItem(value: item, child: Text(item)))
          .toList(),
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: KhatuColors.teal),
      ),
    );
  }
}

class _ProgressHeader extends StatelessWidget {
  final int step;
  final int totalSteps;

  const _ProgressHeader({required this.step, required this.totalSteps});

  @override
  Widget build(BuildContext context) {
    final progress = (step + 1) / totalSteps;

    return Container(
      padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 14.h),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: KhatuColors.line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38.w,
                height: 38.w,
                padding: EdgeInsets.all(5.w),
                decoration: BoxDecoration(
                  color: KhatuColors.softTeal,
                  borderRadius: BorderRadius.circular(10.r),
                ),
                child: Image.asset(
                  'assets/khatulogo-removebg-preview.png',
                  errorBuilder: (_, __, ___) => const Icon(
                    Icons.savings_rounded,
                    color: KhatuColors.deepTeal,
                    size: 20,
                  ),
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Khatu Pay Credit',
                      style: TextStyle(
                        color: KhatuColors.text,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      'Step ${step + 1} of $totalSteps • ${_kStepTitles[step.clamp(0, _kStepTitles.length - 1)]}',
                      style: const TextStyle(
                        color: KhatuColors.muted,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: KhatuColors.softTeal,
                  borderRadius: BorderRadius.circular(KhatuRadius.pill),
                ),
                child: Text(
                  '${(progress * 100).round()}%',
                  style: const TextStyle(
                    color: KhatuColors.deepTeal,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          // Segmented bar rather than one continuous track: at a glance the
          // user can see how many discrete steps are left, not just a ratio.
          Row(
            children: [
              for (var i = 0; i < totalSteps; i++) ...[
                if (i > 0) SizedBox(width: 4.w),
                Expanded(
                  child: Container(
                    height: 5,
                    decoration: BoxDecoration(
                      color: i <= step ? KhatuColors.teal : KhatuColors.line,
                      borderRadius: BorderRadius.circular(KhatuRadius.pill),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          color: KhatuColors.muted,
          fontSize: 11,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

/// Live EMI preview shown as the user types an amount/tenure on step 1.
class _EstimateStrip extends StatelessWidget {
  const _EstimateStrip({required this.emi, required this.tenure});

  final num emi;
  final int tenure;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.md),
      decoration: BoxDecoration(
        color: KhatuColors.softSaffron,
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        border: Border.all(color: KhatuColors.saffron.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          const Icon(Icons.calculate_outlined,
              color: KhatuColors.gold, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(
                  color: KhatuColors.gold,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                ),
                children: [
                  const TextSpan(text: 'Estimated EMI '),
                  TextSpan(
                    text: kpMoney(emi),
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  TextSpan(text: ' × $tenure months at 18% p.a.'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One editable block on the review screen.
class _ReviewSection extends StatelessWidget {
  const _ReviewSection({
    required this.title,
    required this.icon,
    required this.rows,
    required this.onEdit,
    this.statuses,
  });

  final String title;
  final IconData icon;
  final List<(String, String)> rows;
  final VoidCallback onEdit;

  /// Optional per-row verified flags, rendered as a tick/warning instead of
  /// plain text. Length must match [rows] when supplied.
  final List<bool>? statuses;

  @override
  Widget build(BuildContext context) {
    final visible = rows.where((row) => row.$2.trim().isNotEmpty).toList();

    return KpCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                KhatuSpace.lg, KhatuSpace.md, KhatuSpace.sm, KhatuSpace.sm),
            child: Row(
              children: [
                Icon(icon, size: 18, color: KhatuColors.deepTeal),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: KhatuText.h3)),
                TextButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 15),
                  label: const Text('Edit'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: const Size(0, 32),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (visible.isEmpty)
            const Padding(
              padding: EdgeInsets.all(KhatuSpace.lg),
              child: Text('Nothing added yet.', style: KhatuText.bodyMuted),
            )
          else
            for (var i = 0; i < rows.length; i++)
              if (rows[i].$2.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: KhatuSpace.lg, vertical: KhatuSpace.sm + 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 4,
                        child: Text(rows[i].$1, style: KhatuText.label),
                      ),
                      Expanded(
                        flex: 6,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (statuses != null && i < statuses!.length) ...[
                              Icon(
                                statuses![i]
                                    ? Icons.check_circle_rounded
                                    : Icons.error_outline_rounded,
                                size: 14,
                                color: statuses![i]
                                    ? KhatuColors.success
                                    : KhatuColors.gold,
                              ),
                              const SizedBox(width: 5),
                            ],
                            Flexible(
                              child: Text(
                                rows[i].$2,
                                textAlign: TextAlign.right,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: KhatuColors.text,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
          const SizedBox(height: KhatuSpace.sm),
        ],
      ),
    );
  }
}

class _LoanEligibilityBanner extends StatelessWidget {
  final bool loading;
  final bool allowed;
  final String message;

  const _LoanEligibilityBanner({
    required this.loading,
    required this.allowed,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    final bg = loading
        ? const Color(0xFFEFF6FF)
        : allowed
            ? const Color(0xFFECFDF5)
            : const Color(0xFFFFFBEB);
    final fg = loading
        ? const Color(0xFF1D4ED8)
        : allowed
            ? const Color(0xFF047857)
            : const Color(0xFF92400E);
    return Container(
      margin: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 0),
      padding: EdgeInsets.all(12.w),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          if (loading)
            SizedBox(
                width: 18.w,
                height: 18.w,
                child: CircularProgressIndicator(strokeWidth: 2, color: fg))
          else
            Icon(allowed ? Icons.verified_outlined : Icons.info_outline,
                color: fg),
          SizedBox(width: 10.w),
          Expanded(
            child: Text(message,
                style: TextStyle(color: fg, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

class _StepScaffold extends StatelessWidget {
  final String title;
  final String subtitle;
  final GlobalKey<FormState> formKey;
  final List<Widget> children;

  const _StepScaffold({
    required this.title,
    required this.subtitle,
    required this.formKey,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 18.h, 16.w, 24.h),
        children: [
          Text(title,
              style: TextStyle(
                  color: KhatuColors.text,
                  fontSize: 22.sp,
                  fontWeight: FontWeight.w900)),
          SizedBox(height: 6.h),
          Text(subtitle,
              style: TextStyle(
                  color: KhatuColors.muted,
                  fontSize: 13.sp,
                  fontWeight: FontWeight.w600)),
          SizedBox(height: 18.h),
          ...children,
        ],
      ),
    );
  }
}

class _AadhaarEkycPanel extends StatelessWidget {
  final TextEditingController aadhaarNumberController;
  final TextEditingController aadhaarMobileController;
  final TextEditingController otpController;
  final bool sending;
  final bool verifying;
  final bool verified;
  final String? message;
  final VoidCallback onSendOtp;
  final VoidCallback onVerifyOtp;

  const _AadhaarEkycPanel({
    required this.aadhaarNumberController,
    required this.aadhaarMobileController,
    required this.otpController,
    required this.sending,
    required this.verifying,
    required this.verified,
    required this.message,
    required this.onSendOtp,
    required this.onVerifyOtp,
  });

  @override
  Widget build(BuildContext context) {
    final color = verified ? Colors.green : KhatuColors.saffron;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(14.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(verified ? Icons.verified_user : Icons.fingerprint,
                    color: color),
                SizedBox(width: 10.w),
                const Expanded(
                  child: Text('Aadhaar Offline eKYC',
                      style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: KhatuColors.text)),
                ),
                Chip(
                  label: Text(verified ? 'VERIFIED' : 'REQUIRED',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 11)),
                  backgroundColor: color,
                ),
              ],
            ),
            SizedBox(height: 12.h),
            TextFormField(
              controller: aadhaarNumberController,
              enabled: !verified,
              keyboardType: TextInputType.number,
              maxLength: 12,
              decoration: const InputDecoration(
                labelText: 'Aadhaar number',
                prefixIcon: Icon(Icons.badge_outlined),
                counterText: '',
              ),
            ),
            SizedBox(height: 10.h),
            TextFormField(
              controller: aadhaarMobileController,
              enabled: !verified,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: const InputDecoration(
                labelText: 'Aadhaar linked mobile',
                prefixIcon: Icon(Icons.phone_outlined),
                counterText: '',
              ),
            ),
            SizedBox(height: 10.h),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: otpController,
                    enabled: !verified,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'OTP',
                      prefixIcon: Icon(Icons.password_outlined),
                    ),
                  ),
                ),
                SizedBox(width: 10.w),
                OutlinedButton(
                  onPressed: sending || verified ? null : onSendOtp,
                  child: sending
                      ? SizedBox(
                          width: 16.w,
                          height: 16.w,
                          child:
                              const CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Send OTP'),
                ),
              ],
            ),
            SizedBox(height: 10.h),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: verifying || verified ? null : onVerifyOtp,
                icon: verifying
                    ? SizedBox(
                        width: 16.w,
                        height: 16.w,
                        child: const CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.verified_outlined),
                label: Text(verified ? 'Aadhaar Verified' : 'Verify OTP'),
              ),
            ),
            if (message != null && message!.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Text(message!,
                  style: TextStyle(
                      color: verified ? Colors.green : KhatuColors.muted,
                      fontWeight: FontWeight.w800)),
            ],
          ],
        ),
      ),
    );
  }
}

class _PanVerifyPanel extends StatelessWidget {
  final TextEditingController panController;
  final bool verifying;
  final bool verified;
  final String? panName;
  final String? message;
  final VoidCallback onVerify;

  const _PanVerifyPanel({
    required this.panController,
    required this.verifying,
    required this.verified,
    required this.panName,
    required this.message,
    required this.onVerify,
  });

  @override
  Widget build(BuildContext context) {
    final color = verified ? Colors.green : KhatuColors.saffron;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(14.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(verified ? Icons.verified : Icons.credit_card,
                    color: color),
                SizedBox(width: 10.w),
                const Expanded(
                  child: Text('PAN Details',
                      style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: KhatuColors.text)),
                ),
                Chip(
                  label: Text(verified ? 'VERIFIED' : 'REQUIRED',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 11)),
                  backgroundColor: color,
                ),
              ],
            ),
            SizedBox(height: 12.h),
            TextFormField(
              controller: panController,
              enabled: !verifying,
              textCapitalization: TextCapitalization.characters,
              maxLength: 10,
              decoration: const InputDecoration(
                labelText: 'PAN number',
                prefixIcon: Icon(Icons.badge_outlined),
                counterText: '',
              ),
            ),
            if (panName != null && panName!.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Container(
                width: double.infinity,
                padding: EdgeInsets.all(12.w),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(12.r),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.person_search_outlined,
                        color: Colors.green),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Name on PAN',
                            style: TextStyle(
                                color: KhatuColors.muted,
                                fontWeight: FontWeight.w700),
                          ),
                          Text(
                            panName!,
                            style: const TextStyle(
                                color: KhatuColors.text,
                                fontWeight: FontWeight.w900),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
            SizedBox(height: 10.h),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: verifying ? null : onVerify,
                icon: verifying
                    ? SizedBox(
                        width: 16.w,
                        height: 16.w,
                        child: const CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.fact_check_outlined),
                label: Text(verified ? 'Reverify PAN Name' : 'Verify PAN Name'),
              ),
            ),
            if (message != null && message!.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Text(message!,
                  style: TextStyle(
                      color: verified ? Colors.green : KhatuColors.muted,
                      fontWeight: FontWeight.w800)),
            ],
          ],
        ),
      ),
    );
  }
}

class _LiveSelfiePanel extends StatelessWidget {
  final String selfiePath;
  final bool capturing;
  final VoidCallback onCapture;

  const _LiveSelfiePanel({
    required this.selfiePath,
    required this.capturing,
    required this.onCapture,
  });

  @override
  Widget build(BuildContext context) {
    final hasSelfie = selfiePath.isNotEmpty;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(14.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  hasSelfie ? Icons.verified_user : Icons.camera_front_outlined,
                  color: hasSelfie ? Colors.green : KhatuColors.saffron,
                ),
                SizedBox(width: 10.w),
                const Expanded(
                  child: Text(
                    'Live Photo Check',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: KhatuColors.text,
                    ),
                  ),
                ),
                Chip(
                  label: Text(
                    hasSelfie ? 'CAPTURED' : 'REQUIRED',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 11,
                    ),
                  ),
                  backgroundColor:
                      hasSelfie ? Colors.green : KhatuColors.saffron,
                ),
              ],
            ),
            SizedBox(height: 8.h),
            Text(
              'Front camera se live photo capture karein. Gallery upload allowed nahi hai.',
              style: TextStyle(
                color: KhatuColors.muted,
                fontSize: 12.sp,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (hasSelfie) ...[
              SizedBox(height: 12.h),
              ClipRRect(
                borderRadius: BorderRadius.circular(14.r),
                child: Image.file(
                  File(selfiePath),
                  height: 150.h,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            ],
            SizedBox(height: 12.h),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: capturing ? null : onCapture,
                icon: capturing
                    ? SizedBox(
                        width: 16.w,
                        height: 16.w,
                        child: const CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(hasSelfie
                        ? Icons.flip_camera_android_outlined
                        : Icons.camera_alt_outlined),
                label:
                    Text(capturing ? 'Opening Camera...' : hasSelfie ? 'Retake Live Photo' : 'Capture Live Photo'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IncomeProofPanel extends StatelessWidget {
  final String selectedType;
  final String fileName;
  final bool picking;
  final ValueChanged<String> onTypeChanged;
  final VoidCallback onPick;

  const _IncomeProofPanel({
    required this.selectedType,
    required this.fileName,
    required this.picking,
    required this.onTypeChanged,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) {
    final hasFile = fileName.isNotEmpty;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(14.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(hasFile ? Icons.task_outlined : Icons.upload_file_outlined,
                    color: hasFile ? Colors.green : KhatuColors.saffron),
                SizedBox(width: 10.w),
                const Expanded(
                  child: Text('Income Proof',
                      style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: KhatuColors.text)),
                ),
                Chip(
                  label: Text(hasFile ? 'ADDED' : 'REQUIRED',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 11)),
                  backgroundColor: hasFile ? Colors.green : KhatuColors.saffron,
                ),
              ],
            ),
            SizedBox(height: 6.h),
            Text(
              'Choose the type of proof you have, then upload it as a PDF or image.',
              style: TextStyle(
                  color: KhatuColors.muted,
                  fontSize: 12.sp,
                  fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 12.h),
            Wrap(
              spacing: 8.w,
              runSpacing: 8.h,
              children: _kIncomeProofTypes.map((entry) {
                final (code, label) = entry;
                final selected = code == selectedType;
                return ChoiceChip(
                  label: Text(label),
                  selected: selected,
                  onSelected: (_) => onTypeChanged(code),
                  selectedColor: KhatuColors.teal.withValues(alpha: 0.16),
                  labelStyle: TextStyle(
                    color: selected ? KhatuColors.teal : KhatuColors.muted,
                    fontWeight: FontWeight.w800,
                  ),
                );
              }).toList(),
            ),
            SizedBox(height: 12.h),
            OutlinedButton.icon(
              onPressed: picking ? null : onPick,
              icon: picking
                  ? SizedBox(
                      width: 16.w,
                      height: 16.w,
                      child: const CircularProgressIndicator(strokeWidth: 2))
                  : Icon(hasFile ? Icons.refresh : Icons.attach_file),
              label:
                  Text(hasFile ? 'Change File' : 'Choose File (PDF or Image)'),
            ),
            if (hasFile) ...[
              SizedBox(height: 8.h),
              Row(
                children: [
                  const Icon(Icons.insert_drive_file_outlined,
                      size: 16, color: KhatuColors.teal),
                  SizedBox(width: 6.w),
                  Expanded(
                    child: Text(
                      fileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: KhatuColors.text, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  final String amount;
  final String tenure;
  final String purpose;

  const _ReviewCard({
    required this.amount,
    required this.tenure,
    required this.purpose,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18.r),
        border: Border.all(color: KhatuColors.line),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            backgroundColor: Colors.white,
            child: Icon(Icons.verified_user_outlined, color: KhatuColors.teal),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Requesting Rs. ${amount.isEmpty ? '0' : amount}',
                    style: const TextStyle(
                        color: KhatuColors.text, fontWeight: FontWeight.w900)),
                SizedBox(height: 4.h),
                Text(
                  '${tenure.isEmpty ? '0' : tenure} months - ${purpose.isEmpty ? 'Personal' : purpose}',
                  style: const TextStyle(
                      color: KhatuColors.muted, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomActions extends StatelessWidget {
  final int step;
  final int maxStep;
  final bool submitting;
  final bool canSubmit;
  final VoidCallback onBack;
  final VoidCallback onNext;
  final VoidCallback onSubmit;

  const _BottomActions({
    required this.step,
    required this.maxStep,
    required this.submitting,
    required this.canSubmit,
    required this.onBack,
    required this.onNext,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 16.h),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 22,
              offset: const Offset(0, -8)),
        ],
      ),
      child: Row(
        children: [
          if (step > 0)
            OutlinedButton.icon(
              onPressed: submitting ? null : onBack,
              icon: const Icon(Icons.arrow_back),
              label: const Text('Back'),
            ),
          if (step > 0) SizedBox(width: 10.w),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: submitting || !canSubmit
                  ? null
                  : (step == maxStep ? onSubmit : onNext),
              icon: submitting
                  ? SizedBox(
                      width: 18.w,
                      height: 18.w,
                      child: const CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Icon(step == maxStep
                      ? Icons.check_circle_outline
                      : Icons.arrow_forward),
              label: Text(submitting
                  ? 'Submitting...'
                  : (step == maxStep ? 'Submit Application' : 'Continue')),
            ),
          ),
        ],
      ),
    );
  }
}
