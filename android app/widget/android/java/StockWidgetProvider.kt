package diegocrew.stockatlas

import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.os.Bundle
import android.os.PersistableBundle
import android.util.Log
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONException

object StockWidget {
  const val PREFS = "stock_atlas_widgets"
  const val WATCHLIST = "watchlist"
  const val DEFAULT_TEXT = "#E8F0FC"
  const val DEFAULT_GAIN = "#56D99A"
  const val DEFAULT_LOSS = "#F07E8D"
  val LISTS = listOf(
    "custom" to "My watchlist", "spy" to "S&P 500", "berkshire" to "Berkshire Hathaway",
    "qqq" to "Nasdaq-100", "arkk" to "ARK Innovation"
  )
  private const val JOB_OFFSET = 100000

  fun key(id: Int, name: String) = "$id.$name"
  fun preferences(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  fun selectedLists(prefs: SharedPreferences, id: Int): List<String> {
    val raw = prefs.getString(key(id, "lists"), null)
    if (raw != null) {
      try {
        val saved = JSONArray(raw)
        val values = (0 until saved.length()).map { saved.getString(it) }.toSet()
        val selected = LISTS.map { it.first }.filter { it in values }
        if (selected.isNotEmpty()) return selected
        Log.e("StockAtlasWidget", "Widget $id has no valid selected lists")
      } catch (error: JSONException) {
        Log.e("StockAtlasWidget", "Invalid widget list selection for $id", error)
      }
    }
    val legacy = prefs.getString(key(id, "list"), "custom")
    return listOf(if (LISTS.any { it.first == legacy }) legacy!! else "custom")
  }
  fun ids(context: Context): IntArray = AppWidgetManager.getInstance(context)
    .getAppWidgetIds(ComponentName(context, StockWidgetProvider::class.java))

  fun schedule(context: Context, id: Int) {
    val extras = PersistableBundle().apply { putInt(AppWidgetManager.EXTRA_APPWIDGET_ID, id) }
    val job = JobInfo.Builder(JOB_OFFSET + id, ComponentName(context, StockWidgetJobService::class.java))
      .setExtras(extras)
      .setOverrideDeadline(0)
      .build()
    context.getSystemService(JobScheduler::class.java).schedule(job).also {
      if (it != JobScheduler.RESULT_SUCCESS) {
        render(context, id, "Update could not be scheduled. Tap to open the app.")
      }
    }
  }

  fun render(context: Context, id: Int, error: String? = null) {
    if (!ids(context).contains(id)) return
    val prefs = preferences(context)
    val selected = selectedLists(prefs, id)
    val status = prefs.getString(key(id, "status"), "Waiting for data") ?: "Waiting for data"
    val textColor = Color.parseColor(prefs.getString(key(id, "text"), DEFAULT_TEXT))
    val gainColor = Color.parseColor(prefs.getString(key(id, "gain"), DEFAULT_GAIN))
    val lossColor = Color.parseColor(prefs.getString(key(id, "loss"), DEFAULT_LOSS))
    val opacity = prefs.getInt(key(id, "opacity"), 85).coerceIn(0, 100)
    val alpha = (opacity * 255 / 100)
    val height = AppWidgetManager.getInstance(context).getAppWidgetOptions(id)
      .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 100)
    val showStatus = height >= 62 + selected.size * 14
    val tooSmall = height < 48 + selected.size * 14
    val rowTextSize = ((height - if (showStatus) 62f else 48f) / selected.size / 1.3f).coerceIn(10f, 16f)
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: throw IllegalStateException("Stock Atlas launch activity is missing")
    val settings = Intent(context, StockWidgetConfigActivity::class.java)
      .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val views = RemoteViews(context.packageName, R.layout.stock_widget).apply {
      setInt(R.id.widget_root, "setBackgroundColor", Color.argb(alpha, 11, 17, 28))
      setTextViewText(R.id.widget_title, if (error != null) "Stock Atlas · Update failed"
        else if (tooSmall) "Resize to see all lists" else "Stock Atlas · Daily move")
      setTextViewText(R.id.widget_status, if (error == null) status else "$error\n$status")
      setViewVisibility(R.id.widget_status, if (showStatus) View.VISIBLE else View.GONE)
      setTextColor(R.id.widget_title, textColor)
      setTextColor(R.id.widget_settings, textColor)
      setTextColor(R.id.widget_status, textColor)
      removeAllViews(R.id.widget_rows)
      selected.forEach { list ->
        val legacy = prefs.getString(key(id, "list"), "custom") == list
        val move = prefs.getString(key(id, "move.$list"), null)
          ?: if (legacy) prefs.getString(key(id, "move"), null) else null
        val sign = if (prefs.contains(key(id, "sign.$list"))) prefs.getInt(key(id, "sign.$list"), 0)
          else if (legacy) prefs.getInt(key(id, "sign"), 0) else 0
        val label = LISTS.first { it.first == list }.second
        val row = RemoteViews(context.packageName, R.layout.stock_widget_row).apply {
          setTextViewText(R.id.widget_list_name, label)
          setTextViewText(R.id.widget_list_move, move ?: if (error == null) "Updating..." else "Unavailable")
          setTextColor(R.id.widget_list_name, textColor)
          setTextColor(R.id.widget_list_move, if (sign > 0) gainColor else if (sign < 0) lossColor else textColor)
          setTextViewTextSize(R.id.widget_list_name, TypedValue.COMPLEX_UNIT_SP, rowTextSize)
          setTextViewTextSize(R.id.widget_list_move, TypedValue.COMPLEX_UNIT_SP, rowTextSize)
        }
        addView(R.id.widget_rows, row)
      }
      setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, id, open, flags))
      setOnClickPendingIntent(R.id.widget_settings, PendingIntent.getActivity(context, id, settings, flags))
    }
    AppWidgetManager.getInstance(context).updateAppWidget(id, views)
  }

  fun remove(context: Context, id: Int) {
    val prefs = preferences(context)
    val edit = prefs.edit()
    prefs.all.keys.filter { it.startsWith("$id.") }.forEach { edit.remove(it) }
    edit.apply()
    context.getSystemService(JobScheduler::class.java).cancel(JOB_OFFSET + id)
  }
}

class StockWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { id ->
      StockWidget.render(context, id)
      StockWidget.schedule(context, id)
    }
  }

  override fun onDeleted(context: Context, ids: IntArray) {
    ids.forEach { StockWidget.remove(context, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    StockWidget.render(context, id)
  }
}
