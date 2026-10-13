import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("com.google.gms.google-services")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.inputStream().use { localProperties.load(it) }
}

val isReleaseAppBundleBuild =
    gradle.startParameter.taskNames.any { taskName ->
        taskName.contains("bundleRelease", ignoreCase = true)
    }

val autoVersionCode =
    if (isReleaseAppBundleBuild) {
        val nextVersionCode =
            (localProperties.getProperty("flutter.versionCode")?.toIntOrNull() ?: flutter.versionCode) + 1

        localProperties.setProperty("flutter.versionCode", nextVersionCode.toString())
        localPropertiesFile.outputStream().use { localProperties.store(it, "Flutter local properties") }

        val pubspecFile = rootProject.file("../pubspec.yaml")
        if (pubspecFile.exists()) {
            val versionName = localProperties.getProperty("flutter.versionName") ?: flutter.versionName
            val updatedPubspec =
                pubspecFile.readText().replace(
                    Regex("""(?m)^version:\s*([0-9A-Za-z.\-_]+)\+\d+\s*$"""),
                    "version: $versionName+$nextVersionCode",
                )
            pubspecFile.writeText(updatedPubspec)
        }

        nextVersionCode
    } else {
        flutter.versionCode
    }

android {
    namespace = "com.finance.khatupay"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    defaultConfig {
        applicationId = "com.finance.khatupay"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = autoVersionCode
        versionName = flutter.versionName
        multiDexEnabled = true
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = (keystoreProperties["storeFile"] as String?)?.let { rootProject.file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation("androidx.multidex:multidex:2.0.1")
    implementation("com.razorpay:checkout:1.6.33")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}
