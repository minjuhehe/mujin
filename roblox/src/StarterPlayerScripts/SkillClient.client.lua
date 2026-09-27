-- SkillClient (LocalScript in StarterPlayer > StarterPlayerScripts)
-- Builds the skill bar, sends casts / passive toggles to the server, and plays camera shake + flash.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local CollectionService = game:GetService("CollectionService")

local Config = require(ReplicatedStorage:WaitForChild("SkillConfig"))
local S = Config.Settings
local remotes = ReplicatedStorage:WaitForChild("SkillRemotes")
local CastSkill = remotes:WaitForChild("CastSkill")
local TogglePassive = remotes:WaitForChild("TogglePassive")
local CooldownEvent = remotes:WaitForChild("Cooldown")
local FX = remotes:WaitForChild("SkillFX")

local player = Players.LocalPlayer
local mouse = player:GetMouse()
task.spawn(function()
	mouse.TargetFilter = workspace:WaitForChild("SkillFX")
end)

local readyAt = {} -- [skillId] = os.clock() when usable again
local passiveOn = {}
local autoCast = false
for _, s in Config.Skills do
	if s.type == "passive" then
		passiveOn[s.id] = true
	end
end

-- =====================================================================
-- Targeting
-- =====================================================================
local function myRoot()
	local char = player.Character
	return char and char:FindFirstChild("HumanoidRootPart")
end

-- position of the zombie with the most neighbours (used for button taps and auto-cast)
local function densestZombie(maxDist)
	local root = myRoot()
	if not root then
		return nil
	end
	local list = {}
	for _, m in CollectionService:GetTagged(S.ZombieTag) do
		local h = m:FindFirstChildOfClass("Humanoid")
		local r = m:FindFirstChild("HumanoidRootPart")
		if h and r and h.Health > 0 and (r.Position - root.Position).Magnitude < maxDist then
			table.insert(list, r.Position)
		end
	end
	local best, bestCount = nil, -1
	for _, a in list do
		local count = 0
		for _, b in list do
			if (a - b).Magnitude < 15 then
				count += 1
			end
		end
		if count > bestCount then
			best, bestCount = a, count
		end
	end
	return best
end

local function cast(id, fromButton)
	if (readyAt[id] or 0) > os.clock() then
		return
	end
	local root = myRoot()
	if not root then
		return
	end
	local target
	if not fromButton and UserInputService.MouseEnabled then
		target = mouse.Hit.Position
	end
	target = target or densestZombie(S.MaxCastRange) or (root.Position + root.CFrame.LookVector * 25)
	CastSkill:FireServer(id, target)
end

-- =====================================================================
-- UI
-- =====================================================================
local small = workspace.CurrentCamera.ViewportSize.X < 700
local BTN = small and Vector2.new(46, 54) or Vector2.new(64, 76)

local function corner(parent, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = parent
end

local function label(parent, text, size, props)
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Text = text
	l.TextSize = size
	l.Font = Enum.Font.GothamBold
	l.TextColor3 = Color3.fromRGB(232, 236, 243)
	for k, v in pairs(props or {}) do
		l[k] = v
	end
	l.Parent = parent
	return l
end

local function listLayout(parent, dir, pad)
	local l = Instance.new("UIListLayout")
	l.FillDirection = dir
	l.HorizontalAlignment = Enum.HorizontalAlignment.Center
	l.VerticalAlignment = Enum.VerticalAlignment.Center
	l.SortOrder = Enum.SortOrder.LayoutOrder
	l.Padding = UDim.new(0, pad)
	l.Parent = parent
end

local gui = Instance.new("ScreenGui")
gui.Name = "SkillBar"
gui.ResetOnSpawn = false
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = player:WaitForChild("PlayerGui")

local bar = Instance.new("Frame")
bar.AnchorPoint = Vector2.new(0.5, 1)
bar.Position = UDim2.new(0.5, 0, 1, -8)
bar.AutomaticSize = Enum.AutomaticSize.XY
bar.Size = UDim2.new()
bar.BackgroundColor3 = Color3.fromRGB(12, 14, 20)
bar.BackgroundTransparency = 0.25
bar.Parent = gui
corner(bar, 12)
local pad = Instance.new("UIPadding")
pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 6), UDim.new(0, 6)
pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 8), UDim.new(0, 8)
pad.Parent = bar
listLayout(bar, Enum.FillDirection.Vertical, 6)

