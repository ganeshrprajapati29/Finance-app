import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../models/user.dart';
import '../../routes/app_router.dart';
import '../../services/qr_service.dart';
import '../../services/user_service.dart';
import '../widgets/khatupay_qr_card.dart';
import '../widgets/kp_widgets.dart';
import '../widgets/offer_banner_carousel.dart';
import 'dashboard_page.dart' show KhatuBottomNav;

/// "My QR" - the merchant-facing side of the app.
///
/// The QR card itself is captured with a [RepaintBoundary] so Download/Share
/// export exactly what the user sees, including Khatu branding. Feedback is
/// split into a success banner and an error banner rather than one ambiguous
/// message strip, so a failed share never reads like a success.
class QRPage extends StatefulWidget {
  const QRPage({super.key});

  @override
  State<QRPage> createState() => _QRPageState();
}

class _QRPageState extends State<QRPage> {
  final _qrCardKey = GlobalKey();
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String? _notice;
  Map<String, dynamic>? _qr;
  KPUser? _user;

  @override
  void initState() {
    super.initState();
    _loadQr();
  }

  Future<void> _loadQr() async {
    setState(() {
      _loading = true;
      _error = null;
      _notice = null;
    });

    try {
      final results = await Future.wait<dynamic>([
        QRService().getMyQr(),
        UserService().me(),
      ]);
      if (!mounted) return;
      setState(() {
        _qr = Map<String, dynamic>.from(results[0] as Map);
        _user = results[1] as KPUser;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() =>
          _error = friendlyErrorMessage(e, fallback: 'Unable to load your QR.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic> get _payload =>
      Map<String, dynamic>.from(_qr?['payload'] ?? {});

  String get _upi {
    final savedUpi = (_user?.upiId ?? '').trim();
    if (savedUpi.isNotEmpty) return savedUpi;
    final providerUpi =
        (_payload['pa'] ?? _payload['receiverVpa'] ?? '').toString().trim();
    return _isKhatuAlias(providerUpi) ? '' : providerUpi;
  }

  String get _name => (_payload['displayName'] ??
          _payload['pn'] ??
          (_mobileLabel.isEmpty ? null : _mobileLabel) ??
          'KhatuPay User')
      .toString();

  String get _mobileLabel => (_user?.mobile ??
          _payload['displayNumber'] ??
          _payload['registeredMobile'] ??
          '')
      .toString();

  String get _note =>
      (_payload['note'] ?? _payload['tn'] ?? 'KhatuPay payment').toString();

  String get _qrUri {
    final existing =
        (_qr?['uri'] ?? _payload['uri'] ?? _payload['qrString'])?.toString();
    if (_upi.isEmpty) return '';
    if (existing != null &&
        existing.startsWith('upi://') &&
        !_containsKhatuAlias(existing)) {
      return existing;
    }
    return QRService().buildUpiUri(
      vpa: _upi,
      name: _name,
      note: _note,
      transactionRef:
          (_qr?['id'] ?? _qr?['_id'] ?? _payload['qrId'])?.toString(),
    );
  }

  bool _isKhatuAlias(String value) =>
      RegExp(r'@khatu-?pay|@khatupay', caseSensitive: false).hasMatch(value);

  bool _containsKhatuAlias(String value) {
    final uri = Uri.tryParse(value);
    final pa = uri?.queryParameters['pa'] ?? value;
    return _isKhatuAlias(pa);
  }

  Future<File> _writeBrandedQrCardFile() async {
    // Let the boundary settle for a frame before capturing, otherwise the
    // first export can come out blank on slower devices.
    await Future.delayed(const Duration(milliseconds: 120));
    final boundary =
        _qrCardKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) throw 'QR card is not ready yet';
    final image = await boundary.toImage(pixelRatio: 3);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) throw 'Unable to create the QR image';
    final dir = await getApplicationDocumentsDirectory();
    final file = File(
        '${dir.path}/khatupay-qr-${DateTime.now().millisecondsSinceEpoch}.png');
    return file.writeAsBytes(bytes.buffer.asUint8List());
  }

  Future<void> _downloadQr() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      final file = await _writeBrandedQrCardFile();
      await OpenFile.open(file.path);
      if (mounted) setState(() => _notice = 'QR saved to your device.');
    } catch (e) {
      if (mounted) {
        setState(() => _error =
            friendlyErrorMessage(e, fallback: 'Unable to download the QR.'));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _shareQr() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      final file = await _writeBrandedQrCardFile();
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'image/png', name: 'khatupay-qr.png')],
        text: 'Pay $_name on Khatu Pay\n'
            '${_mobileLabel.isEmpty ? '' : 'Mobile: $_mobileLabel\n'}'
            'UPI: $_upi',
      );
    } catch (e) {
      if (mounted) {
        setState(() => _error =
            friendlyErrorMessage(e, fallback: 'Unable to share the QR.'));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _orderSticker() {
    final id = (_qr?['_id'] ?? _qr?['id'])?.toString();
    router.go(
        '/qr-sticker-order${id == null ? '' : '?qrId=${Uri.encodeComponent(id)}'}');
  }

  Future<void> _copyUpi() async {
    if (_upi.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: _upi));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('UPI ID copied')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasQr = _qr != null && _upi.isNotEmpty;

    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('My QR'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: 'Scan any QR',
            onPressed: () => router.go('/qr-scan'),
            icon: const Icon(Icons.qr_code_scanner_rounded),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _loadQr,
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      bottomNavigationBar: const KhatuBottomNav(currentIndex: 2),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: RefreshIndicator(
              color: KhatuColors.teal,
              onRefresh: _loadQr,
              child: ListView(
                padding: KhatuSpace.pageScroll,
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  const _QrHero(),
                  KhatuSpace.gapLg,
                  if (_error != null) ...[
                    KpErrorBanner(message: _error!, onRetry: _loadQr),
                    KhatuSpace.gapMd,
                  ],
                  if (_notice != null) ...[
                    KpNoticeBanner(
                      icon: Icons.check_circle_outline_rounded,
                      color: KhatuColors.success,
                      message: _notice!,
                    ),
                    KhatuSpace.gapMd,
                  ],
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 72),
                      child: Center(
                        child:
                            CircularProgressIndicator(color: KhatuColors.teal),
                      ),
                    )
                  else if (!hasQr)
                    KpEmptyState(
                      icon: Icons.qr_code_2_rounded,
                      illustration: KpIllustrations.merchantQr,
                      title: 'QR is not ready yet',
                      message: _qr == null
                          ? 'Pull down to refresh. Khatu Pay creates this QR automatically for your account.'
                          : 'Add your PhonePe, Paytm or Google Pay UPI ID in Settings. That UPI ID will then power your QR.',
                      actionLabel: 'Open settings',
                      onAction: () => router.go('/settings'),
                    )
                  else ...[
                    RepaintBoundary(
                      key: _qrCardKey,
                      child: KhatuPayQrCard(
                        imageUrl: null,
                        qrData: _qrUri,
                        merchantName: _name,
                        displayLabel: _upi,
                        amount: null,
                        upi: _upi,
                        note: _note,
                      ),
                    ),
                    KhatuSpace.gapLg,
                    _QrActions(
                      busy: _busy,
                      onDownload: _downloadQr,
                      onShare: _shareQr,
                      onOrderSticker: _orderSticker,
                    ),
                    KhatuSpace.gapLg,
                    _QrDetails(
                      upi: _upi,
                      mobile: _mobileLabel,
                      merchantName: _name,
                      routingMode: (_payload['routingMode'] ?? '').toString(),
                      onCopyUpi: _copyUpi,
                    ),
                    KhatuSpace.gapLg,
                    const KpNoticeBanner(
                      icon: Icons.shield_outlined,
                      color: KhatuColors.deepTeal,
                      title: 'Safe to display',
                      message:
                          'This QR only lets people pay you. It can never be used to take money out of your account. Khatu Pay never asks for your UPI PIN to receive money.',
                    ),
                  ],
                  KhatuSpace.gapLg,
                  const OfferBannerCarousel(
                      placement: 'QR_UPI_BANNER', height: 140),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _QrHero extends StatelessWidget {
  const _QrHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.lg),
      decoration: BoxDecoration(
        gradient: KhatuColors.brandGradient,
        borderRadius: BorderRadius.circular(KhatuRadius.lg),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(KhatuRadius.md),
            ),
            child: Image.asset(
              'assets/khatulogo-removebg-preview.png',
              errorBuilder: (_, __, ___) => const Icon(
                Icons.qr_code_2_rounded,
                color: KhatuColors.deepTeal,
              ),
            ),
          ),
          KhatuSpace.wMd,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Accept payments instantly',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Show this QR to any customer. Works with every UPI app in India.',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
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

class _QrActions extends StatelessWidget {
  const _QrActions({
    required this.busy,
    required this.onDownload,
    required this.onShare,
    required this.onOrderSticker,
  });

  final bool busy;
  final VoidCallback onDownload;
  final VoidCallback onShare;
  final VoidCallback onOrderSticker;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: busy ? null : onDownload,
                icon: busy
                    ? const SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.download_rounded, size: 18),
                label: const Text('Download'),
              ),
            ),
            KhatuSpace.wMd,
            Expanded(
              child: OutlinedButton.icon(
                onPressed: busy ? null : onShare,
                icon: const Icon(Icons.ios_share_rounded, size: 18),
                label: const Text('Share'),
              ),
            ),
          ],
        ),
        KhatuSpace.gapMd,
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: onOrderSticker,
            icon: const Icon(Icons.sticky_note_2_outlined, size: 18),
            label: const Text('Order printed QR sticker'),
          ),
        ),
      ],
    );
  }
}

