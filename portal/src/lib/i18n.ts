import { cookies } from "next/headers";
import { BRAND } from "@taptapsell/brand";

// English and Urdu for the customer portal. Urdu pages are laid out right to
// left. The choice is kept in a cookie; without one, the phone's language
// decides. Shop, program and reward names stay as each business wrote them.

export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "ttp_lang";

const en = {
  "nav.cards": "Cards",
  "nav.rewards": "Rewards",
  "nav.me": "Me",
  "nav.notifications": "Notifications",
  "nav.notificationsNew": "Notifications, {n} new",
  "home.heroTitle": "Loyalty cards that live on your phone.",
  "home.heroBody":
    "Collect stamps at the shops you love and earn rewards. Tap your phone on the {brand} stamper at the counter: no app to install, no paper card to lose.",
  "home.getStarted": "Get started",
  "home.signIn": "Sign in",
  "home.howTitle": "How it works",
  "home.step1Title": "Tap",
  "home.step1Body": "After you pay, hold your phone near the stamper on the counter.",
  "home.step2Title": "Collect",
  "home.step2Body": "A stamp lands on your card straight away. Each shop has its own card.",
  "home.step3Title": "Enjoy",
  "home.step3Body": "Fill the card, then show your reward code at the counter.",
  "home.whyTitle": "Every visit counts",
  "home.whyBody":
    "Neighbourhood shops run on regulars. {brand} gives them a simple way to say thank you, and gives you more from the places you already love.",
  "home.sampleShop": "Chai Corner",
  "home.sampleReward": "Free chai on your 10th visit",
  "home.businessTitle": "Run a shop?",
  "home.businessBody": "Bring your regulars back with digital stamp cards. No printing, no app.",
  "home.businessCta": "{brand} for businesses",
  "home.navBusiness": "For businesses",
  "home.eyebrow": "No app. No paper. Just tap.",
  "home.heroNote": "Free for customers · Works on any phone",
  "home.stamperHint": "Drag to spin · Tap to stamp",
  "home.stamperLabel":
    "3D model of the {brand} stamper. Drag to turn it, or press Enter to add a stamp to the sample card.",
  "home.stampCount": "{count} of 10 stamps",
  "home.rewardUnlocked": "Reward unlocked! Show your code at the counter.",
  "home.howBody": "Three steps at the counter. Nothing to download.",
  "home.placesTitle": "Collect stamps at",
  "home.place1": "Cafés",
  "home.place2": "Bakeries",
  "home.place3": "Salons",
  "home.place4": "Juice bars",
  "home.place5": "Pharmacies",
  "home.place6": "Burger joints",
  "home.place7": "Sweet shops",
  "home.place8": "Bookshops",
  "home.feature1Title": "No app to install",
  "home.feature1Body": "Your card opens in the browser. Add it to your home screen if you like.",
  "home.feature2Title": "Every shop, one place",
  "home.feature2Body": "Cards from every {brand} shop you visit, together on one page.",
  "home.feature3Title": "Rewards you can see",
  "home.feature3Body": "Watch each card fill up, and get a reminder before a reward runs out.",
  "home.feature4Title": "Phone cannot tap?",
  "home.feature4Body": "Show your code at the counter and the staff will scan it instead.",
  "home.madeIn": "Made in Pakistan",
  "home.deleted": "Your account has been deleted.",
  "signin.title": "Welcome to {brand}",
  "signin.subtitle": "Sign in or create your account with your email.",
  "signin.back": "Back to home",
  "cards.title": "My cards",
  "cards.emptyTitle": "No cards yet",
  "cards.emptyBody": "Tap a {brand} stamper at any participating shop to get your first card.",
  "cards.shop": "Shop",
  "card.stamps": "{n} of {m} stamps",
  "card.expiry": "Stamps expire after {days} days without a visit. Visit by {date} to keep them.",
  "card.expired": "{n} stamps expired on {date}. Your next visit starts a new card.",
  "card.result.stamped": "Stamp added. Thank you for your visit!",
  "card.result.unlocked": "You earned a reward! Show the code below at the counter.",
  "card.result.joined": "You are in! Tap the stamper again to collect your first stamp.",
  "card.error.STAMP_COOLDOWN": "You already got a stamp here a moment ago. One stamp per visit.",
  "card.error.DAILY_STAMP_LIMIT":
    "You have collected today's stamps for this card. Come back tomorrow!",
  "card.error.TAP_EXPIRED": "That tap expired. Tap the stamper again to collect your stamp.",
  "card.error.TAP_ALREADY_USED": "That tap was already used. Tap the stamper again.",
  "card.error.NOT_ENROLLED": "Join this shop's card first, then tap again.",
  "card.yourReward": "Your reward",
  "card.showCode": "Show this code to the staff to redeem.",
  "card.useBy": "Use by {date}.",
  "rewards.title": "Rewards",
  "rewards.used": "Used",
  "rewards.none": "No rewards waiting. Keep collecting stamps!",
  "card.errorGeneric": "That stamp did not go through. Please tap the stamper again.",
  "notifications.title": "Notifications",
  "notifications.empty": "Nothing yet. Stamps, rewards and reminders show up here.",
  "profile.title": "Me",
  "profile.whatsapp": "Offers on WhatsApp",
  "profile.whatsappHelp": "Choose which shops may message you. You can change this any time.",
  "profile.addNumberFirst": " Add your mobile number above first.",
  "profile.allow": "Allow",
  "profile.allowed": "Allowed",
  "profile.download": "Download my data",
  "profile.signOut": "Sign out",
  "profile.language": "Language",
  "nfc.button": "Tap the stamper with this page",
  "nfc.listening": "Hold your phone near the stamper…",
  "nfc.notOurs": "That is not a {brand} stamper. Try the one at the counter.",
  "nfc.readError": "Could not read the stamper. Hold the phone still and try again.",
  "nfc.off": "NFC is off or not allowed. Turn on NFC in your phone settings and try again.",
  "pwa.offline":
    "You are offline. This is your card as last loaded; new stamps appear when you are back online.",
  "pwa.installAndroid": "Add {brand} to your home screen to open your cards in one tap.",
  "pwa.installIos": "Add {brand} to your home screen: tap Share, then Add to Home Screen.",
  "pwa.add": "Add",
  "pwa.notNow": "Not now",
} as const;

