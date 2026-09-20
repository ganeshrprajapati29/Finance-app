import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

class KhatuPayQrCard extends StatelessWidget {
  final String? imageUrl;
  final String? qrData;
  final String merchantName;
  final String? displayLabel;
  final String? amount;
  final String upi;
  final String note;
  final double width;

  const KhatuPayQrCard({
    super.key,
    required this.imageUrl,
    this.qrData,
    required this.merchantName,
    this.displayLabel,
    required this.upi,
    this.amount,
    this.note = 'Secure payment powered by KhatuPay',
    this.width = 330,
  });

  @override
  Widget build(BuildContext context) {
    final hasAmount = amount != null && amount!.trim().isNotEmpty;
    final label = (displayLabel != null && displayLabel!.trim().isNotEmpty)
        ? displayLabel!.trim()
        : upi;
    final effectiveQrData = (qrData != null && qrData!.trim().isNotEmpty)
        ? qrData!.trim()
        : 'upi://pay?pa=${Uri.encodeComponent(upi)}&pn=${Uri.encodeComponent(merchantName.isEmpty ? 'KhatuPay' : merchantName)}${hasAmount ? '&am=${Uri.encodeComponent(amount!.trim())}' : ''}&cu=INR';

    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: width),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: const Color(0xFFD7EEEA)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F766E).withOpacity(0.16),
                blurRadius: 34,
                offset: const Offset(0, 16),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 54),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF053C3B), Color(0xFF0F766E), Color(0xFF14B8A6)],
                  ),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.16),
                            blurRadius: 22,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Image.asset('assets/khatulogo-removebg-preview.png'),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'KhatuPay',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      merchantName.isEmpty ? 'Scan and Pay' : merchantName,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFD7FFFB),
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -34),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 0, 22, 0),
                  child: Column(
                    children: [
                      Container(
                        width: 266,
                        height: 266,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: const Color(0xFFD7EEEA)),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF0F766E).withOpacity(0.14),
                              blurRadius: 28,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Positioned.fill(
                              child: imageUrl == null || imageUrl!.isEmpty
                                  ? _GeneratedQr(data: effectiveQrData)
                                  : Image.network(
                                      imageUrl!,
                                      fit: BoxFit.contain,
                                      errorBuilder: (_, __, ___) => _GeneratedQr(data: effectiveQrData),
                                    ),
                            ),
                            Container(
                              width: 48,
                              height: 48,
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFE5E7EB)),
                              ),
                              child: Image.asset('assets/khatulogo-removebg-preview.png'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        hasAmount ? 'Rs. ${amount!.trim()}' : 'Open Amount',
                        style: const TextStyle(
                          color: Color(0xFF053C3B),
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'SCAN FROM ANY UPI APP',
                          style: TextStyle(
                            color: Color(0xFF047857),
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FFFE),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFF99C9C4)),
                        ),
                        child: Text(
                          label.isEmpty ? 'Mobile number not set' : label,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Color(0xFF334155),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        note,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GeneratedQr extends StatelessWidget {
  final String data;

  const _GeneratedQr({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.trim().isEmpty || data == 'upi://pay?pa=&pn=KhatuPay&cu=INR') {
      return const Icon(Icons.qr_code_2, size: 190, color: Color(0xFF0F766E));
    }
    return QrImageView(
      data: data,
      version: QrVersions.auto,
      errorCorrectionLevel: QrErrorCorrectLevel.H,
      backgroundColor: Colors.white,
      padding: const EdgeInsets.all(4),
    );
  }
}
