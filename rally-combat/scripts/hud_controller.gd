# HUDController.gd
# Canvas UI overlay for Rally Combat (Health bars, Combo counter, Special cooldown, Touch Mobile controls).

class_name HUDController
extends CanvasLayer

@onready var health_bar_p1: ProgressBar = $Margin/TopBar/P1Health
@onready var health_bar_p2: ProgressBar = $Margin/TopBar/P2Health
@onready var health_bar_p3: ProgressBar = $Margin/TopBar/P3Health
@onready var health_bar_p4: ProgressBar = $Margin/TopBar/P4Health

@onready var combo_label: Label = $Margin/ComboLabel
@onready var countdown_label: Label = $Center/CountdownLabel
@onready var mobile_touch_panel: Control = $MobileControlsPanel

func _ready() -> void:
	# Touch device detection
	if DisplayServer.has_feature(DisplayServer.FEATURE_TOUCHSCREEN) or OS.has_feature("mobile"):
		mobile_touch_panel.visible = true
	else:
		mobile_touch_panel.visible = false

func update_health(seat: int, hp: float, max_hp: float) -> void:
	var bar: ProgressBar = null
	match seat:
		1: bar = health_bar_p1
		2: bar = health_bar_p2
		3: bar = health_bar_p3
		4: bar = health_bar_p4

	if bar:
		bar.max_value = max_hp
		bar.value = hp

func display_combo(combo_count: int) -> void:
	if combo_count > 1:
		combo_label.text = "COMBO x" + str(combo_count)
		combo_label.visible = true
	else:
		combo_label.visible = false

func update_countdown(text: String) -> void:
	countdown_label.text = text
	countdown_label.visible = text != ""
