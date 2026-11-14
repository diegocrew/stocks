package diegocrew.stockatlas

import android.app.job.JobParameters
import android.app.job.JobService
import android.appwidget.AppWidgetManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class StockWidgetJobService : JobService() {
  private val executor = Executors.newCachedThreadPool()
  private val stopped = ConcurrentHashMap<JobParameters, AtomicBoolean>()

  override fun onStartJob(params: JobParameters): Boolean {
    val cancelled = AtomicBoolean(false)
    stopped[params] = cancelled
    executor.execute {
      val id = params.extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      val prefs = StockWidget.preferences(this)
      val lists = StockWidget.selectedLists(prefs, id)
      val watchlist = prefs.getString(StockWidget.WATCHLIST, null)
      try {
        val results = fetchSummaries(lists, watchlist)
        if (!cancelled.get() && StockWidget.ids(this).contains(id) &&
          StockWidget.selectedLists(prefs, id) == lists &&
          ("custom" !in lists || prefs.getString(StockWidget.WATCHLIST, null) == watchlist)) {
          val edit = prefs.edit()
          results.forEach { (list, result) ->
            edit.putString(StockWidget.key(id, "move.$list"), result.move)
              .putInt(StockWidget.key(id, "sign.$list"), result.sign)
          }
          val first = results.first().second
          val warning = if (results.any { it.second.incomplete }) " · Some data stale or unavailable" else ""
          val saved = edit.putString(StockWidget.key(id, "status"), "${first.updated}$warning").commit()
          if (!saved) throw IllegalStateException("Could not save widget data")
          StockWidget.render(this, id)
        }
      } catch (error: Exception) {
        Log.e("StockAtlasWidget", "Could not update widget", error)
        if (!cancelled.get()) StockWidget.render(this, id, "Update failed. Tap to open the app.")
      } finally {
        stopped.remove(params)
        if (!cancelled.get()) jobFinished(params, false)
      }
    }
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean {
    stopped.remove(params)?.set(true)
    return true
  }

  override fun onDestroy() {
    executor.shutdownNow()
    super.onDestroy()
  }
}

private data class WidgetSummary(val move: String, val updated: String, val sign: Int, val incomplete: Boolean)
private data class WidgetHolding(val symbol: String, val weight: Double)

private fun getJson(file: String): JSONObject {
  val connection = URL("https://diegocrew.github.io/stocks/data/$file").openConnection() as HttpURLConnection
  try {
    connection.connectTimeout = 15000
    connection.readTimeout = 15000
    connection.useCaches = false
    connection.setRequestProperty("Cache-Control", "no-cache")
    if (connection.responseCode != HttpURLConnection.HTTP_OK) {
      throw IllegalStateException("Widget data request failed: HTTP ${connection.responseCode}")
    }
    return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
  } finally {
    connection.disconnect()
  }
}

private fun JSONArray.objects(): List<JSONObject> =
  (0 until length()).map { getJSONObject(it) }

private fun fetchSummaries(lists: List<String>, watchlist: String?): List<Pair<String, WidgetSummary>> {
  val market = getJson("market.json")
  val timestamp = market.getString("generatedAt")
  if (!Regex("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}").containsMatchIn(timestamp)) {
    throw IllegalStateException("Invalid snapshot timestamp")
  }
  val stocks = market.getJSONArray("stocks").objects().associateBy { it.getString("symbol") }
  if (stocks.isEmpty()) throw IllegalStateException("Empty market snapshot")
  val portfolios = if (lists.any { it != "custom" }) getJson("portfolios.json").getJSONArray("portfolios").objects() else emptyList()
  val symbols = if ("custom" in lists) {
    if (watchlist != null) JSONArray(watchlist) else getJson("companies.json").getJSONArray("defaultSymbols")
  } else null
  val updated = "Last updated ${timestamp.take(16).replace('T', ' ')} UTC"
  return lists.map { list -> list to summarize(list, stocks, portfolios, symbols, updated) }
}

private fun summarize(
  list: String,
  stocks: Map<String, JSONObject>,
  portfolios: List<JSONObject>,
  symbols: JSONArray?,
  updated: String
): WidgetSummary {
  var stale = false
  val holdings: List<WidgetHolding>
  if (list == "custom") {
    val selected = symbols ?: throw IllegalStateException("Watchlist unavailable")
    if (selected.length() == 0) throw IllegalStateException("Empty watchlist")
    holdings = (0 until selected.length()).map { WidgetHolding(selected.getString(it), 0.0) }
  } else {
    val portfolio = portfolios
      .firstOrNull { it.getString("id") == list } ?: throw IllegalStateException("Portfolio not found")
    stale = portfolio.getBoolean("stale")
    holdings = portfolio.getJSONArray("holdings").objects()
      .filter { !it.isNull("symbol") && !it.isNull("weight") && it.getDouble("weight") > 0 }
      .map { WidgetHolding(it.getString("symbol"), it.getDouble("weight")) }
      .sortedWith(compareByDescending<WidgetHolding> { it.weight }.thenBy { it.symbol })
      .take(30)
  }
  var numerator = 0.0
  var denominator = 0.0
  var included = 0
  for (holding in holdings) {
    val stock = stocks[holding.symbol] ?: continue
    if (stock.optBoolean("stale", false)) stale = true
    if (stock.isNull("dailyChange")) continue
    val change = stock.getDouble("dailyChange")
    val weight = if (list == "custom") stock.optDouble("marketCapUsd", 0.0) else holding.weight
    if (!change.isFinite() || !weight.isFinite() || weight <= 0) continue
    numerator += change * weight
    denominator += weight
    included++
  }
  val result = if (denominator > 0) numerator / denominator else null
  val move = if (result == null) "Unavailable" else String.format(Locale.getDefault(), "%+.2f%%", result)
  val sign = if (result == null || result == 0.0) 0 else if (result > 0) 1 else -1
  return WidgetSummary(move, updated, sign, stale || included != holdings.size)
}
