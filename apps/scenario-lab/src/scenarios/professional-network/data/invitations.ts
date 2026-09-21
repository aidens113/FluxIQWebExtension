import { memberNamed } from "./lookup.js";
import type { InvitationKind, ReceivedInvitation, SentInvitation } from "../types.js";

type SentRow = [kind: InvitationKind, member: string, subject: string, days: number];

/**
 * Everything the signed-in member has invited people to and nobody has
 * answered, newest first as the manager lists it. Twenty-eight are connection
 * requests. Twelve of those went out a month or more ago -- the oldest
 * thirty-three days, well clear of the calendar month -- and one went out
 * twenty-eight days ago, which the page calls four weeks. Eight more are
 * invitations to follow a page or subscribe to a newsletter, four of them a
 * month or more old, and none of them is a connection request.
 */
const SENT_ROWS: readonly SentRow[] = [
  ["person", "Joost van Dijk 🚀", "", 0],
  ["person", "Grace Mbeki", "", 0],
  ["person", "Femke de Graaf", "", 1],
  ["page", "Wouter de Boer", "Northwick Analytics", 2],
  ["person", "Tobias Keller", "", 3],
  ["person", "Kayla Brooks", "", 5],
  ["person", "Niamh Collins", "", 8],
  ["person", "Rahul Verma", "", 10],
  ["page", "Anouk Smit", "Northwick Analytics", 12],
  ["person", "Stefan Vos", "", 13],
  ["person", "Daniela Costa", "", 15],
  ["person", "Chloé Martin", "", 17],
  ["page", "Mei Lin", "Data Hiring Guild", 19],
  ["person", "Hamza Ouali", "", 20],
  ["person", "Oskar Nilsson", "", 22],
  ["person", "Lieke Postma", "", 24],
  ["page", "Ricardo Alves", "Northwick Analytics", 25],
  ["person", "Sven Aalders", "", 26],
  ["person", "Julia Nowak", "", 27],
  ["person", "Rosa Meijer", "", 28],
  ["person", "Aoife Brennan", "", 33],
  ["person", "Mehmet Arslan", "", 38],
  ["page", "Pieter Groen", "Northwick Analytics", 40],
  ["person", "Ines Carvalho", "", 45],
  ["person", "Kees Bakker", "", 52],
  ["person", "Derek Olsen", "", 61],
  ["person", "Fleur Brouwer", "", 66],
  ["page", "Sophie Laurent", "Data Hiring Guild", 70],
  ["person", "Emre Yilmaz", "", 80],
  ["newsletter", "Anouk Smit", "Data Hiring Weekly", 90],
  ["person", "Freya Lindqvist", "", 95],
  ["person", "Nadia Benali", "", 124],
  ["page", "Bas Timmer", "Northwick Analytics", 130],
  ["person", "Koen Verbeek", "", 150],
  ["person", "Elif Kaya", "", 199],
  ["person", "Marit Dekker", "", 240],
];

export const SENT_INVITATIONS: readonly SentInvitation[] = SENT_ROWS.map(([kind, name, subject, days], index) => ({
  urn: `urn:gl:invitation:${7_203_117 - index * 131}`,
  kind,
  memberUrn: memberNamed(name).urn,
  subject,
  days,
}));

type ReceivedRow = [kind: InvitationKind, member: string, subject: string, message: string, days: number];

/** What is waiting for the signed-in member's answer: the other direction, which no withdrawal touches. */
const RECEIVED_ROWS: readonly ReceivedRow[] = [
  ["person", "Ximena Ruiz", "", "Hi Rafaela, we're both hiring data engineers in Rotterdam. Happy to swap notes on the market.", 0],
  ["person", "Pavel Novák", "", "", 2],
  ["page", "Omar Farouk", "Quayside Labs", "", 3],
  ["person", "Lucia Romano", "", "Loved your post on structured interviews!", 6],
  ["person", "Mara Okafor", "", "", 9],
  ["newsletter", "Hendrik Mol", "Portwise Engineering Notes", "", 11],
  ["person", "Chidi Nwosu", "", "Hi Rafaela, Priya Nair suggested I reach out about the platform role.", 16],
  ["person", "Omar Farouk", "", "", 23],
];

export const RECEIVED_INVITATIONS: readonly ReceivedInvitation[] = RECEIVED_ROWS.map(([kind, name, subject, message, days], index) => ({
  urn: `urn:gl:invitation:${6_981_004 + index * 97}`,
  kind,
  memberUrn: memberNamed(name).urn,
  subject,
  message,
  days,
}));
