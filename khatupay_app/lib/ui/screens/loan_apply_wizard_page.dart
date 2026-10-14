import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../models/loan_application.dart';
import '../../routes/app_router.dart';
import '../../services/loan_service.dart';
import '../../services/user_service.dart';
import '../widgets/app_back_button.dart';
import '../widgets/credit_check_card.dart';
import '../widgets/kp_widgets.dart';
import '../widgets/loan_visual.dart';

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
  /// Step to open on. Used only by the UI review renderer.
  static int debugInitialStep = 0;

  const LoanApplyWizardPage({super.key});

  @override
  State<LoanApplyWizardPage> createState() => _LoanApplyWizardPageState();
}

/// Ordered step labels. The last entry is the read-only review screen, which
/// has no form of its own - it renders what the previous four collected.
const _kStepTitles = ['Loan', 'Income', 'KYC', 'Bank', 'Review'];

class _LoanApplyWizardPageState extends State<LoanApplyWizardPage> {
  final _pageController =
      PageController(initialPage: LoanApplyWizardPage.debugInitialStep);
  final _formKeys = List.generate(5, (_) => GlobalKey<FormState>());
  final _draft = LoanApplicationDraft();

  /// Index of the read-only review step.
  static const int _reviewStep = 4;

  int _step = LoanApplyWizardPage.debugInitialStep;
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
  bool _bankStatementAnalysing = false;
  bool _bankStatementVerified = false;
  String? _bankStatementOrderId;
  String? _bankStatementMessage;
  final _imagePicker = ImagePicker();
  String _selfiePath = '';
  bool _capturingSelfie = false;
  bool _livenessVerified = false;
  bool _faceMatchVerified = false;
  bool _livenessSubmitted = false;
  bool _faceMatchSubmitted = false;
  String? _selfieVerificationMessage;
  // Experian credit report. `_creditStatus` stays '' until the server has
  // answered with VERIFIED (report received) or REVIEW (no bureau history).
  bool _creditChecking = false;
  String _creditStatus = '';
  Map<String, dynamic>? _creditSummary;
  String? _creditMessage;

  final bankNameC = TextEditingController();
  final accountNumberC = TextEditingController();
  final ifscC = TextEditingController();
  final accountHolderC = TextEditingController();
  final panNumberC = TextEditingController();

  bool _aadhaarOtpSending = false;
  bool _aadhaarOtpVerifying = false;
  bool _aadhaarEkycVerified = false;
  bool _panVerified = false;
  bool _panVerifying = false;
  bool _bankVerified = false;
  bool _bankValidating = false;
  Timer? _panAutoVerifyTimer;
  bool _panListenerPaused = false;
  String _lastPanAutoVerified = '';
  String? _aadhaarOtpSessionId;
  Map<String, dynamic>? _aadhaarEkyc;
  Map<String, dynamic>? _panVerification;
  Map<String, dynamic>? _panDetails;
  Map<String, dynamic>? _bankValidation;
  String? _aadhaarMessage;
  String? _panMessage;
  String? _panName;
  String? _bankValidationMessage;

  @override
  void initState() {
    super.initState();
    panNumberC.addListener(_onPanChanged);
    accountNumberC.addListener(_onBankDetailsChanged);
    ifscC.addListener(_onBankDetailsChanged);
    _loadEligibility();
    _loadSavedAadhaarEkyc();
  }

  void _onBankDetailsChanged() {
    if (!_bankVerified &&
        _bankValidation == null &&
        _bankValidationMessage == null) {
      return;
    }
    setState(() {
      _bankVerified = false;
      _bankValidation = null;
      _bankValidationMessage = null;
      bankNameC.clear();
      accountHolderC.clear();
    });
  }

