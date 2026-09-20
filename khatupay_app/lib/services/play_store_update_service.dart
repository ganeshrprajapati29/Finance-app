import 'dart:io';

import 'package:in_app_update/in_app_update.dart';

class PlayStoreUpdateResult {
  final bool updateAvailable;
  final bool immediateAllowed;
  final int? availableBuild;

  const PlayStoreUpdateResult({
    required this.updateAvailable,
    required this.immediateAllowed,
    this.availableBuild,
  });

  static const unavailable = PlayStoreUpdateResult(
    updateAvailable: false,
    immediateAllowed: false,
  );
}

class PlayStoreUpdateService {
  PlayStoreUpdateService._();

  static Future<PlayStoreUpdateResult> check() async {
    if (!Platform.isAndroid) return PlayStoreUpdateResult.unavailable;
    try {
      final info = await InAppUpdate.checkForUpdate();
      return PlayStoreUpdateResult(
        updateAvailable:
            info.updateAvailability == UpdateAvailability.updateAvailable,
        immediateAllowed: info.immediateUpdateAllowed,
        availableBuild: info.availableVersionCode,
      );
    } catch (_) {
      // Local/sideloaded builds are not owned by Google Play, so Play Core
      // reports API_NOT_AVAILABLE. The backend policy remains the fallback.
      return PlayStoreUpdateResult.unavailable;
    }
  }

  static Future<bool> startImmediateUpdate() async {
    try {
      await InAppUpdate.performImmediateUpdate();
      return true;
    } catch (_) {
      return false;
    }
  }
}
