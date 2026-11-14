package diegocrew.stockatlas

import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.PersistableBundle
import android.widget.RemoteViews

object StockWidget {
  const val PREFS = "stock_atlas_widgets"
  const val WATCHLIST = "watchlist"
  const val DEFAULT_TEXT = "#E8F0FC"
  const val DEFAULT_GAIN = "#56D99A"
  const val DEFAULT_LOSS = "#F07E8D"
  private const val JOB_OFFSET = 100000

  fun key(id: Int, name: String) = "$id.$name"
  fun preferences(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
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
    val title = prefs.getString(key(id, "title"), "My watchlist") ?: "My watchlist"
    val move = prefs.getString(key(id, "move"), null)
    val status = prefs.getString(key(id, "status"), "Waiting for data") ?: "Waiting for data"
    val textColor = Color.parseColor(prefs.getString(key(id, "text"), DEFAULT_TEXT))
    val gainColor = Color.parseColor(prefs.getString(key(id, "gain"), DEFAULT_GAIN))
    val lossColor = Color.parseColor(prefs.getString(key(id, "loss"), DEFAULT_LOSS))
    val opacity = prefs.getInt(key(id, "opacity"), 85).coerceIn(0, 100)
    val alpha = (opacity * 255 / 100)
    val sign = prefs.getInt(key(id, "sign"), 0)
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: throw IllegalStateException("Stock Atlas launch activity is missing")
    val settings = Intent(context, StockWidgetConfigActivity::class.java)
      .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val views = RemoteViews(context.packageName, R.layout.stock_widget).apply {
      setInt(R.id.widget_root, "setBackgroundColor", Color.argb(alpha, 11, 17, 28))
      setTextViewText(R.id.widget_title, title)
      setTextViewText(R.id.widget_move, move ?: "Updating...")
      setTextViewText(R.id.widget_status, if (error == null) status else "$error\n$status")
      setTextColor(R.id.widget_title, textColor)
      setTextColor(R.id.widget_settings, textColor)
      setTextColor(R.id.widget_status, textColor)
      setTextColor(R.id.widget_move, if (sign > 0) gainColor else if (sign < 0) lossColor else textColor)
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
}
