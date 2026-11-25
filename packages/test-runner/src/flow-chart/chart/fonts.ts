import { readFile } from "node:fs/promises";

/** Fonts the chart is drawn in, tried in order: the rasteriser loads no system fonts of its own. */
const CANDIDATES: readonly { family: string; files: readonly string[] }[] = [
  { family: "Segoe UI", files: ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf"] },
  { family: "Arial", files: ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"] },
  { family: "DejaVu Sans", files: ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] },
  { family: "Helvetica", files: ["/System/Library/Fonts/Helvetica.ttc"] },
];

async function readFont(file: string): Promise<Uint8Array | undefined> {
  try {
    return new Uint8Array(await readFile(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** The first installed font family's files as buffers; throws, saying so, when none is installed. */
export async function chartFonts(): Promise<{ family: string; buffers: Uint8Array[] }> {
  for (const candidate of CANDIDATES) {
    const buffers: Uint8Array[] = [];
    for (const file of candidate.files) {
      const bytes = await readFont(file);
      if (bytes) buffers.push(bytes);
    }
    if (buffers.length > 0) return { family: candidate.family, buffers };
  }
  throw new Error(`no font for the chart is installed (tried ${CANDIDATES.map((candidate) => candidate.family).join(", ")})`);
}
