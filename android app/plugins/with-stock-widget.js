const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod, withMainApplication } = require('expo/config-plugins');

module.exports = config => {
  config = withAndroidManifest(config, mod => {
    const app = mod.modResults.manifest.application[0];
    app.receiver = (app.receiver || []).filter(item => item.$['android:name'] !== '.StockWidgetProvider');
    app.receiver.push({
      $: { 'android:name': '.StockWidgetProvider', 'android:exported': 'true', 'android:label': 'Stock Atlas' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
      'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/stock_widget_info' } }],
    });
    app.activity = (app.activity || []).filter(item => item.$['android:name'] !== '.StockWidgetConfigActivity');
    app.activity.push({
      $: { 'android:name': '.StockWidgetConfigActivity', 'android:exported': 'true', 'android:label': 'Configure Stock Atlas widget' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_CONFIGURE' } }] }],
    });
    app.service = (app.service || []).filter(item => item.$['android:name'] !== '.StockWidgetJobService');
    app.service.push({ $: { 'android:name': '.StockWidgetJobService', 'android:permission': 'android.permission.BIND_JOB_SERVICE', 'android:exported': 'false' } });
    return mod;
  });
  config = withMainApplication(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('Stock Atlas widget requires a Kotlin MainApplication.');
    const marker = 'add(StockWidgetPackage())';
    const anchor = 'PackageList(this).packages.apply {';
    if (!mod.modResults.contents.includes(marker)) {
      if (!mod.modResults.contents.includes(anchor)) throw new Error('Could not register the Stock Atlas widget package.');
      mod.modResults.contents = mod.modResults.contents.replace(anchor, `${anchor}\n          ${marker}`);
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const source = path.join(mod.modRequest.projectRoot, 'widget', 'android');
    const main = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main');
    const packageName = mod.android.package;
    if (packageName !== 'diegocrew.stockatlas') throw new Error('Stock Atlas widget package must match its native sources.');
    fs.cpSync(path.join(source, 'java'), path.join(main, 'java', ...packageName.split('.')), { recursive: true });
    fs.cpSync(path.join(source, 'res'), path.join(main, 'res'), { recursive: true });
    return mod;
  }]);
};
