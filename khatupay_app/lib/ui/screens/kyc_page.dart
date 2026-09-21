import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../models/user.dart';
import '../../providers/auth_providers.dart';
import '../../services/loan_service.dart';
import '../../services/user_service.dart';
import '../widgets/app_back_button.dart';
import '../widgets/offer_banner_carousel.dart';

class KycPage extends ConsumerStatefulWidget {
  const KycPage({super.key});

  @override
  ConsumerState<KycPage> createState() => _KycPageState();
}

class _KycPageState extends ConsumerState<KycPage> {
  final _documentNumberController = TextEditingController();
  final _panController = TextEditingController();
  String _documentType = 'BANK_STATEMENT';
  bool _uploading = false;
  bool _sendingAadhaarOtp = false;
  bool _verifyingAadhaarOtp = false;
  bool _verifyingPan = false;
  bool _capturingSelfie = false;
  bool _livenessVerified = false;
  bool _faceMatchVerified = false;
  String? _aadhaarOtpSessionId;
  String? _message;
  String? _aadhaarMessage;
  String? _panMessage;
  String? _selfieMessage;
  String _selfiePath = '';
  final _imagePicker = ImagePicker();
  List<PlatformFile> _files = [];

  @override
  void initState() {
    super.initState();
    _loadSignCareStatus();
  }

  @override
  void dispose() {
    _documentNumberController.dispose();
    _panController.dispose();
    super.dispose();
  }

  Future<void> _loadSignCareStatus() async {
    try {
      final result = await LoanService().verificationStatus();
      final stages = result['stages'] is Map
          ? Map<String, dynamic>.from(result['stages'])
          : const <String, dynamic>{};
      if (!mounted) return;
      setState(() {
        _livenessVerified = stages['liveness']?['status'] == 'VERIFIED';
        _faceMatchVerified = stages['faceMatch']?['status'] == 'VERIFIED';
        if (_livenessVerified && _faceMatchVerified) {
          _selfieMessage = 'Live selfie and Aadhaar face match verified.';
        }
      });
    } catch (_) {
      // The profile cards still load from the user record; retry is available.
    }
  }

  Future<void> _acceptVerificationConsent() async {
    await LoanService().acceptVerificationConsent();
  }

  Future<void> _pickFiles() async {
    final picked = await FilePicker.platform.pickFiles(allowMultiple: true);
    if (picked == null) return;
    setState(() =>
        _files = picked.files.where((file) => file.path != null).toList());
  }

