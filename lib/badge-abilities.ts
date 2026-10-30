import type { SupportedLanguage } from "./i18n";

export type BadgeAbilityKind = "time" | "score" | "hammer" | "peek";

export type BadgeAbility = {
  kind: BadgeAbilityKind;
  value: number;
  intervalSeconds?: number;
};

const ABILITIES: Record<string, BadgeAbility> = {
  "boss-01": { kind: "time", value: 1, intervalSeconds: 180 },
  "boss-02": { kind: "score", value: 20 },
  "boss-03": { kind: "hammer", value: 1, intervalSeconds: 20 },
  "boss-04": { kind: "peek", value: 3 },
  "boss-05": { kind: "time", value: 1, intervalSeconds: 180 },
  "boss-06": { kind: "score", value: 25 },
  "boss-07": { kind: "hammer", value: 1, intervalSeconds: 20 },
  "boss-08": { kind: "peek", value: 3 },
  "boss-09": { kind: "time", value: 1, intervalSeconds: 180 },
  "boss-10": { kind: "score", value: 30 },
  "boss-11": { kind: "hammer", value: 1, intervalSeconds: 20 },
  "boss-12": { kind: "peek", value: 3 },
  "boss-13": { kind: "time", value: 1, intervalSeconds: 180 },
  "boss-14": { kind: "score", value: 35 },
  "boss-15": { kind: "hammer", value: 1, intervalSeconds: 20 },
  "king-boss-01": { kind: "peek", value: 3 },
  "king-boss-02": { kind: "time", value: 1, intervalSeconds: 180 },
  "king-boss-03": { kind: "score", value: 40 },
  "emperor-boss": { kind: "hammer", value: 1, intervalSeconds: 20 },
};

const TEXT: Record<BadgeAbilityKind, Record<SupportedLanguage, string>> = {
  time: { ko: "3분마다 1초 단축", en: "-1 second every 3 minutes", th: "ลดเวลา 1 วินาทีทุก 3 นาที", ja: "3分ごとに1秒短縮", fr: "-1 seconde toutes les 3 minutes", de: "Alle 3 Minuten 1 Sekunde kürzer", es: "-1 segundo cada 3 minutos", hi: "हर 3 मिनट में 1 सेकंड कम", vi: "Giảm 1 giây mỗi 3 phút", ru: "-1 секунда каждые 3 минуты", "es-MX": "-1 segundo cada 3 minutos", id: "-1 detik setiap 3 menit", it: "-1 secondo ogni 3 minuti", "zh-CN": "每3分钟缩短1秒" },
  score: { ko: "정상 정리마다 +점수", en: "+score for clean moves", th: "+คะแนนเมื่อจัดไพ่ถูกต้อง", ja: "正しい整理で加点", fr: "+score pour chaque rangement", de: "+Punkte für korrekte Züge", es: "+puntos por orden correcto", hi: "सही चाल पर अतिरिक्त अंक", vi: "+điểm khi xếp đúng", ru: "+очки за правильную сортировку", "es-MX": "+puntos por orden correcto", id: "+skor untuk langkah benar", it: "+punti per riordino corretto", "zh-CN": "正确整理时加分" },
  hammer: { ko: "정상 이동 20회마다 망치 +1", en: "+1 hammer every 20 clean moves", th: "+ค้อน 1 อันทุก 20 ครั้ง", ja: "正しい移動20回ごとにハンマー+1", fr: "+1 marteau toutes les 20 actions", de: "+1 Hammer alle 20 Züge", es: "+1 martillo cada 20 movimientos", hi: "हर 20 सही चाल पर +1 हथौड़ा", vi: "+1 búa mỗi 20 nước", ru: "+1 молот каждые 20 ходов", "es-MX": "+1 martillo cada 20 movimientos", id: "+1 palu setiap 20 langkah", it: "+1 martello ogni 20 mosse", "zh-CN": "每20次正确移动获得锤子+1" },
  peek: { ko: "시작 시 뒤집힌 카드 3초 공개", en: "Reveal face-down cards for 3 seconds", th: "เปิดไพ่คว่ำ 3 วินาทีเมื่อเริ่ม", ja: "開始時に裏向きカードを3秒表示", fr: "Révèle les cartes 3 secondes au début", de: "Verdeckte Karten 3 Sekunden zeigen", es: "Revela cartas 3 segundos al inicio", hi: "शुरू में छिपे कार्ड 3 सेकंड दिखाएं", vi: "Lật bài úp trong 3 giây khi bắt đầu", ru: "Показать закрытые карты на 3 секунды", "es-MX": "Revela cartas 3 segundos al inicio", id: "Buka kartu tertutup 3 detik saat mulai", it: "Mostra le carte coperte per 3 secondi", "zh-CN": "开始时显示背面牌3秒" },
};

export function getBadgeAbility(id: string): BadgeAbility {
  return ABILITIES[id] ?? { kind: "score", value: 10 };
}

export function getBadgeAbilityText(id: string, language: SupportedLanguage): string {
  return TEXT[getBadgeAbility(id).kind][language] ?? TEXT[getBadgeAbility(id).kind].en;
}
