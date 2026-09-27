-- SkillServer (Script in ServerScriptService)
-- Server-authoritative skill system: damage, status effects, zombie spawning/AI and all skill visuals.
-- Visuals are built from Parts / ParticleEmitters / Beams on the server, so they replicate to every player.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

print("[SkillServer] started")
local configModule = ReplicatedStorage:WaitForChild("SkillConfig", 10)
if not configModule then
	error("[SkillServer] SkillConfig not found. Put a ModuleScript named SkillConfig in ReplicatedStorage.")
end
local Config = require(configModule)
local S = Config.Settings

-- =====================================================================
-- Remotes and folders
-- =====================================================================
local remoteFolder = ReplicatedStorage:FindFirstChild("SkillRemotes") or Instance.new("Folder")
remoteFolder.Name = "SkillRemotes"

local function getRemote(name)
	local r = remoteFolder:FindFirstChild(name) or Instance.new("RemoteEvent")
	r.Name = name
	r.Parent = remoteFolder
	return r
end

local CastSkill = getRemote("CastSkill") -- client -> server: (skillId, targetPosition)
local TogglePassive = getRemote("TogglePassive") -- client -> server: (skillId, enabled)
local CooldownEvent = getRemote("Cooldown") -- server -> client: (skillId, seconds)
local FX = getRemote("SkillFX") -- server -> clients: ("shake" | "flash", position, ...)
remoteFolder.Parent = ReplicatedStorage

local function getFolder(name)
	local f = workspace:FindFirstChild(name) or Instance.new("Folder")
	f.Name = name
	f.Parent = workspace
	return f
end

local fxFolder = getFolder("SkillFX")
local zombieFolder = getFolder("Zombies")

-- =====================================================================
-- Helpers
-- =====================================================================
local RNG = Random.new()
local TAU = math.pi * 2

local function rand(a, b)
	return RNG:NextNumber(a, b)
end

local startClock = os.clock()
local function mult()
	return math.min(S.MaxScaling, 1 + (os.clock() - startClock) * S.ScalingPerSecond)
end

local function flat(v)
	return Vector3.new(v.X, 0, v.Z)
end

local function flatDist(a, b)
	return flat(a - b).Magnitude
end

local C = {
	white = Color3.fromRGB(255, 255, 255),
	black = Color3.fromRGB(0, 0, 0),
	bleed = Color3.fromRGB(255, 77, 94),
	blood = Color3.fromRGB(150, 0, 18),
	burn = Color3.fromRGB(255, 154, 60),
	fire = Color3.fromRGB(255, 120, 20),
	poison = Color3.fromRGB(157, 255, 106),
	toxic = Color3.fromRGB(90, 220, 40),
	frost = Color3.fromRGB(150, 225, 255),
	ice = Color3.fromRGB(200, 240, 255),
	shock = Color3.fromRGB(143, 244, 255),
	void = Color3.fromRGB(192, 77, 255),
	voidText = Color3.fromRGB(224, 139, 255),
	purple = Color3.fromRGB(155, 92, 255),
	pink = Color3.fromRGB(255, 120, 220),
	blue = Color3.fromRGB(130, 170, 255),
	gold = Color3.fromRGB(255, 213, 74),
	goldPale = Color3.fromRGB(255, 242, 168),
	orange = Color3.fromRGB(255, 138, 31),
	heal = Color3.fromRGB(109, 255, 154),
	star1 = Color3.fromRGB(183, 123, 255),
	star2 = Color3.fromRGB(111, 214, 255),
	scorch = Color3.fromRGB(25, 20, 18),
}

local TEX = {
	spark = "rbxasset://textures/particles/sparkles_main.dds",
	fire = "rbxasset://textures/particles/fire_main.dds",
	smoke = "rbxasset://textures/particles/smoke_main.dds",
}

local function part(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in pairs(props) do
		p[k] = v
	end
	if not p.Parent then
		p.Parent = fxFolder
	end
	return p
end

local function tween(inst, t, props, style, dir)
	local tw = TweenService:Create(inst, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), props)
	tw:Play()
	return tw
end

-- CFrame for a Cylinder part lying flat on the ground (cylinder axis is X, rotate it to Y)
local function flatCF(pos)
	return CFrame.new(pos) * CFrame.Angles(0, 0, math.rad(90))
end

local function light(parent, color, range, brightness)
	local l = Instance.new("PointLight")
	l.Color = color
	l.Range = range
	l.Brightness = brightness or 3
	l.Parent = parent
	return l
end

local function emitter(parent, o)
	local e = Instance.new("ParticleEmitter")
	e.Texture = o.texture or TEX.spark
	e.Color = ColorSequence.new(o.color or C.white, o.color2 or o.color or C.white)
	e.Size = o.size or NumberSequence.new(0.5)
	e.Transparency = o.transparency or NumberSequence.new(0, 1)
	e.Lifetime = o.lifetime or NumberRange.new(0.5)
	e.Speed = o.speed or NumberRange.new(5)
	e.SpreadAngle = o.spread or Vector2.new(180, 180)
	e.Acceleration = o.accel or Vector3.zero
	e.Drag = o.drag or 0
	e.LightEmission = o.light or 1
	e.Rate = o.rate or 0
	e.Rotation = NumberRange.new(0, 360)
	e.RotSpeed = o.rotSpeed or NumberRange.new(-90, 90)
	e.Enabled = (o.rate or 0) > 0
	e.Parent = parent
	return e
end

local function burstAt(pos, o, n)
	local p = part({ Transparency = 1, Size = Vector3.new(0.2, 0.2, 0.2), CFrame = CFrame.new(pos) })
	local e = emitter(p, o)
	e:Emit(n)
	local life = o.lifetime and o.lifetime.Max or 1
	Debris:AddItem(p, life + 0.2)
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude

local function groundAt(pos)
	local ignore = { fxFolder, zombieFolder }
	for _, plr in Players:GetPlayers() do
		if plr.Character then
			table.insert(ignore, plr.Character)
		end
	end
	for _, m in CollectionService:GetTagged(S.ZombieTag) do
		table.insert(ignore, m)
	end
	rayParams.FilterDescendantsInstances = ignore
	local r = workspace:Raycast(pos + Vector3.new(0, 30, 0), Vector3.new(0, -200, 0), rayParams)
	return r and r.Position or Vector3.new(pos.X, pos.Y - 3, pos.Z)
end

local function fxAll(kind, pos, a, b)
	FX:FireAllClients(kind, pos, a, b)
end

-- ----- common visuals -----

local function popText(pos, text, color, size)
	local anchor = part({ Transparency = 1, Size = Vector3.new(0.2, 0.2, 0.2), CFrame = CFrame.new(pos) })
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(120, 40)
	bb.AlwaysOnTop = true
	bb.LightInfluence = 0
	bb.MaxDistance = 150
	bb.Parent = anchor
	local tl = Instance.new("TextLabel")
	tl.BackgroundTransparency = 1
	tl.Size = UDim2.fromScale(1, 1)
	tl.Font = Enum.Font.GothamBlack
	tl.TextSize = size or 22
	tl.Text = text
	tl.TextColor3 = color
	tl.TextStrokeTransparency = 0.3
	tl.Parent = bb
	tween(anchor, 0.8, { CFrame = CFrame.new(pos + Vector3.new(rand(-1, 1), 4, rand(-1, 1))) })
	tween(tl, 0.8, { TextTransparency = 1, TextStrokeTransparency = 1 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
	Debris:AddItem(anchor, 0.85)
end

-- expanding flat shockwave disc
local function ring(groundPos, r0, r1, color, t)
	local p = part({
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.2, r0 * 2, r0 * 2),
		CFrame = flatCF(groundPos + Vector3.new(0, 0.15, 0)),
		Color = color,
		Transparency = 0.25,
	})
	tween(p, t, { Size = Vector3.new(0.2, r1 * 2, r1 * 2), Transparency = 1 })
	Debris:AddItem(p, t + 0.1)
end

-- expanding glowing sphere
local function sphereBurst(pos, radius, color, t)
	local p = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 0.5, CFrame = CFrame.new(pos), Color = color, Transparency = 0.1 })
	light(p, color, radius * 2.5, 5)
	tween(p, t, { Size = Vector3.one * radius * 2, Transparency = 1 })
	Debris:AddItem(p, t + 0.1)
end