  Future<void> _submit() async {
    final docNumber = _documentNumberController.text.trim();
    final paths = _files
        .where((file) => file.path != null)
        .map((file) => file.path!)
        .toList();
    if (docNumber.isEmpty) {
      setState(() => _message = 'Please enter document number');
      return;
    }
    if (paths.isEmpty) {
      setState(() => _message = 'Please select at least one document file');
      return;
    }

    setState(() {
      _uploading = true;
      _message = null;
    });
    try {
      await UserService().uploadKyc(
        filePaths: paths,
        documentType: _documentType,
        documentNumber: docNumber,
      );
      ref.invalidate(meProvider);
      setState(() {
        _files = [];
        _documentNumberController.clear();
        _message = 'KYC submitted successfully. KhatuPay approval is pending.';
      });
    } catch (e) {
      setState(() => _message =
          friendlyErrorMessage(e, fallback: 'KYC could not be submitted.'));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _sendAadhaarOtp() async {
    setState(() {
      _sendingAadhaarOtp = true;
      _aadhaarMessage = null;
    });
    try {
      await _acceptVerificationConsent();
      final result = await LoanService().startAadhaarOvse();
      final txnId =
          (result['txnId'] ?? result['providerReference'] ?? '').toString();
      final requestUrl = (result['requestUrl'] ?? '').toString();
      if (txnId.isEmpty) {
        throw Exception('Verification session was not created.');
      }
      if (requestUrl.isEmpty) {
        throw Exception('Aadhaar verification link was not returned.');
      }
      if (!mounted) return;
      setState(() {
        _aadhaarOtpSessionId = txnId;
        _aadhaarMessage =
            'Complete face-auth verification in the official Aadhaar app, then return here.';
      });
      final opened = await launchUrl(Uri.parse(requestUrl),
          mode: LaunchMode.externalApplication);
      if (!opened) {
        throw Exception('Could not open the Aadhaar verification app.');
      }
    } catch (e) {
      setState(() => _aadhaarMessage = friendlyErrorMessage(e,
          fallback: 'Could not start Aadhaar verification.'));
    } finally {
      if (mounted) setState(() => _sendingAadhaarOtp = false);
    }
  }

  Future<void> _verifyAadhaarOtp() async {
    final txnId = (_aadhaarOtpSessionId ?? '').trim();
    if (txnId.isEmpty) {
      setState(() => _aadhaarMessage = 'Start Aadhaar verification first.');
      return;
    }
    setState(() {
      _verifyingAadhaarOtp = true;
      _aadhaarMessage = null;
    });
    try {
      final result = await LoanService().aadhaarOvseResult(txnId);
      final verified = result['status'] == 'VERIFIED';
      final data = result['summary'] is Map
          ? Map<String, dynamic>.from(result['summary'])
          : const <String, dynamic>{};
      final name = (data['name'] ?? '').toString();
      if (verified) ref.invalidate(meProvider);
      setState(() {
        _aadhaarMessage = verified
            ? (name.isEmpty
                ? 'Aadhaar verified successfully.'
                : 'Aadhaar verified for $name.')
            : 'Verification is still pending. Complete it in the Aadhaar app and check again.';
      });
    } catch (e) {
      setState(() => _aadhaarMessage =
          friendlyErrorMessage(e, fallback: 'Aadhaar could not be verified.'));
    } finally {
      if (mounted) setState(() => _verifyingAadhaarOtp = false);
    }
  }

  Future<void> _verifyPan() async {
    final pan = _panController.text.trim().toUpperCase();
    if (!RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]$').hasMatch(pan)) {
      setState(() => _panMessage = 'Enter valid PAN number');
      return;
    }
    setState(() {
      _verifyingPan = true;
      _panMessage = null;
    });
    try {
      final user = await ref.read(meProvider.future);
      if (user.name.trim().length < 2) {
        throw Exception(
            'Please add your full name in Profile before PAN verification.');
      }
      await _acceptVerificationConsent();
      final result = await LoanService()
          .verifyPanWithSignCare(pan: pan, name: user.name.trim());
      final panData = result['summary'] is Map
          ? Map<String, dynamic>.from(result['summary'])
          : const <String, dynamic>{};
      final name = (panData['name'] ?? '').toString();
      ref.invalidate(meProvider);
      setState(() {
        _panMessage = name.isEmpty
            ? 'PAN details verified successfully.'
            : 'PAN verified for $name.';
      });
    } catch (e) {
      setState(() => _panMessage =
          friendlyErrorMessage(e, fallback: 'PAN could not be verified.'));
    } finally {
      if (mounted) setState(() => _verifyingPan = false);
    }
  }

  Future<void> _captureAndVerifySelfie() async {
    setState(() {
      _capturingSelfie = true;
      _selfieMessage = null;
    });
    try {
      final picked = await _imagePicker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 82,
        maxWidth: 1400,
      );
      if (picked == null) return;
      await _acceptVerificationConsent();
      final encoded = base64Encode(await File(picked.path).readAsBytes());
      final liveness = await LoanService().verifyLiveness(encoded);
      if (liveness['status'] != 'VERIFIED') {
        throw Exception('Live face verification needs another clear photo.');
      }
      final faceMatch =
          await LoanService().verifyFaceMatch(selfieBase64: encoded);
      if (faceMatch['status'] != 'VERIFIED') {
        throw Exception('Selfie did not match the verified Aadhaar photo.');
      }
      if (!mounted) return;
      setState(() {
        _selfiePath = picked.path;
        _livenessVerified = true;
        _faceMatchVerified = true;
        _selfieMessage = 'Live selfie and Aadhaar face match verified.';
      });
    } catch (e) {
      if (mounted) {
        setState(() => _selfieMessage = friendlyErrorMessage(e,
            fallback:
                'Selfie verification failed. Use good lighting and try again.'));
      }
    } finally {
      if (mounted) setState(() => _capturingSelfie = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider);
    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('KYC Verification'),
        leading: const AppBackButton(),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(meProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: me.when(
        data: (user) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(meProvider);
            await ref.read(meProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              const OfferBannerCarousel(placement: 'KYC_BANNER', height: 150),
              const SizedBox(height: 14),
              _KycStatusCard(user: user),
              if (_message != null) ...[
                const SizedBox(height: 12),
                _MessageBanner(text: _message!),
              ],
              const SizedBox(height: 14),
              _AadhaarEkycCard(
                user: user,
                sending: _sendingAadhaarOtp,
                verifying: _verifyingAadhaarOtp,
                message: _aadhaarMessage,
                onSendOtp: _sendAadhaarOtp,
                onVerifyOtp: _verifyAadhaarOtp,
              ),
              const SizedBox(height: 14),
              _PanDetailsCard(
                user: user,
                panController: _panController,
                verifying: _verifyingPan,
                message: _panMessage,
                onVerify: _verifyPan,
              ),
              const SizedBox(height: 14),
              _SelfieVerificationCard(
                verified: _livenessVerified && _faceMatchVerified,
                capturing: _capturingSelfie,
                imagePath: _selfiePath,
                message: _selfieMessage,
                onCapture: _captureAndVerifySelfie,
              ),
              const SizedBox(height: 14),
              _UploadCard(
                documentType: _documentType,
                documentNumberController: _documentNumberController,
                files: _files,
                uploading: _uploading,
                onTypeChanged: (value) =>
                    setState(() => _documentType = value ?? 'BANK_STATEMENT'),
                onPick: _pickFiles,
                onSubmit: _submit,
              ),
              const SizedBox(height: 14),
              _SubmittedDocuments(user: user),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
                friendlyErrorMessage(e, fallback: 'Unable to load KYC.'),
                textAlign: TextAlign.center),
          ),
        ),
      ),
    );
  }
}