  Future<void> _loadSavedAadhaarEkyc() async {
    try {
      final user = await UserService().me();
      final kyc = user.kyc ?? {};
      final aadhaarVerified = kyc['aadhaarVerified'] == true;
      final panVerified = kyc['panVerified'] == true;
      if (!mounted) return;
      setState(() {
        // A borrower should not need to type their authenticated profile
        // details again. Keep the editable fields blank only when the profile
        // itself has no value.
        if (nameC.text.trim().isEmpty && user.name.trim().isNotEmpty) {
          nameC.text = user.name.trim();
        }
        if (emailC.text.trim().isEmpty && user.email.trim().isNotEmpty) {
          emailC.text = user.email.trim();
        }
        if (mobileC.text.trim().isEmpty && user.mobile.trim().isNotEmpty) {
          mobileC.text = _normaliseIndianMobile(user.mobile);
        }
        if (aadhaarVerified) {
          _aadhaarEkycVerified = true;
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
            'summary': kyc['panData'], // panData IS the summary in saved form
            'response': kyc['panVerification']?['response'],
          };
          _panDetails = kyc['panData'] is Map
              ? Map<String, dynamic>.from(kyc['panData'])
              : const <String, dynamic>{};
          _lastPanAutoVerified = panNumberC.text.trim();
          // Try kyc.panName first (set by backend from ClubAPI), then panData.name
          final savedName = (kyc['panName'] ?? '').toString().trim();
          final panName = savedName.isNotEmpty && savedName != 'Customer'
              ? savedName
              : _extractPanName(_panVerification!);
          _panName = panName.isEmpty ? null : panName;
          _panMessage = panName.isEmpty
              ? 'Saved PAN verification found.'
              : 'Saved PAN verified for $panName.';
        }
      });
      await _restoreSavedVerificationStages();
    } catch (_) {
      // A new DigiLocker consent session can be started if saved data is stale.
    }
  }

  /// Verification happens on the server and can finish after Android pauses
  /// the app. Restore its persisted status so reopening the wizard never
  /// makes a completed selfie or bank check look unfinished.
  Future<void> _restoreSavedVerificationStages() async {
    try {
      final verification = await LoanService().verificationStatus();
      final stages = verification['stages'];
      if (!mounted || stages is! Map) return;

      String statusOf(String stage) {
        final value = stages[stage];
        return value is Map
            ? (value['status'] ?? '').toString().toUpperCase()
            : '';
      }
      final aadhaarStatus = statusOf('aadhaar');
      final panStatus = statusOf('pan');
      final livenessStatus = statusOf('liveness');
      final faceStatus = statusOf('faceMatch');
      final bankStatus = statusOf('bank');
      final bankStage = stages['bank'];
      setState(() {
        _aadhaarEkycVerified = _aadhaarEkycVerified || aadhaarStatus == 'VERIFIED';
        _panVerified = _panVerified || panStatus == 'VERIFIED';
        _livenessVerified = livenessStatus == 'VERIFIED';
        _faceMatchVerified = faceStatus == 'VERIFIED';
        _livenessSubmitted = ['VERIFIED', 'REVIEW'].contains(livenessStatus);
        _faceMatchSubmitted = ['VERIFIED', 'REVIEW'].contains(faceStatus);
        _bankVerified = ['VERIFIED', 'REVIEW'].contains(bankStatus);
        if (bankStage is Map && _bankVerified) {
          _bankValidation = Map<String, dynamic>.from(bankStage);
          final accountName = (bankStage['accountName'] ?? '').toString().trim();
          final bankName = (bankStage['bankName'] ?? '').toString().trim();
          if (accountHolderC.text.trim().isEmpty && accountName.isNotEmpty) {
            accountHolderC.text = accountName;
          }
          if (bankNameC.text.trim().isEmpty && bankName.isNotEmpty) {
            bankNameC.text = bankName;
          }
        }
        if (_livenessSubmitted && _faceMatchSubmitted && _selfieVerificationMessage == null) {
          _selfieVerificationMessage = _livenessVerified && _faceMatchVerified
              ? 'Live selfie and face match verified.'
              : 'Live photo submitted and awaiting secure review.';
        }
      });
    } catch (_) {
      // The wizard remains usable; each stage can still be checked again.
    }
  }

  String _normaliseIndianMobile(String value) {
    var digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 12 && digits.startsWith('91')) digits = digits.substring(2);
    if (digits.length == 11 && digits.startsWith('0')) digits = digits.substring(1);
    return digits;
  }

  bool _isValidIndianMobile(String value) =>
      RegExp(r'^[6-9]\d{9}$').hasMatch(_normaliseIndianMobile(value));

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
        _panDetails = null;
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

  /// ClubAPI returns the real name from PAN database (firstName + middleName + lastName).
  /// The backend merges it into summary.name before sending to Flutter.
  String _extractPanName(Map<String, dynamic> result) {
    final summary = result['summary'] is Map
        ? Map<String, dynamic>.from(result['summary'])
        : const <String, dynamic>{};

    // Backend stores ClubAPI name in summary.name
    for (final v in [
      summary['name'],
      summary['fullName'],
    ]) {
      final t = (v ?? '').toString().trim();
      if (t.isNotEmpty && t != 'null' && t != 'Customer') return t;
    }
    return '';
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
    setState(() {
      _aadhaarOtpSending = true;
      _aadhaarMessage = null;
      _aadhaarEkycVerified = false;
    });
    try {
      if (!await _ensureSignCareConsent()) return;
      final result = await LoanService().startDigiLocker();
      if (!mounted) return;
      setState(() {
        _aadhaarOtpSessionId =
            (result['transactionId'] ?? result['providerReference'] ?? '')
                .toString();
        _aadhaarMessage =
            'Complete secure DigiLocker consent inside Khatu Pay.';
      });
      final requestUrl = (result['requestUrl'] ?? '').toString();
      if (requestUrl.isNotEmpty) {
        final completed = await router.push<bool>(
          '/loan-aadhaar-verification?url=${Uri.encodeComponent(requestUrl)}',
        );
        if (completed == true && mounted) {
          await _verifyAadhaarOtp(afterConsent: true);
        }
      } else {
        throw Exception('Secure verification could not be started.');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _aadhaarMessage = friendlyErrorMessage(e,
            fallback: 'Could not start secure identity verification.'));
      }
    } finally {
      if (mounted) setState(() => _aadhaarOtpSending = false);
    }
  }

  Future<void> _verifyAadhaarOtp({bool afterConsent = false}) async {
    final txnId = (_aadhaarOtpSessionId ?? '').trim();
    if (txnId.isEmpty) {
      _showError('Start secure identity verification first.');
      return;
    }
    setState(() {
      _aadhaarOtpVerifying = true;
      _aadhaarMessage = null;
    });
    try {
      final result = afterConsent
          ? await LoanService().digilockerResultAfterConsent(txnId)
          : await LoanService().digilockerResult(txnId);
      final verified = result['status'] == 'VERIFIED';
      if (!mounted) return;
      setState(() {
        _aadhaarEkycVerified = verified;
        _aadhaarEkyc = result;
        final data = result['summary'] is Map
            ? Map<String, dynamic>.from(result['summary'])
            : const <String, dynamic>{};
        // summary carries the name; the parsed address lives in providerData.
        final claims = result['providerData'] is Map
            ? Map<String, dynamic>.from(result['providerData'])
            : const <String, dynamic>{};
        final name =
            _firstText([data['name'], data['fullName'], claims['fullName']]);
        final address = _extractAadhaarAddress(claims.isEmpty ? data : claims);
        if (name.isNotEmpty && nameC.text.trim().isEmpty) nameC.text = name;
        if (address.isNotEmpty && addressC.text.trim().isEmpty) {
          addressC.text = address;
        }
        _aadhaarMessage = verified
            ? (name.isEmpty
                ? 'Identity verification completed.'
                : 'Identity verified for $name.')
            : 'Verification is still pending. Complete secure consent and try again.';
      });
    } catch (e) {
      if (mounted) {
        setState(() => _aadhaarMessage = friendlyErrorMessage(e,
            fallback: 'Identity verification could not be completed.'));
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
      _panDetails = null;
    });
    try {
      if (!await _ensureSignCareConsent()) return;
      final result = await LoanService().verifyPanWithSignCare(
        pan: pan,
        name: nameC.text.trim().isEmpty ? 'Customer' : nameC.text.trim(),
      );
      final verified = result['status'] == 'VERIFIED';
      if (!mounted) return;
      setState(() {
        _panVerified = verified;
        _panVerification = result;
        _panDetails = result['summary'] is Map
            ? Map<String, dynamic>.from(result['summary'])
            : const <String, dynamic>{};
        _lastPanAutoVerified = pan;
        final panName = _extractPanName(result);
        _panName = panName.isEmpty ? null : panName;

        // Build a rich status message from all returned fields
        final summary = _panDetails ?? {};
        final category = (summary['category'] ?? '').toString().trim();
        final panStatus =
            (summary['panStatus'] ?? summary['status'] ?? '').toString().trim();
        final aadhaar =
            (summary['aadhaarSeedingStatus'] ?? '').toString().trim();

        String msg;
        if (verified) {
          final parts = <String>[];
          if (panName.isNotEmpty) parts.add('Name: $panName');
          if (category.isNotEmpty) parts.add('Type: $category');
          if (panStatus.isNotEmpty) parts.add('Status: $panStatus');
          if (aadhaar.isNotEmpty) parts.add('Aadhaar: $aadhaar');
          msg = parts.isEmpty
              ? 'PAN verified successfully.'
              : parts.join('  •  ');
        } else {
          final statusText = panStatus.isNotEmpty ? panStatus : 'INVALID';
          msg = 'PAN status: $statusText. Sahi PAN number enter karein.';
        }
        _panMessage = msg;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _panVerified = false;
          _panName = null;
          _panDetails = null;
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
    final mobile = _normaliseIndianMobile(mobileC.text);
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
      if (!await _ensureSignCareConsent()) return;
      final result = await LoanService().verifyBankWithSignCare(
        accountNumber: account,
        ifsc: ifsc,
      );
      final summary = result['summary'] is Map
          ? Map<String, dynamic>.from(result['summary'])
          : const <String, dynamic>{};
      final name = (result['accountName'] ??
              result['beneficiaryName'] ??
              result['name'] ??
              summary['name'] ??
              summary['accountName'] ??
              summary['beneficiaryName'] ??
              '')
          .toString();
      final bankName = (result['bankName'] ??
              result['bank_name'] ??
              summary['bankName'] ??
              summary['bank_name'] ??
              '')
          .toString();
      final status = (result['status'] ?? '').toString().toUpperCase();
      final accepted = status == 'VERIFIED' || status == 'REVIEW';
      final message = (result['message'] ?? '').toString().trim();
      if (!mounted) return;
      setState(() {
        _bankVerified = accepted;
        _bankValidation = result;
        if (name.isNotEmpty) accountHolderC.text = name;
        if (bankName.isNotEmpty) bankNameC.text = bankName;
        _bankValidationMessage = status == 'REVIEW'
            ? (message.isEmpty
                ? 'Bank details submitted for Khatu Pay review.'
                : message)
            : status == 'PENDING'
                ? 'Bank verification is still running. Tap Validate again in a moment.'
                : status == 'FAILED'
                    ? (message.isEmpty
                        ? 'Bank account could not be verified. Please check the account number and IFSC.'
                        : message)
                    : name.isEmpty
                        ? 'Bank account validated.'
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

  Future<bool> _ensureSignCareConsent() async {
    if (_consentAccepted) {
      await LoanService().acceptVerificationConsent();
      return true;
    }
    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Verification consent'),
        content: const Text(
          'I authorise Khatu Pay to verify my identity, bank account and credit information through SignCare for loan eligibility assessment.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Not now')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('I agree')),
        ],
      ),
    );
    if (accepted != true) return false;
    await LoanService().acceptVerificationConsent();
    if (mounted) setState(() => _consentAccepted = true);
    return true;
  }

  Future<void> _pickIncomeProofFile() async {
    setState(() => _pickingIncomeProof = true);
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: _incomeProofType == 'BANK_STATEMENT'
            ? ['pdf']
            : ['pdf', 'jpg', 'jpeg', 'png'],
      );
      final file = picked?.files.firstOrNull;
      if (file?.path == null) return;
      setState(() {
        _incomeProofPath = file!.path!;
        _incomeProofFileName = file.name;
        _bankStatementVerified = false;
        _bankStatementOrderId = null;
        _bankStatementMessage = null;
      });
      if (_incomeProofType == 'BANK_STATEMENT') {
        await _startBankStatementAnalysis(file!.path!);
      }
    } catch (e) {
      if (mounted) {
        _showError(friendlyErrorMessage(e,
            fallback: 'Could not open file picker. Please try again.'));
      }
    } finally {
      if (mounted) setState(() => _pickingIncomeProof = false);
    }
  }

  Future<void> _startBankStatementAnalysis(String path) async {
    setState(() {
      _bankStatementAnalysing = true;
      _bankStatementMessage = 'Uploading statement for secure analysis...';
    });
    try {
      if (!await _ensureSignCareConsent()) return;
      final password = await _optionalStatementPassword();
      if (!mounted) return;
      final result = await LoanService().analyseBankStatement(
        filePath: path,
        password: password ?? '',
        accountType: _employmentType == 'Salaried' ? 'SALARIED' : 'SME',
      );
      final orderId =
          (result['orderId'] ?? result['providerReference'] ?? '').toString();
      if ((result['status'] ?? '') == 'REVIEW') {
        // Provider outage: the statement is saved and the credit team
        // completes the analysis, so the customer can continue.
        setState(() {
          _bankStatementVerified = true;
          _bankStatementMessage = (result['message'] ??
                  'Bank statement received. Khatu Pay will complete the analysis during review.')
              .toString();
        });
        return;
      }
      if (orderId.isEmpty) {
        throw Exception('Bank statement analysis could not be started.');
      }
      setState(() {
        _bankStatementOrderId = orderId;
        _bankStatementMessage =
            'Analysis started. Checking the report status...';
      });
      await _checkBankStatementAnalysis();
    } catch (e) {
      if (mounted) {
        setState(() => _bankStatementMessage = friendlyErrorMessage(e,
            fallback:
                'Bank statement could not be analysed. Check the PDF and try again.'));
      }
    } finally {
      if (mounted) setState(() => _bankStatementAnalysing = false);
    }
  }

  Future<String?> _optionalStatementPassword() async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('PDF password'),
        content: TextField(
          controller: controller,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Password (optional)',
            hintText: 'Leave blank if the PDF opens without a password',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, ''),
              child: const Text('No password')),
          FilledButton(
              onPressed: () => Navigator.pop(context, controller.text),
              child: const Text('Continue')),
        ],
      ),
    );
    controller.dispose();
    return value;
  }

  Future<void> _checkBankStatementAnalysis() async {
    final orderId = (_bankStatementOrderId ?? '').trim();
    if (orderId.isEmpty) return;
    setState(() => _bankStatementAnalysing = true);
    try {
      final result = await LoanService().bankStatementAnalysisStatus(orderId);
      final verified = result['status'] == 'VERIFIED';
      if (!mounted) return;
      setState(() {
        _bankStatementVerified = verified;
        _bankStatementMessage = verified
            ? 'Bank statement analysed successfully.'
            : 'Analysis is still processing. Tap Check status after a moment.';
      });
    } catch (e) {
      if (mounted) {
        setState(() => _bankStatementMessage = friendlyErrorMessage(e,
            fallback: 'Could not check bank statement analysis status.'));
      }
    } finally {
      if (mounted) setState(() => _bankStatementAnalysing = false);
    }
  }

  Future<void> _captureLiveSelfie() async {
    setState(() => _capturingSelfie = true);
    try {
      if (!await _ensureSignCareConsent()) return;
      final picked = await _imagePicker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 82,
        maxWidth: 1400,
      );
      if (picked == null) return;
      if (!mounted) return;
      setState(() {
        _selfiePath = picked.path;
        _livenessVerified = false;
        _faceMatchVerified = false;
        _livenessSubmitted = false;
        _faceMatchSubmitted = false;
        _selfieVerificationMessage =
            'Live photo submitted. Verification is in progress.';
      });
      final imageBase64 = base64Encode(await File(picked.path).readAsBytes());
      final liveness = await LoanService().verifyLiveness(imageBase64);
      final livenessStatus = (liveness['status'] ?? '').toString();
      final livenessAccepted =
          livenessStatus == 'VERIFIED' || livenessStatus == 'REVIEW';
      if (!livenessAccepted) {
        if (livenessStatus == 'FAILED') {
          throw Exception(liveness['message'] ??
              'Live selfie was not accepted. Please retake the photo in good light with only your face visible.');
        }
        if (livenessStatus == 'PENDING') {
          throw Exception(
              'Your live photo is still being verified. Please capture it again in a moment.');
        }
        throw Exception(_verificationStageMessage(liveness,
            'Live photo was captured, but needs one more clear selfie.'));
      }
      if (!mounted) return;
      setState(() {
        _livenessVerified = livenessStatus == 'VERIFIED';
        _livenessSubmitted = true;
        _selfieVerificationMessage = livenessStatus == 'VERIFIED'
            ? 'Live selfie verified. Matching face with identity photo...'
            : _verificationStageMessage(liveness,
                'Live photo captured. Verification will be reviewed securely.');
      });
      final faceMatch =
          await LoanService().verifyFaceMatch(selfieBase64: imageBase64);
      if (!mounted) return;
      final faceStatus = (faceMatch['status'] ?? '').toString();
      final verified = faceStatus == 'VERIFIED';
      final faceAccepted = verified || faceStatus == 'REVIEW';
      setState(() {
        _livenessSubmitted = true;
        _faceMatchVerified = verified;
        _faceMatchSubmitted = faceAccepted;
        _selfieVerificationMessage = verified
            ? 'Live selfie and face match verified.'
            : faceAccepted
                ? _verificationStageMessage(faceMatch,
                    'Live photo captured. Face match is under review.')
                : _verificationStageMessage(
                    faceMatch, 'Face match needs one more clear live photo.');
      });
    } catch (e) {
      if (mounted) {
        // The service layer already read the stage back from the server after
        // a lost response, so anything that reaches here really needs a retry.
        // Marking it "submitted" locally would only fail later at submit.
        setState(() {
          _livenessVerified = false;
          _faceMatchVerified = false;
          _livenessSubmitted = false;
          _faceMatchSubmitted = false;
          _selfieVerificationMessage = _selfiePath.isNotEmpty
              ? friendlyErrorMessage(e,
                  fallback:
                      'Live photo could not be submitted. Please try again in good light.')
              : friendlyErrorMessage(e,
                  fallback:
                      'Camera photo could not be saved. Please try again.');
        });
      }
    } finally {
      if (mounted) setState(() => _capturingSelfie = false);
    }
  }

  String _verificationStageMessage(
      Map<String, dynamic> result, String fallback) {
    final summary = result['summary'] is Map
        ? Map<String, dynamic>.from(result['summary'])
        : const <String, dynamic>{};
    for (final value in [
      summary['providerMessage'],
      result['message'],
      summary['providerStatus'],
    ]) {
      final text = (value ?? '').toString().trim();
      if (text.isNotEmpty && text != 'null') return text;
    }
    return fallback;
  }

  /// Blocking requirements for a step, in the order the user should fix them.
  /// Returns null when the step is complete. Shared by [_next] and [_submit]
  /// so the two can never disagree about what "complete" means.
  String? _stepBlocker(int step) {
    switch (step) {
      case 0:
        final amount = num.tryParse(amountC.text.trim()) ?? 0;
        final tenure = int.tryParse(tenureC.text.trim()) ?? 0;
        if (nameC.text.trim().isEmpty) return 'Please enter your full name.';
        if (!_isValidIndianMobile(mobileC.text)) {
          return 'Please enter a valid mobile number.';
        }
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
        if (_incomeProofType == 'BANK_STATEMENT' && !_bankStatementVerified) {
          return 'Please complete bank statement analysis before continuing.';
        }
        return null;
      case 2:
        if (!_aadhaarEkycVerified) {
          return 'Please complete secure DigiLocker identity verification.';
        }
        if (!_panVerified) return 'Please verify your PAN details.';
        if (!_livenessSubmitted ||
            !_faceMatchSubmitted) {
          return 'Please capture and submit your live photo.';
        }
        return null;
      case 3:
        if (!RegExp(r'^\d{6,20}$').hasMatch(accountNumberC.text.trim())) {
          return 'Please enter a valid bank account number.';
        }
        if (!RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$')
            .hasMatch(ifscC.text.trim().toUpperCase())) {
          return 'Please enter a valid IFSC code.';
        }
        if (!_bankVerified) {
          return 'Please validate your bank account details.';
        }
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

    // The credit report is part of every application. A bureau outage comes
    // back as REVIEW (the credit team re-pulls it), so this never strands the
    // customer - it only stops a submit that skipped the check.
    if (_creditStatus != 'VERIFIED' && _creditStatus != 'REVIEW') {
      final creditOk = await _runCreditCheck();
      if (!creditOk) {
        if (mounted) {
          setState(() => _submitError = _creditMessage ??
              'Please complete the credit report check before submitting.');
        }
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
    } on LoanSubmitException catch (e) {
      if (!mounted) return;
      setState(() => _submitError = e.message);
      final step = _stepForStages(e.stages);
      if (step != null && step != _step) _goToStep(step);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitError = friendlyErrorMessage(e,
          fallback:
              'Your application could not be submitted. Please try again.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// The wizard step where the customer can finish the first stage the
  /// server says is incomplete.
  int? _stepForStages(List<String> stages) {
    if (stages.isEmpty) return null;
    const identity = {'pan', 'aadhaar', 'liveness', 'faceMatch'};
    if (stages.any(identity.contains)) {
      // Reset local flags so the step shows what is still missing.
      setState(() {
        if (stages.contains('aadhaar')) _aadhaarEkycVerified = false;
        if (stages.contains('pan')) _panVerified = false;
        if (stages.contains('liveness') || stages.contains('faceMatch')) {
          _livenessSubmitted = false;
          _faceMatchSubmitted = false;
        }
      });
      return 2;
    }
    if (stages.contains('bank') || stages.contains('upi')) {
      setState(() => _bankVerified = false);
      return 3;
    }
    if (stages.contains('bankStatement')) return 1;
    if (stages.contains('credit')) {
      setState(() => _creditStatus = '');
      return _reviewStep;
    }
    return null;
  }

  /// Fetches the Experian report. Returns true when the application may go on:
  /// VERIFIED (report received) or REVIEW (no bureau history - the credit team
  /// decides). Any other outcome leaves [_creditMessage] set for the user.
  Future<bool> _runCreditCheck() async {
    if (_creditChecking) return false;
    setState(() {
      _creditChecking = true;
      _creditMessage = null;
    });
    try {
      final credit = await LoanService().fetchExperian();
      final status = (credit['status'] ?? '').toString().toUpperCase();
      if (status != 'VERIFIED' && status != 'REVIEW') {
        throw Exception(
            'Your credit report is still being prepared. Please try again in a moment.');
      }
      if (!mounted) return false;
      final summary = credit['summary'];
      setState(() {
        _creditStatus = status;
        _creditSummary =
            summary is Map ? Map<String, dynamic>.from(summary) : null;
      });
      return true;
    } catch (e) {
      if (!mounted) return false;
      setState(() {
        _creditStatus = '';
        _creditSummary = null;
        _creditMessage = friendlyErrorMessage(e,
            fallback:
                'Your credit report could not be fetched. Please try again.');
      });
      return false;
    } finally {
      if (mounted) setState(() => _creditChecking = false);
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
      ..mobile = _normaliseIndianMobile(mobileC.text)
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
      ..accountHolderName = accountHolderC.text.trim().isEmpty
          ? (_bankVerified ? 'Pending Khatu Pay review' : '')
          : accountHolderC.text.trim()
      ..bankValidation = _bankValidation
      ..creditReportConsent = _consentAccepted
      ..termsAccepted = _consentAccepted
      ..privacyAccepted = _consentAccepted;
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
                  required: true,
                  number: true,
                  onChanged: (_) => setState(() {})),
            ),
            SizedBox(width: 10.w),
            Expanded(
              flex: 2,
              child: _field(tenureC, 'Months', Icons.calendar_month,
                  required: true,
                  number: true,
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
          analysing: _bankStatementAnalysing,
          analysisVerified: _bankStatementVerified,
          analysisMessage: _bankStatementMessage,
          onTypeChanged: (value) => setState(() {
            _incomeProofType = value;
            _incomeProofPath = '';
            _incomeProofFileName = '';
            _bankStatementVerified = false;
            _bankStatementOrderId = null;
            _bankStatementMessage = null;
          }),
          onPick: _pickIncomeProofFile,
          onCheckStatus: _checkBankStatementAnalysis,
        ),
      ],
    );
  }

  Widget _stepDocuments() {
    return _StepScaffold(
      title: 'KYC Verify',
      subtitle:
          'Verify your PAN and identity through secure DigiLocker consent to continue.',
      formKey: _formKeys[2],
      children: [
        _AadhaarEkycPanel(
          sending: _aadhaarOtpSending,
          verifying: _aadhaarOtpVerifying,
          verified: _aadhaarEkycVerified,
          started: (_aadhaarOtpSessionId ?? '').isNotEmpty,
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
          panDetails: _panDetails,
          message: _panMessage,
          onVerify: () => _verifyPan(),
        ),
        SizedBox(height: 12.h),
        _LiveSelfiePanel(
          selfiePath: _selfiePath,
          capturing: _capturingSelfie,
          verified: _livenessVerified && _faceMatchVerified,
          submitted: _livenessSubmitted && _faceMatchSubmitted,
          message: _selfieVerificationMessage,
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
        _field(accountNumberC, 'Account number', Icons.numbers,
            required: true, number: true),
        _field(
          ifscC,
          'IFSC code',
          Icons.pin_outlined,
          required: true,
          textCapitalization: TextCapitalization.characters,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
            LengthLimitingTextInputFormatter(11),
            TextInputFormatter.withFunction((oldValue, newValue) {
              return newValue.copyWith(
                text: newValue.text.toUpperCase(),
                selection: newValue.selection,
              );
            }),
          ],
        ),
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
        if (_bankVerified) ...[
          SizedBox(height: 8.h),
          _AutoVerifiedBankDetails(
            bankName: bankNameC.text.trim(),
            accountHolder: accountHolderC.text.trim(),
          ),
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
    TextCapitalization? textCapitalization,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: TextFormField(
        controller: controller,
        maxLines: lines,
        onChanged: onChanged,
        inputFormatters: inputFormatters,
        textCapitalization: textCapitalization ??
            (email ? TextCapitalization.none : TextCapitalization.words),
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
          if (phone && text.isNotEmpty && !_isValidIndianMobile(text)) {
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
                          child:
                              _heroStat('Estimated EMI', kpMoney(estimate.emi)),
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
              (
                'Monthly income',
                kpMoney(num.tryParse(monthlyIncomeC.text.trim()) ?? 0)
              ),
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
              (
                'Identity verification',
                _aadhaarEkycVerified ? 'Verified' : 'Pending'
              ),
              ('PAN', _panVerified ? (_panName ?? 'Verified') : 'Pending'),
              (
                'Face verification',
                _livenessVerified && _faceMatchVerified
                    ? 'Verified'
                    : _selfiePath.isEmpty
                        ? 'Pending'
                        : _livenessSubmitted && _faceMatchSubmitted
                            ? 'Submitted for review'
                            : 'Incomplete'
              ),
            ],
            statuses: [
              _aadhaarEkycVerified,
              _panVerified,
              _livenessSubmitted && _faceMatchSubmitted,
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
          SizedBox(height: 12.h),
          CreditCheckCard(
            checking: _creditChecking,
            status: _creditStatus,
            summary: _creditSummary,
            message: _creditMessage,
            enabled: _consentAccepted && !_submitting,
            onCheck: _runCreditCheck,
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
    return Container(
      padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 12.h),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: KhatuColors.line)),
      ),
      // Numbered stepper: completed steps show a tick, the current one is
      // filled, and the connector fills as the borrower moves forward.
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < totalSteps; i++)
            Expanded(
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 3,
                          color: i == 0
                              ? Colors.transparent
                              : i <= step
                                  ? KhatuColors.teal
                                  : KhatuColors.line,
                        ),
                      ),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        width: 26,
                        height: 26,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i < step
                              ? KhatuColors.teal
                              : i == step
                                  ? KhatuColors.deepTeal
                                  : Colors.white,
                          border: Border.all(
                            color: i <= step
                                ? Colors.transparent
                                : KhatuColors.lineStrong,
                            width: 1.5,
                          ),
                        ),
                        child: i < step
                            ? const Icon(Icons.check_rounded,
                                size: 15, color: Colors.white)
                            : Text(
                                '${i + 1}',
                                style: TextStyle(
                                  fontFamily: 'Roboto',
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: i == step
                                      ? Colors.white
                                      : KhatuColors.faint,
                                ),
                              ),
                      ),
                      Expanded(
                        child: Container(
                          height: 3,
                          color: i == totalSteps - 1
                              ? Colors.transparent
                              : i < step
                                  ? KhatuColors.teal
                                  : KhatuColors.line,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _kStepTitles[i.clamp(0, _kStepTitles.length - 1)],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Roboto',
                      color: i == step
                          ? KhatuColors.deepTeal
                          : i < step
                              ? KhatuColors.text
                              : KhatuColors.faint,
                      fontSize: 10.5,
                      fontWeight: i == step ? FontWeight.w900 : FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _AutoVerifiedBankDetails extends StatelessWidget {
  final String bankName;
  final String accountHolder;

  const _AutoVerifiedBankDetails({
    required this.bankName,
    required this.accountHolder,
  });

  @override
  Widget build(BuildContext context) {
    final rows = [
      (
        'Bank name',
        bankName.isEmpty ? 'Will be reviewed by Khatu Pay' : bankName
      ),
      (
        'Account holder',
        accountHolder.isEmpty ? 'Will be reviewed by Khatu Pay' : accountHolder
      ),
    ];
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(12.w),
      decoration: BoxDecoration(
        color: KhatuColors.softTeal,
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(color: KhatuColors.teal.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: rows
            .map((row) => Padding(
                  padding: EdgeInsets.only(bottom: row == rows.last ? 0 : 8.h),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          row.$1,
                          style: const TextStyle(
                            color: KhatuColors.muted,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          row.$2,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            color: KhatuColors.text,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                ))
            .toList(),
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
    final visual = switch (title) {
      'Loan details' => const (
          'assets/loans/generated/loan_apply_illustration.png',
          Icons.request_quote_outlined
        ),
      'Income details' => const (
          'assets/loans/generated/loan_credit_review.png',
          Icons.insights_outlined
        ),
      'KYC Verify' => const (
          'assets/loans/generated/loan_identity_check.png',
          Icons.verified_user_outlined
        ),
      'Bank Details' => const (
          'assets/loans/generated/loan_bank_verify.png',
          Icons.account_balance_outlined
        ),
      _ => const (
          'assets/loans/generated/loan_apply_illustration.png',
          Icons.assignment_turned_in_outlined
        ),
    };
    return Form(
      key: formKey,
      child: ListView(
        padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 24.h),
        children: [
          // One compact header card per step: what this step is for on the
          // left, its illustration on the right.
          Container(
            padding: EdgeInsets.fromLTRB(16.w, 14.h, 10.w, 14.h),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFE8F8F4), Color(0xFFF4FBF9)],
              ),
              borderRadius: BorderRadius.circular(KhatuRadius.lg),
              border: Border.all(
                  color: KhatuColors.teal.withValues(alpha: 0.18)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: TextStyle(
                              fontFamily: 'Roboto',
                              color: KhatuColors.ink,
                              fontSize: 20.sp,
                              height: 1.15,
                              fontWeight: FontWeight.w900)),
                      SizedBox(height: 6.h),
                      Text(subtitle,
                          style: TextStyle(
                              fontFamily: 'Roboto',
                              color: KhatuColors.muted,
                              fontSize: 12.5.sp,
                              height: 1.4,
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                SizedBox(width: 8.w),
                LoanVisual(
                    asset: visual.$1, fallbackIcon: visual.$2, size: 78.w),
              ],
            ),
          ),
          SizedBox(height: 18.h),
          ...children,
        ],
      ),
    );
  }
}

class _AadhaarEkycPanel extends StatelessWidget {
  final bool sending;
  final bool verifying;
  final bool verified;
  final bool started;
  final String? message;
  final VoidCallback onSendOtp;
  final VoidCallback onVerifyOtp;

  const _AadhaarEkycPanel({
    required this.sending,
    required this.verifying,
    required this.verified,
    required this.message,
    required this.onSendOtp,
    required this.onVerifyOtp,
    this.started = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = verified ? KhatuColors.success : KhatuColors.saffron;
    final busy = sending || verifying;
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
                  child: Text('Aadhaar via DigiLocker',
                      style: TextStyle(
                          fontFamily: 'Roboto',
                          fontWeight: FontWeight.w900,
                          color: KhatuColors.text)),
                ),
                _StageChip(
                    label: verified ? 'Verified' : 'Required', color: color),
              ],
            ),
            SizedBox(height: 10.h),
            Text(
                verified
                    ? 'Your identity is verified through DigiLocker.'
                    : 'Verify with secure DigiLocker consent. Your Aadhaar number and OTP are entered only on the DigiLocker page, never in Khatu Pay.',
                style: const TextStyle(
                    fontFamily: 'Roboto',
                    color: KhatuColors.muted,
                    fontSize: 12.5,
                    height: 1.45,
                    fontWeight: FontWeight.w600)),
            if (!verified) ...[
              SizedBox(height: 12.h),
              // One clear action. "Check status" only makes sense after the
              // DigiLocker session has been started.
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: busy ? null : onSendOtp,
                  icon: sending
                      ? SizedBox(
                          width: 16.w,
                          height: 16.w,
                          child: const CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.verified_user_outlined),
                  label: Text(sending
                      ? 'Opening DigiLocker...'
                      : started
                          ? 'Verify again with DigiLocker'
                          : 'Verify with DigiLocker'),
                ),
              ),
              if (started) ...[
                SizedBox(height: 8.h),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: busy ? null : onVerifyOtp,
                    icon: verifying
                        ? SizedBox(
                            width: 16.w,
                            height: 16.w,
                            child: const CircularProgressIndicator(
                                strokeWidth: 2))
                        : const Icon(Icons.sync_rounded),
                    label: Text(verifying
                        ? 'Checking...'
                        : 'I finished - check status'),
                  ),
                ),
              ],
            ],
            if (message != null && message!.isNotEmpty) ...[
              SizedBox(height: 10.h),
              Text(message!,
                  style: TextStyle(
                      fontFamily: 'Roboto',
                      color: verified ? KhatuColors.success : KhatuColors.muted,
                      fontWeight: FontWeight.w800)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Small status pill used on the verification cards.
class _StageChip extends StatelessWidget {
  const _StageChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(KhatuRadius.pill),
        ),
        child: Text(label,
            style: TextStyle(
                fontFamily: 'Roboto',
                color: color == KhatuColors.saffron ? KhatuColors.gold : color,
                fontWeight: FontWeight.w900,
                fontSize: 11)),
      );
}

