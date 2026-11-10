export const LOG_REGEX = {
	altered:
		/^\[[^\]]+\]\[\d+\]\[(\d+)\] Player Join,\s*(\d+),\s*(\d+),\s*(.*),\s*[^,]*\s*$/,
	dead: /^\[[^\]]+\]\[\d+\]\[(\d+)\] Player (\d+) Dead, killed by (\d+)$/,
	teamScoreInit:
		/^\[[^\]]+\]\[\d+\]\[(\d+)\] OnTeamScoreInited -> TeamName: ([^,]+) TeamID: (\d+)$/,
	teamScoreChanged:
		/^\[[^\]]+\]\[\d+\]\[(\d+)\] OnTeamScoreChanged -> TeamID: (\d+) TeamScore: (\d+)$/,
	revive:
		/^\[[^\]]+\]\[\d+\]\[(\d+)\] Revive Player (\d+), revivePosition=\([^)]+\)$/,
	teamEliminated:
		/^\[[^\]]+\]\[\d+\]\[(\d+)\].*isTeamLastKill:\s*(True|False)\b.*$/,
} as const;

