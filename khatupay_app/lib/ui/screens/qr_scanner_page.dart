import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:go_router/go_router.dart';
import '../../services/payment_service.dart';

class QRScannerPage extends StatefulWidget {
  const QRScannerPage({super.key});

  @override
  State<QRScannerPage> createState() => _QRScannerPageState();
}

class _QRScannerPageState extends State<QRScannerPage> {
  MobileScannerController controller = MobileScannerController();
  bool _hasPermission = false;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _requestCameraPermission();
  }

  Future<void> _requestCameraPermission() async {
    final status = await Permission.camera.request();
    setState(() {
      _hasPermission = status.isGranted;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasPermission) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('QR Scanner'),
          backgroundColor: Colors.lightBlue,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Camera permission is required to scan QR codes'),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _requestCameraPermission,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.lightBlue,
                ),
                child: const Text('Grant Permission'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan QR Code'),
        backgroundColor: Colors.lightBlue,
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_android),
            onPressed: () => controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: controller,
            onDetect: (capture) {
              final List<Barcode> barcodes = capture.barcodes;
              for (final barcode in barcodes) {
                if (barcode.rawValue != null && !_isProcessing) {
                  _handleScannedQR(barcode.rawValue!);
                  break;
                }
              }
            },
          ),
          if (_isProcessing)
            Container(
              color: Colors.black54,
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),
        ],
      ),
    );
  }

  void _handleScannedQR(String qrData) async {
    setState(() => _isProcessing = true);

    try {
      // Parse UPI QR code data
      final upiData = _parseUPIData(qrData);
      if (upiData != null && upiData['payeeVPA']!.isNotEmpty && upiData['amount']!.isNotEmpty) {
        // Show confirmation dialog
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Confirm Payment'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Payee: ${upiData['payeeName']}'),
                Text('VPA: ${upiData['payeeVPA']}'),
                Text('Amount: ₹${upiData['amount']}'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Pay Now'),
              ),
            ],
          ),
        );

        if (confirmed == true) {
          // Initiate P2P payment
          await _initiateP2PPayment(upiData);
        }
      } else {
        // Show error for invalid QR
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invalid QR code. Please scan a valid UPI QR code with amount.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error processing QR: $e')),
      );
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _initiateP2PPayment(Map<String, String> upiData) async {
    try {
      final ps = PaymentService();
      final amount = double.parse(upiData['amount']!);
      final data = await ps.createP2PPaymentOrder(
        amount,
        upiData['payeeVPA']!,
        upiData['payeeName'] ?? 'Unknown Payee',
        note: 'P2P Payment via QR Scan',
      );
      final order = data['order'];

      ps.newCheckout(
        amount: amount,
        orderId: order['id'],
        onSuccess: (oid, pid, sig) async {
          await ps.verifyRazorpay(oid, pid, sig);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('P2P Payment successful!')),
            );
            context.go('/'); // Go back to dashboard
          }
        },
        onFail: (m) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Payment failed: $m')),
            );
          }
        },
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error initiating payment: $e')),
      );
    }
  }

  Map<String, String>? _parseUPIData(String qrData) {
    // Basic UPI QR parsing - in real implementation, use a proper UPI parser
    if (qrData.contains('upi://pay')) {
      final uri = Uri.parse(qrData);
      return {
        'payeeVPA': uri.queryParameters['pa'] ?? '',
        'payeeName': uri.queryParameters['pn'] ?? '',
        'amount': uri.queryParameters['am'] ?? '',
        'merchantCode': uri.queryParameters['mc'] ?? '',
        'transactionRef': uri.queryParameters['tr'] ?? '',
      };
    }
    return null;
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }
}
