// Renders real screens to PNG files so the UI can be reviewed without a device:
//   flutter test test/visual --update-goldens
// Output: test/visual/out/<name>.png
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khatupay_app/core/app_theme.dart';

const _fontDir = r'C:\flutter\bin\cache\artifacts\material_fonts';

Future<void> loadAppFonts() async {
  Future<ByteData> read(String name) async =>
      ByteData.view(File('$_fontDir\\$name').readAsBytesSync().buffer);
  final roboto = FontLoader('Roboto')
    ..addFont(read('roboto-regular.ttf'))
    ..addFont(read('roboto-medium.ttf'))
    ..addFont(read('roboto-bold.ttf'))
    ..addFont(read('roboto-black.ttf'));
  await roboto.load();
  final icons = FontLoader('MaterialIcons')
    ..addFont(read('materialicons-regular.otf'));
  await icons.load();
  // Styles without an explicit family fall back to the test binding's block
  // font; on a phone they fall back to Roboto, so mirror that here.
  for (final family in const ['FlutterTest', 'Ahem', '.SF UI Text', 'sans-serif']) {
    final fallback = FontLoader(family)
      ..addFont(read('roboto-regular.ttf'))
      ..addFont(read('roboto-medium.ttf'))
      ..addFont(read('roboto-bold.ttf'))
      ..addFont(read('roboto-black.ttf'));
    await fallback.load();
  }
}

/// Pumps [screen] on a phone-sized surface and writes `out/<name>.png`.
Future<void> renderScreen(
  WidgetTester tester,
  String name,
  Widget screen, {
  List<Override> overrides = const [],
  Size size = const Size(390, 844),
  double scrollBy = 0,
  Future<void> Function(WidgetTester tester)? beforeShot,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final previousOnError = FlutterError.onError;
  // Image/network failures are expected in a test binding; keep rendering.
  FlutterError.onError = (details) {};
  addTearDown(() => FlutterError.onError = previousOnError);

  await tester.pumpWidget(ProviderScope(
    overrides: overrides,
    child: ScreenUtilInit(
      designSize: const Size(375, 812),
      minTextAdapt: true,
      builder: (_, __) => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light().copyWith(
          textTheme: AppTheme.light().textTheme.apply(fontFamily: 'Roboto'),
        ),
        home: RepaintBoundary(key: const ValueKey('shot'), child: screen),
      ),
    ),
  ));
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
  // Asset images decode on real async time, outside the fake test clock.
  await tester.runAsync(() async {
    for (final element in find.byType(Image).evaluate().toList()) {
      final image = (element.widget as Image).image;
      try {
        await precacheImage(image, element).timeout(const Duration(seconds: 3));
      } catch (_) {}
    }
  });
  for (var i = 0; i < 3; i++) {
    await tester.pump(const Duration(milliseconds: 200));
  }
  if (beforeShot != null) await beforeShot(tester);
  if (scrollBy != 0) {
    final scrollable = find.byType(Scrollable).first;
    await tester.drag(scrollable, Offset(0, -scrollBy));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
  }
  await expectLater(
    find.byKey(const ValueKey('shot')),
    matchesGoldenFile('out/$name.png'),
  );
}