local function row(order)
	local f = Instance.new("Frame")
	f.BackgroundTransparency = 1
	f.AutomaticSize = Enum.AutomaticSize.XY
	f.Size = UDim2.new()
	f.LayoutOrder = order
	f.Parent = bar
	listLayout(f, Enum.FillDirection.Horizontal, 5)
	return f
end

local topRow = row(1)
local passiveRow = row(2)
local activeRow = row(3)

local autoBtn = Instance.new("TextButton")
autoBtn.Size = UDim2.fromOffset(small and 150 or 190, 26)
autoBtn.BackgroundColor3 = Color3.fromRGB(30, 33, 44)
autoBtn.TextColor3 = Color3.fromRGB(232, 236, 243)
autoBtn.Font = Enum.Font.GothamBold
autoBtn.TextSize = 13
autoBtn.Parent = topRow
corner(autoBtn, 8)
local autoStroke = Instance.new("UIStroke")
autoStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
autoStroke.Parent = autoBtn

local function setAuto(v)
	autoCast = v
	autoBtn.Text = "Auto-cast: " .. (v and "ON" or "OFF") .. " (T)"
	autoStroke.Color = v and Color3.fromRGB(255, 213, 74) or Color3.fromRGB(80, 84, 100)
	autoBtn.TextColor3 = v and Color3.fromRGB(255, 213, 74) or Color3.fromRGB(232, 236, 243)
end
setAuto(false)
autoBtn.Activated:Connect(function()
	setAuto(not autoCast)
end)

local buttons = {}

local function refreshPassive(id)
	local b = buttons[id]
	local on = passiveOn[id]
	b.button.BackgroundTransparency = on and 0 or 0.5
	b.stroke.Transparency = on and 0 or 0.75
	b.icon.TextTransparency = on and 0 or 0.6
	b.name.TextTransparency = on and 0 or 0.6
end

local function togglePassive(id)
	passiveOn[id] = not passiveOn[id]
	TogglePassive:FireServer(id, passiveOn[id])
	refreshPassive(id)
end

for i, s in Config.Skills do
	local b = Instance.new("TextButton")
	b.Text = ""
	b.AutoButtonColor = true
	b.Size = UDim2.fromOffset(BTN.X, BTN.Y)
	b.BackgroundColor3 = Color3.fromRGB(30, 33, 44)
	b.LayoutOrder = i
	b.Parent = s.type == "passive" and passiveRow or activeRow
	corner(b, 10)

	local stroke = Instance.new("UIStroke")
	stroke.Color = s.color
	stroke.Thickness = 2
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	stroke.Parent = b

	local icon = label(b, s.icon, small and 20 or 28, {
		Size = UDim2.new(1, 0, 0.55, 0),
		Position = UDim2.fromOffset(0, 2),
		Font = Enum.Font.GothamBold,
	})
	local name = label(b, s.name, small and 9 or 11, {
		Size = UDim2.new(1, -4, 0.4, 0),
		Position = UDim2.new(0, 2, 0.56, 0),
		TextWrapped = true,
		TextYAlignment = Enum.TextYAlignment.Top,
	})
	if s.keyLabel then
		label(b, s.keyLabel, 11, {
			Size = UDim2.fromOffset(14, 14),
			Position = UDim2.fromOffset(4, 2),
			TextXAlignment = Enum.TextXAlignment.Left,
			TextTransparency = 0.2,
		})
	end

	local cd, cdText
	if s.type == "active" then
		cd = Instance.new("Frame")
		cd.AnchorPoint = Vector2.new(0, 1)
		cd.Position = UDim2.fromScale(0, 1)
		cd.Size = UDim2.fromScale(1, 0)
		cd.BackgroundColor3 = Color3.new(0, 0, 0)
		cd.BackgroundTransparency = 0.3
		cd.ZIndex = 2
		cd.Parent = b
		corner(cd, 10)
		cdText = label(b, "", small and 14 or 18, {
			Size = UDim2.fromScale(1, 1),
			ZIndex = 3,
			Font = Enum.Font.GothamBlack,
			TextStrokeTransparency = 0.4,
		})
	end

	buttons[s.id] = { button = b, stroke = stroke, icon = icon, name = name, cd = cd, cdText = cdText, skill = s }
	b.Activated:Connect(function()
		if s.type == "passive" then
			togglePassive(s.id)
		else
			cast(s.id, true)
		end
	end)
	if s.type == "passive" then
		refreshPassive(s.id)
	end
