import type { AuthoredListing } from "../listing.js";

/**
 * Furniture. Three dining tables within five miles of Kelford are the save
 * task's answer; a search for "dining table" also turns up table legs, chairs
 * sold to match a dining table, a sold table and a cheap one just outside the
 * radius, all of them cheaper than the answer.
 *
 * The rattan armchair is one of the two listings the account had already
 * saved before the session began, and it has since sold.
 */
export const FURNITURE_LISTINGS: readonly AuthoredListing[] = [
  { key: "oak-extending-table", title: "Extending oak dining table, seats 6-8", category: "furniture", price: 180, condition: "good", place: "kelford-centre", hours: 70, seller: "rosa-lindqvist", delivery: "pickup",
    description: "Solid oak with one extension leaf. Some ring marks on the top, otherwise solid. Needs two people to carry.", details: [["Material", "Oak"], ["Seats", "6 to 8"]] },
  { key: "pine-round-table", title: "Round pine dining table, 90cm", category: "furniture", price: 45, condition: "fair", place: "upper-kelford", hours: 20, seller: "priya-nandakumar", delivery: "pickup",
    description: "Round pine table, 90cm across. A few dents and a wobble that a tightened bolt would fix.", details: [["Material", "Pine"], ["Diameter", "90cm"]] },
  { key: "glass-table", title: "Glass dining table with chrome legs", category: "furniture", price: 60, was: 85, condition: "good", place: "kelford-harbour", hours: 36, seller: "leila-farah", delivery: "pickup",
    description: "Tempered glass top, 120 x 80cm, chrome legs. Price dropped for a quick sale.", details: [["Material", "Glass and chrome"], ["Size", "120 x 80cm"]] },
  { key: "dining-chairs", title: "Set of 4 dining chairs, match any dining table", category: "furniture", price: 40, condition: "good", place: "kelford-harbour", hours: 50, seller: "casey-moreno", delivery: "pickup",
    description: "Four grey upholstered dining chairs. They would match any dining table. Table not included." },
  { key: "farmhouse-table", title: "Farmhouse dining table and bench", category: "furniture", price: 120, condition: "good", place: "saltmarsh-row", hours: 90, seller: "owen-bracegirdle", delivery: "pickup",
    description: "Painted farmhouse table with a matching bench. Seats six.", details: [["Seats", "6"]] },
  { key: "drop-leaf-table", title: "Small dining table, drop leaf", category: "furniture", price: 30, condition: "fair", place: "brackwater", hours: 12, seller: "fergus-lyle", delivery: "pickup",
    description: "Drop-leaf table, good for a small kitchen." },
  { key: "white-gloss-table", title: "White gloss dining table, 4 seater", category: "furniture", price: 55, condition: "like-new", place: "hallam-cross", hours: 48, seller: "gideon-marsh", delivery: "pickup",
    description: "High-gloss white, barely used." },
  { key: "coffee-table", title: "Coffee table, walnut effect", category: "furniture", price: 25, condition: "good", place: "kelford-centre", hours: 10, seller: "sam-ellery", delivery: "pickup",
    description: "Walnut-effect coffee table with a shelf underneath." },
  { key: "walnut-table", title: "Dining table, solid walnut, mid-century", category: "furniture", price: 350, condition: "like-new", place: "upper-kelford", hours: 150, seller: "harper-quinlan", delivery: "pickup",
    description: "Mid-century design in solid walnut, recently refinished." },
  { key: "industrial-table", title: "Dining table, industrial style, 160cm", category: "furniture", price: 95, condition: "good", place: "saltmarsh-row", hours: 28, seller: "tomasz-wrona", delivery: "pickup",
    description: "Reclaimed-look top on black steel legs, 160 x 90cm.", details: [["Size", "160 x 90cm"]] },
  { key: "veneer-table-sold", title: "Dining table, oak veneer", category: "furniture", price: 35, condition: "good", place: "kelford-centre", hours: 100, seller: "niamh-doherty", delivery: "pickup", sold: true,
    description: "Oak veneer table. Now sold." },
  { key: "hairpin-legs", title: "Dining table legs x4, hairpin, 71cm", category: "furniture", price: 28, condition: "new", place: "kelford-harbour", hours: 6, seller: "ellis-carver", delivery: "both",
    description: "Four 71cm hairpin legs for a dining table. Screws included. Legs only, no table top." },
  { key: "rattan-armchair", title: "Rattan armchair", category: "furniture", price: 65, condition: "good", place: "upper-kelford", hours: 400, seller: "beatrix-fell", delivery: "pickup", sold: true,
    description: "Vintage rattan armchair with cushion." },
  { key: "grey-sofa", title: "Two-seater sofa, grey fabric", category: "furniture", price: 150, condition: "good", place: "brackwater", hours: 30, seller: "dana-whitlock", delivery: "pickup",
    description: "Comfortable two-seater, pet-free and smoke-free home." },
  { key: "chest-of-drawers", title: "Chest of drawers, white, 5 drawers", category: "furniture", price: 70, condition: "good", place: "kelford-harbour", hours: 45, seller: "imogen-blake", delivery: "pickup",
    description: "Five deep drawers, all runners work." },
  { key: "oak-bookcase", title: "Bookcase, oak effect, 5 shelves", category: "furniture", price: 35, condition: "good", place: "ashby-moor", hours: 22, seller: "kwame-asante", delivery: "pickup",
    description: "Flat-packed and ready to collect." },
];
