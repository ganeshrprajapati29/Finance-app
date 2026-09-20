import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/app_theme.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/kp_widgets.dart';

class MerchantQrPage extends ConsumerStatefulWidget { const MerchantQrPage({super.key}); @override ConsumerState<MerchantQrPage> createState() => _State(); }
class _State extends ConsumerState<MerchantQrPage> {
  Map<String,dynamic>? qr; bool busy = false; String? error;
  Future<void> generate() async { setState(() { busy = true; error = null; }); try { qr = await MerchantBusinessService().createQr(); setState(() {}); } catch (e) { setState(() => error = e.toString()); } finally { setState(() => busy = false); } }
  @override Widget build(BuildContext context) { final profile = ref.watch(merchantDashboardProvider); final existing = profile.valueOrNull?.qr; final data = qr ?? existing; final payload = (data?['payload'] ?? '').toString(); return KpAppShell(title: 'My Business QR', children: [
    if (error != null) KpErrorBanner(message: error!), KpCard(child: Column(children: [const Text('KHATU PAY BUSINESS', style: TextStyle(color: KhatuColors.teal, fontWeight: FontWeight.w900)), const SizedBox(height: 12), if (payload.isNotEmpty) QrImageView(data: payload, size: 240, eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: KhatuColors.ink), dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: KhatuColors.deepTeal)) else Image.asset('assets/business/business_payments.png', height: 220), const SizedBox(height: 12), Text(profile.valueOrNull?.business?.businessName ?? 'Your business', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text(profile.valueOrNull?.business?.publicId ?? '', style: const TextStyle(color: KhatuColors.muted)), const SizedBox(height: 16), SizedBox(width: double.infinity, child: ElevatedButton.icon(onPressed: busy ? null : payload.isEmpty ? generate : () => Share.share('Pay ${profile.valueOrNull?.business?.businessName ?? 'this business'} securely: $payload'), icon: Icon(payload.isEmpty ? Icons.qr_code_2 : Icons.share_outlined), label: Text(payload.isEmpty ? 'Generate business QR' : 'Share payment QR')))])),
    const KpNoticeBanner(icon: Icons.info_outline, color: KhatuColors.info, title: 'How collections work', message: 'This QR identifies your approved Khatu Pay business. A customer payment is confirmed by the payment provider before it appears in your balance. Bank settlement is tracked separately.'),
  ]); }
}
