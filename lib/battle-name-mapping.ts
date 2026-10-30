import type { SupportedLanguage } from "./i18n";

type Names = Partial<Record<SupportedLanguage, string>> & { en: string };

const NAMES: Record<string, Names> = {
  anglerfish: { en: "Deep Anglerfish", ko: "심해 아귀", ja: "深海アンコウ", "zh-CN": "深海鮟鱇", es: "Pez linterna abisal", fr: "Baudroie abyssale", de: "Tiefseeangler", it: "Rana pescatrice abissale" },
  "blue-shark": { en: "Blue Shark", ko: "푸른 상어", ja: "青いサメ", "zh-CN": "蓝鲨", es: "Tiburón azul", fr: "Requin bleu", de: "Blauer Hai", it: "Squalo blu" },
  pufferfish: { en: "Royal Pufferfish", ko: "왕복어", ja: "ロイヤルフグ", "zh-CN": "皇家河豚", es: "Pez globo real", fr: "Poisson-globe royal", de: "Königskugelfisch", it: "Pesce palla reale" },
  "jellyfish-mage": { en: "Jellyfish Mage", ko: "해파리 마도사", ja: "クラゲ魔導師", "zh-CN": "水母法师", es: "Mago medusa", fr: "Mage méduse", de: "Quallenmagier", it: "Mago medusa" },
  "hermit-cannon": { en: "Hermit Cannoner", ko: "소라 대포병", ja: "ヤドカリ砲兵", "zh-CN": "寄居蟹炮手", es: "Cañonero ermitaño", fr: "Canonnier ermite", de: "Einsiedlerkanonier", it: "Cannoniere eremita" },
  "coral-golem": { en: "Coral Golem", ko: "산호 골렘", ja: "珊瑚ゴーレム", "zh-CN": "珊瑚魔像", es: "Gólem de coral", fr: "Golem de corail", de: "Korallengolem", it: "Golem di corallo" },
  "seahorse-caster": { en: "Seahorse Caster", ko: "해마 주문술사", ja: "タツノオトシゴ術師", "zh-CN": "海马术士", es: "Hechicero caballito de mar", fr: "Lanceur hippocampe", de: "Seepferdchenzauberer", it: "Incantatore cavalluccio" },
  "squid-mage": { en: "Squid Mage", ko: "오징어 마법사", ja: "イカ魔術師", "zh-CN": "鱿鱼法师", es: "Mago calamar", fr: "Mage calmar", de: "Tintenfischmagier", it: "Mago calamaro" },
  "moonveil-witchfish": { en: "Moonveil Witchfish", ko: "문베일 마녀어", ja: "ムーンベール魔女魚", "zh-CN": "月幕巫鱼", es: "Pez bruja Velo Lunar", fr: "Poisson-sorcière Voile lunaire", de: "Mondschleier-Hexenfisch", it: "Pesce strega Velo lunare" },
  "tideforge-crab": { en: "Tideforge Crab", ko: "타이드포지 게", ja: "タイドフォージガニ", "zh-CN": "潮铸螃蟹", es: "Cangrejo Forjamareas", fr: "Crabe Forge-marée", de: "Gezeiten-Schmiedekrabbe", it: "Granchio Forgiamarea" },
  "abyssal-clockwork-eel": { en: "Abyssal Clockwork Eel", ko: "심연 시계태엽 장어", ja: "深淵のぜんまいウナギ", "zh-CN": "深渊发条鳗", es: "Anguila mecánica abisal", fr: "Anguille mécanique abyssale", de: "Abyssaaler Uhrwerk-Aal", it: "Anguilla meccanica abissale" },
  "reefstone-minotaur": { en: "Reefstone Minotaur", ko: "리프스톤 미노타우로스", ja: "リーフストーン・ミノタウロス", "zh-CN": "礁石牛头人", es: "Minotauro Piedraarrecife", fr: "Minotaure Pierre-récif", de: "Riffstein-Minotaurus", it: "Minotauro Pietrareefo" },
  "stormshell-oracle": { en: "Stormshell Oracle", ko: "스톰셸 오라클", ja: "ストームシェルの神託者", "zh-CN": "风暴壳预言者", es: "Oráculo Conchatormenta", fr: "Oracle Coquille-tempête", de: "Sturmschalen-Orakel", it: "Oracolo Conchiglia-tempesta" },
  "emberkelp-knight": { en: "Emberkelp Knight", ko: "엠버켈프 기사", ja: "エンバーケルプ騎士", "zh-CN": "余烬海带骑士", es: "Caballero Quelpoascua", fr: "Chevalier varech-braise", de: "Glutkelp-Ritter", it: "Cavaliere Kelpbrace" },
  "cloud-tiger": { en: "Cloud Tiger", ko: "구름 호랑이", ja: "雲のトラ", "zh-CN": "云虎", es: "Tigre de nube", fr: "Tigre des nuages", de: "Wolkentiger", it: "Tigre delle nuvole" },
  "gumiho-tail": { en: "Gumiho Tail", ko: "구미호 꼬리", ja: "九尾狐のしっぽ", "zh-CN": "九尾狐尾巴", es: "Cola de gumiho", fr: "Queue de gumiho", de: "Gumiho-Schwanz", it: "Coda di gumiho" },
  "mochi-rabbit": { en: "Mochi Rabbit", ko: "모찌 토끼", ja: "もちウサギ", "zh-CN": "麻薯兔", es: "Conejo mochi", fr: "Lapin mochi", de: "Mochi-Kaninchen", it: "Coniglio mochi" },
};

export function getLocalizedBattleName(id: string, fallback: string, language: SupportedLanguage): string {
  return NAMES[id]?.[language] ?? NAMES[id]?.en ?? fallback;
}
