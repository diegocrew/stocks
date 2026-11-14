package diegocrew.stockatlas

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import android.content.Intent
import java.util.Locale

class StockWidgetConfigActivity : Activity() {
  private val listIds = arrayOf("custom", "spy", "berkshire", "qqq", "arkk")
  private val listNames = arrayOf("My watchlist", "S&P 500 · SPY", "Berkshire Hathaway", "Nasdaq-100 · QQQ", "ARK Innovation · ARKK")
  private var id = AppWidgetManager.INVALID_APPWIDGET_ID

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setResult(RESULT_CANCELED)
    id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    val info = AppWidgetManager.getInstance(this).getAppWidgetInfo(id)
    if (id == AppWidgetManager.INVALID_APPWIDGET_ID || info?.provider?.className != StockWidgetProvider::class.java.name) {
      finish()
      return
    }

    val prefs = StockWidget.preferences(this)
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(20), dp(20), dp(20))
    }
    val scroll = ScrollView(this).apply { addView(layout) }
    setContentView(scroll)
    fun label(value: String) {
      layout.addView(TextView(this).apply { text = value; textSize = 16f; setPadding(0, dp(12), 0, dp(4)) })
    }
    val selectedColors = mutableMapOf<String, Int>()
    fun colorField(label: String, key: String, fallback: String) {
      label(label)
      selectedColors[key] = Color.parseColor(prefs.getString(StockWidget.key(id, key), fallback))
      val button = Button(this)
      fun showSelection() {
        val color = selectedColors.getValue(key)
        button.text = "Choose color"
        button.backgroundTintList = ColorStateList.valueOf(color)
        button.setTextColor(if (Color.red(color) * 299 + Color.green(color) * 587 + Color.blue(color) * 114 > 150000) Color.BLACK else Color.WHITE)
      }
      showSelection()
      button.setOnClickListener {
        val options = listOf(
          "White" to "#FFFFFF", "Light gray" to "#CCD5E0", "Gray" to "#8290A4", "Black" to "#111111",
          "Red" to "#E74C5C", "Pink" to "#F07E8D", "Orange" to "#FF9F43", "Yellow" to "#F5D76E",
          "Green" to "#56D99A", "Teal" to "#39C5BB", "Blue" to "#66C9F5", "Navy" to "#3859A8",
          "Purple" to "#AD82E8", "Magenta" to "#DF70CA", "Brown" to "#9B6B4A", "Cream" to "#F3E2C2",
        )
        val grid = GridLayout(this).apply { columnCount = 2; setPadding(dp(8), dp(8), dp(8), dp(8)) }
        val dialog = AlertDialog.Builder(this).setTitle(label)
          .setView(ScrollView(this).apply { addView(grid) }).setNegativeButton("Cancel", null).create()
        options.forEach { (name, value) ->
          val color = Color.parseColor(value)
          val option = Button(this).apply {
            text = name
            backgroundTintList = ColorStateList.valueOf(color)
            setTextColor(if (Color.red(color) * 299 + Color.green(color) * 587 + Color.blue(color) * 114 > 150000) Color.BLACK else Color.WHITE)
            setOnClickListener { selectedColors[key] = color; showSelection(); dialog.dismiss() }
          }
          grid.addView(option, GridLayout.LayoutParams().apply {
            width = 0
            height = ViewGroup.LayoutParams.WRAP_CONTENT
            columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
          })
        }
        dialog.show()
      }
      layout.addView(button)
    }

    label("Choose a list")
    val spinner = Spinner(this).apply {
      adapter = ArrayAdapter(this@StockWidgetConfigActivity, android.R.layout.simple_spinner_dropdown_item, listNames)
      val saved = prefs.getString(StockWidget.key(id, "list"), "custom")
      setSelection(listIds.indexOf(saved).coerceAtLeast(0))
      layout.addView(this)
    }
    val opacityLabel = TextView(this).apply { textSize = 16f; setPadding(0, dp(12), 0, 0) }
    layout.addView(opacityLabel)
    val opacity = SeekBar(this).apply {
      max = 100
      progress = prefs.getInt(StockWidget.key(id, "opacity"), 85)
      opacityLabel.text = "Background opacity: $progress%"
      setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
        override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) {
          opacityLabel.text = "Background opacity: $value%"
        }
        override fun onStartTrackingTouch(bar: SeekBar) {}
        override fun onStopTrackingTouch(bar: SeekBar) {}
      })
      layout.addView(this)
    }
    colorField("Text color", "text", StockWidget.DEFAULT_TEXT)
    colorField("Positive move color", "gain", StockWidget.DEFAULT_GAIN)
    colorField("Negative move color", "loss", StockWidget.DEFAULT_LOSS)
    layout.addView(TextView(this).apply {
      text = "Tap the gear on the widget to change these settings later. Data updates approximately every 30 minutes and when the watchlist changes."
      setPadding(0, dp(16), 0, dp(16))
    })
    layout.addView(Button(this).apply {
      text = "Save widget"
      gravity = Gravity.CENTER
      setOnClickListener {
        val selected = spinner.selectedItemPosition
        val list = listIds[selected]
        val edit = prefs.edit()
          .putString(StockWidget.key(id, "list"), list)
          .putInt(StockWidget.key(id, "opacity"), opacity.progress)
          .putString(StockWidget.key(id, "text"), String.format(Locale.US, "#%06X", selectedColors.getValue("text") and 0xffffff))
          .putString(StockWidget.key(id, "gain"), String.format(Locale.US, "#%06X", selectedColors.getValue("gain") and 0xffffff))
          .putString(StockWidget.key(id, "loss"), String.format(Locale.US, "#%06X", selectedColors.getValue("loss") and 0xffffff))
        if (prefs.getString(StockWidget.key(id, "list"), null) != list) {
          edit.putString(StockWidget.key(id, "title"), listNames[selected])
            .remove(StockWidget.key(id, "move"))
            .remove(StockWidget.key(id, "status"))
            .remove(StockWidget.key(id, "sign"))
        }
        if (!edit.commit()) {
          Toast.makeText(this@StockWidgetConfigActivity, "Could not save widget settings.", Toast.LENGTH_LONG).show()
          return@setOnClickListener
        }
        StockWidget.render(this@StockWidgetConfigActivity, id)
        StockWidget.schedule(this@StockWidgetConfigActivity, id)
        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id))
        finish()
      }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
