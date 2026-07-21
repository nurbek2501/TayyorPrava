// O'zbek lotin -> kirill avto-o'girish (admin "Test tekshirish" da jonli ishlatiladi).
// Manba: test-checker dasturining translit mantig'i. Natijani tahrirlasa bo'ladi.

const DI: Record<string, string> = {
  sh: "ш", ch: "ч", yo: "ё", yu: "ю", ya: "я", ye: "е",
};
const ONE: Record<string, string> = {
  a: "а", b: "б", c: "с", d: "д", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с",
  t: "т", u: "у", v: "в", w: "в", x: "х", y: "й", z: "з",
};

function normApos(s: string): string {
  return s.replace(/[ʻ’‘`´ʼ]/g, "'");
}

function matchCase(cyr: string, latinFirst: string): string {
  return latinFirst === latinFirst.toUpperCase() && latinFirst !== latinFirst.toLowerCase()
    ? cyr.toUpperCase()
    : cyr;
}

export function latToCyr(input: string): string {
  let s = normApos(input || "");
  // o'/g' -> ў/ғ (digraflardan oldin)
  s = s.replace(/[oO]'/g, (m) => (m[0] === "O" ? "Ў" : "ў"));
  s = s.replace(/[gG]'/g, (m) => (m[0] === "G" ? "Ғ" : "ғ"));

  const out: string[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    const two = s.slice(i, i + 2).toLowerCase();
    const low = ch.toLowerCase();
    if (DI[two]) {
      out.push(matchCase(DI[two], ch));
      i += 2;
      continue;
    }
    if (low === "e") {
      const prev = i > 0 ? s[i - 1] : "";
      const initial = i === 0 || !/[a-zа-яёўғқҳ']/i.test(prev);
      out.push(matchCase(initial ? "э" : "е", ch));
      i += 1;
      continue;
    }
    if (ONE[low]) {
      out.push(matchCase(ONE[low], ch));
      i += 1;
      continue;
    }
    if (ch === "'") {
      out.push("ъ"); // tutuq belgisi
      i += 1;
      continue;
    }
    out.push(ch); // raqam, probel, tinish belgisi
    i += 1;
  }
  return out.join("");
}
