import type { SupportedLanguage } from "./i18n";

export type BadgeAbilityKind =
  | "time-180"
  | "score-move-10"
  | "hammer-clean-30"
  | "peek-3"
  | "foundation-score-1"
  | "first-move-score"
  | "combo-score"
  | "peek-3-cards"
  | "clean-time-5"
  | "boss-score-1"
  | "stock-first-card"
  | "free-recycle"
  | "combo-time"
  | "score-multiplier"
  | "starting-hammer"
  | "random-peek-2"
  | "time-90"
  | "foundation-bonus"
  | "boss-hammer";

export type BadgeAbility = {
  kind: BadgeAbilityKind;
  value: number;
  intervalSeconds?: number;
  intervalMoves?: number;
};

const ABILITIES: Record<string, BadgeAbility> = {
  "boss-01": { kind: "time-180", value: 1, intervalSeconds: 180 },
  "boss-02": { kind: "score-move-10", value: 20, intervalMoves: 10 },
  "boss-03": { kind: "hammer-clean-30", value: 1, intervalMoves: 30 },
  "boss-04": { kind: "peek-3", value: 3 },
  "boss-05": { kind: "foundation-score-1", value: 1 },
  "boss-06": { kind: "first-move-score", value: 50 },
  "boss-07": { kind: "combo-score", value: 10 },
  "boss-08": { kind: "peek-3-cards", value: 3 },
  "boss-09": { kind: "clean-time-5", value: 1, intervalMoves: 5 },
  "boss-10": { kind: "boss-score-1", value: 1 },
  "boss-11": { kind: "stock-first-card", value: 1 },
  "boss-12": { kind: "free-recycle", value: 1 },
  "boss-13": { kind: "combo-time", value: 2 },
  "boss-14": { kind: "score-multiplier", value: 5 },
  "boss-15": { kind: "starting-hammer", value: 1 },
  "king-boss-01": { kind: "random-peek-2", value: 2 },
  "king-boss-02": { kind: "time-90", value: 1, intervalSeconds: 90 },
  "king-boss-03": { kind: "foundation-bonus", value: 1 },
  "emperor-boss": { kind: "boss-hammer", value: 2 },
};