class _KycStatusCard extends StatelessWidget {
  final KPUser user;

  const _KycStatusCard({required this.user});

  @override
  Widget build(BuildContext context) {
    final kyc = user.kyc ?? {};
    final status = _status(kyc);
    final color = _statusColor(status);
    final kycNumber = (kyc['kycNumber'] ?? '').toString();
    final rejectionReason = (kyc['rejectionReason'] ?? '').toString();
    final aadhaarVerified = kyc['aadhaarVerified'] == true;
    final panVerified = kyc['panVerified'] == true;
    final submittedAt = (kyc['submittedAt'] ?? '').toString();
    final approvedAt = (kyc['approvedAt'] ?? '').toString();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: KhatuColors.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.035),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(18)),
                child: Icon(_statusIcon(status), color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('KhatuPay KYC',
                        style: TextStyle(
                            color: KhatuColors.text,
                            fontSize: 22,
                            fontWeight: FontWeight.w900)),
                    const SizedBox(height: 5),
                    _KycPill(label: _statusLabel(status), color: color),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _statusLine('Account', user.name.isEmpty ? user.mobile : user.name),
          _statusLine(
              'Mobile', user.mobile.isEmpty ? 'Not saved' : user.mobile),
          _statusLine('Aadhaar eKYC', aadhaarVerified ? 'Verified' : 'Pending'),
          _statusLine('PAN Details', panVerified ? 'Verified' : 'Pending'),
          _statusLine('Review Status', _reviewCopy(status)),
          if (submittedAt.isNotEmpty)
            _statusLine('Submitted', submittedAt.split('T').first),
          if (approvedAt.isNotEmpty)
            _statusLine('Approved', approvedAt.split('T').first),
          _statusLine('KYC Number',
              kycNumber.isEmpty ? 'Generated after approval' : kycNumber),
          if (rejectionReason.isNotEmpty)
            _statusLine('Correction note', rejectionReason),
        ],
      ),
    );
  }

  Widget _statusLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stacked = constraints.maxWidth < 340;
          final labelWidget = Text(label,
              style: const TextStyle(
                  color: KhatuColors.muted, fontWeight: FontWeight.w700));
          final valueWidget = Text(value,
              textAlign: stacked ? TextAlign.left : TextAlign.right,
              style: const TextStyle(
                  color: KhatuColors.text, fontWeight: FontWeight.w900));
          if (stacked) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [labelWidget, const SizedBox(height: 3), valueWidget],
            );
          }
          return Row(
            children: [
              Expanded(child: labelWidget),
              const SizedBox(width: 10),
              Expanded(child: valueWidget),
            ],
          );
        },
      ),
    );
  }

  String _reviewCopy(String status) {
    switch (status.toUpperCase()) {
      case 'APPROVED':
      case 'VERIFIED':
        return 'Approved by KhatuPay review team';
      case 'REJECTED':
        return 'Rejected, please resubmit';
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      case 'PENDING':
        return 'Pending review team approval';
      default:
        return 'Submit documents for review';
    }
  }
}