local function scorch(pos, r, life, color)
	local g = groundAt(pos)
	local p = part({
		Shape = Enum.PartType.Cylinder,
		Material = Enum.Material.Slate,
		Color = color or C.scorch,
		Size = Vector3.new(0.1, r * 2, r * 2),
		CFrame = flatCF(g + Vector3.new(0, 0.05 + rand(0, 0.04), 0)),
		Transparency = 0.15,
	})
	task.delay(life * 0.6, function()
		if p.Parent then
			tween(p, life * 0.4, { Transparency = 1 })
		end
	end)
	Debris:AddItem(p, life)
end

-- jagged lightning bolt between two points (flickers 3 times)
local function jaggedPoints(a, b, segs, amp)
	local dir = b - a
	if dir.Magnitude < 0.05 then
		return { a, b }
	end
	local u = dir.Unit
	local side = u:Cross(Vector3.yAxis)
	side = side.Magnitude < 0.01 and Vector3.xAxis or side.Unit
	local up = side:Cross(u)
	local pts = { a }
	for i = 1, segs - 1 do
		local t = i / segs
		table.insert(pts, a + dir * t + side * rand(-amp, amp) + up * rand(-amp, amp))
	end
	table.insert(pts, b)
	return pts
end

local function segment(p0, p1, width, color, transparency)
	local len = (p1 - p0).Magnitude
	if len < 0.05 then
		return nil
	end
	return part({
		Size = Vector3.new(width, width, len),
		CFrame = CFrame.lookAt((p0 + p1) / 2, p1),
		Color = color,
		Transparency = transparency or 0,
	})
end

local function lightning(a, b, color)
	task.spawn(function()
		for _ = 1, 3 do
			local pts = jaggedPoints(a, b, 7, 1.2)
			local made = {}
			for i = 1, #pts - 1 do
				table.insert(made, segment(pts[i], pts[i + 1], 0.55, color, 0.45))
				table.insert(made, segment(pts[i], pts[i + 1], 0.18, C.white, 0))
			end
			task.wait(0.07)
			for _, p in made do
				p:Destroy()
			end
		end
	end)
end

-- =====================================================================
-- Zombie registry and status state
-- =====================================================================
local zstate = {} -- [model] = state
local animTracks = {} -- [model] = walk AnimationTrack (spawned zombies only)
local passiveState = {} -- [player] = { lifesteal = true, ... }
local cooldowns = {} -- [player] = { [skillId] = readyClock }

local function alive(st)
	return st and not st.dead and st.hum.Health > 0 and st.root.Parent ~= nil and st.model.Parent ~= nil
end

local function allAlive()
	local list = {}
	for _, st in zstate do
		if alive(st) then
			table.insert(list, st)
		end
	end
	return list
end

local function zombiesNear(pos, radius)
	local list = {}
	for _, st in zstate do
		if alive(st) and flatDist(st.root.Position, pos) < radius then
			table.insert(list, st)
		end
	end
	return list
end

local function damage(st, amount, color, attacker, small)
	if not alive(st) then
		return 0
	end
	if attacker then
		st.lastAttacker = attacker
	end
	local before = st.hum.Health
	st.hum:TakeDamage(amount)
	popText(st.root.Position + Vector3.new(0, 3, 0), tostring(math.max(1, math.floor(amount + 0.5))), color or C.white, small and 16 or 22)
	return math.min(before, amount)
end

local function knock(st, fromPos, power, up)
	if not alive(st) or st.root.Anchored then
		return
	end
	local d = flat(st.root.Position - fromPos)
	if d.Magnitude < 0.1 then
		d = Vector3.new(0, 0, 1)
	end
	local m = st.big and 0.4 or 1
	st.root.AssemblyLinearVelocity = d.Unit * power * m + Vector3.new(0, up or 15, 0)
end

local function knockDir(st, dir, power)
	if not alive(st) or st.root.Anchored then
		return
	end
	local m = st.big and 0.4 or 1
	st.root.AssemblyLinearVelocity = dir * power * m + Vector3.new(0, 18, 0)
end

local function isPassiveOn(player, id)
	local p = player and passiveState[player]
	return p ~= nil and p[id] == true
end

-- ----- status effects -----

local function applyBleed(st)
	st.bleed.n = math.min(5, st.bleed.n + 1)
	st.bleed.t = 4
end

local function applyBurn(st, dur, attacker)
	if attacker then
		st.lastAttacker = st.lastAttacker or attacker
	end
	if st.burn.t <= 0 then
		st.burn.acc = 0
	end
	st.burn.t = math.max(st.burn.t, dur or 3)
end

local function applyPoison(st)
	st.poison.n = math.min(8, st.poison.n + 1)
	st.poison.t = 5
end

local function freeze(st, dur)
	st.freeze = dur
	st.frost.n = 0
	st.frost.t = 0
	popText(st.root.Position + Vector3.new(0, 5, 0), "FROZEN", C.ice, 20)
	local cf, size = st.model:GetBoundingBox()
	if st.ice then
		st.ice:Destroy()
	end
	st.ice = part({
		Material = Enum.Material.Ice,
		Color = C.ice,
		Transparency = 0.35,
		Size = size * 1.15,
		CFrame = cf,
	})
	st.iceOffset = st.root.CFrame:ToObjectSpace(cf)
	st.root.Anchored = true
	burstAt(st.root.Position, {
		color = C.ice,
		size = NumberSequence.new(0.8, 0),
		lifetime = NumberRange.new(0.4, 0.7),
		speed = NumberRange.new(10, 20),
		drag = 3,
	}, 20)
	ring(groundAt(st.root.Position), 1, 7, C.ice, 0.4)
end

local function unfreeze(st)
	st.freeze = 0
	if st.ice then
		local pos = st.ice.Position
		st.ice:Destroy()
		st.ice = nil
		for _ = 1, 8 do
			local shard = part({
				Material = Enum.Material.Ice,
				Color = C.ice,
				Transparency = 0.2,
				Size = Vector3.new(rand(0.4, 0.9), rand(0.4, 0.9), rand(0.4, 0.9)),
				CFrame = CFrame.new(pos + Vector3.new(rand(-1, 1), rand(0, 2), rand(-1, 1))),
				Anchored = false,
				CanCollide = true,
			})
			shard.AssemblyLinearVelocity = Vector3.new(rand(-18, 18), rand(10, 25), rand(-18, 18))
			Debris:AddItem(shard, 1.5)
		end
	end
	if st.root.Parent then
		st.root.Anchored = false
		pcall(function()
			st.root:SetNetworkOwner(nil)
		end)
	end
end

local function applyFrost(st)
	if st.freeze > 0 then
		return
	end
	st.frost.n += 1
	st.frost.t = 3
	if st.frost.n >= 5 then
		freeze(st, 1.6)
	end
end

-- per-zombie looping visuals (created once, toggled on/off)
local function ensureFx(st)
	if st.fx then
		return st.fx
	end
	local att = Instance.new("Attachment")
	att.Name = "SkillFxAttachment"
	att.Parent = st.root

	local fire = Instance.new("Fire")
	fire.Heat = 9
	fire.Size = st.big and 7 or 5
	fire.Color = C.fire
	fire.SecondaryColor = Color3.fromRGB(200, 40, 10)
	fire.Enabled = false
	fire.Parent = st.root

	local hl = Instance.new("Highlight")
	hl.DepthMode = Enum.HighlightDepthMode.Occluded
	hl.OutlineTransparency = 0.4
	hl.Enabled = false
	hl.Parent = st.model

	st.fx = {
		att = att,
		fire = fire,
		highlight = hl,
		bleed = emitter(att, {
			texture = TEX.smoke,
			color = C.blood,
			size = NumberSequence.new(0.35, 0.15),
			transparency = NumberSequence.new(0, 0.2),
			lifetime = NumberRange.new(0.6, 0.9),
			speed = NumberRange.new(2, 5),
			accel = Vector3.new(0, -40, 0),
			light = 0,
			rate = 1,
		}),
		poison = emitter(att, {
			texture = TEX.smoke,
			color = C.poison,
			color2 = C.toxic,
			size = NumberSequence.new(0.3, 0.8),
			lifetime = NumberRange.new(0.8, 1.2),
			speed = NumberRange.new(2, 4),
			spread = Vector2.new(40, 40),
			accel = Vector3.new(0, 4, 0),
			light = 0.5,
			rate = 1,
		}),
		frost = emitter(att, {
			color = C.ice,
			size = NumberSequence.new(0.35, 0),
			lifetime = NumberRange.new(0.8, 1.2),
			speed = NumberRange.new(1, 2),
			accel = Vector3.new(0, -3, 0),
			rate = 10,
		}),
		shock = emitter(att, {
			color = C.shock,
			color2 = C.white,
			size = NumberSequence.new(0.5, 0),
			lifetime = NumberRange.new(0.1, 0.25),
			speed = NumberRange.new(10, 20),
			rate = 40,
		}),
	}
	for _, key in { "bleed", "poison", "frost", "shock" } do
		st.fx[key].Enabled = false
	end
	return st.fx
