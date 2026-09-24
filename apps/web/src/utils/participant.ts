/**
 * Kiểm tra xem participant có phải là Bot / Agent / Egress (như STT agent) hay không.
 */
export function isAgentParticipant(participant?: {
  identity?: string;
  name?: string;
  kind?: any;
  isAgent?: boolean;
} | null): boolean {
  if (!participant) return false;
  if (participant.isAgent) return true;
  if (participant.kind === 2 || (participant.kind as any) === "agent") return true;
  const identity = participant.identity || "";
  const name = participant.name || "";
  if (
    identity.startsWith("agent-") ||
    identity.includes("stt-transcriber") ||
    identity.startsWith("EG_") ||
    name.includes("stt-transcriber")
  ) {
    return true;
  }
  return false;
}
