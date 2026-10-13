import 'package:url_launcher/url_launcher.dart';

class VerificationBrowser {
  const VerificationBrowser._();

  static Future<bool> open(String url) async {
    final uri = Uri.tryParse(url.trim());
    if (uri == null || !uri.hasScheme) return false;

    try {
      final openedInApp = await launchUrl(
        uri,
        mode: LaunchMode.inAppBrowserView,
        webViewConfiguration: const WebViewConfiguration(
          enableJavaScript: true,
          enableDomStorage: true,
        ),
      );
      if (openedInApp) return true;
    } catch (_) {
      // Some desktop/web targets do not support the in-app browser view.
    }

    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
