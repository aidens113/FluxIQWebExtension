/**
 * Pure functions shared by the server render, the reducer, and the in-page
 * client. The client script embeds each entry's compiled source, so every
 * entry must stay a self-contained arrow function: no imports and no
 * references to anything outside its own body.
 */
export const pageLogic = {
  isInviteEmail: (value: string): boolean => value.length <= 254 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value),
  inviteResult: (invite: { email: string; role: string } | undefined): string =>
    invite ? `Invitation sent to ${invite.email} (${invite.role === "editor" ? "Editor" : "Viewer"})` : "No invitations sent",
  sectionTitle: (position: number): string => `Section ${position}`,
  sectionCount: (count: number): string => (count === 0 ? "No sections yet" : count === 1 ? "1 section" : `${count} sections`),
  publishResult: (count: number): string => (count > 0 ? "Draft published" : "Not published"),
  draftStatus: (draft: string): string => (draft === "deleted" ? "Draft deleted" : "Draft active"),
};