class _KycPill extends StatelessWidget {
  final String label;
  final Color color;

  const _KycPill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style:
            TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w900),
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  final String documentType;
  final TextEditingController documentNumberController;
  final List<PlatformFile> files;
  final bool uploading;
  final ValueChanged<String?> onTypeChanged;
  final VoidCallback onPick;
  final VoidCallback onSubmit;

  const _UploadCard({
    required this.documentType,
    required this.documentNumberController,
    required this.files,
    required this.uploading,
    required this.onTypeChanged,
    required this.onPick,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Submit Documents',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text(
                'Upload supporting documents only when required. PAN, Aadhaar and selfie are verified securely above.',
                style: TextStyle(
                    color: KhatuColors.muted, fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: documentType,
              decoration: const InputDecoration(
                  labelText: 'Document Type', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'VOTER_ID', child: Text('Voter ID')),
                DropdownMenuItem(
                    value: 'DRIVING_LICENSE', child: Text('Driving License')),
                DropdownMenuItem(value: 'PASSPORT', child: Text('Passport')),
                DropdownMenuItem(
                    value: 'BANK_STATEMENT', child: Text('Bank Statement')),
                DropdownMenuItem(value: 'OTHER', child: Text('Other')),
              ],
              onChanged: uploading ? null : onTypeChanged,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: documentNumberController,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                  labelText: 'Document Number',
                  hintText: 'Enter document number',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: uploading ? null : onPick,
              icon: const Icon(Icons.attach_file),
              label: Text(files.isEmpty
                  ? 'Select Documents'
                  : '${files.length} file selected'),
            ),
            if (files.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...files.map((file) => _FilePill(name: file.name)),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: uploading ? null : onSubmit,
                icon: const Icon(Icons.cloud_upload),
                label: Text(uploading
                    ? 'Submitting...'
                    : 'Submit for KhatuPay Approval'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AadhaarEkycCard extends StatelessWidget {
  final KPUser user;
  final bool sending;
  final bool verifying;
  final String? message;
  final VoidCallback onSendOtp;
  final VoidCallback onVerifyOtp;

  const _AadhaarEkycCard({
    required this.user,
    required this.sending,
    required this.verifying,
    required this.message,
    required this.onSendOtp,
    required this.onVerifyOtp,
  });

  @override
  Widget build(BuildContext context) {
    final kyc = user.kyc ?? {};
    final verified = kyc['aadhaarVerified'] == true;
    final aadhaarData = kyc['aadhaarData'] is Map
        ? Map<String, dynamic>.from(kyc['aadhaarData'])
        : const <String, dynamic>{};
    final name = (aadhaarData['fullName'] ??
            aadhaarData['name'] ??
            aadhaarData['residentName'] ??
            '')
        .toString();
    final masked = (aadhaarData['maskedAadhaar'] ?? '').toString();
    final address = _aadhaarAddress(aadhaarData);
    final color = verified ? Colors.green : KhatuColors.saffron;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(verified ? Icons.verified_user : Icons.fingerprint,
                    color: color),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('Aadhaar Offline eKYC',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                ),
                Chip(
                  label: Text(verified ? 'VERIFIED' : 'OVSE',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 11)),
                  backgroundColor: color,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (verified) ...[
              Text(
                  name.isEmpty
                      ? 'Aadhaar verified successfully.'
                      : 'Verified name: $name',
                  style: const TextStyle(
                      color: KhatuColors.text, fontWeight: FontWeight.w800)),
              if (masked.isNotEmpty)
                Text(masked, style: const TextStyle(color: KhatuColors.muted)),
              if (address.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('Address: $address',
                      style: const TextStyle(
                          color: KhatuColors.muted,
                          fontWeight: FontWeight.w700)),
                ),
            ] else ...[
              const Text(
                'Verify securely in the official Aadhaar app. Khatu Pay does not ask for or store your Aadhaar number.',
                style: TextStyle(
                    color: KhatuColors.muted, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: sending ? null : onSendOtp,
                      icon: sending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.open_in_new_rounded),
                      label:
                          Text(sending ? 'Starting...' : 'Start verification'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: verifying ? null : onVerifyOtp,
                  icon: verifying
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.verified_outlined),
                  label: const Text('Check verification status'),
                ),
              ),
            ],
            if (message != null && message!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(message!,
                  style: TextStyle(
                      color: message!.toLowerCase().contains('failed')
                          ? Colors.red
                          : color,
                      fontWeight: FontWeight.w800)),
            ],
          ],
        ),
      ),
    );
  }

  String _aadhaarAddress(Map<String, dynamic> data) {
    final raw = data['address'];
    if (raw is String && raw.trim().isNotEmpty) return raw.trim();
    final address =
        raw is Map ? Map<String, dynamic>.from(raw) : const <String, dynamic>{};
    String first(List<dynamic> values) {
      for (final value in values) {
        final text = (value ?? '').toString().trim();
        if (text.isNotEmpty && text != 'null') return text;
      }
      return '';
    }

    final parts = [
      first([address['careOf'], address['co'], data['careOf']]),
      first([address['house'], address['houseNo'], data['house']]),
      first([address['street'], address['landmark'], data['street']]),
      first([
        address['vtc'],
        address['village'],
        address['locality'],
        address['po'],
        data['locality']
      ]),
      first([address['dist'], address['district'], data['district']]),
      first([address['state'], data['state']]),
      first([address['pc'], address['pincode'], data['pincode']]),
    ].where((part) => part.isNotEmpty).toList();
    return first([data['fullAddress'], parts.join(', ')]);
  }
}

