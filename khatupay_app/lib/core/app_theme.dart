import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// ---------------------------------------------------------------------------
/// Khatu Pay design system
/// ---------------------------------------------------------------------------
/// A single source of truth for colour, type, spacing, radii and component
/// themes. The palette is pulled from the Khatu Pay logo (deep teal mark with a
/// warm saffron/gold accent) and tuned for an Indian fintech feel: trustworthy
/// teal for money movement, saffron for rewards/offers/loan CTAs, and a calm
/// off-white canvas with white surfaces so numbers stay the loudest thing on
/// screen.
///
/// Nothing here is screen-specific. Screens compose [KhatuColors], [KhatuText],
/// [KhatuSpace] and [KhatuRadius] instead of re-declaring their own local
/// colour constants.

class KhatuColors {
  const KhatuColors._();

  // --- Brand -------------------------------------------------------------
  /// Darkest brand tone. Used for hero headers and high-contrast surfaces.
  static const ink = Color(0xFF08201E);

  /// Logo teal. Primary brand colour for headers/gradients.
  static const deepTeal = Color(0xFF075E54);

  /// Interactive teal - buttons, links, selected states.
  static const teal = Color(0xFF00A884);

  /// Lighter teal, used for gradient ends and subtle highlights.
  static const mint = Color(0xFF14B8A6);

  /// Reward / offer / loan-CTA accent.
  static const saffron = Color(0xFFF59E0B);

  /// Deeper saffron, safe for text on light saffron washes.
  static const gold = Color(0xFFB45309);

  // --- Neutrals ----------------------------------------------------------
  static const bg = Color(0xFFF7FAF9);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceAlt = Color(0xFFF1F5F4);
  static const line = Color(0xFFE5ECEA);
  static const lineStrong = Color(0xFFD3DEDB);
  static const text = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);
  static const faint = Color(0xFF94A3B8);

  // --- Tints (backgrounds for chips, banners, icon wells) ----------------
  static const softTeal = Color(0xFFE8F8F4);
  static const softSaffron = Color(0xFFFFF7E8);
  static const softBlue = Color(0xFFEFF6FF);
  static const softRed = Color(0xFFFEF2F2);
  static const softGreen = Color(0xFFECFDF5);

  // --- Status ------------------------------------------------------------
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFD97706);
  static const danger = Color(0xFFDC2626);
  static const info = Color(0xFF2563EB);
  static const blue = Color(0xFF2563EB);
  static const pending = Color(0xFFD97706);

  // --- Gradients ---------------------------------------------------------
  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [deepTeal, teal],
  );

  static const heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [ink, deepTeal, teal],
    stops: [0.0, 0.55, 1.0],
  );

  static const saffronGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF59E0B), Color(0xFFEA580C)],
  );

  /// Resolves any backend status string (loan, payment, KYC, withdrawal,
  /// sticker order...) to a display colour. Unknown values fall back to
  /// [muted] instead of throwing, so a new backend status never breaks a
  /// screen.
  static Color status(String? raw) {
    switch ((raw ?? '').trim().toUpperCase()) {
      case 'CONFIRMED':
      case 'SUCCESS':
      case 'PAID':
      case 'APPROVED':
      case 'ACTIVE':
      case 'VERIFIED':
      case 'COMPLETED':
      case 'DELIVERED':
      case 'CREDITED':
        return success;
      case 'PENDING':
      case 'PROCESSING':
      case 'IN_PROGRESS':
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      case 'AWAITING':
      case 'INITIATED':
        return warning;
      case 'FAILED':
      case 'REJECTED':
      case 'CANCELLED':
      case 'DECLINED':
      case 'OVERDUE':
      case 'EXPIRED':
        return danger;
      case 'DISBURSED':
      case 'REFUNDED':
      case 'SHIPPED':
        return info;
      case 'CLOSED':
        return deepTeal;
      default:
        return muted;
    }
  }

  /// Soft background tint that pairs with [status].
  static Color statusTint(String? raw) => status(raw).withValues(alpha: 0.10);
}

/// Spacing scale (4pt grid). Used instead of magic `SizedBox` numbers so the
/// vertical rhythm stays consistent across screens.
class KhatuSpace {
  const KhatuSpace._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  /// Standard horizontal page gutter.
  static const EdgeInsets page = EdgeInsets.symmetric(horizontal: lg);

  /// Page padding that leaves room for a bottom nav bar / FAB.
  static const EdgeInsets pageScroll = EdgeInsets.fromLTRB(lg, lg, lg, 96);

