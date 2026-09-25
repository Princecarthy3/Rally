extends Node3D

const PLAYER_SCENE := preload("res://scenes/player.tscn")
const SPAWN_POINTS := [Vector3(-6, 1, -4), Vector3(6, 1, 4), Vector3(-4, 1, 6), Vector3(4, 1, -6)]
const ARENA_RADIUS := 11.5

@onready var bridge: NetworkBridge = $NetworkBridge
@onready var spawner: Node3D = $FighterSpawner

var fighters: Dictionary = {}
var local_seat := 1
var broadcast_timer := 0.0

func _ready() -> void:
	bridge.sync_event_received.connect(_on_network_event)
	_spawn_fighter(local_seat, true)
	bridge.send_player_ready(local_seat, "neon_rooftop_v2")

func _physics_process(delta: float) -> void:
	broadcast_timer -= delta
	if broadcast_timer <= 0.0:
		broadcast_timer = 0.05
		var local_fighter = fighters.get(local_seat)
		if is_instance_valid(local_fighter):
			bridge.send_player_transform(local_seat, local_fighter.global_position, local_fighter.rotation.y, local_fighter.current_health, local_fighter.attack_state)

func _spawn_fighter(seat: int, local: bool) -> PlayerController:
	if fighters.has(seat) and is_instance_valid(fighters[seat]):
		return fighters[seat]
	var fighter := PLAYER_SCENE.instantiate() as PlayerController
	fighter.seat_number = seat
	fighter.is_local_player = local
	fighter.global_position = SPAWN_POINTS[clampi(seat - 1, 0, SPAWN_POINTS.size() - 1)]
	fighter.player_eliminated.connect(_on_fighter_eliminated)
	spawner.add_child(fighter)
	fighters[seat] = fighter
	return fighter

func _on_network_event(event_name: String, payload: Variant) -> void:
	if event_name == "rally_player_state":
		_apply_remote_state(payload)
	elif event_name == "rally_player_ready":
		var seat := _payload_int(payload, "seat", 0)
		if seat > 0 and seat != local_seat:
			_spawn_fighter(seat, false)
	elif event_name == "rally_hit":
		_apply_remote_hit(payload)
	elif event_name == "rally_elimination":
		var eliminated_seat := _payload_int(payload, "seat", 0)
		var eliminated = fighters.get(eliminated_seat)
		if is_instance_valid(eliminated):
			eliminated.apply_remote_elimination()

func _apply_remote_state(payload: Variant) -> void:
	var seat := _payload_int(payload, "seat", 0)
	if seat <= 0 or seat == local_seat:
		return
	var fighter := _spawn_fighter(seat, false)
	var position := _payload_vector3(payload, "position", fighter.global_position)
	position.x = clampf(position.x, -ARENA_RADIUS, ARENA_RADIUS)
	position.z = clampf(position.z, -ARENA_RADIUS, ARENA_RADIUS)
	fighter.apply_remote_state(position, _payload_float(payload, "rotation_y", fighter.rotation.y), _payload_float(payload, "hp", fighter.current_health), str(_payload_value(payload, "state", "idle")))

func _apply_remote_hit(payload: Variant) -> void:
	var victim: PlayerController = fighters.get(_payload_int(payload, "victim_seat", 0)) as PlayerController
	if is_instance_valid(victim) and victim.seat_number == local_seat:
		victim.take_damage(_payload_float(payload, "damage", 0.0), Vector3.ZERO, _payload_int(payload, "attacker_seat", 0))

func _on_fighter_eliminated(seat: int) -> void:
	if seat == local_seat:
		bridge.send_elimination(seat)

func _payload_value(payload: Variant, key: String, fallback: Variant) -> Variant:
	return payload.get(key, fallback) if payload is Dictionary else fallback

func _payload_int(payload: Variant, key: String, fallback: int) -> int:
	return int(_payload_value(payload, key, fallback))

func _payload_float(payload: Variant, key: String, fallback: float) -> float:
	return float(_payload_value(payload, key, fallback))

func _payload_vector3(payload: Variant, key: String, fallback: Vector3) -> Vector3:
	var value = _payload_value(payload, key, null)
	if value is Dictionary:
		return Vector3(float(value.get("x", fallback.x)), float(value.get("y", fallback.y)), float(value.get("z", fallback.z)))
	return fallback

func clampi(value: int, minimum: int, maximum: int) -> int:
	return maxi(minimum, mini(value, maximum))

func _on_flicker_timer_timeout() -> void:
	var lights := [$Arena/RimLight, $Arena/FillLight, $Arena/CenterGlow]
	for light in lights:
		if is_instance_valid(light):
			light.light_energy = randf_range(2.5, 10.0)
