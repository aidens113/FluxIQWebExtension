// The words by which a control offers to bring the person into the set an item
// belongs to (t810). Client words live here and nowhere upstream: Core never
// reads them, it is only told that a mark was found (`rejected-marks`).
//
// A control's name begins with the offer, on a word boundary, in any case:
// "Join group", "Follow", "Subscribe to channel", "Connect", "Add friend",
// "Request to join", "Become a member". A name that begins with the state the
// offer has already led to is no offer: "Joined", "Following", "Unfollow",
// "Unsubscribe", "Leave group", "Requested", "Pending", "Member". "Join" does
// not match "Joined" because the boundary is a word's end, and the state words
// are refused first for the names that begin with them but are not the verb
// ("Following" begins with "follow" without a boundary, so it already fails).

/** The verbs and phrases that offer entry, each at the start of a name. */
const OFFERS = ["join", "follow", "subscribe", "connect", "add friend", "request to join", "become a member"];
/** The states that an offer has already led to, which are never offers. */
const STATES = ["joined", "following", "unfollow", "unsubscribe", "leave", "requested", "pending", "member"];

const WORD_END = "(?![\\p{L}\\p{N}])";
const SPACES = "\\s+";
const OFFER = new RegExp(`^(?:${OFFERS.map((phrase) => phrase.replace(/ /gu, SPACES)).join("|")})${WORD_END}`, "iu");
const STATE = new RegExp(`^(?:${STATES.join("|")})${WORD_END}`, "iu");

/** Whether `name`, a control's own accessible name, offers entry into its item's set. */
export function offerWords(name: string): boolean {
  const text = name.trim();
  return OFFER.test(text) && !STATE.test(text);
}