class _SelfieVerificationCard extends StatelessWidget {
  final bool verified;
  final bool capturing;
  final String imagePath;
  final String? message;
  final VoidCallback onCapture;

  const _SelfieVerificationCard({
    required this.verified,
    required this.capturing,
    required this.imagePath,
    required this.message,
    required this.onCapture,
  });

  @override
  Widget build(BuildContext context) {
    final color = verified ? Colors.green : KhatuColors.saffron;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(verified ? Icons.verified_user : Icons.camera_front_outlined,
                  color: color),
              const SizedBox(width: 10),
              const Expanded(
                child: Text('Live Selfie & Face Match',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              ),
              Chip(
                label: Text(verified ? 'VERIFIED' : 'REQUIRED',
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 11)),
                backgroundColor: color,
              ),
            ]),
            const SizedBox(height: 8),
            const Text(
              'Capture a live front-camera photo. It will be checked for liveness and matched with your verified Aadhaar photo.',
              style: TextStyle(
                  color: KhatuColors.muted, fontWeight: FontWeight.w700),
            ),
            if (imagePath.isNotEmpty) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(File(imagePath),
                    height: 120, width: 120, fit: BoxFit.cover),
              ),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: capturing ? null : onCapture,
                icon: capturing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.camera_alt_outlined),
                label: Text(capturing
                    ? 'Verifying...'
                    : verified
                        ? 'Capture & Reverify'
                        : 'Capture Live Selfie'),
              ),
            ),
            if (message != null && message!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(message!,
                  style: TextStyle(
                      color: verified ? Colors.green : Colors.red.shade700,
                      fontWeight: FontWeight.w800)),
            ],
          ],
        ),
      ),
    );
  }
}

class _PanDetailsCard extends StatelessWidget {
  final KPUser user;
  final TextEditingController panController;
  final bool verifying;
  final String? message;
  final VoidCallback onVerify;

  const _PanDetailsCard({
    required this.user,
    required this.panController,
    required this.verifying,
    required this.message,
    required this.onVerify,
  });

