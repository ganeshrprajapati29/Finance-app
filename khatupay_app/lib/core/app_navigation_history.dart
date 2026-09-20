import 'package:go_router/go_router.dart';

class AppNavigationHistory {
  AppNavigationHistory._();

  static final List<String> _locations = <String>[];
  static bool _navigatingBack = false;

  static void seed(String location) {
    final clean = _clean(location);
    if (clean == '/splash') return;
    if (_locations.isEmpty) _locations.add(clean);
  }

  static void record(String location) {
    final clean = _clean(location);
    if (_navigatingBack) {
      _navigatingBack = false;
      return;
    }
    if (clean == '/splash') return;
    if (_locations.isNotEmpty && _locations.last == clean) return;
    _locations.add(clean);
    if (_locations.length > 32) _locations.removeAt(0);
  }

  static String previous(String current, {String fallback = '/'}) {
    final cleanCurrent = _clean(current);
    while (_locations.isNotEmpty && _locations.last == cleanCurrent) {
      _locations.removeLast();
    }
    if (_locations.isEmpty) return fallback;
    _navigatingBack = true;
    return _locations.last;
  }

  static void prepareForNativePop(String current) {
    final cleanCurrent = _clean(current);
    while (_locations.isNotEmpty && _locations.last == cleanCurrent) {
      _locations.removeLast();
    }
    _navigatingBack = true;
  }

  static void goBack(GoRouter router, {String fallback = '/'}) {
    final current = router.routeInformationProvider.value.uri.toString();
    router.go(previous(current, fallback: fallback));
  }

  static String _clean(String location) {
    final text = location.trim();
    if (text.isEmpty) return '/';
    return text;
  }
}
