export type CardBackTheme = {
  name: string;
  outer: string;
  inner: string;
  border: string;
  mark: string;
  glyph: string;
};

const CARD_BACK_THEMES: CardBackTheme[] = [
  { name: "민트 펠트", outer: "#77D6C3", inner: "#1E3153", border: "#A5F0DF", mark: "#77D6C3", glyph: "✦" },
  { name: "오로라", outer: "#9C85EE", inner: "#292052", border: "#D0C4FF", mark: "#B9F4E5", glyph: "✧" },
  { name: "코랄", outer: "#FF8A76", inner: "#5A2632", border: "#FFC1B4", mark: "#FFE6B5", glyph: "◆" },
  { name: "라군", outer: "#4BA9C8", inner: "#143F58", border: "#9BE7F1", mark: "#F4E98C", glyph: "✺" },
  { name: "골드", outer: "#D6A956", inner: "#49351A", border: "#FFE7A2", mark: "#FFF3C9", glyph: "✹" },
  { name: "로즈", outer: "#D46B9A", inner: "#511D3A", border: "#FFC0DC", mark: "#FFE1EF", glyph: "✿" },
];

export function getCardBackTheme(level: number): CardBackTheme {
  return CARD_BACK_THEMES[(Math.max(level, 1) - 1) % CARD_BACK_THEMES.length];
}