end

local function updateFx(st)
	local fx = ensureFx(st)
	fx.fire.Enabled = st.burn.t > 0
	fx.bleed.Enabled = st.bleed.t > 0
	fx.bleed.Rate = 6 * st.bleed.n
	fx.poison.Enabled = st.poison.t > 0
	fx.poison.Rate = 3 * st.poison.n
	fx.frost.Enabled = st.frost.t > 0 or st.freeze > 0
	fx.shock.Enabled = st.shock > 0

	local hl = fx.highlight
	if st.freeze > 0 then
		hl.Enabled, hl.FillColor, hl.OutlineColor, hl.FillTransparency = true, C.ice, C.white, 0.3
	elseif st.shock > 0 then
		hl.Enabled, hl.FillColor, hl.OutlineColor, hl.FillTransparency = true, C.shock, C.white, 0.4
	elseif st.frost.t > 0 then
		hl.Enabled, hl.FillColor, hl.OutlineColor, hl.FillTransparency = true, C.frost, C.frost, 0.75 - 0.06 * st.frost.n
	elseif st.poison.t > 0 then
		hl.Enabled, hl.FillColor, hl.OutlineColor, hl.FillTransparency = true, C.toxic, C.poison, 0.75 - 0.03 * st.poison.n
	elseif st.burn.t > 0 then
		hl.Enabled, hl.FillColor, hl.OutlineColor, hl.FillTransparency = true, C.fire, C.burn, 0.7
	elseif st.bleed.t > 0 then
		hl.Enabled, hl.FillColor, hl.OutlineColor, hl.FillTransparency = true, C.blood, C.bleed, 0.75
	else
		hl.Enabled = false
	end
end

local function clearFx(st)
	if st.fx then
		st.fx.fire.Enabled = false
		st.fx.highlight.Enabled = false
		for _, key in { "bleed", "poison", "frost", "shock" } do
			st.fx[key].Enabled = false
		end
	end
	if st.ice then
		st.ice:Destroy()
		st.ice = nil
	end
end

-- =====================================================================
-- Lifesteal (Void Devour) orbs, bullets, toxic clouds
-- =====================================================================
local souls = {}
local bullets = {}
local clouds = {}
local healAcc = {}

local function heal(player, amount)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not hum or not root or hum.Health <= 0 then
		return
	end
	hum.Health = math.min(hum.MaxHealth, hum.Health + amount)
	healAcc[player] = (healAcc[player] or 0) + amount
	burstAt(root.Position, {
		color = C.heal,
		size = NumberSequence.new(0.5, 0),
		lifetime = NumberRange.new(0.5, 0.8),
		speed = NumberRange.new(3, 6),
		accel = Vector3.new(0, 8, 0),
	}, 4)
	if RNG:NextNumber() < 0.35 then
		ring(groundAt(root.Position), 1, 5, C.heal, 0.35)
	end
end

local function spawnSoul(pos, player, value, big)
	local size = big and 1.6 or 0.9
	local p = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * size, CFrame = CFrame.new(pos), Color = big and C.voidText or C.void })
	light(p, C.void, big and 10 or 6, 2)
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, size * 0.4, 0)
	a0.Parent = p
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -size * 0.4, 0)
	a1.Parent = p
	local trail = Instance.new("Trail")
	trail.Attachment0, trail.Attachment1 = a0, a1
	trail.Color = ColorSequence.new(C.voidText, C.purple)
	trail.Transparency = NumberSequence.new(0.2, 1)
	trail.Lifetime = 0.3
	trail.LightEmission = 1
	trail.Parent = p
	-- wisps being devoured out of the zombie
	burstAt(pos, {
		color = Color3.fromRGB(138, 61, 255),
		size = NumberSequence.new(0.5, 0),
		lifetime = NumberRange.new(0.3, 0.6),
		speed = NumberRange.new(2, 6),
		accel = Vector3.new(0, 6, 0),
	}, big and 12 or 4)
	table.insert(souls, {
		part = p,
		pos = pos,
		vel = Vector3.new(rand(-25, 25), rand(8, 25), rand(-25, 25)),
		player = player,
		value = value,
		life = 3,
	})
end

local function updateSouls(dt)
	for i = #souls, 1, -1 do
		local o = souls[i]
		local char = o.player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		o.life -= dt
		local done = false
		if not root or o.life <= 0 or not o.player.Parent then
			done = true
			if root then
				heal(o.player, o.value)
			end
		else
			local d = root.Position - o.pos
			if d.Magnitude < 2.5 then
				heal(o.player, o.value)
				done = true
			else
				o.vel += d.Unit * 180 * dt
				o.vel *= math.max(0, 1 - 2.5 * dt)
				o.pos += o.vel * dt
				o.part.CFrame = CFrame.new(o.pos)
			end
		end
		if done then
			o.part:Destroy()
			table.remove(souls, i)
		end
	end
end

local function flushHeals()
	for player, amount in healAcc do
		if amount >= 1 then
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
			if root then
				popText(root.Position + Vector3.new(0, 4, 0), "+" .. math.floor(amount + 0.5), C.heal, 22)
			end
			healAcc[player] = 0
		end
	end
end

local function spawnToxicCloud(pos, radius, player)
	local g = groundAt(pos)
	local base = part({
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.2, radius * 2, radius * 2),
		CFrame = flatCF(g + Vector3.new(0, 0.1, 0)),
		Color = C.toxic,
		Transparency = 0.75,
	})
	local holder = part({ Transparency = 1, Size = Vector3.new(radius * 1.6, 2, radius * 1.6), CFrame = CFrame.new(g + Vector3.new(0, 1.5, 0)) })
	local em = emitter(holder, {
		texture = TEX.smoke,
		color = C.poison,
		color2 = C.toxic,
		size = NumberSequence.new(3, 6),
		transparency = NumberSequence.new(0.55, 1),
		lifetime = NumberRange.new(1.5, 2.2),
		speed = NumberRange.new(0.5, 2),
		spread = Vector2.new(180, 20),
		light = 0.3,
		rate = 25,
	})
	em.Shape = Enum.ParticleEmitterShape.Box
	table.insert(clouds, { pos = g, r = radius, t = 3.5, acc = 0, player = player, parts = { base, holder } })
end

local function updateClouds(dt)
	for i = #clouds, 1, -1 do
		local c = clouds[i]
		c.t -= dt
		c.acc += dt
		if c.acc >= 0.5 then
			c.acc -= 0.5
			for _, st in zombiesNear(c.pos, c.r) do
				damage(st, 4 * mult(), C.poison, c.player, true)
				if alive(st) then
					applyPoison(st)
				end
			end
		end
		if c.t <= 0 then
			for _, p in c.parts do
				p:Destroy()
			end
			table.remove(clouds, i)
		end
	end
end

-- =====================================================================
-- Combat primitives
-- =====================================================================
local function explode(pos, radius, dmg, player, o)
	o = o or {}
	for _, st in zombiesNear(pos, radius) do
		local f = 1 - 0.5 * math.min(1, flatDist(st.root.Position, pos) / radius)
		damage(st, dmg * f, o.text or C.burn, player)
		if alive(st) then
			knock(st, pos, o.knock or 40, 20)
			if o.burn then
				applyBurn(st, 3, player)
			end
		end
	end
	sphereBurst(pos, radius, o.c2 or C.orange, 0.35)
	sphereBurst(pos, radius * 0.5, o.c1 or C.goldPale, 0.25)
	local g = groundAt(pos)
	ring(g, 1, radius * 1.2, o.c2 or C.orange, 0.4)
	burstAt(pos, {
		color = o.c1 or C.goldPale,
		color2 = o.c2 or C.orange,
		size = NumberSequence.new(0.8, 0),
		lifetime = NumberRange.new(0.3, 0.6),
		speed = NumberRange.new(radius * 2, radius * 4),
		drag = 4,
	}, math.floor(math.min(40, radius * 2)))
	if o.smoke ~= false then
		burstAt(pos, {
			texture = TEX.smoke,
			color = Color3.fromRGB(60, 58, 64),
			size = NumberSequence.new(2, 5),
			transparency = NumberSequence.new(0.4, 1),
			lifetime = NumberRange.new(0.8, 1.4),
			speed = NumberRange.new(4, 12),
			drag = 2,
			light = 0,
		}, math.floor(radius))
	end
	if o.scorch ~= false then
		scorch(pos, radius * 0.55, 8)
	end
	fxAll("shake", pos, o.shake or radius / 5, 90)