  @override
  Widget build(BuildContext context) {
    final kyc = user.kyc ?? {};
    final verified = kyc['panVerified'] == true;
    final panName =
        (kyc['panName'] ?? kyc['panData']?['name'] ?? '').toString();
    final panNumber = (kyc['panNumber'] ?? '').toString();
    final color = verified ? Colors.green : KhatuColors.saffron;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(verified ? Icons.verified : Icons.credit_card,
                    color: color),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('PAN Details',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                ),
                Chip(
                  label: Text(verified ? 'VERIFIED' : 'VERIFY',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 11)),
                  backgroundColor: color,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (verified) ...[
              Text(
                  panName.isEmpty
                      ? 'PAN verified successfully.'
                      : 'PAN name: $panName',
                  style: const TextStyle(
                      color: KhatuColors.text, fontWeight: FontWeight.w800)),
              if (panNumber.isNotEmpty)
                Text(panNumber,
                    style: const TextStyle(color: KhatuColors.muted)),
            ] else ...[
              const Text(
                'Verify PAN name before loan submission.',
                style: TextStyle(
                    color: KhatuColors.muted, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: panController,
                textCapitalization: TextCapitalization.characters,
                maxLength: 10,
                decoration: const InputDecoration(
                    labelText: 'PAN number',
                    counterText: '',
                    border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: verifying ? null : onVerify,
                  icon: verifying
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.fact_check_outlined),
                  label: const Text('Verify PAN Name'),
                ),
              ),
            ],
            if (message != null && message!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(message!,
                  style: TextStyle(
                      color: message!.toLowerCase().contains('failed')
                          ? Colors.red
                          : color,
                      fontWeight: FontWeight.w800)),
            ],
          ],
        ),
      ),
    );
  }
}

class _SubmittedDocuments extends StatelessWidget {
  final KPUser user;

  const _SubmittedDocuments({required this.user});

  @override
  Widget build(BuildContext context) {
    final docs = (user.kyc?['docs'] ?? user.kyc?['documents']);
    final list = docs is List ? docs : const [];
    if (list.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(18),
          child: Text('No KYC documents submitted yet.',
              style: TextStyle(
                  color: KhatuColors.muted, fontWeight: FontWeight.w800)),
        ),
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Submitted Documents',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            ...list.map(
                (doc) => _DocTile(doc: Map<String, dynamic>.from(doc as Map))),
          ],
        ),
      ),
    );
  }
}

class _DocTile extends StatelessWidget {
  final Map<String, dynamic> doc;

  const _DocTile({required this.doc});

  @override
  Widget build(BuildContext context) {
    final status = (doc['status'] ?? 'PENDING').toString().toUpperCase();
    final color = _statusColor(status);
    final notes = (doc['notes'] ?? '').toString();
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(_statusIcon(status), color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    (doc['documentType'] ?? doc['type'] ?? 'Document')
                        .toString(),
                    style: const TextStyle(fontWeight: FontWeight.w900)),
                Text(
                    (doc['documentNumber'] ?? doc['originalName'] ?? '')
                        .toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                if (notes.isNotEmpty)
                  Text(notes,
                      style: const TextStyle(
                          color: KhatuColors.muted, fontSize: 12)),
              ],
            ),
          ),
          Chip(
            label: Text(_statusLabel(status),
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w900)),
            backgroundColor: color,
          ),
        ],
      ),
    );
  }
}

class _FilePill extends StatelessWidget {
  final String name;

  const _FilePill({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KhatuColors.line),
      ),
      child: Row(
        children: [
          const Icon(Icons.description, color: KhatuColors.teal, size: 18),
          const SizedBox(width: 8),
          Expanded(
              child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}

class _MessageBanner extends StatelessWidget {
  final String text;

  const _MessageBanner({required this.text});

  @override
  Widget build(BuildContext context) {
    final success = text.toLowerCase().contains('success');
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: success ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: success ? Colors.green.shade200 : Colors.orange.shade200),
      ),
      child: Text(text,
          style: TextStyle(
              color: success ? Colors.green.shade900 : Colors.orange.shade900,
              fontWeight: FontWeight.w800)),
    );
  }
}

String _status(Map<String, dynamic> kyc) {
  final raw = (kyc['status'] ?? '').toString().toUpperCase();
  if (raw == 'SUBMITTED') return 'PENDING';
  return raw.isEmpty ? 'PENDING' : raw;
}

String _statusLabel(String status) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'VERIFIED':
      return 'APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'PENDING':
      return 'PENDING';
    default:
      return 'PENDING';
  }
}

Color _statusColor(String status) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'VERIFIED':
      return Colors.green;
    case 'REJECTED':
      return Colors.red;
    default:
      return KhatuColors.saffron;
  }
}

IconData _statusIcon(String status) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'VERIFIED':
      return Icons.verified_user;
    case 'REJECTED':
      return Icons.report_problem;
    default:
      return Icons.pending_actions;
  }
}
