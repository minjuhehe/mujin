# Zombie Skill Effects (Roblox)

The Roblox version of `game.html`: 7 passive on-hit effects and 6 active skills, with a zombie spawner and a skill bar UI.

| Passive (on every auto-attack hit) | Active (keys 1–6) |
|---|---|
| 🧛 Void Devour (lifesteal/heal) | 🕳️ 1 Black Hole |
| 🩸 Bleed | ☄️ 2 Meteor |
| 🔥 Inferno (spreads) | 🌀 3 Void Rift |
| ❄️ Frost (5 stacks = frozen) | 🌠 4 Starblade |
| 💥 Explosive | ☀️ 5 Divine Wrath |
| ⚡ Electric (chains 5 zombies) | ⚖️ 6 Judgement |
| ☣️ Toxic (poison cloud on death) | |

## Install (copy-paste into Roblox Studio)

Create these 3 scripts. The names must match exactly.

| File in this folder | Where in Studio | Type | Name |
|---|---|---|---|
| `src/ReplicatedStorage/SkillConfig.lua` | ReplicatedStorage | **ModuleScript** | `SkillConfig` |
| `src/ServerScriptService/SkillServer.server.lua` | ServerScriptService | **Script** | `SkillServer` |
| `src/StarterPlayerScripts/SkillClient.client.lua` | StarterPlayer › StarterPlayerScripts | **LocalScript** | `SkillClient` |

1. In the Explorer, hover over the service → click **+** → pick the type above → rename it.
2. Open it, delete the default code, and paste the whole file.
3. Press **Play**. Zombies spawn around you, and you shoot them automatically.

If you use [Rojo](https://rojo.space), run `rojo serve` in this folder instead (`default.project.json` is included).

## Controls

- **Walk** with the normal Roblox controls. Your character shoots the nearest zombie automatically.
- **1–6**: cast at the mouse position. Tapping a button casts at the biggest group of zombies, which is how it works on mobile.
- **Click a passive** to turn it on or off.
- **T**: auto-cast.
- Kills show on the leaderboard.

## Using your own zombies

Set `SpawnZombies = false` in `SkillConfig`, then add the tag **`Zombie`** to your zombie models. Use the Tag Editor in Studio's Properties panel, or run `CollectionService:AddTag(model, "Zombie")` in code. Each model needs a `Humanoid` and a `HumanoidRootPart`. Your zombies keep their own AI, and the skills damage, slow, freeze and pull them.

All damage numbers, cooldowns, spawn rates and ranges are at the top of `SkillConfig`.