  static const EdgeInsets card = EdgeInsets.all(lg);

  static const SizedBox gapXs = SizedBox(height: xs);
  static const SizedBox gapSm = SizedBox(height: sm);
  static const SizedBox gapMd = SizedBox(height: md);
  static const SizedBox gapLg = SizedBox(height: lg);
  static const SizedBox gapXl = SizedBox(height: xl);
  static const SizedBox gapXxl = SizedBox(height: xxl);

  static const SizedBox wSm = SizedBox(width: sm);
  static const SizedBox wMd = SizedBox(width: md);
  static const SizedBox wLg = SizedBox(width: lg);
}

/// Corner radii.
class KhatuRadius {
  const KhatuRadius._();

  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double pill = 999;

  static final BorderRadius rSm = BorderRadius.circular(sm);
  static final BorderRadius rMd = BorderRadius.circular(md);
  static final BorderRadius rLg = BorderRadius.circular(lg);
  static final BorderRadius rXl = BorderRadius.circular(xl);
  static final BorderRadius rPill = BorderRadius.circular(pill);
}

/// Elevation presets. Khatu surfaces are flat and hairline-bordered; shadow is
/// only used to lift a card off the canvas, never as decoration.
class KhatuShadow {
  const KhatuShadow._();

  static List<BoxShadow> get soft => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.035),
          blurRadius: 14,
          offset: const Offset(0, 6),
        ),
      ];

  static List<BoxShadow> get raised => [
        BoxShadow(
          color: KhatuColors.ink.withValues(alpha: 0.10),
          blurRadius: 24,
          offset: const Offset(0, 12),
        ),
      ];
}

/// Text styles, named by role rather than by size so a future type-scale
/// change stays in this one file.
class KhatuText {
  const KhatuText._();

  static const display = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w900,
    color: KhatuColors.text,
    height: 1.15,
    letterSpacing: -0.5,
  );

  static const h1 = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w900,
    color: KhatuColors.text,
    height: 1.2,
    letterSpacing: -0.3,
  );

  static const h2 = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w900,
    color: KhatuColors.text,
    height: 1.25,
  );

  static const h3 = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w800,
    color: KhatuColors.text,
    height: 1.3,
  );

  static const body = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: KhatuColors.text,
    height: 1.4,
  );

  static const bodyMuted = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: KhatuColors.muted,
    height: 1.4,
  );

  static const label = TextStyle(
    fontSize: 12.5,
    fontWeight: FontWeight.w700,
    color: KhatuColors.muted,
    height: 1.3,
  );

  static const caption = TextStyle(
    fontSize: 11.5,
    fontWeight: FontWeight.w700,
    color: KhatuColors.faint,
    height: 1.3,
  );

  /// Money. Bold and tight so an amount reads as data, not as prose.
  static const amount = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w900,
    color: KhatuColors.text,
    height: 1.1,
    letterSpacing: -0.4,
  );

  static const amountLarge = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w900,
    color: Colors.white,
    height: 1.05,
    letterSpacing: -1,
  );

  static const button = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w900,
    letterSpacing: 0.2,
  );
}

