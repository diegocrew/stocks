package diegocrew.stockatlas

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray

class StockWidgetPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(StockWidgetModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class StockWidgetModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "StockAtlasWidget"

  @ReactMethod
  fun syncWatchlist(symbols: ReadableArray, promise: Promise) {
    try {
      val array = JSONArray()
      for (index in 0 until symbols.size()) array.put(symbols.getString(index))
      val value = array.toString()
      val prefs = StockWidget.preferences(context)
      if (prefs.getString(StockWidget.WATCHLIST, null) != value) {
        if (!prefs.edit().putString(StockWidget.WATCHLIST, value).commit()) {
          throw IllegalStateException("Could not save widget watchlist")
        }
        StockWidget.ids(context).filter { prefs.getString(StockWidget.key(it, "list"), "custom") == "custom" }
          .forEach { StockWidget.schedule(context, it) }
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WIDGET_WATCHLIST", error)
    }
  }
}