end

local function chainLightning(player, origin, originPos, jumps, dmg)
	local used = { [origin] = true }
	local cur = originPos
	for _ = 1, jumps do
		local best, bestDist = nil, 18
		for _, st in allAlive() do
			if not used[st] then
				local d = (st.root.Position - cur).Magnitude
				if d < bestDist then
					best, bestDist = st, d
				end
			end
		end
		if not best then
			break
		end
		used[best] = true
		local bp = best.root.Position
		lightning(cur, bp, C.shock)
		damage(best, dmg, C.shock, player)
		if alive(best) then
			best.shock = 0.4
		end
		burstAt(bp, {
			color = C.white,
			color2 = C.shock,
			size = NumberSequence.new(0.4, 0),
			lifetime = NumberRange.new(0.15, 0.35),
			speed = NumberRange.new(15, 30),
			drag = 3,
		}, 10)
		cur = bp
	end
end

local function onBulletHit(player, st)
	local m = mult()
	local pos = st.root.Position
	local dealt = damage(st, S.BulletDamage * m, C.white, player)
	knock(st, player.Character and player.Character:GetPivot().Position or pos, 8, 2)
	local on = passiveState[player] or {}
	if on.lifesteal then
		spawnSoul(pos, player, dealt * 0.3 + 0.5, false)
	end
	if alive(st) then
		if on.bleed then
			applyBleed(st)
		end
		if on.inferno then
			applyBurn(st, 3, player)
		end
		if on.frost then
			applyFrost(st)
		end
		if on.toxic then
			applyPoison(st)
		end
	end
	if on.explosive and RNG:NextNumber() < 0.22 then
		explode(pos, 10, 22 * m, player, { shake = 1.5 })
	end
	if on.electric and RNG:NextNumber() < 0.3 then
		chainLightning(player, st, pos, 5, 14 * m)
	end
end

local function fireBullet(player, root, target)
	local dir = (target.root.Position - root.Position).Unit
	local start = root.Position + dir * 2 + Vector3.new(0, 0.5, 0)
	local p = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 0.6, CFrame = CFrame.new(start), Color = C.goldPale })
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, 0.2, 0)
	a0.Parent = p
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -0.2, 0)
	a1.Parent = p
	local trail = Instance.new("Trail")
	trail.Attachment0, trail.Attachment1 = a0, a1
	trail.Color = ColorSequence.new(C.goldPale, C.orange)
	trail.Transparency = NumberSequence.new(0, 1)
	trail.Lifetime = 0.12
	trail.LightEmission = 1
	trail.Parent = p
	table.insert(bullets, { part = p, pos = start, target = target, player = player, life = 1.5 })
end

local function updateBullets(dt)
	for i = #bullets, 1, -1 do
		local b = bullets[i]
		b.life -= dt
		local done = b.life <= 0 or not alive(b.target) or not b.player.Parent
		if not done then
			local d = b.target.root.Position - b.pos
			local step = 140 * dt
			if d.Magnitude <= math.max(2, step) then
				onBulletHit(b.player, b.target)
				done = true
			else
				b.pos += d.Unit * step
				b.part.CFrame = CFrame.new(b.pos)
			end
		end
		if done then
			b.part:Destroy()
			table.remove(bullets, i)
		end
	end
end

-- =====================================================================
-- Zombie death / registration
-- =====================================================================
local function onZombieDied(st)
	if st.dead then
		return
	end
	st.dead = true
	local pos = st.root.Position
	local attacker = st.lastAttacker

	if attacker and attacker.Parent then
		local ls = attacker:FindFirstChild("leaderstats")
		local kills = ls and ls:FindFirstChild("Kills")
		if kills then
			kills.Value += 1
		end
	end

	-- Toxic: poisoned zombies leave a poison cloud behind
	if st.poison.n > 0 then
		spawnToxicCloud(pos, 7 + st.poison.n * 0.6, attacker)
	end
	-- Inferno: burning zombies burst into flames and ignite neighbours
	if st.burn.t > 0 then
		burstAt(pos, {
			texture = TEX.fire,
			color = C.goldPale,
			color2 = C.fire,
			size = NumberSequence.new(2, 0),
			lifetime = NumberRange.new(0.4, 0.7),
			speed = NumberRange.new(8, 16),
			drag = 2,
		}, 25)
		for _, o in zombiesNear(pos, 10) do
			applyBurn(o, 2.5, attacker)
		end
	end
	-- Void Devour: bigger soul on kill
	if isPassiveOn(attacker, "lifesteal") then
		spawnSoul(pos, attacker, 3 + st.hum.MaxHealth * 0.03, true)
	end

	scorch(pos, st.big and 3.5 or 2.5, 10, Color3.fromRGB(60, 80, 35))
	clearFx(st)
	if st.root.Anchored then
		st.root.Anchored = false
	end
	if st.model:GetAttribute("SkillDemoZombie") then
		Debris:AddItem(st.model, 2.5)
	end
end

local function register(model)
	if zstate[model] or not model:IsA("Model") then
		return
	end
	local hum = model:FindFirstChildOfClass("Humanoid") or model:WaitForChild("Humanoid", 5)
	local root = model:FindFirstChild("HumanoidRootPart") or model:WaitForChild("HumanoidRootPart", 5)
	if not hum or not root or zstate[model] then
		return
	end
	local st = {
		model = model,
		hum = hum,
		root = root,
		big = model:GetAttribute("Big") == true,
		baseSpeed = hum.WalkSpeed,
		bleed = { n = 0, t = 0, acc = 0 },
		burn = { t = 0, acc = 0 },
		poison = { n = 0, t = 0, acc = 0 },
		frost = { n = 0, t = 0 },
		freeze = 0,
		shock = 0,
		atkCd = 0,
	}
	zstate[model] = st
	pcall(function()
		root:SetNetworkOwner(nil)
	end)
	hum.Died:Connect(function()
		onZombieDied(st)
	end)
	model.AncestryChanged:Connect(function(_, parent)
		if not parent then
			clearFx(st)
			zstate[model] = nil
			animTracks[model] = nil
		end
	end)
end

CollectionService:GetInstanceAddedSignal(S.ZombieTag):Connect(register)
for _, m in CollectionService:GetTagged(S.ZombieTag) do
	task.spawn(register, m)
end

-- per-frame status ticking
local function tickStatus(st, dt)
	local m = mult()

	local b = st.bleed
	if b.t > 0 then
		b.t -= dt
		b.acc += dt
		if b.acc >= 0.5 then
			b.acc -= 0.5
			damage(st, 2 * b.n * m, C.bleed, nil, true)
			if not alive(st) then
				return
			end
		end
		if b.t <= 0 then
			b.n, b.acc = 0, 0
		end
	end

	local f = st.burn
	if f.t > 0 then
		f.t -= dt
		f.acc += dt
		if f.acc >= 0.5 then
			f.acc -= 0.5
			damage(st, 5 * m, C.burn, nil, true)
			if not alive(st) then
				return
			end
			if RNG:NextNumber() < 0.2 then
				for _, o in zombiesNear(st.root.Position, 8) do
					if o ~= st and o.burn.t <= 0 then
						applyBurn(o, 2.5, st.lastAttacker)
						burstAt((st.root.Position + o.root.Position) / 2, {
							texture = TEX.fire,
							color = C.goldPale,
							color2 = C.fire,
							size = NumberSequence.new(1.5, 0),
							lifetime = NumberRange.new(0.3, 0.5),
							speed = NumberRange.new(3, 6),
						}, 10)
						break
					end
				end
			end
		end
	end

	local p = st.poison
	if p.t > 0 then
		p.t -= dt
		p.acc += dt
		if p.acc >= 0.5 then
			p.acc -= 0.5
			damage(st, 1.25 * p.n * m, C.poison, nil, true)
			if not alive(st) then
				return
			end
		end
		if p.t <= 0 then
			p.n, p.acc = 0, 0
		end
	end

	if st.frost.t > 0 then
		st.frost.t -= dt
		if st.frost.t <= 0 then
			st.frost.n = 0
		end
	end
	if st.freeze > 0 then
		st.freeze -= dt
		if st.freeze <= 0 then
			unfreeze(st)
		elseif st.ice and st.iceOffset then
			st.ice.CFrame = st.root.CFrame * st.iceOffset
		end
	end
	if st.shock > 0 then
		st.shock -= dt
	end

	local speed = st.baseSpeed
	if st.freeze > 0 or st.shock > 0 then
		speed = 0
	elseif st.frost.t > 0 then
		speed *= math.max(0.35, 1 - 0.13 * st.frost.n)
	end
	if st.hum.WalkSpeed ~= speed then
		st.hum.WalkSpeed = speed
	end
	local track = animTracks[st.model]
	if track then
		track:AdjustSpeed(speed > 0 and speed / 12 or 0)
	end

	updateFx(st)
