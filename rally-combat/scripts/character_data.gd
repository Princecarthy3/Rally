# CharacterData.gd
# Roster configuration system for Rally Combat playable fighters.

class_name CharacterData
extends Resource

enum Archetype {
	BALANCED,
	SPEED,
	POWER,
	DEFENDER
}

@export var archetype: Archetype = Archetype.BALANCED
@export var character_name: String = "Vanguard"
@export var max_health: float = 100.0
@export var move_speed: float = 7.0
@export var jump_velocity: float = 8.5
@export var light_damage: float = 10.0
@export var heavy_damage: float = 18.0
@export var attack_speed: float = 1.0
@export var knockback_strength: float = 1.0
@export var block_mitigation: float = 0.65 # 65% damage reduction when blocking
@export var special_name: String = "Energy Strike"
@export var special_cooldown: float = 8.0
@export var special_damage: float = 28.0
@export var primary_color: Color = Color(1.0, 0.2, 0.4) # Bright vibrant Rally theme

static func get_character_config(type: Archetype) -> CharacterData:
	var data = CharacterData.new()
	match type:
		Archetype.BALANCED:
			data.archetype = Archetype.BALANCED
			data.character_name = "Vanguard"
			data.max_health = 100.0
			data.move_speed = 7.0
			data.jump_velocity = 8.5
			data.light_damage = 10.0
			data.heavy_damage = 18.0
			data.attack_speed = 1.0
			data.knockback_strength = 1.0
			data.block_mitigation = 0.65
			data.special_name = "Energy Strike"
			data.special_cooldown = 8.0
			data.special_damage = 28.0
			data.primary_color = Color(1.0, 0.25, 0.35)

		Archetype.SPEED:
			data.archetype = Archetype.SPEED
			data.character_name = "Stryker"
			data.max_health = 85.0
			data.move_speed = 9.2
			data.jump_velocity = 9.5
			data.light_damage = 8.0
			data.heavy_damage = 15.0
			data.attack_speed = 1.35
			data.knockback_strength = 0.8
			data.block_mitigation = 0.55
			data.special_name = "Dash Strike"
			data.special_cooldown = 6.0
			data.special_damage = 22.0
			data.primary_color = Color(0.2, 0.85, 0.95)

		Archetype.POWER:
			data.archetype = Archetype.POWER
			data.character_name = "Titan"
			data.max_health = 120.0
			data.move_speed = 5.6
			data.jump_velocity = 7.8
			data.light_damage = 13.0
			data.heavy_damage = 24.0
			data.attack_speed = 0.8
			data.knockback_strength = 1.55
			data.block_mitigation = 0.70
			data.special_name = "Ground Slam"
			data.special_cooldown = 10.0
			data.special_damage = 35.0
			data.primary_color = Color(0.95, 0.75, 0.15)

		Archetype.DEFENDER:
			data.archetype = Archetype.DEFENDER
			data.character_name = "Aegis"
			data.max_health = 130.0
			data.move_speed = 6.0
			data.jump_velocity = 8.0
			data.light_damage = 9.0
			data.heavy_damage = 16.0
			data.attack_speed = 0.9
			data.knockback_strength = 0.95
			data.block_mitigation = 0.85 # Stronger 85% block mitigation
			data.special_name = "Shield Burst"
			data.special_cooldown = 9.0
			data.special_damage = 25.0
			data.primary_color = Color(0.3, 0.9, 0.5)

	return data
