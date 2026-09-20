import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../routes/app_router.dart';
import '../../services/payment_service.dart';
import '../widgets/app_back_button.dart';

class QRScannerPage extends StatefulWidget {
  const QRScannerPage({super.key});

  @override
  State<QRScannerPage> createState() => _QRScannerPageState();
}

class _QRScannerPageState extends State<QRScannerPage> {
  final MobileScannerController _controller = MobileScannerController();
  bool _hasPermission = false;
  bool _processing = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _requestPermission();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _requestPermission() async {
    final status = await Permission.camera.request();
    if (mounted) setState(() => _hasPermission = status.isGranted);
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final value = capture.barcodes
        .map((barcode) => barcode.rawValue)
        .whereType<String>()
        .where((raw) => raw.trim().isNotEmpty)
        .firstOrNull;
    if (value == null) return;
    await _handleScan(value);
  }

  Future<void> _handleScan(String raw) async {
    setState(() {
      _processing = true;
      _message = null;
    });

    try {
      await _controller.stop();
      final upi = UpiQrPayload.parse(raw);
      if (upi == null || upi.vpa.isEmpty) {
        setState(() => _message = 'This QR is not a valid UPI payment QR.');
        return;
      }

      final confirmedPayload = await showModalBottomSheet<UpiQrPayload>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _PaymentSheet(payload: upi),
      );

      if (confirmedPayload != null) {
        await _pay(confirmedPayload);
      }
    } catch (e) {
      if (mounted) setState(() => _message = 'QR processing failed: $e');
    } finally {
      if (mounted) {
        setState(() => _processing = false);
        await _controller.start();
      }
    }
  }

  Future<void> _pay(UpiQrPayload payload) async {
    try {
      setState(() => _message = 'Opening secure payment gateway...');
      final ps = PaymentService();
      final data = await ps.createP2PPaymentOrder(
        payload.amount!,
        payload.vpa,
        payload.name.isEmpty ? 'UPI Payee' : payload.name,
        note: payload.note.isEmpty ? 'QR payment' : payload.note,
      );
      await ps.openGatewayCheckout(data);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment started. Check history for final status.')),
      );
      router.go('/payments');
    } catch (e) {
      if (mounted) setState(() => _message = 'Payment gateway error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasPermission) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Scan & Pay'),
          leading: const AppBackButton(),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.camera_alt_outlined, size: 58, color: Color(0xFF0F766E)),
                const SizedBox(height: 12),
                const Text('Camera permission is required to scan payment QR codes.', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(onPressed: _requestPermission, child: const Text('Grant Permission')),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan & Pay'),
        leading: const AppBackButton(),
        actions: [
          IconButton(icon: const Icon(Icons.flash_on), onPressed: () => _controller.toggleTorch()),
          IconButton(icon: const Icon(Icons.cameraswitch), onPressed: () => _controller.switchCamera()),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          _ScannerOverlay(message: _message),
          if (_processing)
            Container(
              color: Colors.black45,
              child: const Center(child: CircularProgressIndicator(color: Colors.white)),
            ),
        ],
      ),
    );
  }
}

class UpiQrPayload {
  final String raw;
  final String vpa;
  final String name;
  final String note;
  final String reference;
  final double? amount;

  const UpiQrPayload({
    required this.raw,
    required this.vpa,
    required this.name,
    required this.note,
    required this.reference,
    required this.amount,
  });

  UpiQrPayload copyWith({double? amount}) {
    return UpiQrPayload(
      raw: raw,
      vpa: vpa,
      name: name,
      note: note,
      reference: reference,
      amount: amount ?? this.amount,
    );
  }

  static UpiQrPayload? parse(String raw) {
    final trimmed = raw.trim();
    if (!trimmed.toLowerCase().startsWith('upi://pay')) return null;

    final uri = Uri.tryParse(trimmed);
    if (uri == null) return null;
    final params = uri.queryParameters;
    final amount = double.tryParse(params['am'] ?? '');
    return UpiQrPayload(
      raw: raw,
      vpa: params['pa'] ?? '',
      name: Uri.decodeComponent(params['pn'] ?? ''),
      note: Uri.decodeComponent(params['tn'] ?? params['cu'] ?? ''),
      reference: params['tr'] ?? '',
      amount: amount,
    );
  }
}

class _PaymentSheet extends StatefulWidget {
  final UpiQrPayload payload;

  const _PaymentSheet({required this.payload});

  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  late final TextEditingController _amountController = TextEditingController(
    text: widget.payload.amount?.toStringAsFixed(0) ?? '',
  );

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.56,
      minChildSize: 0.42,
      maxChildSize: 0.82,
      builder: (context, scrollController) {
        return Container(
          padding: EdgeInsets.only(
            left: 18,
            right: 18,
            top: 18,
            bottom: 18 + MediaQuery.of(context).viewInsets.bottom,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: ListView(
            controller: scrollController,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(999)),
                ),
              ),
              const SizedBox(height: 18),
              const Text('Confirm QR Payment', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0B1220))),
              const SizedBox(height: 6),
              const Text('Payment will be processed through the secure third-party gateway.', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
              const SizedBox(height: 18),
              _DetailRow(label: 'Payee', value: widget.payload.name.isEmpty ? 'UPI Payee' : widget.payload.name),
              _DetailRow(label: 'UPI ID', value: widget.payload.vpa),
              if (widget.payload.reference.isNotEmpty) _DetailRow(label: 'Reference', value: widget.payload.reference),
              if (widget.payload.note.isNotEmpty) _DetailRow(label: 'Note', value: widget.payload.note),
              const SizedBox(height: 14),
              TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Amount',
                  prefixText: 'Rs. ',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        final amount = double.tryParse(_amountController.text.trim());
                        if (amount == null || amount <= 0) return;
                        Navigator.pop(context, widget.payload.copyWith(amount: amount));
                      },
                      child: const Text('Pay Now'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ScannerOverlay extends StatelessWidget {
  final String? message;

  const _ScannerOverlay({this.message});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Column(
        children: [
          const Spacer(),
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: const Color(0xFF5EEAD4), width: 4),
              ),
            ),
          ),
          const SizedBox(height: 22),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 22),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.62),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              message ?? 'Scan any UPI QR to pay through gateway',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
            ),
          ),
          const Spacer(),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 92, child: Text(label, style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700))),
          Expanded(child: Text(value, style: const TextStyle(color: Color(0xFF0B1220), fontWeight: FontWeight.w800))),
        ],
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
