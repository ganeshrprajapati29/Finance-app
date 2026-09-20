import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../ui/widgets/app_back_button.dart';
import '../providers/clubapi_providers.dart';

class ClubAPIOutletPage extends ConsumerStatefulWidget {
  const ClubAPIOutletPage({super.key});

  @override
  ConsumerState<ClubAPIOutletPage> createState() => _ClubAPIOutletPageState();
}

class _ClubAPIOutletPageState extends ConsumerState<ClubAPIOutletPage> {
  final _formKey = GlobalKey<FormState>();
  final _outletMobileC = TextEditingController();
  final _nameC = TextEditingController();
  final _aadhaarC = TextEditingController();
  final _panC = TextEditingController();
  final _shopNameC = TextEditingController();
  final _shopAddressC = TextEditingController();
  final _cityC = TextEditingController();
  final _stateC = TextEditingController();
  final _pincodeC = TextEditingController();
  final _bankAccountC = TextEditingController();
  final _ifscC = TextEditingController();
  final _latitudeC = TextEditingController();
  final _longitudeC = TextEditingController();
  final _emailC = TextEditingController();
  final _otpC = TextEditingController();
  final _otpSessionC = TextEditingController();

  bool _sendingOtp = false;
  bool _verifyingOtp = false;
  bool _checkingStatus = false;
  Map<String, dynamic>? _lastResponse;

  @override
  void dispose() {
    for (final controller in [
      _outletMobileC,
      _nameC,
      _aadhaarC,
      _panC,
      _shopNameC,
      _shopAddressC,
      _cityC,
      _stateC,
      _pincodeC,
      _bankAccountC,
      _ifscC,
      _latitudeC,
      _longitudeC,
      _emailC,
      _otpC,
      _otpSessionC,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _registerOutlet() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _sendingOtp = true;
      _lastResponse = null;
    });
    try {
      final service = ref.read(clubAPIServiceProvider);
      final result = await service.registerOutlet(
        outletMobile: _outletMobileC.text.trim(),
        aadhaarNumber: _aadhaarC.text.trim(),
        pan: _panC.text.trim(),
        name: _nameC.text.trim(),
        shopName: _shopNameC.text.trim(),
        shopAddress: _shopAddressC.text.trim(),
        pincode: _pincodeC.text.trim(),
        state: _stateC.text.trim(),
        city: _cityC.text.trim(),
        bankAccountNumber: _bankAccountC.text.trim(),
        bankIfscCode: _ifscC.text.trim(),
        latitude: _latitudeC.text.trim(),
        longitude: _longitudeC.text.trim(),
        email: _emailC.text.trim(),
      );
      _otpSessionC.text = _readString(result, const ['otpSessionId', 'sessionId', 'requestId', 'urid']);
      _show('Outlet OTP request sent');
      setState(() => _lastResponse = result);
    } catch (e) {
      _show(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _sendingOtp = false);
    }
  }

  Future<void> _verifyOtp() async {
    if (_outletMobileC.text.trim().length != 10 || _otpC.text.trim().length < 4) {
      _show('Enter outlet mobile and OTP', isError: true);
      return;
    }
    setState(() {
      _verifyingOtp = true;
      _lastResponse = null;
    });
    try {
      final service = ref.read(clubAPIServiceProvider);
      final result = await service.verifyOutletOtp(
        outletMobile: _outletMobileC.text.trim(),
        otp: _otpC.text.trim(),
        aadhaarNumber: _aadhaarC.text.trim(),
        otpSessionId: _otpSessionC.text.trim(),
        latitude: _latitudeC.text.trim(),
        longitude: _longitudeC.text.trim(),
      );
      _show('Outlet OTP verified');
      setState(() => _lastResponse = result);
    } catch (e) {
      _show(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _verifyingOtp = false);
    }
  }

