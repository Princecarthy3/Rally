# Rally Combat - Godot 4 3D Arena Brawler

This is the standalone **Godot 4.x** project for **Rally Combat**, integrated into the Rally Web Application platform.

## Project Architecture

```
rally-combat/
├── project.godot           # Godot 4 project configuration (3D rendering, input map, viewport)
├── export_presets.cfg      # Web (HTML5/WebAssembly) export preset config
├── scenes/
│   ├── main.tscn           # Main scene hierarchy (spawner, camera, arena, network bridge)
│   ├── arena.tscn          # Rally Rooftop Arena (barriers, neon trim, lighting)
│   ├── player.tscn         # CharacterBody3D node (hitboxes, hurtboxes, mesh, animations)
│   ├── camera.tscn         # Dynamic third-person multiplayer camera
│   └── hud.tscn            # Canvas UI overlay (health bars, combo text, touch controls)
├── scripts/
│   ├── character_data.gd   # Archetype resource system (Balanced, Speed, Power, Defender)
│   ├── player_controller.gd# Fighter movement, jump, dodge, attacks, block, & health
│   ├── combat_manager.gd   # Hit detection & combo system
│   ├── dynamic_camera.gd   # Multi-player dynamic zoom & group center tracking
│   ├── arena.gd            # Arena boundary collision handling
│   ├── network_bridge.gd   # JavaScriptBridge interop with Supabase Realtime in Rally
│   ├── hud_controller.gd   # HUD interface & mobile touch controls
│   └── sound_manager.gd    # Audio synthesis controller
└── assets/                 # 3D GLB/GLTF models, textures, animations, & audio
```

## Playable Roster Archetypes

1. **Vanguard (Balanced)**: 100 HP | Speed 7.0 | Light 10 | Heavy 18 | Special: Energy Strike (8s)
2. **Stryker (Speed)**: 85 HP | Speed 9.2 | Light 8 | Heavy 15 | Special: Dash Strike (6s)
3. **Titan (Power)**: 120 HP | Speed 5.6 | Light 13 | Heavy 24 | Special: Ground Slam (10s)
4. **Aegis (Defender)**: 130 HP | Speed 6.0 | Light 9 | Heavy 16 | Special: Shield Burst (9s)

## How to Open in Godot Editor

1. Download & Install [Godot 4.3+](https://godotengine.org/download).
2. Launch Godot, click **Import**, select `rally-combat/project.godot`.
3. Press **F5** to run the project.

## How to Export to Web (HTML5 / WebAssembly)

To build the Godot Web export for Rally:
```bash
godot --headless --export-release "Web (HTML5)" public/godot/rally-combat/index.html
```

The exported WebAssembly build is hosted inside `public/godot/rally-combat/` and bridged seamlessly to Supabase Realtime in Rally.
