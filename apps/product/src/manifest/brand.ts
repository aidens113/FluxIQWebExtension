import type { PanelProduct } from "fluxiq/platform/panel";

/**
 * Accent colours per mode. The brand amber #f5b83d is under Core's contrast
 * floor against the panel's white surface, so the light set uses a deeper
 * amber family and keeps #f5b83d for the dark set, where it passes against
 * the dark surface (#111820).
 */
export const productBrand: NonNullable<PanelProduct["brand"]> = {
  light: { primary: "#8a5700", primaryHover: "#6b4300", focus: "#b36b00" },
  dark: { primary: "#f5b83d", primaryHover: "#ffd27a", focus: "#f5b83d" }
};
