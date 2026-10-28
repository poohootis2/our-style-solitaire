export type CardBackTheme = {
  name: string;
  outer: string;
  inner: string;
  border: string;
  mark: string;
  glyph: string;
  image?: string;
};

export const CARD_BACK_THEMES: CardBackTheme[] = [
  { name: "카드 뒷면 01", outer: "#2E5D8A", inner: "#17314F", border: "#B9E4FF", mark: "#EAF8FF", glyph: "✦", image: "card_back_01.png" },
  { name: "카드 뒷면 02", outer: "#7A3E72", inner: "#321B3E", border: "#F4B8E8", mark: "#FFF0FB", glyph: "✧", image: "card_back_02.png" },
  { name: "카드 뒷면 03", outer: "#9B4B35", inner: "#4A211C", border: "#FFD0A8", mark: "#FFF4DE", glyph: "◆", image: "card_back_03.png" },
  { name: "카드 뒷면 04", outer: "#2B806F", inner: "#123F3A", border: "#A7F4DB", mark: "#E9FFF8", glyph: "✺", image: "card_back_04.png" },
  { name: "카드 뒷면 05", outer: "#B47B2C", inner: "#513915", border: "#FFE39B", mark: "#FFF8D7", glyph: "✹", image: "card_back_05.png" },
  { name: "카드 뒷면 06", outer: "#A64D70", inner: "#4B1D3A", border: "#FFC5DD", mark: "#FFEAF2", glyph: "✿", image: "card_back_06.png" },
  { name: "카드 뒷면 07", outer: "#416FAD", inner: "#172E56", border: "#BBD9FF", mark: "#EDF6FF", glyph: "♜", image: "card_back_07.png" },
  { name: "카드 뒷면 08", outer: "#7656A9", inner: "#2B1D4A", border: "#E5D5FF", mark: "#FFF0B8", glyph: "♛", image: "card_back_08.png" },
];

const STAGE_CARD_BACK_THEME_COUNT = CARD_BACK_THEMES.length;

export function getCardBackTheme(level: number): CardBackTheme {
  return CARD_BACK_THEMES[(Math.max(level, 1) - 1) % STAGE_CARD_BACK_THEME_COUNT];
}

export function getCardBackThemeByIndex(index: number): CardBackTheme {
  return CARD_BACK_THEMES[Math.max(0, Math.min(CARD_BACK_THEMES.length - 1, Math.floor(index)))];
}
