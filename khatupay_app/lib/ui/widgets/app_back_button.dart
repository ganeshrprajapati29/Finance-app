import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_navigation_history.dart';

class AppBackButton extends StatelessWidget {
  final String fallbackRoute;
  final Color? color;

  const AppBackButton({
    super.key,
    this.fallbackRoute = '/',
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Back',
      icon: Icon(Icons.arrow_back, color: color),
      onPressed: () {
        final router = GoRouter.of(context);
        if (context.canPop()) {
          final current = router.routeInformationProvider.value.uri.toString();
          AppNavigationHistory.prepareForNativePop(current);
          context.pop();
        } else {
          AppNavigationHistory.goBack(
            router,
            fallback: fallbackRoute,
          );
        }
      },
    );
  }
}