end

-- =====================================================================
-- ACTIVE SKILLS
-- =====================================================================

-- 1. Black Hole: pulls zombies in, damages the core, collapses into an explosion
local function castBlackhole(player, target)
	local center = groundAt(target) + Vector3.new(0, 5, 0)
	local R, dur = 35, 3.5
	local m = mult()

	local core = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 0.2, Material = Enum.Material.SmoothPlastic, Color = C.black, CFrame = CFrame.new(center) })
	local horizon = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 0.2, Material = Enum.Material.ForceField, Color = C.voidText, CFrame = CFrame.new(center) })
	local lens = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 0.2, Material = Enum.Material.ForceField, Color = Color3.fromRGB(90, 40, 200), Transparency = 0.3, CFrame = CFrame.new(center) })
	light(core, C.purple, 35, 5)
	tween(core, 0.35, { Size = Vector3.one * 6 }, Enum.EasingStyle.Back)
	tween(horizon, 0.35, { Size = Vector3.one * 8 })
	tween(lens, 0.5, { Size = Vector3.one * R * 1.2 })

	-- particles sucked inward from a big invisible sphere
	local sucker = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * R * 1.4, Transparency = 1, CFrame = CFrame.new(center) })
	local em = emitter(sucker, {
		color = C.voidText,
		color2 = C.pink,
		size = NumberSequence.new(0.7, 0.1),
		lifetime = NumberRange.new(1, 1.4),
		speed = NumberRange.new(18, 26),
		rate = 90,
	})
	em.Shape = Enum.ParticleEmitterShape.Sphere
	em.ShapeInOut = Enum.ParticleEmitterShapeInOut.Inward
	em.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface

	-- accretion disk: glowing orbs spinning in two tilted rings
	local orbs = {}
	local colors = { C.purple, C.pink, C.blue, Color3.fromRGB(255, 200, 140) }
	for i = 1, 30 do
		local inner = i <= 16
		table.insert(orbs, {
			p = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * rand(0.5, 1.1), Color = colors[(i % 4) + 1], CFrame = CFrame.new(center) }),
			a = rand(0, TAU),
			r = (inner and 6 or 8.5) + rand(-0.7, 0.7),
			w = inner and 5 or 3.2,
		})
	end
	local tilt = CFrame.new(center) * CFrame.Angles(math.rad(20), 0, math.rad(rand(-15, 15)))

	local t, acc = 0, 0
	local conn
	conn = RunService.Heartbeat:Connect(function(dt)
		t += dt
		local k = math.min(1, t / 0.35)
		for _, o in orbs do
			o.a += o.w * dt
			o.p.CFrame = tilt * CFrame.new(math.cos(o.a) * o.r * k, 0, math.sin(o.a) * o.r * k)
		end
		for _, st in zombiesNear(center, R) do
			local d = flat(center - st.root.Position)
			local dist = d.Magnitude
			if dist > 1.5 then
				local s = 1 - dist / R
				local u = d.Unit
				local move = math.min(dist - 1.5, (10 + 40 * s) * dt)
				local tangent = Vector3.new(-u.Z, 0, u.X) * s * 14 * dt
				st.root.CFrame += u * move + tangent
			end
		end
		acc += dt
		if acc >= 0.2 then
			acc -= 0.2
			for _, st in zombiesNear(center, 7) do
				damage(st, 10 * m, C.voidText, player, true)
			end
		end
		if t >= dur then
			conn:Disconnect()
			for _, o in orbs do
				o.p:Destroy()
			end
			core:Destroy()
			horizon:Destroy()
			lens:Destroy()
			sucker:Destroy()
			explode(center, 16, 90 * m, player, { c1 = C.white, c2 = C.purple, text = C.voidText, knock = 70, shake = 4, smoke = false })
			ring(groundAt(center), 2, 28, C.voidText, 0.5)
			fxAll("flash", center, C.purple, 80)
		end
	end)
end

-- 2. Meteor: warning circle, fiery meteor falls, crater + burning ground
local function castMeteor(player, target)
	local g = groundAt(target)
	local R, fall = 18, 0.85
	local m = mult()

	local warnCircle = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.15, R * 2, R * 2), CFrame = flatCF(g + Vector3.new(0, 0.1, 0)), Color = Color3.fromRGB(255, 60, 0), Transparency = 0.75 })
	local shrink = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.2, R * 2, R * 2), CFrame = flatCF(g + Vector3.new(0, 0.15, 0)), Color = Color3.fromRGB(255, 200, 120), Transparency = 0.6 })
	tween(warnCircle, fall, { Transparency = 0.45 })
	tween(shrink, fall, { Size = Vector3.new(0.2, 1, 1) }, Enum.EasingStyle.Linear)

	local start = g + Vector3.new(50, 110, 20)
	local rock = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 6, Material = Enum.Material.Basalt, Color = Color3.fromRGB(70, 40, 25), CFrame = CFrame.new(start) })
	local glow = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 7.5, Color = C.orange, Transparency = 0.5, CFrame = CFrame.new(start) })
	light(rock, C.orange, 45, 6)
	local fire = Instance.new("Fire")
	fire.Size = 15
	fire.Heat = 25
	fire.Color = C.orange
	fire.SecondaryColor = Color3.fromRGB(200, 40, 0)
	fire.Parent = rock
	emitter(rock, {
		texture = TEX.fire,
		color = C.goldPale,
		color2 = C.fire,
		size = NumberSequence.new(4, 0),
		lifetime = NumberRange.new(0.4, 0.7),
		speed = NumberRange.new(1, 3),
		rate = 150,
	})
	emitter(rock, {
		texture = TEX.smoke,
		color = Color3.fromRGB(50, 45, 45),
		size = NumberSequence.new(3, 6),
		transparency = NumberSequence.new(0.3, 1),
		lifetime = NumberRange.new(0.8, 1.2),
		speed = NumberRange.new(0.5, 1),
		light = 0,
		rate = 40,
	})

	local t = 0
	local conn
	conn = RunService.Heartbeat:Connect(function(dt)
		t += dt
		local p = math.min(1, t / fall)
		local pos = start:Lerp(g, p * p)
		rock.CFrame = CFrame.new(pos)
		glow.CFrame = CFrame.new(pos)
		if p < 1 then
			return
		end
		conn:Disconnect()
		rock:Destroy()
		glow:Destroy()
		warnCircle:Destroy()
		shrink:Destroy()

		local impact = g + Vector3.new(0, 2, 0)
		explode(impact, R, 150 * m, player, { burn = true, knock = 60, shake = 6, scorch = false })
		fxAll("flash", impact, C.orange, 90)

		-- crater with glowing lava
		local crater = part({ Shape = Enum.PartType.Cylinder, Material = Enum.Material.Basalt, Color = Color3.fromRGB(30, 22, 18), Size = Vector3.new(0.3, 22, 22), CFrame = flatCF(g + Vector3.new(0, 0.05, 0)) })
		local lava = part({ Shape = Enum.PartType.Cylinder, Material = Enum.Material.Neon, Color = C.fire, Transparency = 0.2, Size = Vector3.new(0.35, 12, 12), CFrame = flatCF(g + Vector3.new(0, 0.08, 0)) })
		light(lava, C.fire, 25, 4)
		tween(lava, 3, { Transparency = 1, Size = Vector3.new(0.35, 6, 6) })
		task.delay(10, function()
			if crater.Parent then
				tween(crater, 4, { Transparency = 1 })
			end
		end)
		Debris:AddItem(crater, 14)
		Debris:AddItem(lava, 3.1)

		-- flying rock debris
		for _ = 1, 14 do
			local d = part({
				Material = Enum.Material.Basalt,
				Color = Color3.fromRGB(80, 55, 40),
				Size = Vector3.new(rand(0.6, 1.4), rand(0.6, 1.4), rand(0.6, 1.4)),
				CFrame = CFrame.new(impact) * CFrame.Angles(rand(0, TAU), rand(0, TAU), 0),
				Anchored = false,
				CanCollide = true,
			})
			d.AssemblyLinearVelocity = Vector3.new(rand(-35, 35), rand(25, 55), rand(-35, 35))
			Debris:AddItem(d, 3)
		end

		-- burning ground for 2.2s
		local fires = {}
		for _ = 1, 4 do
			local fp = part({ Transparency = 1, Size = Vector3.one, CFrame = CFrame.new(g + Vector3.new(rand(-8, 8), 0.5, rand(-8, 8))) })
			local f = Instance.new("Fire")
			f.Size = rand(6, 10)
			f.Heat = 12
			f.Parent = fp
			table.insert(fires, fp)
		end
		task.spawn(function()
			for _ = 1, 7 do
				task.wait(0.3)
				for _, st in zombiesNear(g, 16) do
					damage(st, 6 * m, C.burn, player, true)
					if alive(st) then
						applyBurn(st, 1.5, player)
					end
				end
			end
			for _, fp in fires do
				fp:Destroy()
			end
		end)
	end)
