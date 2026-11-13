const { withAppBuildGradle } = require('expo/config-plugins');

const start = '// BEGIN Stock Atlas upload signing';
const end = '// END Stock Atlas upload signing';

function configureUploadSigning(contents) {
  const previous = new RegExp(`\\n${start}[\\s\\S]*?${end}\\n?`, 'g');
  return `${contents.replace(previous, '').trimEnd()}
${start}
android {
    signingConfigs {
        stockAtlasUpload {
            def uploadStore = System.getenv("STOCK_ATLAS_KEYSTORE")
            if (uploadStore) {
                storeFile file(uploadStore)
            }
            storePassword System.getenv("STOCK_ATLAS_STORE_PASSWORD")
            keyAlias System.getenv("STOCK_ATLAS_KEY_ALIAS")
            keyPassword System.getenv("STOCK_ATLAS_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.stockAtlasUpload
        }
    }
}

gradle.taskGraph.whenReady { graph ->
    if (graph.allTasks.any { it.project == project && it.name.toLowerCase().contains("release") }) {
        def required = ["STOCK_ATLAS_KEYSTORE", "STOCK_ATLAS_STORE_PASSWORD",
                        "STOCK_ATLAS_KEY_ALIAS", "STOCK_ATLAS_KEY_PASSWORD"]
        def missing = required.findAll { !System.getenv(it)?.trim() }
        if (!missing.isEmpty()) {
            throw new GradleException("Release signing credentials missing: " + missing.join(", ") +
                ". Build with npm run release:android; never use the debug key for a release.")
        }
    }
}
${end}
`;
}

module.exports = config => withAppBuildGradle(config, mod => {
  if (mod.modResults.language !== 'groovy') throw new Error('Stock Atlas upload signing requires a Groovy app build file.');
  mod.modResults.contents = configureUploadSigning(mod.modResults.contents);
  return mod;
});

module.exports.configureUploadSigning = configureUploadSigning;
