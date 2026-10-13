// Builds the Android adaptive-icon foreground from the brand icon:
//   dart run tool/make_icon_foreground.dart
// Android masks adaptive icons to the centre ~66%, so the artwork is scaled
// into that safe zone on a transparent canvas.
// ignore_for_file: depend_on_referenced_packages
import 'dart:io';

import 'package:image/image.dart' as img;

void main() {
  final source = img.decodePng(
      File('assets/brand/khatupay_app_icon_v2.png').readAsBytesSync())!;
  const canvasSize = 1024;
  final inner = (canvasSize * 0.70).round();
  final scaled = img.copyResize(source,
      width: inner, height: inner, interpolation: img.Interpolation.cubic);
  final canvas = img.Image(width: canvasSize, height: canvasSize, numChannels: 4);
  img.fill(canvas, color: img.ColorRgba8(0, 0, 0, 0));
  final offset = (canvasSize - inner) ~/ 2;
  img.compositeImage(canvas, scaled, dstX: offset, dstY: offset);
  File('assets/brand/khatupay_app_icon_foreground.png')
      .writeAsBytesSync(img.encodePng(canvas));
  // Sample the artwork's own backdrop so the adaptive background matches it.
  final p = source.getPixel(source.width ~/ 2, 6);
  stdout.writeln(
      'foreground written; edge colour #${p.r.toInt().toRadixString(16).padLeft(2, '0')}${p.g.toInt().toRadixString(16).padLeft(2, '0')}${p.b.toInt().toRadixString(16).padLeft(2, '0')} alpha ${p.a.toInt()}');
}
