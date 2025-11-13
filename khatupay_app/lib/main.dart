import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'core/fcm.dart';
import 'routes/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ✅ Initialize Firebase Cloud Messaging (if using)
  try {
    await FCM.init();
  } catch (e) {
    print('Firebase initialization failed: $e');
  }

  runApp(const ProviderScope(child: MyApp()));

  // ✅ Start listening for foreground messages after app is built
  WidgetsBinding.instance.addPostFrameCallback((_) {
    try {
      FCM.listenForeground();
    } catch (e) {
      print('FCM listen failed: $e');
    }
  });
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenUtilInit(
      designSize: const Size(375, 812), // iPhone X size as base
      minTextAdapt: true,
      splitScreenMode: true,
      builder: (context, child) {
        return MaterialApp.router(
          title: 'Khatu Pay',

          // ✅ Apply light/white theme globally with blue/green accents
          theme: ThemeData(
            useMaterial3: true,
            brightness: Brightness.light,             // ✅ Light mode
            scaffoldBackgroundColor: Colors.white,    // ✅ All screens white
            primaryColor: Colors.blueAccent,          // ✅ Blue primary
            colorScheme: const ColorScheme.light(
              primary: Colors.blueAccent,
              secondary: Colors.green,
            ),
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
            elevatedButtonTheme: ElevatedButtonThemeData(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blueAccent,
                foregroundColor: Colors.white,
              ),
            ),
          ),

          // ✅ Route setup
          routerConfig: router,

          debugShowCheckedModeBanner: false,
        );
      },
    );
  }
}
