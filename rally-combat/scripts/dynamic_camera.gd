# DynamicCamera.gd
# Dynamic third-person multiplayer camera tracking all active fighters in Rally Combat.

class_name DynamicCamera
extends Camera3D

@export var min_distance: float = 8.0
@export var max_distance: float = 22.0
@export var base_pitch: float = -25.0 # Degrees
@export var smooth_speed: float = 5.0

var targets: Array[Node3D] = []

func _process(delta: float) -> void:
	var active_targets: Array[Node3D] = []
	for target in targets:
		if is_instance_valid(target):
			if target is PlayerController and target.is_alive:
				active_targets.append(target)
			elif not (target is PlayerController):
				active_targets.append(target)

	if active_targets.is_empty():
		return

	# Calculate center position & bounding box
	var center = Vector3.ZERO
	var min_pos = active_targets[0].global_position
	var max_pos = active_targets[0].global_position

	for t in active_targets:
		var pos = t.global_position
		center += pos
		min_pos.x = min(min_pos.x, pos.x)
		min_pos.z = min(min_pos.z, pos.z)
		max_pos.x = max(max_pos.x, pos.x)
		max_pos.z = max(max_pos.z, pos.z)

	center /= active_targets.size()

	# Dynamic zoom based on furthest player separation
	var max_spread = max(max_pos.x - min_pos.x, max_pos.z - min_pos.z)
	var desired_distance = clamp(min_distance + max_spread * 0.85, min_distance, max_distance)

	# Desired Camera Position behind and above center
	var offset = Vector3(0, desired_distance * 0.55, desired_distance * 0.85)
	var target_cam_pos = center + offset

	global_position = global_position.lerp(target_cam_pos, smooth_speed * delta)
	look_at(center + Vector3(0, 1.2, 0), Vector3.UP)