export type MessageKey = keyof typeof en;

const ur: Record<MessageKey, string> = {
  "nav.cards": "کارڈز",
  "nav.rewards": "انعامات",
  "nav.me": "میں",
  "nav.notifications": "اطلاعات",
  "nav.notificationsNew": "اطلاعات، {n} نئی",
  "home.heroTitle": "لائلٹی کارڈز، اب آپ کے فون میں۔",
  "home.heroBody":
    "اپنی پسندیدہ دکانوں سے اسٹیمپ جمع کریں اور انعام پائیں۔ کاؤنٹر پر رکھے {brand} اسٹیمپر پر فون ٹیپ کریں: نہ کوئی ایپ انسٹال کرنی، نہ کاغذی کارڈ سنبھالنا۔",
  "home.getStarted": "شروع کریں",
  "home.signIn": "سائن ان",
  "home.howTitle": "یہ کیسے کام کرتا ہے",
  "home.step1Title": "ٹیپ کریں",
  "home.step1Body": "ادائیگی کے بعد اپنا فون کاؤنٹر پر رکھے اسٹیمپر کے قریب لائیں۔",
  "home.step2Title": "جمع کریں",
  "home.step2Body": "اسٹیمپ فوراً آپ کے کارڈ پر لگ جاتا ہے۔ ہر دکان کا اپنا کارڈ ہوتا ہے۔",
  "home.step3Title": "مزے کریں",
  "home.step3Body": "کارڈ پورا کریں، پھر کاؤنٹر پر اپنا انعامی کوڈ دکھائیں۔",
  "home.whyTitle": "ہر بار آنا اہم ہے",
  "home.whyBody":
    "محلے کی دکانیں اپنے مستقل گاہکوں سے چلتی ہیں۔ {brand} انہیں شکریہ کہنے کا آسان طریقہ دیتا ہے، اور آپ کو اپنی پسندیدہ جگہوں سے زیادہ فائدہ۔",
  "home.sampleShop": "چائے کارنر",
  "home.sampleReward": "دسویں بار آنے پر مفت چائے",
  "home.businessTitle": "دکان چلاتے ہیں؟",
  "home.businessBody":
    "ڈیجیٹل اسٹیمپ کارڈز سے اپنے گاہکوں کو بار بار واپس لائیں۔ نہ چھپائی، نہ ایپ۔",
  "home.businessCta": "کاروبار کے لیے {brand}",
  "home.navBusiness": "کاروبار کے لیے",
  "home.eyebrow": "نہ ایپ، نہ کاغذ۔ بس ٹیپ کریں۔",
  "home.heroNote": "گاہکوں کے لیے مفت · ہر فون پر چلتا ہے",
  "home.stamperHint": "گھمانے کے لیے کھینچیں · اسٹیمپ کے لیے ٹیپ کریں",
  "home.stamperLabel":
    "{brand} اسٹیمپر کا تھری ڈی ماڈل۔ گھمانے کے لیے کھینچیں، یا نمونہ کارڈ پر اسٹیمپ لگانے کے لیے Enter دبائیں۔",
  "home.stampCount": "10 میں سے {count} اسٹیمپ",
  "home.rewardUnlocked": "انعام کھل گیا! کاؤنٹر پر اپنا کوڈ دکھائیں۔",
  "home.howBody": "کاؤنٹر پر تین قدم۔ کچھ ڈاؤن لوڈ نہیں کرنا۔",
  "home.placesTitle": "یہاں اسٹیمپ جمع کریں",
  "home.place1": "کیفے",
  "home.place2": "بیکریاں",
  "home.place3": "سیلون",
  "home.place4": "جوس کارنر",
  "home.place5": "فارمیسیاں",
  "home.place6": "برگر شاپس",
  "home.place7": "مٹھائی کی دکانیں",
  "home.place8": "کتابوں کی دکانیں",
  "home.feature1Title": "کوئی ایپ نہیں",
  "home.feature1Body": "آپ کا کارڈ براؤزر میں کھلتا ہے۔ چاہیں تو اسے ہوم اسکرین پر رکھ لیں۔",
  "home.feature2Title": "ہر دکان، ایک جگہ",
  "home.feature2Body": "ہر {brand} دکان کے کارڈز، ایک ہی صفحے پر۔",
  "home.feature3Title": "انعام سامنے نظر آئیں",
  "home.feature3Body": "ہر کارڈ کو بھرتا دیکھیں، اور انعام ختم ہونے سے پہلے یاد دہانی پائیں۔",
  "home.feature4Title": "فون ٹیپ نہیں کرتا؟",
  "home.feature4Body": "کاؤنٹر پر اپنا کوڈ دکھائیں، عملہ اسے اسکین کر لے گا۔",
  "home.madeIn": "پاکستان میں بنایا گیا",
  "home.deleted": "آپ کا اکاؤنٹ ختم کر دیا گیا ہے۔",
  "signin.title": "{brand} میں خوش آمدید",
  "signin.subtitle": "اپنی ای میل سے سائن ان کریں یا نیا اکاؤنٹ بنائیں۔",
  "signin.back": "واپس ہوم پر",
  "cards.title": "میرے کارڈز",
  "cards.emptyTitle": "ابھی کوئی کارڈ نہیں",
  "cards.emptyBody": "اپنا پہلا کارڈ پانے کے لیے کسی بھی شریک دکان پر {brand} اسٹیمپر کو ٹیپ کریں۔",
  "cards.shop": "دکان",
  "card.stamps": "{m} میں سے {n} اسٹیمپ",
  "card.expiry":
    "اگر {days} دن تک نہ آئیں تو اسٹیمپ ختم ہو جاتے ہیں۔ انہیں بچانے کے لیے {date} تک آئیں۔",
  "card.expired": "{date} کو {n} اسٹیمپ ختم ہو گئے۔ اگلی بار نیا کارڈ شروع ہوگا۔",
  "card.result.stamped": "اسٹیمپ لگ گیا۔ آنے کا شکریہ!",
  "card.result.unlocked": "آپ نے انعام جیت لیا! نیچے دیا گیا کوڈ کاؤنٹر پر دکھائیں۔",
  "card.result.joined": "آپ شامل ہو گئے! پہلا اسٹیمپ لینے کے لیے اسٹیمپر کو دوبارہ ٹیپ کریں۔",
  "card.error.STAMP_COOLDOWN": "آپ کو ابھی یہاں اسٹیمپ ملا ہے۔ ہر بار آنے پر ایک اسٹیمپ۔",
  "card.error.DAILY_STAMP_LIMIT": "آج کے اسٹیمپ پورے ہو گئے۔ کل دوبارہ آئیں!",
  "card.error.TAP_EXPIRED": "یہ ٹیپ پرانا ہو گیا۔ اسٹیمپ کے لیے اسٹیمپر کو دوبارہ ٹیپ کریں۔",
  "card.error.TAP_ALREADY_USED": "یہ ٹیپ پہلے استعمال ہو چکا ہے۔ اسٹیمپر کو دوبارہ ٹیپ کریں۔",
  "card.error.NOT_ENROLLED": "پہلے اس دکان کا کارڈ لیں، پھر دوبارہ ٹیپ کریں۔",
  "card.yourReward": "آپ کا انعام",
  "card.showCode": "انعام لینے کے لیے یہ کوڈ عملے کو دکھائیں۔",
  "card.useBy": "{date} تک استعمال کریں۔",
  "rewards.title": "انعامات",
  "rewards.used": "استعمال شدہ",
  "rewards.none": "ابھی کوئی انعام نہیں۔ اسٹیمپ جمع کرتے رہیں!",
  "card.errorGeneric": "اسٹیمپ نہیں لگا۔ براہ کرم اسٹیمپر کو دوبارہ ٹیپ کریں۔",
  "notifications.title": "اطلاعات",
  "notifications.empty": "ابھی کچھ نہیں۔ اسٹیمپ، انعامات اور یاد دہانیاں یہاں نظر آئیں گی۔",
  "profile.title": "میں",
  "profile.whatsapp": "واٹس ایپ پر آفرز",
  "profile.whatsappHelp":
    "چنیں کون سی دکانیں آپ کو پیغام بھیج سکتی ہیں۔ آپ یہ کبھی بھی بدل سکتے ہیں۔",
  "profile.addNumberFirst": " پہلے اوپر اپنا موبائل نمبر درج کریں۔",
  "profile.allow": "اجازت دیں",
  "profile.allowed": "اجازت ہے",
  "profile.download": "میرا ڈیٹا ڈاؤن لوڈ کریں",
  "profile.signOut": "سائن آؤٹ",
  "profile.language": "زبان",
  "nfc.button": "اس صفحے سے اسٹیمپر ٹیپ کریں",
  "nfc.listening": "فون کو اسٹیمپر کے قریب رکھیں…",
  "nfc.notOurs": "یہ {brand} اسٹیمپر نہیں ہے۔ کاؤنٹر والا آزمائیں۔",
  "nfc.readError": "اسٹیمپر پڑھا نہیں جا سکا۔ فون کو ساکن رکھ کر دوبارہ کوشش کریں۔",
  "nfc.off": "NFC بند ہے یا اجازت نہیں۔ فون کی سیٹنگز میں NFC آن کر کے دوبارہ کوشش کریں۔",
  "pwa.offline":
    "آپ آف لائن ہیں۔ یہ آپ کا آخری بار کھولا گیا کارڈ ہے؛ نئے اسٹیمپ آن لائن ہونے پر نظر آئیں گے۔",
  "pwa.installAndroid": "کارڈز ایک ٹیپ میں کھولنے کے لیے {brand} کو ہوم اسکرین پر لگائیں۔",
  "pwa.installIos": "{brand} کو ہوم اسکرین پر لگائیں: Share دبائیں، پھر Add to Home Screen۔",
  "pwa.add": "لگائیں",
  "pwa.notNow": "ابھی نہیں",
};

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, ur };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ur";
}

/** The visitor's language: their choice, else the phone's, else English. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  const { headers } = await import("next/headers");
  const accept = (await headers()).get("accept-language") ?? "";
  return /^ur\b|,\s*ur\b/i.test(accept) ? "ur" : "en";
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translator(locale: Locale): Translate {
  const dictionary = DICTIONARIES[locale];
  // {brand} is filled in everywhere, so the product name lives in one place.
  return (key, vars) => {
    const all: Record<string, string | number> = { brand: BRAND.name, ...vars };
    return dictionary[key].replace(/\{(\w+)\}/g, (_, name: string) => String(all[name] ?? ""));
  };
}

/** For server components: the visitor's translator. */
export async function getT(): Promise<Translate> {
  return translator(await getLocale());
}

/** Messages a client component needs, picked on the server. */
export function pick<K extends MessageKey>(t: Translate, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, t(k)])) as Record<K, string>;
}
