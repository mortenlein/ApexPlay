export function buildSteamConnectUrl(
  serverIp?: string | null,
  serverPort?: string | null,
  serverPassword?: string | null
) {
  if (!serverIp) {
    return null;
  }

  const portSegment = serverPort ? `:${serverPort}` : "";
  const passwordSegment = serverPassword ? `/${serverPassword}` : "";
  return `steam://connect/${serverIp}${portSegment}${passwordSegment}`;
}