end

-- 3. Void Rift: purple portal that damages everything inside, tendrils grab zombies
local function castVoidRift(player, target)
	local g = groundAt(target)
	local R, dur = 14, 4.5
	local m = mult()
	local center = g + Vector3.new(0, 6, 0)
	local caster = player.Character and player.Character:GetPivot().Position or center + Vector3.new(0, 0, 10)
	local facing = CFrame.lookAt(center, Vector3.new(caster.X, center.Y, caster.Z))

	-- portal: a flat neon ellipse with a dark centre (SpecialMesh sphere squashed flat)
	local function ellipse(color, material, scale)
		local p = part({ Size = Vector3.one, CFrame = facing, Color = color, Material = material })
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.Sphere
		mesh.Scale = Vector3.new(0, 0, 0)
		mesh.Parent = p
		tween(mesh, 0.4, { Scale = scale }, Enum.EasingStyle.Back)
		return p, mesh
	end
	local outer, outerMesh = ellipse(C.void, Enum.Material.Neon, Vector3.new(8, 13, 0.5))
	local mid, midMesh = ellipse(C.pink, Enum.Material.Neon, Vector3.new(6.8, 11.2, 0.7))
	local inner, innerMesh = ellipse(Color3.fromRGB(10, 0, 20), Enum.Material.SmoothPlastic, Vector3.new(5.6, 9.4, 0.9))
	light(outer, C.void, 30, 4)

	local swirl = emitter(outer, {
		color = C.voidText,
		color2 = C.purple,
		size = NumberSequence.new(0.6, 0),
		lifetime = NumberRange.new(0.6, 1),
		speed = NumberRange.new(4, 9),
		rate = 60,
		rotSpeed = NumberRange.new(-360, 360),
	})
	local sucker = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 16, Transparency = 1, CFrame = CFrame.new(center) })
	local inward = emitter(sucker, {
		color = C.pink,
		color2 = C.void,
		size = NumberSequence.new(0.5, 0),
		lifetime = NumberRange.new(0.6, 0.8),
		speed = NumberRange.new(10, 14),
		rate = 50,
	})
	inward.Shape = Enum.ParticleEmitterShape.Sphere
	inward.ShapeInOut = Enum.ParticleEmitterShapeInOut.Inward

	-- ground rune circle: neon disc with a dark disc on top leaves a glowing ring edge
	local runeOuter = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.12, R * 2, R * 2), CFrame = flatCF(g + Vector3.new(0, 0.08, 0)), Color = C.void, Transparency = 0.3 })
	local runeInner = part({ Shape = Enum.PartType.Cylinder, Material = Enum.Material.SmoothPlastic, Size = Vector3.new(0.14, R * 2 - 1, R * 2 - 1), CFrame = flatCF(g + Vector3.new(0, 0.1, 0)), Color = Color3.fromRGB(30, 5, 50), Transparency = 0.25 })
	local runes = {}
	for i = 1, 8 do
		table.insert(runes, { p = part({ Size = Vector3.new(0.2, 0.3, 1.6), Color = C.voidText }), a = i * TAU / 8 })
	end

	local portalAtt = Instance.new("Attachment")
	portalAtt.Parent = outer
	local tendrils = {} -- [state] = { att, beam, seed }

	local t, acc = 0, 0
	local conn
	local function dropTendril(st)
		local td = tendrils[st]
		if td then
			td.beam:Destroy()
			td.att:Destroy()
			tendrils[st] = nil
		end
	end
	conn = RunService.Heartbeat:Connect(function(dt)
		t += dt
		for _, r in runes do
			r.a += dt * 0.8
			local pos = g + Vector3.new(math.cos(r.a) * (R - 1.5), 0.2, math.sin(r.a) * (R - 1.5))
			r.p.CFrame = CFrame.lookAt(pos, g + Vector3.new(0, 0.2, 0))
		end

		-- tendrils to up to 8 zombies in range, wobbling
		local near = zombiesNear(g, R + 4)
		local keep = {}
		for i, st in near do
			if i > 8 then
				break
			end
			keep[st] = true
			if not tendrils[st] then
				local att = Instance.new("Attachment")
				att.Parent = st.root
				local beam = Instance.new("Beam")
				beam.Attachment0, beam.Attachment1 = portalAtt, att
				beam.Color = ColorSequence.new(C.voidText, C.void)
				beam.LightEmission = 1
				beam.Width0, beam.Width1 = 0.8, 0.2
				beam.Segments = 12
				beam.FaceCamera = true
				beam.Parent = outer
				tendrils[st] = { att = att, beam = beam, seed = rand(0, 10) }
			end
			local td = tendrils[st]
			td.beam.CurveSize0 = math.sin(t * 7 + td.seed) * 6
			td.beam.CurveSize1 = math.cos(t * 5 + td.seed) * 4
			-- slight pull toward the portal
			local d = flat(g - st.root.Position)
			if d.Magnitude > 2 then
				st.root.CFrame += d.Unit * 5 * dt
			end
		end
		for st in tendrils do
			if not keep[st] or not alive(st) then
				dropTendril(st)
			end
		end

		acc += dt
		if acc >= 0.25 then
			acc -= 0.25
			for _, st in zombiesNear(g, R) do
				damage(st, 11 * m, C.voidText, player, true)
			end
		end

		if t >= dur then
			conn:Disconnect()
			for st in tendrils do
				dropTendril(st)
			end
			swirl.Enabled = false
			inward.Enabled = false
			for _, mesh in { outerMesh, midMesh, innerMesh } do
				tween(mesh, 0.4, { Scale = Vector3.zero }, Enum.EasingStyle.Back, Enum.EasingDirection.In)
			end
			tween(runeOuter, 0.4, { Transparency = 1 })
			tween(runeInner, 0.4, { Transparency = 1 })
			sphereBurst(center, 8, C.void, 0.4)
			task.delay(0.45, function()
				for _, p in { outer, mid, inner, sucker, runeOuter, runeInner } do
					p:Destroy()
				end
				for _, r in runes do
					r.p:Destroy()
				end
			end)
		end
	end)
end

