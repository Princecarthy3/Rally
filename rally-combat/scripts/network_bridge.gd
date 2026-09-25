# NetworkBridge.gd
# JavaScriptBridge interop for integrating Godot 4 Web Assembly runtime with Supabase Realtime in Rally.

class_name NetworkBridge
extends Node

signal sync_event_received(event_name, payload)

var js_bridge_available: bool = false
var callback_ref: JavaScriptObject

func _ready() -> void:
	if OS.has_feature("web"):
		js_bridge_available = true
		callback_ref = JavaScriptBridge.create_callback(_on_js_message)
		var window = JavaScriptBridge.get_interface("window")
		if window:
			window.onGodotNetworkEvent = callback_ref

func send_player_ready(seat: int, arena_id: String) -> void:
	if not js_bridge_available:
		return
	var window = JavaScriptBridge.get_interface("window")
	if window and window.has_method("sendRallyCombatReady"):
		window.sendRallyCombatReady(seat, arena_id)

func send_player_transform(seat: int, pos: Vector3, rot_y: float, hp: float, state: String) -> void:
	if not js_bridge_available:
		return
	var window = JavaScriptBridge.get_interface("window")
	if window and window.has_method("sendRallyCombatState"):
		window.sendRallyCombatState(seat, pos.x, pos.y, pos.z, rot_y, hp, state)

func send_hit_event(attacker_seat: int, victim_seat: int, damage: float) -> void:
	if not js_bridge_available:
		return
	var window = JavaScriptBridge.get_interface("window")
	if window and window.has_method("sendRallyCombatHit"):
		window.sendRallyCombatHit(attacker_seat, victim_seat, damage)

func send_elimination(eliminated_seat: int) -> void:
	if not js_bridge_available:
		return
	var window = JavaScriptBridge.get_interface("window")
	if window and window.has_method("sendRallyCombatElimination"):
		window.sendRallyCombatElimination(eliminated_seat)

func _on_js_message(args: Array) -> void:
	if args.size() > 0:
		var event_name = str(args[0])
		var payload = args[1] if args.size() > 1 else null
		emit_signal("sync_event_received", event_name, payload)
