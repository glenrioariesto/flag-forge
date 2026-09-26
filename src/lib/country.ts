/**
 * Pure country-code parser for live-chat messages.
 * Aliases are checked FIRST so words like "INDONESIA" resolve correctly
 * (previously the generic 2-4 char rule shadowed them).
 */

const ALIASES: Array<{ keys: string[]; code: string }> = [
    { keys: ["INDONESIA", "INDO"], code: "ID" },
    { keys: ["AMERICA", "USA"], code: "US" },
    { keys: ["JAPAN", "NIPPON"], code: "JP" },
    { keys: ["KOREA"], code: "KR" },
    { keys: ["BRAZIL"], code: "BR" },
    { keys: ["GERMANY"], code: "DE" },
    { keys: ["FRANCE"], code: "FR" },
];

// ISO 3166-1 alpha-2 codes for every country the game currently knows how to
// render/spawn (flagcdn serves the full set, so all 249 are renderable).
// Anything outside this set falls back to text (no 404 spam, no junk-code
// leaderboard entries).
const ISO_CODES = new Set(
    (
        "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ " +
        "BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
        "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
        "DE DJ DK DM DO DZ " +
        "EC EE EG EH ER ES ET " +
        "FI FJ FK FM FO FR " +
        "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY " +
        "HK HM HN HR HT HU " +
        "ID IE IL IM IN IO IQ IR IS IT " +
        "JE JM JO JP " +
        "KE KG KH KI KM KN KP KR KW KY KZ " +
        "LA LB LC LI LK LR LS LT LU LV LY " +
        "MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
        "NA NC NE NF NG NI NL NO NP NR NU NZ " +
        "OM " +
        "PA PE PF PG PH PK PL PM PN PR PS PT PW PY " +
        "QA " +
        "RE RO RS RU RW " +
        "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ " +
        "TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
        "UA UG UM US UY UZ " +
        "VA VC VE VG VI VN VU " +
        "WF WS " +
        "YE YT " +
        "ZA ZM ZW"
    ).split(" "),
);

export function extractCountryCode(text: string): string | null {
    const cleaned = (text || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
    if (!cleaned) return null;

    for (const alias of ALIASES) {
        if (alias.keys.some((k) => cleaned.includes(k))) return alias.code;
    }

    if (cleaned.length < 2 || cleaned.length > 4) return null;
    const candidate = cleaned.slice(0, 2);
    return ISO_CODES.has(candidate) ? candidate : null;
}