class _PanVerifyPanel extends StatelessWidget {
  final TextEditingController panController;
  final bool verifying;
  final bool verified;
  final String? panName;
  final Map<String, dynamic>? panDetails;
  final String? message;
  final VoidCallback onVerify;

  const _PanVerifyPanel({
    required this.panController,
    required this.verifying,
    required this.verified,
    required this.panName,
    required this.panDetails,
    required this.message,
    required this.onVerify,
  });

  @override
  Widget build(BuildContext context) {
    final color = verified ? Colors.green : KhatuColors.saffron;
    final details = panDetails ?? const <String, dynamic>{};
    final panStatus =
        (details['panStatus'] ?? details['status'] ?? '').toString().trim();
    final aadhaarSeeding =
        (details['aadhaarSeedingStatus'] ?? '').toString().trim();
    final category = (details['category'] ?? '').toString().trim();
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
                _StageChip(
                    label: verified ? 'Verified' : 'Required',
                    color: verified ? KhatuColors.success : KhatuColors.saffron),
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
            // Show PAN details returned by provider (category, status, aadhaar link).
            // Name comes from ClubAPI panVerify — show it when available.
            if (verified &&
                (panName != null && panName!.isNotEmpty ||
                    category.isNotEmpty ||
                    panStatus.isNotEmpty ||
                    aadhaarSeeding.isNotEmpty)) ...[
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.verified_outlined, color: Colors.green),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (panName != null && panName!.isNotEmpty) ...[
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
                                  fontWeight: FontWeight.w900,
                                  fontSize: 16),
                            ),
                            SizedBox(height: 4.h),
                          ],
                          if (category.isNotEmpty)
                            Text(
                              'PAN type: $category',
                              style: const TextStyle(
                                  color: KhatuColors.muted,
                                  fontWeight: FontWeight.w700),
                            ),
                          if (panStatus.isNotEmpty)
                            Text(
                              'Status: $panStatus',
                              style: TextStyle(
                                  color: panStatus.toUpperCase() == 'VALID'
                                      ? Colors.green.shade700
                                      : KhatuColors.muted,
                                  fontWeight: FontWeight.w700),
                            ),
                          if (aadhaarSeeding.isNotEmpty)
                            Text(
                              'Aadhaar link: $aadhaarSeeding',
                              style: const TextStyle(
                                  color: KhatuColors.muted,
                                  fontWeight: FontWeight.w700),
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
                label: Text(verified ? 'Reverify PAN' : 'Verify PAN'),
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
  final bool verified;
  final bool submitted;
  final String? message;
  final VoidCallback onCapture;

  const _LiveSelfiePanel({
    required this.selfiePath,
    required this.capturing,
    required this.verified,
    required this.submitted,
    required this.message,
    required this.onCapture,
  });

  @override
  Widget build(BuildContext context) {
    final hasSelfie = selfiePath.isNotEmpty;
    final submittedForReview = submitted && !verified;
    final statusColor = verified
        ? Colors.green
        : submittedForReview
            ? KhatuColors.saffron
            : KhatuColors.saffron;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(14.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!hasSelfie)
              const Align(
                alignment: Alignment.centerRight,
                child: LoanVisual(
                  asset: 'assets/loans/generated/loan_selfie_secure.png',
                  fallbackIcon: Icons.face_retouching_natural_outlined,
                  size: 72,
                ),
              ),
            Row(
              children: [
                Icon(
                  hasSelfie ? Icons.verified_user : Icons.camera_front_outlined,
                  color: statusColor,
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
                _StageChip(
                    label: verified
                        ? 'Verified'
                        : submittedForReview
                            ? 'In review'
                            : 'Required',
                    color: verified
                        ? KhatuColors.success
                        : submittedForReview
                            ? KhatuColors.info
                            : KhatuColors.saffron),
              ],
            ),
            SizedBox(height: 8.h),
            Text(
              'Use the front camera for a live selfie. Gallery upload is not allowed.',
              style: TextStyle(
                color: KhatuColors.muted,
                fontSize: 12.sp,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (message != null && message!.isNotEmpty) ...[
              SizedBox(height: 8.h),
              Text(message!,
                  style: TextStyle(
                    color: verified ? Colors.green : KhatuColors.muted,
                    fontWeight: FontWeight.w700,
                  )),
            ],
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
                label: Text(capturing
                    ? 'Opening Camera...'
                    : hasSelfie
                        ? 'Retake Live Photo'
                        : 'Capture Live Photo'),
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
  final bool analysing;
  final bool analysisVerified;
  final String? analysisMessage;
  final ValueChanged<String> onTypeChanged;
  final VoidCallback onPick;
  final VoidCallback onCheckStatus;

  const _IncomeProofPanel({
    required this.selectedType,
    required this.fileName,
    required this.picking,
    required this.analysing,
    required this.analysisVerified,
    required this.analysisMessage,
    required this.onTypeChanged,
    required this.onPick,
    required this.onCheckStatus,
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
                _StageChip(
                    label: hasFile ? 'Added' : 'Required',
                    color: hasFile ? KhatuColors.success : KhatuColors.saffron),
              ],
            ),
            SizedBox(height: 6.h),
            Text(
              selectedType == 'BANK_STATEMENT'
                  ? 'Upload a PDF statement. It will be securely analysed before submission.'
                  : 'Choose the type of proof you have, then upload it as a PDF or image.',
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
              onPressed: picking || analysing ? null : onPick,
              icon: picking || analysing
                  ? SizedBox(
                      width: 16.w,
                      height: 16.w,
                      child: const CircularProgressIndicator(strokeWidth: 2))
                  : Icon(hasFile ? Icons.refresh : Icons.attach_file),
              label: Text(analysing
                  ? 'Analysing statement...'
                  : hasFile
                      ? 'Change File'
                      : selectedType == 'BANK_STATEMENT'
                          ? 'Choose Bank Statement PDF'
                          : 'Choose File (PDF or Image)'),
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
            if (selectedType == 'BANK_STATEMENT' &&
                analysisMessage != null) ...[
              SizedBox(height: 10.h),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    analysisVerified
                        ? Icons.verified_rounded
                        : Icons.schedule_rounded,
                    size: 18,
                    color: analysisVerified ? Colors.green : KhatuColors.gold,
                  ),
                  SizedBox(width: 7.w),
                  Expanded(
                    child: Text(analysisMessage!,
                        style: TextStyle(
                          color: analysisVerified
                              ? Colors.green
                              : KhatuColors.muted,
                          fontWeight: FontWeight.w700,
                        )),
                  ),
                ],
              ),
              if (!analysisVerified && hasFile) ...[
                SizedBox(height: 8.h),
                OutlinedButton.icon(
                  onPressed: analysing ? null : onCheckStatus,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Check analysis status'),
                ),
              ],
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
      padding: EdgeInsets.fromLTRB(
          16.w, 10.h, 16.w, 10.h + MediaQuery.of(context).viewPadding.bottom),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: KhatuColors.line)),
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
            IconButton(
              tooltip: 'Back',
              onPressed: submitting ? null : onBack,
              icon: const Icon(Icons.arrow_back),
              style: IconButton.styleFrom(
                foregroundColor: KhatuColors.deepTeal,
                backgroundColor: KhatuColors.softTeal,
                fixedSize: const Size(48, 48),
              ),
            ),
          if (step > 0) SizedBox(width: 10.w),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: submitting || !canSubmit
                  ? null
                  : (step == maxStep ? onSubmit : onNext),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(0, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(KhatuRadius.md),
                ),
              ),
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