  Future<void> _checkStatus() async {
    if (_outletMobileC.text.trim().length != 10) {
      _show('Enter outlet mobile number', isError: true);
      return;
    }
    setState(() {
      _checkingStatus = true;
      _lastResponse = null;
    });
    try {
      final result = await ref.read(clubAPIServiceProvider).getOutletStatus(_outletMobileC.text.trim());
      setState(() => _lastResponse = result);
    } catch (e) {
      _show(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _checkingStatus = false);
    }
  }

  String _readString(Map<String, dynamic> data, List<String> keys) {
    for (final key in keys) {
      final value = data[key] ?? (data['data'] is Map ? data['data'][key] : null);
      if (value != null && value.toString().isNotEmpty) return value.toString();
    }
    return '';
  }

  void _show(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: isError ? Colors.red : Colors.green),
    );
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Outlet Setup'),
        leading: const AppBackButton(fallbackRoute: '/clubapi/dashboard'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _section(
              title: 'Outlet KYC',
              children: [
                _field(_outletMobileC, 'Outlet Mobile', Icons.phone, number: true, maxLength: 10),
                _field(_nameC, 'Owner Name', Icons.person),
                _field(_aadhaarC, 'Aadhaar Number', Icons.badge, number: true, maxLength: 12),
                _field(_panC, 'PAN Number', Icons.credit_card),
                _field(_emailC, 'Email', Icons.email, requiredField: false),
              ],
            ),
            _section(
              title: 'Shop Details',
              children: [
                _field(_shopNameC, 'Shop Name', Icons.store),
                _field(_shopAddressC, 'Shop Address', Icons.location_on, lines: 2),
                Row(
                  children: [
                    Expanded(child: _field(_cityC, 'City', Icons.location_city)),
                    const SizedBox(width: 12),
                    Expanded(child: _field(_stateC, 'State', Icons.map)),
                  ],
                ),
                _field(_pincodeC, 'Pincode', Icons.pin_drop, number: true, maxLength: 6),
              ],
            ),
            _section(
              title: 'Bank & Location',
              children: [
                _field(_bankAccountC, 'Bank Account Number', Icons.account_balance, number: true),
                _field(_ifscC, 'IFSC Code', Icons.confirmation_number),
                Row(
                  children: [
                    Expanded(child: _field(_latitudeC, 'Latitude', Icons.my_location)),
                    const SizedBox(width: 12),
                    Expanded(child: _field(_longitudeC, 'Longitude', Icons.explore)),
                  ],
                ),
              ],
            ),
            FilledButton.icon(
              onPressed: _sendingOtp ? null : _registerOutlet,
              icon: _sendingOtp ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.sms),
              label: Text(_sendingOtp ? 'Sending OTP...' : 'Send Outlet OTP'),
            ),
            const SizedBox(height: 12),
            _section(
              title: 'Verify & Status',
              children: [
                _field(_otpC, 'OTP', Icons.password, number: true, requiredField: false),
                _field(_otpSessionC, 'OTP Session ID', Icons.key, requiredField: false),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _verifyingOtp ? null : _verifyOtp,
                        icon: const Icon(Icons.verified_user),
                        label: Text(_verifyingOtp ? 'Verifying...' : 'Verify OTP'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _checkingStatus ? null : _checkStatus,
                        icon: const Icon(Icons.info_outline),
                        label: Text(_checkingStatus ? 'Checking...' : 'Status'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            if (_lastResponse != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(_lastResponse.toString()),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _section({required String title, required List<Widget> children}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    IconData icon, {
    bool number = false,
    bool requiredField = true,
    int? maxLength,
    int lines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: number ? TextInputType.number : TextInputType.text,
        maxLength: maxLength,
        maxLines: lines,
        textCapitalization: label.contains('PAN') || label.contains('IFSC') ? TextCapitalization.characters : TextCapitalization.words,
        validator: requiredField ? _required : null,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon),
          border: const OutlineInputBorder(),
          counterText: '',
        ),
      ),
    );
  }
}
