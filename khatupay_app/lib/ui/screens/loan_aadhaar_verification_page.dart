import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Hosts the provider's consent journey inside the app. No Aadhaar number or
/// OTP is entered into KhatuPay; it is handled only by the provider page.
class LoanAadhaarVerificationPage extends StatefulWidget {
  final String verificationUrl;

  /// App-bar title; DigiLocker consent and agreement eSign share this page.
  final String? title;

  const LoanAadhaarVerificationPage({
    super.key,
    required this.verificationUrl,
    this.title,
  });

  @override
  State<LoanAadhaarVerificationPage> createState() =>
      _LoanAadhaarVerificationPageState();
}

class _LoanAadhaarVerificationPageState
    extends State<LoanAadhaarVerificationPage> {
  late final WebViewController _controller;
  var _loading = true;
  var _canGoBack = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final verificationUri = Uri.tryParse(widget.verificationUrl.trim());
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (_) async {
            final canGoBack = await _controller.canGoBack();
            if (mounted) {
              setState(() {
                _loading = false;
                _canGoBack = canGoBack;
              });
            }
          },
          onWebResourceError: (error) {
            if ((error.isForMainFrame ?? false) && mounted) {
              setState(() {
                _loading = false;
                _error =
                    'The secure verification page could not be loaded. Please try again.';
              });
            }
          },
          onNavigationRequest: (request) {
            if (_isCompletionUrl(request.url)) {
              Navigator.of(context).pop(true);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      );

    if (verificationUri == null || !verificationUri.hasScheme) {
      _loading = false;
      _error =
          'The secure verification link is unavailable. Please start again.';
      return;
    }
    _controller.loadRequest(verificationUri);
  }

  bool _isCompletionUrl(String value) {
    final uri = Uri.tryParse(value);
    if (uri == null) return false;
    final status = (uri.queryParameters['status'] ?? '').toLowerCase();
    final host = uri.host.toLowerCase();
    return ((host == 'khatupay.com' || host == 'www.khatupay.com') &&
            uri.path.contains('loan-signing-complete')) ||
        // SignCare's own landing page when no redirectUrl was honoured.
        (host.endsWith('signcare.io') && uri.path.contains('digilocker-done')) ||
        {'success', 'completed', 'verified'}.contains(status);
  }

  Future<void> _closeAndRefresh() async {
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: _closeAndRefresh,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: Text((widget.title ?? '').trim().isEmpty
            ? 'Secure identity verification'
            : widget.title!.trim()),
        actions: [
          IconButton(
            tooltip: 'Reload',
            onPressed: _error == null ? () => _controller.reload() : null,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: const Color(0xFFEAF8F5),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 11),
            child: const Row(
              children: [
                Icon(Icons.verified_user_outlined, color: Color(0xFF0F766E)),
                SizedBox(width: 9),
                Expanded(
                  child: Text(
                    'Complete consent securely. KhatuPay never receives your Aadhaar number or OTP.',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: _error == null
                ? WebViewWidget(controller: _controller)
                : _ErrorState(onRetry: () {
                    setState(() => _error = null);
                    _controller.reload();
                  }),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  if (_canGoBack)
                    TextButton.icon(
                      onPressed: () async {
                        await _controller.goBack();
                        if (mounted) setState(() => _canGoBack = false);
                      },
                      icon: const Icon(Icons.arrow_back_rounded),
                      label: const Text('Previous'),
                    ),
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: _closeAndRefresh,
                    icon: const Icon(Icons.check_circle_outline_rounded),
                    label: const Text('I have completed verification'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;

  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.wifi_off_rounded,
                size: 42,
                color: Color(0xFF667085),
              ),
              const SizedBox(height: 12),
              const Text(
                'Unable to load secure verification',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
              ),
              const SizedBox(height: 8),
              const Text(
                'Check your connection and try again.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
}