class _QrDetails extends StatelessWidget {
  const _QrDetails({
    required this.upi,
    required this.mobile,
    required this.merchantName,
    required this.routingMode,
    required this.onCopyUpi,
  });

  final String upi;
  final String mobile;
  final String merchantName;
  final String routingMode;
  final VoidCallback onCopyUpi;

  @override
  Widget build(BuildContext context) {
    return KpCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(
                KhatuSpace.lg, KhatuSpace.lg, KhatuSpace.lg, KhatuSpace.sm),
            child: Text('Payment details', style: KhatuText.h3),
          ),
          _row('Merchant name', merchantName),
          if (mobile.isNotEmpty) _row('Registered mobile', mobile),
          _row('UPI ID', upi, onCopy: onCopyUpi),
          if (routingMode.trim().isNotEmpty)
            _row('Routing', KpStatusBadge.prettify(routingMode)),
          const SizedBox(height: KhatuSpace.sm),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {VoidCallback? onCopy}) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: KhatuSpace.lg, vertical: KhatuSpace.sm),
      child: Row(
        children: [
          Expanded(flex: 4, child: Text(label, style: KhatuText.label)),
          Expanded(
            flex: 6,
            child: Text(
              value.trim().isEmpty ? '--' : value,
              textAlign: TextAlign.right,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: KhatuColors.text,
                fontWeight: FontWeight.w800,
                fontSize: 13.5,
              ),
            ),
          ),
          if (onCopy != null)
            IconButton(
              tooltip: 'Copy',
              onPressed: onCopy,
              visualDensity: VisualDensity.compact,
              constraints: const BoxConstraints(),
              padding: const EdgeInsets.only(left: 8),
              icon: const Icon(Icons.copy_rounded,
                  size: 15, color: KhatuColors.deepTeal),
            ),
        ],
      ),
    );
  }
}
