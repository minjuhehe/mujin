-- SkillConfig (ModuleScript in ReplicatedStorage)
-- Shared by the server (damage/effects) and the client (skill bar UI).

local Config = {}

Config.Settings = {
	-- Zombies -------------------------------------------------------------
	SpawnZombies = true, -- set to false if your game already spawns its own zombies
	ZombieTag = "Zombie", -- tag your own zombie models with this (CollectionService) so skills can hit them
	MaxZombies = 40,
	SpawnInterval = 1.2, -- seconds between spawns
	SpawnRadiusMin = 60,
	SpawnRadiusMax = 90,
	ZombieBaseHealth = 60,
	ZombieDamage = 10, -- damage per hit to players
	ZombieAttackInterval = 0.8,

	-- Player auto-attack (this is what triggers the passive effects) -------
	AutoAttack = true,
	AttackRange = 70,
	AttackInterval = 0.3,
	BulletDamage = 12,

	-- Skills --------------------------------------------------------------
	MaxCastRange = 150, -- active skills can't be cast further than this from the player
	ScalingPerSecond = 1 / 70, -- damage and zombie HP grow over time
	MaxScaling = 6,
}

-- type = "passive": applied on every auto-attack hit, toggled on/off from the skill bar
-- type = "active": cast with keys 1-6 or by pressing the button
Config.Skills = {
	{ id = "lifesteal", name = "Void Devour", th = "ดูดเลือด", icon = "🧛", type = "passive", color = Color3.fromRGB(180, 108, 255) },
	{ id = "bleed", name = "Bleed", th = "เลือดไหล", icon = "🩸", type = "passive", color = Color3.fromRGB(224, 32, 58) },
	{ id = "inferno", name = "Inferno", th = "ไฟลุก", icon = "🔥", type = "passive", color = Color3.fromRGB(255, 122, 26) },
	{ id = "frost", name = "Frost", th = "เยือกแข็ง", icon = "❄️", type = "passive", color = Color3.fromRGB(127, 216, 255) },
	{ id = "explosive", name = "Explosive", th = "ระเบิด", icon = "💥", type = "passive", color = Color3.fromRGB(255, 179, 71) },
	{ id = "electric", name = "Electric", th = "ช็อต", icon = "⚡", type = "passive", color = Color3.fromRGB(111, 243, 255) },
	{ id = "toxic", name = "Toxic", th = "พิษ", icon = "☣️", type = "passive", color = Color3.fromRGB(125, 255, 74) },

	{ id = "blackhole", name = "Black Hole", th = "หลุมดำ", icon = "🕳️", type = "active", key = Enum.KeyCode.One, keyLabel = "1", cd = 12, color = Color3.fromRGB(155, 92, 255) },
	{ id = "meteor", name = "Meteor", th = "อุกกาบาต", icon = "☄️", type = "active", key = Enum.KeyCode.Two, keyLabel = "2", cd = 6, color = Color3.fromRGB(255, 90, 31) },
	{ id = "voidrift", name = "Void Rift", th = "ประตูมิติ", icon = "🌀", type = "active", key = Enum.KeyCode.Three, keyLabel = "3", cd = 9, color = Color3.fromRGB(192, 77, 255) },
	{ id = "starblade", name = "Starblade", th = "ดาวตก", icon = "🌠", type = "active", key = Enum.KeyCode.Four, keyLabel = "4", cd = 7, color = Color3.fromRGB(122, 168, 255) },
	{ id = "divine", name = "Divine Wrath", th = "แสงทองรอบตัว", icon = "☀️", type = "active", key = Enum.KeyCode.Five, keyLabel = "5", cd = 10, color = Color3.fromRGB(255, 213, 74) },
	{ id = "judgement", name = "Judgement", th = "ลำแสงพิพากษา", icon = "⚖️", type = "active", key = Enum.KeyCode.Six, keyLabel = "6", cd = 8, color = Color3.fromRGB(255, 226, 122) },
}

Config.ById = {}
for _, s in ipairs(Config.Skills) do
	Config.ById[s.id] = s
end

return Config
