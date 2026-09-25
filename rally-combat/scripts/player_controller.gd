# PlayerController.gd
# 3D Fighter Character controller with hitboxes, hurtboxes, movement, combos, and state logic.

class_name PlayerController
extends CharacterBody3D

signal health_changed(current_hp, max_hp)
signal player_eliminated(seat_number)
signal combo_updated(combo_count)

@export var seat_number: int = 1
@export var is_local_player: bool = true
@export var archetype: CharacterData.Archetype = CharacterData.Archetype.BALANCED

const GRAVITY: float = 24.0

var config: CharacterData
var current_health: float = 100.0
var is_alive: bool = true

# Combat States
var is_blocking: bool = false
var is_dodging: bool = false
var dodge_timer: float = 0.0
var dodge_cooldown_timer: float = 0.0
var special_cooldown_timer: float = 0.0

# Attack States & Combos
var attack_state: String = "idle" # "idle", "light_1", "light_2", "heavy", "special"
var attack_timer: float = 0.0
var combo_count: int = 0
var combo_window_timer: float = 0.0

# Hurtbox / Hitbox nodes
@onready var hurtbox_area: Area3D = $HurtboxArea
@onready var hitbox_area: Area3D = $HitboxArea
@onready var anim_player: AnimationPlayer = $AnimationPlayer
@onready var mesh_instance: MeshInstance3D = $FighterMesh

func _ready() -> void:
	config = CharacterData.get_character_config(archetype)
	current_health = config.max_health
	emit_signal("health_changed", current_health, config.max_health)

func _physics_process(delta: float) -> void:
	if not is_alive:
		return

	# Timers
	if dodge_timer > 0.0:
		dodge_timer -= delta
		if dodge_timer <= 0.0:
			is_dodging = false

	if dodge_cooldown_timer > 0.0:
		dodge_cooldown_timer -= delta

	if special_cooldown_timer > 0.0:
		special_cooldown_timer -= delta

	if combo_window_timer > 0.0:
		combo_window_timer -= delta
		if combo_window_timer <= 0.0:
			combo_count = 0
			emit_signal("combo_updated", 0)

	if attack_timer > 0.0:
		attack_timer -= delta
		if attack_timer <= 0.0:
			attack_state = "idle"

	# Apply Gravity
	if not is_on_floor():
		velocity.y -= GRAVITY * delta

	# Process local input
	if is_local_player and attack_state == "idle":
		_handle_local_input(delta)

	move_and_slide()

func _handle_local_input(_delta: float) -> void:
	# Jump
	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = config.jump_velocity

	# Dodge / Dash
	if Input.is_action_just_pressed("dodge") and dodge_cooldown_timer <= 0.0:
		is_dodging = true
		dodge_timer = 0.25 # 250ms i-frames
		dodge_cooldown_timer = 1.2
		var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
		var dash_dir = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
		if dash_dir.length() < 0.1:
			dash_dir = -transform.basis.z
		velocity = dash_dir * (config.move_speed * 2.2)
		return

	# Blocking
	is_blocking = Input.is_action_pressed("block") and is_on_floor()

	# Movement
	var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
	var direction = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()

	if is_blocking:
		velocity.x = 0
		velocity.z = 0
	elif direction != Vector3.ZERO:
		velocity.x = direction.x * config.move_speed
		velocity.z = direction.z * config.move_speed
		var target_rotation = atan2(-direction.x, -direction.z)
		rotation.y = lerp_angle(rotation.y, target_rotation, 0.2)
	else:
		velocity.x = move_toward(velocity.x, 0, config.move_speed)
		velocity.z = move_toward(velocity.z, 0, config.move_speed)

	# Combat Actions
	if Input.is_action_just_pressed("attack_light"):
		_execute_light_attack()
	elif Input.is_action_just_pressed("attack_heavy"):
		_execute_heavy_attack()
	elif Input.is_action_just_pressed("special_ability") and special_cooldown_timer <= 0.0:
		_execute_special_ability()

func _execute_light_attack() -> void:
	attack_state = "light_attack"
	attack_timer = 0.35 / config.attack_speed
	combo_count += 1
	combo_window_timer = 1.5
	emit_signal("combo_updated", combo_count)
	_trigger_hitbox(config.light_damage, config.knockback_strength, 0.3)

func _execute_heavy_attack() -> void:
	attack_state = "heavy_attack"
	attack_timer = 0.65 / config.attack_speed
	combo_count += 1
	combo_window_timer = 1.5
	emit_signal("combo_updated", combo_count)
	_trigger_hitbox(config.heavy_damage, config.knockback_strength * 1.6, 0.5)

func _execute_special_ability() -> void:
	attack_state = "special_attack"
	attack_timer = 0.8
	special_cooldown_timer = config.special_cooldown
	_trigger_hitbox(config.special_damage, config.knockback_strength * 2.0, 0.6)

func _trigger_hitbox(damage: float, knockback: float, active_time: float) -> void:
	# Active hitbox check against overlapping enemy hurtboxes
	var overlapping_areas = hitbox_area.get_overlapping_areas()
	for area in overlapping_areas:
		if area.owner != self and area.owner.has_method("take_damage"):
			var target = area.owner as PlayerController
			var kb_dir = (target.global_position - global_position).normalized()
			kb_dir.y = 0.4
			target.take_damage(damage, kb_dir * (knockback * 8.0), seat_number)

func apply_remote_state(remote_position: Vector3, remote_rotation_y: float, remote_hp: float, remote_state: String) -> void:
	global_position = global_position.lerp(remote_position, 0.35)
	rotation.y = lerp_angle(rotation.y, remote_rotation_y, 0.35)
	current_health = clampf(remote_hp, 0.0, config.max_health)
	attack_state = remote_state
	if current_health <= 0.0:
		apply_remote_elimination()

func apply_remote_elimination() -> void:
	is_alive = false
	attack_state = "eliminated"
	velocity = Vector3.ZERO
	mesh_instance.visible = false

func take_damage(raw_damage: float, knockback_vector: Vector3, attacker_seat: int) -> void:
	if not is_alive or is_dodging:
		return

	var final_damage = raw_damage
	if is_blocking:
		final_damage = raw_damage * (1.0 - config.block_mitigation)

	current_health -= final_damage
	if current_health < 0.0:
		current_health = 0.0

	velocity += knockback_vector * (0.5 if is_blocking else 1.0)
	emit_signal("health_changed", current_health, config.max_health)

	if current_health <= 0.0:
		is_alive = false
		attack_state = "eliminated"
		emit_signal("player_eliminated", seat_number)