const TEXT: Record<BadgeAbilityKind, Record<SupportedLanguage, string>> = {
  "time-180": { ko: "3분마다 경과시간 1초 단축", en: "Reduce elapsed time by 1 second every 3 minutes", th: "ลดเวลาที่ผ่านไป 1 วินาทีทุก 3 นาที", ja: "3分ごとに経過時間を1秒短縮", fr: "Réduit le temps écoulé de 1 seconde toutes les 3 minutes", de: "Verkürzt die verstrichene Zeit alle 3 Minuten um 1 Sekunde", es: "Reduce 1 segundo del tiempo transcurrido cada 3 minutos", hi: "हर 3 मिनट में बीता समय 1 सेकंड कम करें", vi: "Giảm 1 giây thời gian đã trôi qua mỗi 3 phút", ru: "Сокращает прошедшее время на 1 секунду каждые 3 минуты", "es-MX": "Reduce 1 segundo del tiempo transcurrido cada 3 minutos", id: "Kurangi waktu berlalu 1 detik setiap 3 menit", it: "Riduce di 1 secondo il tempo trascorso ogni 3 minuti", "zh-CN": "每3分钟减少已用时间1秒" },
  "score-move-10": { ko: "정상 카드 이동 10개마다 +20점", en: "+20 score every 10 correct card moves", th: "+20 คะแนนทุกการย้ายไพ่ถูกต้อง 10 ครั้ง", ja: "正しいカード移動10回ごとに+20点", fr: "+20 points toutes les 10 actions correctes", de: "+20 Punkte alle 10 korrekten Kartenbewegungen", es: "+20 puntos cada 10 movimientos correctos", hi: "हर 10 सही कार्ड चालों पर +20 अंक", vi: "+20 điểm sau mỗi 10 lần di chuyển đúng", ru: "+20 очков каждые 10 правильных ходов", "es-MX": "+20 puntos cada 10 movimientos correctos", id: "+20 skor setiap 10 perpindahan kartu yang benar", it: "+20 punti ogni 10 mosse corrette", "zh-CN": "每正确移动10张牌获得+20分" },
  "hammer-clean-30": { ko: "취소·망치 사용 없이 정상 이동 30회마다 망치 +1", en: "+1 hammer every 30 correct moves without undo or hammer", th: "+1 ค้อนทุกการย้ายถูกต้อง 30 ครั้งโดยไม่ใช้เลิกทำหรือค้อน", ja: "取り消しやハンマーなしで正しい移動30回ごとにハンマー+1", fr: "+1 marteau toutes les 30 actions correctes sans annulation ni marteau", de: "+1 Hammer alle 30 korrekten Züge ohne Rückgängig oder Hammer", es: "+1 martillo cada 30 movimientos correctos sin deshacer ni martillo", hi: "बिना पूर्ववत या हथौड़े के हर 30 सही चालों पर +1 हथौड़ा", vi: "+1 búa sau mỗi 30 lần di chuyển đúng không hoàn tác hay dùng búa", ru: "+1 молоток каждые 30 правильных ходов без отмены и молотка", "es-MX": "+1 martillo cada 30 movimientos correctos sin deshacer ni martillo", id: "+1 palu setiap 30 perpindahan benar tanpa batal atau palu", it: "+1 martello ogni 30 mosse corrette senza annullare né usare il martello", "zh-CN": "不使用撤销或锤子时每正确移动30次获得+1把锤子" },
  "peek-3": { ko: "게임 시작 시 뒤집힌 카드 3초 공개", en: "Reveal face-down cards for 3 seconds at start", th: "เปิดไพ่คว่ำเป็นเวลา 3 วินาทีเมื่อเริ่มเกม", ja: "ゲーム開始時に裏向きのカードを3秒間公開", fr: "Révèle les cartes face cachée pendant 3 secondes au début", de: "Deckt zu Beginn 3 Sekunden lang verdeckte Karten auf", es: "Revela las cartas boca abajo durante 3 segundos al comenzar", hi: "खेल शुरू होने पर उल्टे कार्ड 3 सेकंड के लिए दिखाएं", vi: "Lật mở các lá úp trong 3 giây khi bắt đầu", ru: "Открывает закрытые карты на 3 секунды в начале игры", "es-MX": "Revela las cartas boca abajo durante 3 segundos al comenzar", id: "Tampilkan kartu tertutup selama 3 detik saat mulai", it: "Rivela le carte coperte per 3 secondi all'inizio", "zh-CN": "游戏开始时展示背面牌3秒" },
  "foundation-score-1": { ko: "파운데이션에 카드를 놓을 때마다 +1점", en: "+1 score whenever a card is placed on a foundation", th: "+1 คะแนนทุกครั้งที่วางไพ่บนฐาน", ja: "ファンデーションにカードを置くたびに+1点", fr: "+1 point à chaque carte posée sur une fondation", de: "+1 Punkt für jede Karte auf einem Fundament", es: "+1 punto cada vez que colocas una carta en una base", hi: "फाउंडेशन पर कार्ड रखने पर हर बार +1 अंक", vi: "+1 điểm mỗi khi đặt một lá lên nền", ru: "+1 очко за каждую карту, помещённую в основание", "es-MX": "+1 punto cada vez que colocas una carta en una base", id: "+1 skor setiap kali kartu diletakkan di fondasi", it: "+1 punto ogni volta che una carta viene messa in fondazione", "zh-CN": "每将一张牌放入基础区获得+1分" },
  "first-move-score": { ko: "첫 정상 이동에 +50점", en: "+50 score on the first correct move", th: "+50 คะแนนในการย้ายไพ่ถูกต้องครั้งแรก", ja: "最初の正しい移動で+50点", fr: "+50 points au premier mouvement correct", de: "+50 Punkte beim ersten korrekten Zug", es: "+50 puntos en el primer movimiento correcto", hi: "पहली सही चाल पर +50 अंक", vi: "+50 điểm cho lần di chuyển đúng đầu tiên", ru: "+50 очков за первый правильный ход", "es-MX": "+50 puntos en el primer movimiento correcto", id: "+50 skor pada perpindahan benar pertama", it: "+50 punti alla prima mossa corretta", "zh-CN": "第一次正确移动获得+50分" },
  "combo-score": { ko: "10콤보 달성 시 +10점 추가", en: "+10 score when reaching a 10-combo", th: "+10 คะแนนเมื่อทำคอมโบครบ 10", ja: "10コンボ達成時に+10点", fr: "+10 points à 10 combos", de: "+10 Punkte bei 10er-Kombo", es: "+10 puntos al alcanzar un combo de 10", hi: "10 कॉम्बो पर +10 अंक", vi: "+10 điểm khi đạt combo 10", ru: "+10 очков при достижении 10 комбо", "es-MX": "+10 puntos al alcanzar un combo de 10", id: "+10 skor saat mencapai kombo 10", it: "+10 punti al raggiungimento di 10 combo", "zh-CN": "达到10连击时额外获得+10分" },
  "peek-3-cards": { ko: "게임 시작 시 카드 3장 공개", en: "Reveal 3 cards at game start", th: "เปิดไพ่ 3 ใบเมื่อเริ่มเกม", ja: "ゲーム開始時にカード3枚を公開", fr: "Révèle 3 cartes au début", de: "Deckt zu Beginn 3 Karten auf", es: "Revela 3 cartas al comenzar", hi: "खेल शुरू होने पर 3 कार्ड दिखाएं", vi: "Hiện 3 lá bài khi bắt đầu", ru: "Открывает 3 карты в начале игры", "es-MX": "Revela 3 cartas al comenzar", id: "Tampilkan 3 kartu saat mulai", it: "Rivela 3 carte all'inizio", "zh-CN": "游戏开始时展示3张牌" },
  "clean-time-5": { ko: "취소·망치 없이 정상 이동 5회마다 시간 1초 보너스", en: "+1 second every 5 correct moves without undo or hammer", th: "+1 วินาทีทุก 5 การย้ายถูกต้องโดยไม่เลิกทำหรือใช้ค้อน", ja: "取り消しやハンマーなしで正しい移動5回ごとに時間+1秒", fr: "+1 seconde toutes les 5 actions correctes sans annulation ni marteau", de: "+1 Sekunde alle 5 korrekten Züge ohne Rückgängig oder Hammer", es: "+1 segundo cada 5 movimientos correctos sin deshacer ni martillo", hi: "बिना पूर्ववत या हथौड़े के हर 5 सही चालों पर +1 सेकंड", vi: "+1 giây sau mỗi 5 lần di chuyển đúng không hoàn tác hay dùng búa", ru: "+1 секунда каждые 5 правильных ходов без отмены и молотка", "es-MX": "+1 segundo cada 5 movimientos correctos sin deshacer ni martillo", id: "+1 detik setiap 5 perpindahan benar tanpa batal atau palu", it: "+1 secondo ogni 5 mosse corrette senza annullare né usare il martello", "zh-CN": "不使用撤销或锤子时每正确移动5次增加1秒" },
  "boss-score-1": { ko: "보스 명중 시마다 +1점", en: "+1 score for each boss hit", th: "+1 คะแนนทุกครั้งที่โจมตีบอส", ja: "ボスに命中するたびに+1点", fr: "+1 point à chaque coup porté au boss", de: "+1 Punkt für jeden Boss-Treffer", es: "+1 punto por cada golpe al jefe", hi: "बॉस पर हर प्रहार के लिए +1 अंक", vi: "+1 điểm cho mỗi lần đánh trúng boss", ru: "+1 очко за каждое попадание по боссу", "es-MX": "+1 punto por cada golpe al jefe", id: "+1 skor setiap kali mengenai bos", it: "+1 punto per ogni colpo al boss", "zh-CN": "每次命中Boss获得+1分" },
  "stock-first-card": { ko: "게임 시작 시 스톡 첫 번째 카드 공개", en: "Reveal the first stock card at game start", th: "เปิดไพ่ใบแรกในกองสต็อกเมื่อเริ่มเกม", ja: "ゲーム開始時にストックの1枚目を公開", fr: "Révèle la première carte de la pioche au début", de: "Deckt die erste Vorratskarte zu Beginn auf", es: "Revela la primera carta del mazo al comenzar", hi: "खेल शुरू होने पर स्टॉक का पहला कार्ड दिखाएं", vi: "Hiện lá đầu tiên của chồng bài khi bắt đầu", ru: "Открывает первую карту колоды в начале игры", "es-MX": "Revela la primera carta del mazo al comenzar", id: "Tampilkan kartu pertama dari stok saat mulai", it: "Rivela la prima carta dello stock all'inizio", "zh-CN": "游戏开始时展示库存第一张牌" },
  "free-recycle": { ko: "첫 스톡 순환 1회 무료", en: "The first stock recycle is free", th: "หมุนกองสต็อกครั้งแรกฟรี", ja: "最初のストック循環が無料", fr: "Le premier recyclage de la pioche est gratuit", de: "Der erste Vorratsumlauf ist kostenlos", es: "El primer reciclaje del mazo es gratis", hi: "पहला स्टॉक चक्र निःशुल्क", vi: "Lần xoay chồng bài đầu tiên miễn phí", ru: "Первый повторный проход колоды бесплатный", "es-MX": "El primer reciclaje del mazo es gratis", id: "Daur ulang stok pertama gratis", it: "Il primo riciclo dello stock è gratuito", "zh-CN": "第一次循环库存牌免费" },
  "combo-time": { ko: "10콤보마다 콤보 시간 2초 연장", en: "+2 seconds to the combo timer at 10-combo", th: "+2 วินาทีให้เวลาคอมโบเมื่อครบ 10", ja: "10コンボごとにコンボ時間+2秒", fr: "+2 secondes au chrono du combo à 10 combos", de: "+2 Sekunden Kombozeit bei 10er-Kombo", es: "+2 segundos al tiempo de combo con 10 combos", hi: "10 कॉम्बो पर कॉम्बो टाइमर में +2 सेकंड", vi: "+2 giây cho đồng hồ combo khi đạt 10", ru: "+2 секунды к таймеру комбо при 10 комбо", "es-MX": "+2 segundos al tiempo de combo con 10 combos", id: "+2 detik pada timer kombo saat mencapai 10", it: "+2 secondi al timer combo a 10 combo", "zh-CN": "每达到10连击，连击时间增加2秒" },
  "score-multiplier": { ko: "정리 점수 +5% 보너스", en: "+5% bonus to clear score", th: "+5% โบนัสคะแนนเคลียร์", ja: "クリアスコア+5%ボーナス", fr: "+5 % de bonus au score de nettoyage", de: "+5 % Bonus auf den Aufräumscore", es: "+5% de bonificación al puntaje de limpieza", hi: "क्लियर स्कोर पर +5% बोनस", vi: "Thưởng +5% điểm dọn bài", ru: "+5% к очкам за очистку", "es-MX": "+5% de bonificación al puntaje de limpieza", id: "+5% bonus skor penyelesaian", it: "+5% di bonus al punteggio di riordino", "zh-CN": "整理得分+5%奖励" },
  "starting-hammer": { ko: "게임 시작 시 망치 +1", en: "+1 hammer at game start", th: "+1 ค้อนเมื่อเริ่มเกม", ja: "ゲーム開始時にハンマー+1", fr: "+1 marteau au début", de: "+1 Hammer zu Spielbeginn", es: "+1 martillo al comenzar", hi: "खेल शुरू होने पर +1 हथौड़ा", vi: "+1 búa khi bắt đầu", ru: "+1 молоток в начале игры", "es-MX": "+1 martillo al comenzar", id: "+1 palu saat mulai", it: "+1 martello all'inizio", "zh-CN": "游戏开始时获得+1把锤子" },
  "random-peek-2": { ko: "3분마다 랜덤 카드 2장을 2초간 공개", en: "Reveal 2 random cards for 2 seconds every 3 minutes", th: "เปิดไพ่สุ่ม 2 ใบเป็นเวลา 2 วินาทีทุก 3 นาที", ja: "3分ごとにランダムなカード2枚を2秒間公開", fr: "Révèle 2 cartes aléatoires pendant 2 secondes toutes les 3 minutes", de: "Deckt alle 3 Minuten 2 zufällige Karten 2 Sekunden lang auf", es: "Revela 2 cartas al azar durante 2 segundos cada 3 minutos", hi: "हर 3 मिनट में 2 यादृच्छिक कार्ड 2 सेकंड के लिए दिखाएं", vi: "Hiện 2 lá ngẫu nhiên trong 2 giây mỗi 3 phút", ru: "Открывает 2 случайные карты на 2 секунды каждые 3 минуты", "es-MX": "Revela 2 cartas al azar durante 2 segundos cada 3 minutos", id: "Tampilkan 2 kartu acak selama 2 detik setiap 3 menit", it: "Rivela 2 carte casuali per 2 secondi ogni 3 minuti", "zh-CN": "每3分钟随机展示2张牌2秒" },
  "time-90": { ko: "90초마다 경과시간 1초 단축", en: "Reduce elapsed time by 1 second every 90 seconds", th: "ลดเวลาที่ผ่านไป 1 วินาทีทุก 90 วินาที", ja: "90秒ごとに経過時間を1秒短縮", fr: "Réduit le temps écoulé de 1 seconde toutes les 90 secondes", de: "Verkürzt die verstrichene Zeit alle 90 Sekunden um 1 Sekunde", es: "Reduce 1 segundo del tiempo transcurrido cada 90 segundos", hi: "हर 90 सेकंड में बीता समय 1 सेकंड कम करें", vi: "Giảm 1 giây thời gian đã trôi qua mỗi 90 giây", ru: "Сокращает прошедшее время на 1 секунду каждые 90 секунд", "es-MX": "Reduce 1 segundo del tiempo transcurrido cada 90 segundos", id: "Kurangi waktu berlalu 1 detik setiap 90 detik", it: "Riduce di 1 secondo il tempo trascorso ogni 90 secondi", "zh-CN": "每90秒减少已用时间1秒" },
  "foundation-bonus": { ko: "파운데이션 완성 시 +1 보너스", en: "+1 bonus when completing a foundation", th: "+1 โบนัสเมื่อสร้างฐานสำเร็จ", ja: "ファンデーション完成時に+1ボーナス", fr: "+1 bonus à chaque fondation terminée", de: "+1 Bonus beim Abschließen eines Fundaments", es: "+1 de bonificación al completar una base", hi: "फाउंडेशन पूरा होने पर +1 बोनस", vi: "+1 điểm thưởng khi hoàn thành một nền", ru: "+1 бонус при завершении основания", "es-MX": "+1 de bonificación al completar una base", id: "+1 bonus saat fondasi selesai", it: "+1 bonus quando completi una fondazione", "zh-CN": "完成一个基础区时获得+1奖励" },
  "boss-hammer": { ko: "보스 클리어 시 추가 망치 +2", en: "+2 additional hammers after clearing a boss", th: "+2 ค้อนเพิ่มเติมหลังชนะบอส", ja: "ボスクリア時に追加ハンマー+2", fr: "+2 marteaux supplémentaires après avoir vaincu un boss", de: "+2 zusätzliche Hämmer nach einem Boss-Sieg", es: "+2 martillos adicionales al derrotar a un jefe", hi: "बॉस क्लियर करने पर +2 अतिरिक्त हथौड़े", vi: "+2 búa thêm sau khi hạ boss", ru: "+2 дополнительных молотка после победы над боссом", "es-MX": "+2 martillos adicionales al derrotar a un jefe", id: "+2 palu tambahan setelah mengalahkan bos", it: "+2 martelli aggiuntivi dopo aver sconfitto un boss", "zh-CN": "击败Boss后额外获得+2把锤子" },
};

export function getBadgeAbility(id: string): BadgeAbility {
  return ABILITIES[id] ?? { kind: "score-move-10", value: 20, intervalMoves: 10 };
}

export function getBadgeAbilityText(id: string, language: SupportedLanguage): string {
  return TEXT[getBadgeAbility(id).kind][language];
}