-- 4. Starblade: 16 purple/blue shooting stars homing onto zombies
local function castStarblade(player, target)
	local m = mult()
	local cands = zombiesNear(target, 45)
	for i = 1, 16 do
		task.delay((i - 1) * 0.07, function()
			local st = #cands > 0 and cands[RNG:NextInteger(1, #cands)] or nil
			local tp = st and alive(st) and st.root.Position or groundAt(target + Vector3.new(rand(-20, 20), 0, rand(-20, 20))) + Vector3.new(0, 1, 0)
			local color = i % 2 == 0 and C.star1 or C.star2
			local start = tp + Vector3.new(rand(-35, -20), 65, rand(-12, 12))

			local star = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 1.6, Color = C.white, CFrame = CFrame.new(start) })
			local halo = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 3, Color = color, Transparency = 0.5, CFrame = CFrame.new(start) })
			light(star, color, 14, 4)
			local a0 = Instance.new("Attachment")
			a0.Position = Vector3.new(0, 0.7, 0)
			a0.Parent = star
			local a1 = Instance.new("Attachment")
			a1.Position = Vector3.new(0, -0.7, 0)
			a1.Parent = star
			local trail = Instance.new("Trail")
			trail.Attachment0, trail.Attachment1 = a0, a1
			trail.Color = ColorSequence.new(C.white, color)
			trail.Transparency = NumberSequence.new(0, 1)
			trail.Lifetime = 0.35
			trail.LightEmission = 1
			trail.WidthScale = NumberSequence.new(1, 0)
			trail.Parent = star
			emitter(star, {
				color = color,
				color2 = C.white,
				size = NumberSequence.new(0.5, 0),
				lifetime = NumberRange.new(0.3, 0.5),
				speed = NumberRange.new(1, 3),
				rate = 60,
			})

			local t, fall = 0, 0.35
			local conn
			conn = RunService.Heartbeat:Connect(function(dt)
				t += dt
				if st and alive(st) then
					tp = st.root.Position
				end
				local p = math.min(1, t / fall)
				local pos = start:Lerp(tp, p)
				star.CFrame = CFrame.new(pos)
				halo.CFrame = CFrame.new(pos)
				if p >= 1 then
					conn:Disconnect()
					star:Destroy()
					halo:Destroy()
					explode(tp, 7, 38 * m, player, { c1 = C.white, c2 = color, text = color, knock = 25, shake = 1.5, smoke = false, scorch = false })
					burstAt(tp, {
						color = C.white,
						color2 = color,
						size = NumberSequence.new(1, 0),
						lifetime = NumberRange.new(0.4, 0.8),
						speed = NumberRange.new(10, 25),
						drag = 3,
						rotSpeed = NumberRange.new(-300, 300),
					}, 14)
				end
			end)
		end)
	end
end

-- 5. Divine Wrath: 3 waves of golden rays fired in every direction from the player
local function castDivine(player)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then
		return
	end
	local m = mult()
	local N, L = 16, 60
	local step = TAU / N

	local halo = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 4, Material = Enum.Material.ForceField, Color = C.gold, CFrame = root.CFrame })
	local haloLight = light(halo, C.gold, 30, 6)
	local sparkle = emitter(halo, {
		color = C.goldPale,
		color2 = C.gold,
		size = NumberSequence.new(0.5, 0),
		lifetime = NumberRange.new(0.6, 1),
		speed = NumberRange.new(2, 5),
		accel = Vector3.new(0, 6, 0),
		rate = 40,
	})
	tween(halo, 0.3, { Size = Vector3.one * 10 })
	local follow = RunService.Heartbeat:Connect(function()
		if root.Parent then
			halo.CFrame = root.CFrame
		end
	end)

	for wave = 0, 2 do
		task.delay(wave * 0.4, function()
			if not root.Parent then
				return
			end
			local origin = root.Position
			local off = wave * (math.pi / N)
			for k = 0, N - 1 do
				local a = off + k * step
				local dir = Vector3.new(math.cos(a), 0, math.sin(a))
				local mid = origin + dir * (L / 2 + 2)
				local cf = CFrame.lookAt(mid, mid + dir)
				local beam = part({ Size = Vector3.new(1.4, 1.4, L), CFrame = cf, Color = C.gold, Transparency = 0.25 })
				local core = part({ Size = Vector3.new(0.4, 0.4, L), CFrame = cf, Color = C.white })
				tween(beam, 0.5, { Size = Vector3.new(0.1, 0.1, L), Transparency = 1 })
				tween(core, 0.5, { Size = Vector3.new(0.05, 0.05, L), Transparency = 1 })
				Debris:AddItem(beam, 0.55)
				Debris:AddItem(core, 0.55)
			end
			for _, st in zombiesNear(origin, L + 2) do
				local rel = flat(st.root.Position - origin)
				local ang = math.atan2(rel.Z, rel.X)
				local da = (ang - off) % step
				da = math.min(da, step - da)
				if rel.Magnitude * math.sin(da) < 3 then
					damage(st, 48 * m, C.gold, player)
					if alive(st) then
						knock(st, origin, 35, 12)
					end
				end
			end
			ring(groundAt(origin), 2, 25, C.gold, 0.45)
			sphereBurst(origin, 6, C.goldPale, 0.3)
			fxAll("shake", origin, 1.5, 60)
			fxAll("flash", origin, C.gold, 40)
		end)
	end

	task.delay(1.4, function()
		follow:Disconnect()
		sparkle.Enabled = false
		tween(haloLight, 0.3, { Brightness = 0 })
		tween(halo, 0.3, { Size = Vector3.one * 2, Transparency = 1 })
		Debris:AddItem(halo, 0.35)
	end)
end