end

-- =====================================================================
-- Input
-- =====================================================================
local keyToSkill = {}
for _, s in Config.Skills do
	if s.key then
		keyToSkill[s.key] = s.id
	end
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	local id = keyToSkill[input.KeyCode]
	if id then
		cast(id, false)
	elseif input.KeyCode == Enum.KeyCode.T then
		setAuto(not autoCast)
	end
end)

CooldownEvent.OnClientEvent:Connect(function(id, seconds)
	readyAt[id] = os.clock() + seconds
	local b = buttons[id]
	if b then
		b.button.Size = UDim2.fromOffset(BTN.X * 1.1, BTN.Y * 1.1)
		TweenService:Create(b.button, TweenInfo.new(0.25, Enum.EasingStyle.Back), { Size = UDim2.fromOffset(BTN.X, BTN.Y) }):Play()
	end
end)

-- auto-cast: fire any ready skill at the biggest zombie group nearby
task.spawn(function()
	while true do
		task.wait(0.6)
		if autoCast and densestZombie(60) then
			for _, s in Config.Skills do
				if s.type == "active" and (readyAt[s.id] or 0) <= os.clock() then
					cast(s.id, true)
					break
				end
			end
		end
	end
end)

-- =====================================================================
-- Camera shake + screen flash (triggered by the server)
-- =====================================================================
local shakeMag = 0
local flashFx = Instance.new("ColorCorrectionEffect")
flashFx.Name = "SkillFlash"
flashFx.Parent = Lighting

FX.OnClientEvent:Connect(function(kind, pos, a, b)
	local cam = workspace.CurrentCamera
	local dist = (cam.Focus.Position - pos).Magnitude
	local range = b or 80
	if dist > range then
		return
	end
	local falloff = 1 - dist / range
	if kind == "shake" then
		shakeMag = math.max(shakeMag, (a or 2) * falloff)
	elseif kind == "flash" then
		flashFx.TintColor = (a or Color3.new(1, 1, 1)):Lerp(Color3.new(1, 1, 1), 0.4)
		flashFx.Brightness = 0.3 * falloff
		TweenService:Create(flashFx, TweenInfo.new(0.45), { TintColor = Color3.new(1, 1, 1), Brightness = 0 }):Play()
	end
end)

local rng = Random.new()
RunService.RenderStepped:Connect(function(dt)
	-- cooldown overlays
	local now = os.clock()
	for _, b in buttons do
		if b.cd then
			local rem = math.max(0, (readyAt[b.skill.id] or 0) - now)
			b.cd.Size = UDim2.fromScale(1, math.clamp(rem / b.skill.cd, 0, 1))
			b.cdText.Text = rem > 0 and string.format("%.1f", rem) or ""
			b.stroke.Thickness = rem > 0 and 2 or 3
		end
	end

	-- camera shake
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	if shakeMag > 0.02 then
		hum.CameraOffset = Vector3.new(rng:NextNumber(-1, 1), rng:NextNumber(-1, 1), rng:NextNumber(-1, 1)) * shakeMag * 0.25
		shakeMag = math.max(0, shakeMag - dt * (shakeMag * 5 + 0.5))
	elseif hum.CameraOffset ~= Vector3.zero then
		shakeMag = 0
		hum.CameraOffset = Vector3.zero
	end
end)
