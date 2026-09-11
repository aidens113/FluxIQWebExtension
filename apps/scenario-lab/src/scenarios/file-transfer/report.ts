/** The seeded monthly report the fixture serves as a CSV attachment. */
export type FileTransferReport = { filename: string; rowCount: number; csv: string };

const REGIONS = ["North", "South", "East", "West"] as const;

/** Builds the report for a seed: the same seed always yields the same file name and bytes. */
export function fileTransferReport(seed: number): FileTransferReport {
  const rows = REGIONS.map((region, index) => {
    const orders = 20 + positiveModulo(seed * 37 + index * 101, 80);
    const unitPrice = 12 + positiveModulo(seed * 13 + index * 29, 18);
    return `${region},${orders},${(orders * unitPrice).toFixed(2)}`;
  });
  return { filename: `report-${seed}.csv`, rowCount: rows.length, csv: `${["region,orders,revenue", ...rows].join("\r\n")}\r\n` };
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
