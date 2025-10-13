import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/fcm.dart';
import 'routes/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ✅ Initialize Firebase Cloud Messaging (if using)
  await FCM.init();
  FCM.listenForeground();

  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Khatu Pay',

      // ✅ Apply light/white theme globally
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,             // ✅ Light mode
        scaffoldBackgroundColor: Colors.white,    // ✅ All screens white
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,          // ✅ White app bar
          foregroundColor: Colors.black,          // ✅ Black icons & text
          elevation: 1,
          centerTitle: true,
          titleTextStyle: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.black,
          ),
        ),
        cardColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.black),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Colors.black),
          bodyMedium: TextStyle(color: Colors.black),
        ),
      ),

      // ✅ Route setup
      routerConfig: router,

      debugShowCheckedModeBanner: false,
      
    );
  }
}