-- 6. Judgement: charge up, then one huge straight golden beam from the player
local function castJudgement(player, target)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then
		return
	end
	local m = mult()
	local dir = flat(target - root.Position)
	dir = dir.Magnitude > 0.1 and dir.Unit or flat(root.CFrame.LookVector).Unit
	local L, W, charge = 150, 4, 0.55
	root.CFrame = CFrame.lookAt(root.Position, root.Position + dir)

	local aim = part({ Size = Vector3.new(0.15, 0.15, L), Color = C.gold, Transparency = 0.6 })
	local orb = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 0.5, Color = C.goldPale })
	light(orb, C.gold, 20, 4)
	local gather = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 16, Transparency = 1 })
	local ge = emitter(gather, {
		color = C.goldPale,
		color2 = C.gold,
		size = NumberSequence.new(0.5, 0),
		lifetime = NumberRange.new(0.3, 0.4),
		speed = NumberRange.new(18, 24),
		rate = 120,
	})
	ge.Shape = Enum.ParticleEmitterShape.Sphere
	ge.ShapeInOut = Enum.ParticleEmitterShapeInOut.Inward
	local shell = part({ Shape = Enum.PartType.Ball, Size = Vector3.one * 14, Material = Enum.Material.ForceField, Color = C.gold })
	tween(orb, charge, { Size = Vector3.one * 3 })
	tween(shell, charge, { Size = Vector3.one * 4 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)

	local t = 0
	local conn
	conn = RunService.Heartbeat:Connect(function(dt)
		t += dt
		if not root.Parent then
			conn:Disconnect()
			for _, p in { aim, orb, gather, shell } do
				p:Destroy()
			end
			return
		end
		local front = root.Position + dir * 3
		aim.CFrame = CFrame.lookAt(front + dir * (L / 2), front + dir * L)
		aim.Transparency = 0.3 + RNG:NextNumber() * 0.4
		orb.CFrame = CFrame.new(front)
		gather.CFrame = CFrame.new(front)
		shell.CFrame = root.CFrame
		if t < charge then
			return
		end
		conn:Disconnect()
		for _, p in { aim, orb, gather, shell } do
			p:Destroy()
		end

		local origin = root.Position + dir * 2
		local mid = origin + dir * (L / 2)
		-- cylinder axis is X: rotate so it points along the beam direction
		local cf = CFrame.lookAt(mid, mid + dir) * CFrame.Angles(0, math.rad(90), 0)
		local outer = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(L, 1, 1), CFrame = cf, Color = C.gold, Transparency = 0.35 })
		local core = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(L, 0.5, 0.5), CFrame = cf, Color = C.white })
		light(core, C.gold, 40, 8)
		tween(outer, 0.08, { Size = Vector3.new(L, W * 2.4, W * 2.4) })
		tween(core, 0.08, { Size = Vector3.new(L, W * 0.8, W * 0.8) })
		task.delay(0.1, function()
			tween(outer, 0.6, { Size = Vector3.new(L, 0.2, 0.2), Transparency = 1 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			tween(core, 0.6, { Size = Vector3.new(L, 0.1, 0.1), Transparency = 1 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
		end)
		Debris:AddItem(outer, 0.75)
		Debris:AddItem(core, 0.75)
		sphereBurst(origin, 5, C.goldPale, 0.3)

		for _, st in allAlive() do
			local rel = flat(st.root.Position - origin)
			local along = rel:Dot(dir)
			local perp = (rel - dir * along).Magnitude
			if along > -2 and along < L and perp < W + 1.5 then
				damage(st, 260 * m, C.goldPale, player)
				if alive(st) then
					knockDir(st, dir, 90)
				end
			end
		end
		-- golden sparks along the beam
		for i = 1, 8 do
			burstAt(origin + dir * (i * L / 9), {
				color = C.white,
				color2 = C.gold,
				size = NumberSequence.new(0.7, 0),
				lifetime = NumberRange.new(0.3, 0.6),
				speed = NumberRange.new(10, 25),
				drag = 3,
			}, 10)
		end
		fxAll("shake", origin, 7, 120)
		fxAll("flash", origin, C.gold, 120)
	end)
end

local CASTERS = {
	blackhole = castBlackhole,
	meteor = castMeteor,
	voidrift = castVoidRift,
	starblade = castStarblade,
	divine = castDivine,
	judgement = castJudgement,
}

-- =====================================================================
-- Remotes: casting and passive toggles
-- =====================================================================
CastSkill.OnServerEvent:Connect(function(player, id, target)
	local skill = type(id) == "string" and Config.ById[id]
	if not skill or skill.type ~= "active" then
		return
	end
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not hum or not root or hum.Health <= 0 then
		return
	end
	cooldowns[player] = cooldowns[player] or {}
	local now = os.clock()
	if (cooldowns[player][id] or 0) > now then
		return
	end

	-- sanitize the target position
	if typeof(target) ~= "Vector3" or target.X ~= target.X or target.Y ~= target.Y or target.Z ~= target.Z then
		target = root.Position + root.CFrame.LookVector * 25
	end
	local offset = target - root.Position
	if offset.Magnitude > S.MaxCastRange then
		target = root.Position + offset.Unit * S.MaxCastRange
	end

	cooldowns[player][id] = now + skill.cd
	CooldownEvent:FireClient(player, id, skill.cd)
	local ok, err = pcall(CASTERS[id], player, target)
	if not ok then
		warn("[SkillServer] " .. id .. " failed: " .. tostring(err))
	end
end)

TogglePassive.OnServerEvent:Connect(function(player, id, enabled)
	local skill = type(id) == "string" and Config.ById[id]
	if not skill or skill.type ~= "passive" or type(enabled) ~= "boolean" then
		return
	end
	passiveState[player] = passiveState[player] or {}
	passiveState[player][id] = enabled
end)

local function onPlayerAdded(player)
	local on = {}
	for _, s in Config.Skills do
		if s.type == "passive" then
			on[s.id] = true
		end
	end
	passiveState[player] = on
	cooldowns[player] = {}

	if not player:FindFirstChild("leaderstats") then
		local ls = Instance.new("Folder")
		ls.Name = "leaderstats"
		local kills = Instance.new("IntValue")
		kills.Name = "Kills"
		kills.Parent = ls
		ls.Parent = player
	end
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, p in Players:GetPlayers() do
	onPlayerAdded(p)
end
Players.PlayerRemoving:Connect(function(player)
	passiveState[player] = nil
	cooldowns[player] = nil
	healAcc[player] = nil
end)

-- =====================================================================
-- Main loops
-- =====================================================================
local healFlushTimer = 0
RunService.Heartbeat:Connect(function(dt)
	for _, st in allAlive() do
		tickStatus(st, dt)
	end
	updateBullets(dt)
	updateSouls(dt)
	updateClouds(dt)
	healFlushTimer += dt
	if healFlushTimer >= 0.3 then
		healFlushTimer = 0
		flushHeals()
	end
end)

-- player auto-attack: shoots the nearest zombie, which triggers the passives
task.spawn(function()
	while true do
		task.wait(S.AttackInterval)
		if S.AutoAttack then
			for _, player in Players:GetPlayers() do
				local char = player.Character
				local hum = char and char:FindFirstChildOfClass("Humanoid")
				local root = char and char:FindFirstChild("HumanoidRootPart")
				if hum and root and hum.Health > 0 then
					local best, bestDist = nil, S.AttackRange
					for _, st in allAlive() do
						local d = (st.root.Position - root.Position).Magnitude
						if d < bestDist then
							best, bestDist = st, d
						end
					end
					if best then
						fireBullet(player, root, best)
					end
				end
			end
		end
	end
end)

-- =====================================================================
-- Demo zombies (spawner + simple chase AI). Disable with Settings.SpawnZombies = false.
-- =====================================================================
local WALK_ANIM = "rbxassetid://507777826" -- default R15 walk
local template

local function buildTemplate()
	local desc = Instance.new("HumanoidDescription")
	local skin = Color3.fromRGB(110, 140, 80)
	desc.HeadColor = skin
	desc.LeftArmColor = skin
	desc.RightArmColor = skin
	desc.TorsoColor = Color3.fromRGB(70, 60, 50)
	desc.LeftLegColor = Color3.fromRGB(45, 45, 60)
	desc.RightLegColor = Color3.fromRGB(45, 45, 60)
	local ok, model = pcall(function()
		return Players:CreateHumanoidModelFromDescription(desc, Enum.HumanoidRigType.R15)
	end)
	if not ok or not model then
		warn("[SkillServer] Could not build zombie template: " .. tostring(model))
		return
	end
	model.Name = "Zombie"
	print("[SkillServer] zombie template ready, spawning zombies")
	local animate = model:FindFirstChild("Animate")
	if animate then
		animate:Destroy()
	end
	template = model
end

local function spawnZombie()
	local players = Players:GetPlayers()
	if #players == 0 then
		return
	end
	local target = players[RNG:NextInteger(1, #players)]
	local root = target.Character and target.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return
	end
	local a = rand(0, TAU)
	local spot = root.Position + Vector3.new(math.cos(a), 0, math.sin(a)) * rand(S.SpawnRadiusMin, S.SpawnRadiusMax)
	local g = groundAt(spot + Vector3.new(0, 40, 0))

	local z = template:Clone()
	local hum = z:FindFirstChildOfClass("Humanoid")
	local big = RNG:NextNumber() < 0.08
	local lvl = mult()
	hum.MaxHealth = S.ZombieBaseHealth * lvl * (big and 4 or 1)
	hum.Health = hum.MaxHealth
	hum.WalkSpeed = big and 8 or rand(10, 14)
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	if big then
		z:ScaleTo(1.5)
		z:SetAttribute("Big", true)
	end
	z:SetAttribute("SkillDemoZombie", true)
	z:PivotTo(CFrame.new(g + Vector3.new(0, 4, 0)))
	z.Parent = zombieFolder

	local animator = hum:FindFirstChildOfClass("Animator") or Instance.new("Animator")
	animator.Parent = hum
	local anim = Instance.new("Animation")
	anim.AnimationId = WALK_ANIM
	pcall(function()
		local track = animator:LoadAnimation(anim)
		track.Looped = true
		track:Play(0.1)
		animTracks[z] = track
	end)

	CollectionService:AddTag(z, S.ZombieTag)
end

task.spawn(function()
	if not S.SpawnZombies then
		return
	end
	buildTemplate()
	if not template then
		return
	end
	while true do
		task.wait(S.SpawnInterval)
		local count = 0
		for _, st in zstate do
			if alive(st) and st.model:GetAttribute("SkillDemoZombie") then
				count += 1
			end
		end
		if count < S.MaxZombies then
			spawnZombie()
		end
	end
end)

-- chase + melee AI for the demo zombies only (your own zombies keep their own AI)
task.spawn(function()
	while true do
		local dt = task.wait(0.25)
		for _, st in allAlive() do
			if st.model:GetAttribute("SkillDemoZombie") then
				local best, bestDist = nil, math.huge
				for _, player in Players:GetPlayers() do
					local char = player.Character
					local hum = char and char:FindFirstChildOfClass("Humanoid")
					local root = char and char:FindFirstChild("HumanoidRootPart")
					if hum and root and hum.Health > 0 then
						local d = (root.Position - st.root.Position).Magnitude
						if d < bestDist then
							best, bestDist = { hum = hum, root = root }, d
						end
					end
				end
				st.atkCd = math.max(0, st.atkCd - dt)
				if best then
					st.hum:MoveTo(best.root.Position)
					local reach = st.big and 6 or 4.5
					if bestDist < reach and st.freeze <= 0 and st.shock <= 0 and st.atkCd <= 0 then
						st.atkCd = S.ZombieAttackInterval
						best.hum:TakeDamage(S.ZombieDamage * (st.big and 2 or 1))
					end
				end
			end
		end
	end
end)