class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: KhatuColors.teal,
      brightness: Brightness.light,
      primary: KhatuColors.teal,
      onPrimary: Colors.white,
      secondary: KhatuColors.saffron,
      onSecondary: Colors.white,
      error: KhatuColors.danger,
      surface: KhatuColors.surface,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: scheme,
      scaffoldBackgroundColor: KhatuColors.bg,
      canvasColor: KhatuColors.bg,
      visualDensity: VisualDensity.standard,
      fontFamily: 'Roboto',
      splashFactory: InkRipple.splashFactory,

      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        foregroundColor: KhatuColors.text,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: KhatuColors.text,
          fontSize: 18,
          fontWeight: FontWeight.w900,
        ),
        iconTheme: IconThemeData(color: KhatuColors.text),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
        ),
      ),

      cardTheme: CardThemeData(
        color: KhatuColors.surface,
        elevation: 0,
        margin: const EdgeInsets.symmetric(vertical: 6),
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          side: const BorderSide(color: KhatuColors.line),
        ),
        surfaceTintColor: Colors.white,
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        labelStyle: const TextStyle(
          color: KhatuColors.muted,
          fontWeight: FontWeight.w700,
        ),
        floatingLabelStyle: const TextStyle(
          color: KhatuColors.deepTeal,
          fontWeight: FontWeight.w800,
        ),
        hintStyle: const TextStyle(
          color: KhatuColors.faint,
          fontWeight: FontWeight.w600,
        ),
        helperStyle: KhatuText.caption,
        errorStyle: const TextStyle(
          color: KhatuColors.danger,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
        prefixIconColor: KhatuColors.muted,
        suffixIconColor: KhatuColors.muted,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          borderSide: const BorderSide(color: KhatuColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          borderSide: const BorderSide(color: KhatuColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          borderSide: const BorderSide(color: KhatuColors.teal, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          borderSide: const BorderSide(color: KhatuColors.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          borderSide: const BorderSide(color: KhatuColors.danger, width: 1.6),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          borderSide: const BorderSide(color: KhatuColors.line),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: KhatuColors.teal,
          foregroundColor: Colors.white,
          disabledBackgroundColor: KhatuColors.lineStrong,
          disabledForegroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          minimumSize: const Size(48, 50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(KhatuRadius.md),
          ),
          textStyle: KhatuText.button,
        ),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: KhatuColors.saffron,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          minimumSize: const Size(48, 50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(KhatuRadius.md),
          ),
          textStyle: KhatuText.button,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: KhatuColors.deepTeal,
          side: const BorderSide(color: KhatuColors.lineStrong),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(KhatuRadius.md),
          ),
          textStyle: KhatuText.button,
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: KhatuColors.deepTeal,
          textStyle: const TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 13.5,
          ),
        ),
      ),

      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: KhatuColors.teal,
        foregroundColor: Colors.white,
        elevation: 2,
      ),

      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: KhatuColors.teal,
        unselectedItemColor: KhatuColors.muted,
        selectedLabelStyle:
            TextStyle(fontWeight: FontWeight.w900, fontSize: 11),
        unselectedLabelStyle:
            TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),

      chipTheme: ChipThemeData(
        backgroundColor: KhatuColors.surfaceAlt,
        selectedColor: KhatuColors.softTeal,
        side: const BorderSide(color: KhatuColors.line),
        labelStyle: const TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 12.5,
          color: KhatuColors.text,
        ),
        secondaryLabelStyle: const TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 12.5,
          color: KhatuColors.deepTeal,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(KhatuRadius.pill)),
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: KhatuColors.ink,
        contentTextStyle: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
        actionTextColor: KhatuColors.mint,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
        ),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        titleTextStyle: KhatuText.h2,
        contentTextStyle: KhatuText.bodyMuted,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KhatuRadius.xl),
        ),
      ),

      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        showDragHandle: true,
        dragHandleColor: KhatuColors.lineStrong,
      ),

      dividerTheme: const DividerThemeData(
        color: KhatuColors.line,
        thickness: 1,
        space: 1,
      ),

      listTileTheme: const ListTileThemeData(
        iconColor: KhatuColors.teal,
        textColor: KhatuColors.text,
        titleTextStyle: KhatuText.h3,
        subtitleTextStyle: KhatuText.label,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        horizontalTitleGap: 12,
      ),

      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: KhatuColors.teal,
        linearTrackColor: KhatuColors.line,
        circularTrackColor: Colors.transparent,
      ),

      tabBarTheme: const TabBarThemeData(
        labelColor: KhatuColors.deepTeal,
        unselectedLabelColor: KhatuColors.muted,
        indicatorColor: KhatuColors.teal,
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5),
        unselectedLabelStyle:
            TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
        dividerColor: KhatuColors.line,
      ),

      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.all(Colors.white),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? KhatuColors.teal
              : KhatuColors.lineStrong,
        ),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),

      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? KhatuColors.teal
              : Colors.transparent,
        ),
        checkColor: WidgetStateProperty.all(Colors.white),
        side: const BorderSide(color: KhatuColors.lineStrong, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
      ),

      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? KhatuColors.teal
              : KhatuColors.lineStrong,
        ),
      ),

      textSelectionTheme: const TextSelectionThemeData(
        cursorColor: KhatuColors.teal,
        selectionColor: KhatuColors.softTeal,
        selectionHandleColor: KhatuColors.teal,
      ),

      textTheme: const TextTheme(
        displaySmall: KhatuText.display,
        headlineSmall: KhatuText.h1,
        titleLarge: KhatuText.h2,
        titleMedium: KhatuText.h3,
        bodyLarge: KhatuText.body,
        bodyMedium: KhatuText.body,
        bodySmall: KhatuText.label,
        labelLarge: KhatuText.button,
        labelSmall: KhatuText.caption,
      ),
    );
  }
}
