export interface TeamImportRow {
  teamName: string;
  seed?: string;
  playerName?: string;
  nickname?: string;
  countryCode?: string;
  seating?: string;
  steamId?: string;
  isLeader?: string;
}

export function parseCsvRows(csvText: string): TeamImportRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || "";
    });

    return {
      teamName: row.teamName || "",
      seed: row.seed || "",
      playerName: row.playerName || "",
      nickname: row.nickname || "",
      countryCode: row.countryCode || "",
      seating: row.seating || "",
      steamId: row.steamId || "",
      isLeader: row.isLeader || "",
    };
  });
}

export function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

export function buildTeamsCsv(teams: any[]) {
  const header = [
    "teamName",
    "seed",
    "playerName",
    "nickname",
    "countryCode",
    "seating",
    "steamId",
    "isLeader",
  ];

  const rows = teams.flatMap((team) => {
    const players = Array.isArray(team.players) && team.players.length > 0 ? team.players : [null];
    return players.map((player: any) =>
      [
        team.name,
        team.seed ?? "",
        player?.name ?? "",
        player?.nickname ?? "",
        player?.countryCode ?? "",
        player?.seating ?? "",
        player?.steamId ?? "",
        player?.isLeader ? "true" : "",
      ]
        .map(escapeCsvValue)
        .join(",")
    );
  });

  return [header.join(","), ...rows].join("\n");
}

function escapeCsvValue(value: string | number) {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}
