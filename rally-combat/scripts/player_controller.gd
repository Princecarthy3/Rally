# PlayerController.gd
# 3D Fighter Character controller with hitboxes, hurtboxes, movement, combos, and state logic.

class_name PlayerController
extends CharacterBody3D

signal health_changed(current_hp, max_hp)
signal player_eliminated(seat_number)
signal combo_updated(combo_count)
signal hit_landed(attacker_seat, victim_seat, damage, hit_position)

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
	_build_fighter_visuals()
	emit_signal("health_changed", current_health, config.max_health)

func _build_fighter_visuals() -> void:
	var armor := StandardMaterial3D.new()
	armor.albedo_color = config.primary_color
	armor.metallic = 0.42
	armor.roughness = 0.34
	var dark_armor := StandardMaterial3D.new()
	dark_armor.albedo_color = Color(0.09, 0.14, 0.2)
	dark_armor.metallic = 0.28
	dark_armor.roughness = 0.52
	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.72, 0.48, 0.34)
	skin.roughness = 0.78
	var visor := StandardMaterial3D.new()
	visor.albedo_color = Color(0.86, 0.95, 1.0)
	visor.metallic = 0.65
	visor.roughness = 0.2
	_add_part("Head", _sphere(0.3), skin, Vector3(0, 0.77, 0))
	_add_part("Helmet", _sphere(0.31), armor, Vector3(0, 0.91, -0.04), Vector3(1.0, 0.58, 1.0))
	_add_part("Visor", _box(Vector3(0.38, 0.1, 0.08)), visor, Vector3(0, 0.79, 0.25))
	_add_part("ChestPlate", _sphere(0.48), armor, Vector3(0, 0.13, 0.1), Vector3(1.0, 1.05, 0.68))
	_add_part("ChestCore", _sphere(0.14), visor, Vector3(0, 0.16, 0.43))
	_add_part("Belt", _cylinder(0.33, 0.14), dark_armor, Vector3(0, -0.37, 0))
	for side in [-1.0, 1.0]:
		_add_part("Shoulder", _sphere(0.23), armor, Vector3(side * 0.49, 0.36, 0))
		_add_part("Forearm", _capsule(0.15, 0.42), dark_armor, Vector3(side * 0.48, -0.05, 0.1))
		_add_part("Gauntlet", _sphere(0.19), armor, Vector3(side * 0.49, -0.34, 0.17))
		_add_part("Thigh", _capsule(0.19, 0.46), armor, Vector3(side * 0.21, -0.58, 0))
		_add_part("Boot", _box(Vector3(0.34, 0.2, 0.48)), dark_armor, Vector3(side * 0.21, -0.91, 0.1))

func _add_part(part_name: String, primitive: PrimitiveMesh, material: StandardMaterial3D, local_position: Vector3, part_scale: Vector3 = Vector3.ONE) -> void:
	var part := MeshInstance3D.new()
	part.name = part_name
	part.mesh = primitive
	part.material_override = material
	part.position = local_position
	part.scale = part_scale
	part.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	mesh_instance.add_child(part)

func _sphere(radius: float) -> SphereMesh:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 16
	mesh.rings = 12
	return mesh

func _box(size: Vector3) -> BoxMesh:
	var mesh := BoxMesh.new()
	mesh.size = size
	return mesh

func _capsule(radius: float, height: float) -> CapsuleMesh:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = height
	return mesh

func _cylinder(radius: float, height: float) -> CylinderMesh:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	return mesh

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
	# Physics overlap lists are updated at the end of a physics frame. Waiting
	# one frame makes quick attacks register consistently, including on Web builds.
	await get_tree().physics_frame
	var elapsed := 0.0
	var hit_targets: Dictionary = {}
	while elapsed < active_time and is_alive:
		for area in hitbox_area.get_overlapping_areas():
			var target := _fighter_for_area(area)
			if target == null or target == self or not target.is_alive:
				continue
			var target_id := target.get_instance_id()
			if hit_targets.has(target_id):
				continue
			hit_targets[target_id] = true
			var kb_dir := (target.global_position - global_position).normalized()
			kb_dir.y = 0.4
			target.take_damage(damage, kb_dir * (knockback * 8.0), seat_number)
			emit_signal("hit_landed", seat_number, target.seat_number, damage, target.global_position + Vector3.UP)
		await get_tree().physics_frame
		elapsed += get_physics_process_delta_time()

func _fighter_for_area(area: Area3D) -> PlayerController:
	var node: Node = area
	while node != null:
		if node is PlayerController:
			return node as PlayerController
		node = node.get_parent()
	return null

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
