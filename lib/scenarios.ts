import { getPhraseById } from "./phrases";
import type { Scenario } from "./types";

/**
 * Scenario Mode —— 把已有短语重组成「按真实顺序走一遍」的流程页。
 *
 * 为什么这么设计（别改成"再加一批句子"）：
 *  1. 每一步只引用 data/phrases.json 里**已经存在**的短语 id（sayId），
 *     音频、单句页、收藏、逐词表全部复用 —— 零新音频、零新 slug。
 *  2. 真正的信息增量是 `theySay`（对方会怎么回）和 `note`（什么时候说、
 *     会踩什么坑）。分类页是「有什么句子」，这里答的是「先说什么、对方回什么」。
 *  3. 标题刻意对齐真实搜索意图（airport / taxi / hotel / ordering food /
 *     paying / getting around），而不是"攻略"式的去哪玩。
 */
export const SCENARIOS: Scenario[] = [
  {
    slug: "arriving-at-the-airport",
    emoji: "🛬",
    name: "Arriving at the airport",
    blurb: "Immigration, questions and getting out of the terminal.",
    h1: "At the airport in Chinese: from landing to the taxi rank",
    metaTitle: "Airport Chinese: landing, immigration and getting out",
    description:
      "The Chinese you need in your first hour in China — immigration questions, baggage claim and getting to the taxi rank, in the order you'll use them.",
    intro: [
      "Immigration is the first place anyone speaks Chinese at you at full speed, and it happens about an hour after you land. Nothing here is a conversation: you get asked three or four short questions and you give three or four short answers.",
      "Airport staff deal with foreigners all day, so they will repeat themselves, point and slow down. Your job is to recognise the question, not to speak well. Two things are worth doing on the plane: screenshot your hotel's Chinese name and address, and keep a power bank in your carry-on.",
    ],
    steps: [
      {
        sayId: 20,
        title: "Hand over your passport",
        theySay: {
          zh: "请出示护照。",
          py: "Qǐng chūshì hùzhào.",
          en: "Please show your passport.",
        },
        note: "You'll hear this at 边检 (biānjiǎn, border control). Have the passport already open at the photo page, and if the airline handed out an arrival card (入境卡) on the plane, fill it in before you reach the desk.",
      },
      {
        sayId: 80,
        title: "Answer why you're here",
        theySay: {
          zh: "来中国做什么？",
          py: "Lái Zhōngguó zuò shénme?",
          en: "What are you here for?",
        },
        note: "One word is a complete answer: 旅游 (lǚyóu, tourism) or 商务 (shāngwù, business). The officer isn't making conversation, so don't add detail — long answers are what send you to the side room.",
      },
      {
        sayId: 16,
        title: "Say the language problem first",
        theySay: {
          zh: "你会说中文吗？",
          py: "Nǐ huì shuō Zhōngwén ma?",
          en: "Do you speak Chinese?",
        },
        note: "Saying this before the questions start is what makes people switch to simple words, gestures, or the colleague who speaks some English. It costs one sentence and saves you the whole queue.",
      },
      {
        sayId: 48,
        title: "When it's too fast to follow",
        theySay: {
          zh: "我说慢一点。",
          py: "Wǒ shuō màn yīdiǎn.",
          en: "I'll speak more slowly.",
        },
        note: "Chinese airport announcements and staff speech run fast, and it is normal to catch only the first two words. Staff will also often just point — follow the finger, not the sentence.",
      },
      {
        sayId: 11,
        title: "Find the bathroom before the taxi queue",
        theySay: {
          zh: "在那边。",
          py: "Zài nàbiān.",
          en: "Over there.",
        },
        note: "The sign on the wall says 厕所 (cèsuǒ); the politer word you'll hear staff use is 洗手间 (xǐshǒujiān). Both mean the same thing, so don't wait for the word you learned.",
      },
      {
        sayId: 17,
        title: "Ask a member of staff",
        theySay: {
          zh: "有什么可以帮您？",
          py: "Yǒu shénme kěyǐ bāng nín?",
          en: "What can I help you with?",
        },
        note: "There is always an information desk (问询处) near arrivals. Asking staff beats asking a stranger — they know where the taxi rank is, and they are used to being asked in broken Chinese.",
      },
    ],
    alsoIds: [57, 12, 14],
    faq: [
      {
        q: "Do I need to speak Chinese to get through immigration in China?",
        a: "No. Immigration officers ask a small, predictable set of questions — your passport, your purpose of visit and how long you're staying — and airport staff deal with non-Chinese speakers every day. Two phrases usually cover it: 这是我的护照 (here is my passport) and 我是游客 (I'm a tourist).",
      },
      {
        q: "What Chinese will I hear at immigration?",
        a: "The most common are 请出示护照 (please show your passport), 来中国做什么 (what are you here for), and 待几天 (how many days are you staying). Answers can be a single word — 旅游 for tourism, 商务 for business.",
      },
      {
        q: "How do I get from the airport to my hotel without speaking Chinese?",
        a: "Use the official taxi rank outside arrivals rather than anyone who approaches you inside the terminal, and have your hotel address saved in Chinese on your phone. 请带我去这个地址 (please take me to this address) plus the screenshot gets you there; see the taxi guide for the rest.",
      },
    ],
  },
  {
    slug: "taking-a-taxi",
    emoji: "🚕",
    name: "Taking a taxi or Didi",
    blurb: "Give the address, check the price, pay by QR code.",
    h1: "Taking a taxi in Chinese: the address, the price and the payment",
    metaTitle: "Taxi Chinese: give your address and pay by QR",
    description:
      "Four things you say in a Chinese taxi — hand over the address, ask how long, check the price, pay by QR code — with pinyin and audio for each phrase.",
    intro: [
      "Taxis in China are cheap, metered and everywhere. The hard part is the first ten seconds: the driver needs your destination in Chinese, and a spoken street address usually means nothing to them.",
      "So the most useful preparation is not a sentence, it's a screenshot. Save your hotel's Chinese name and address where you can show it without unlocking your phone — and ask the hotel front desk to write it out for you when you check out.",
    ],
    steps: [
      {
        sayId: 55,
        title: "Show the address, then say it",
        theySay: {
          zh: "好的，上车吧。",
          py: "Hǎo de, shàng chē ba.",
          en: "OK, get in.",
        },
        note: "Show the screenshot first, then read the sentence. Chinese addresses run largest-to-smallest (city, district, street, building) — the opposite of English — which is another reason not to try reading one aloud from your booking email.",
      },
      {
        sayId: 13,
        title: "If the driver isn't sure where",
        theySay: {
          zh: "哪里？再说一遍。",
          py: "Nǎlǐ? Zài shuō yí biàn.",
          en: "Where? Say that again.",
        },
        note: "这里 (zhèlǐ) is here and 哪里 (nǎlǐ) is where — nearly the same sound, and the tone is all that separates them. Having the address on screen makes this step unnecessary, which is exactly the point.",
      },
      {
        sayId: 56,
        title: "Ask how long before you set off",
        theySay: {
          zh: "大概四十分钟。",
          py: "Dàgài sìshí fēnzhōng.",
          en: "About forty minutes.",
        },
        note: "Times come as 分钟 (fēnzhōng, minutes) and 小时 (xiǎoshí, hours). Rush hour roughly doubles any estimate — in Beijing and Shanghai the metro is often the faster option, and drivers will happily tell you so.",
      },
      {
        sayId: 1,
        title: "Check the meter, not the price",
        theySay: {
          zh: "打表，三十八。",
          py: "Dǎ biǎo, sānshíbā.",
          en: "On the meter — thirty-eight.",
        },
        note: "打表 (dǎ biǎo) means the meter is running; taxis at the official rank always do. Anyone approaching you inside an airport or station offering a car is not the official rank — walk outside instead.",
      },
      {
        sayId: 97,
        title: "Settle payment before you arrive",
        theySay: {
          zh: "微信还是支付宝？",
          py: "Wēixìn háishì Zhīfùbǎo?",
          en: "WeChat or Alipay?",
        },
        note: "This is the most common question you'll be asked anywhere in China. Set up Alipay or WeChat Pay before you fly and link a card inside the app — many drivers no longer carry change, and a few won't take cash at all.",
      },
      {
        sayId: 95,
        title: "Pay by scanning",
        theySay: {
          zh: "你扫我。",
          py: "Nǐ sǎo wǒ.",
          en: "You scan me.",
        },
        note: "扫 (sǎo) means to scan. The driver will hold up a QR code or point at one stuck to the dashboard: scan it in Alipay or WeChat Pay, type the amount the meter shows, and confirm. Show them the green success screen before you get out.",
      },
      {
        sayId: 103,
        title: "Take the printed slip",
        theySay: {
          zh: "电子发票，在手机上。",
          py: "Diànzǐ fāpiào, zài shǒujī shàng.",
          en: "Electronic receipt, on your phone.",
        },
        note: "发票 (fāpiào) is the official tax invoice you need for expense claims; a plain payment record is 收据 (shōujù). Taxi meters print a small slip automatically — keep it, since it carries the car number and the fare if you leave something behind.",
      },
    ],
    alsoIds: [12, 96, 102],
    faq: [
      {
        q: "How do I tell a Chinese taxi driver where to go?",
        a: "Show the Chinese address on your phone and say 请带我去这个地址 (please take me to this address). Spoken addresses are unreliable because Chinese addresses run from city down to building; a screenshot of the hotel page in Chinese works every time.",
      },
      {
        q: "Can I pay a taxi in China with cash?",
        a: "Often, but not always — many drivers now expect QR payment and don't carry change. Alipay or WeChat Pay linked to a foreign card is the safe default; ask 收现金吗 (do you take cash?) before you get in if cash is all you have.",
      },
      {
        q: "Is it cheaper to take a taxi or Didi in China?",
        a: "They're usually within a few yuan of each other. Didi (in Alipay, or as its own app) avoids any conversation about the address because you type it in, which makes it the easier first ride if you're not confident speaking yet.",
      },
    ],
  },
  {
    slug: "checking-into-a-hotel",
    emoji: "🏨",
    name: "Checking into a hotel",
    blurb: "Booking, passports, rooms and leaving your bags.",
    h1: "Checking into a hotel in Chinese: booking, passport, room",
    metaTitle: "Hotel Chinese: check in, Wi-Fi, breakfast and bags",
    description:
      "From 我订了房间 to 我要退房 — what you say at a Chinese hotel front desk, and what the clerk will ask you back, with pinyin and audio.",
    intro: [
      "A Chinese hotel front desk is the easiest place in the country to speak bad Chinese: the conversation is a fixed script about bookings, passports, floors and breakfast times, and the staff have it hundreds of times a week.",
      "One thing to know before you arrive: every hotel in China registers its guests with the local police, and hotels that accept foreign guests copy your passport and visa page at check-in. That's routine, not suspicion — but it's also why a cheap hotel that can't register foreigners may refuse your booking at the door.",
    ],
    steps: [
      {
        sayId: 21,
        title: "Say you have a booking",
        theySay: {
          zh: "请问订房的名字是？",
          py: "Qǐngwèn dìngfáng de míngzi shì?",
          en: "May I ask what name the room was booked under?",
        },
        note: "Give the name exactly as it appears on the booking — the romanisation matters less than the spelling, and the clerk will spell it back to you on screen. Having the confirmation open on your phone shortens this step to pointing.",
      },
      {
        sayId: 23,
        title: "Ask to check in",
        theySay: {
          zh: "请出示护照。",
          py: "Qǐng chūshì hùzhào.",
          en: "Please show your passport.",
        },
        note: "One passport per guest, including children. If your booking is in a partner's name, expect them to need a passport too — the registration is per person, not per room.",
      },
      {
        sayId: 20,
        title: "Hand over your passport",
        theySay: {
          zh: "好的，请稍等。",
          py: "Hǎo de, qǐng shāoděng.",
          en: "OK, one moment please.",
        },
        note: "While they copy the passport they'll usually ask for a deposit (押金, yājīn), taken as a card pre-authorisation or a QR payment and returned at check-out. It's normal — ask for 押金多少 if you want the number up front.",
      },
      {
        sayId: 25,
        title: "Find out which floor",
        theySay: {
          zh: "五楼，这是房卡。",
          py: "Wǔ lóu, zhè shì fángkǎ.",
          en: "Fifth floor — here's your key card.",
        },
        note: "一楼 (yī lóu) is the ground floor, and lifts label it 1F — so a room on 五楼 is four levels up from the street. 房卡 (fángkǎ) is the key card; many hotels also need it in a slot inside the room before the lights work.",
      },
      {
        sayId: 26,
        title: "Get the Wi-Fi sorted",
        theySay: {
          zh: "密码在房卡上。",
          py: "Mìmǎ zài fángkǎ shàng.",
          en: "The password is on the key card.",
        },
        note: "Wi-Fi passwords are printed on the key card sleeve or on a card in the room as often as at the desk. Worth knowing: hotel Wi-Fi in China may not reach Google, WhatsApp or Instagram at all — set up your own data or a roaming eSIM before you rely on it.",
      },
      {
        sayId: 30,
        title: "Check the breakfast window",
        theySay: {
          zh: "早上七点到十点。",
          py: "Zǎoshang qī diǎn dào shí diǎn.",
          en: "From seven to ten in the morning.",
        },
        note: "Hotel breakfast in China is usually a 自助餐 (zìzhùcān, buffet) and closes sharply — the last half hour is cleared early. The same 几点 question asks opening and closing times for anything: 泳池几点开 (what time does the pool open).",
      },
      {
        sayId: 29,
        title: "Leave your bags after check-out",
        theySay: {
          zh: "可以，放这儿吧。",
          py: "Kěyǐ, fàng zhèr ba.",
          en: "Sure — leave them here.",
        },
        note: "Most hotels store bags for free on your last day, which is what makes an evening flight workable. Ask at the desk on the way out, not when you check out in a hurry.",
      },
      {
        sayId: 24,
        title: "Check out",
        theySay: {
          zh: "房卡给我，稍等。",
          py: "Fángkǎ gěi wǒ, shāoděng.",
          en: "Give me the key card, one moment.",
        },
        note: "Hand the card over while you say it. Two things to check before you go: the deposit has been released, and you haven't been charged for the minibar — the bill on screen is the one to read, not the one on paper.",
      },
    ],
    alsoIds: [22, 27, 28],
    faq: [
      {
        q: "How do you say “I have a booking” in Chinese?",
        a: "我订了房间 (Wǒ dìng le fángjiān) — literally “I booked a room”. The 了 marks it as already done. Have your confirmation on screen: the clerk will ask 请问订房的名字是 (what name is the booking under?) and match it against the computer.",
      },
      {
        q: "Do hotels in China ask for your passport?",
        a: "Yes. Every hotel registers guests with the local police, and hotels that can accept foreign guests copy your passport and visa page at check-in. It's a legal requirement rather than a choice, so it happens at five-star hotels and hostels alike.",
      },
      {
        q: "What should I ask at a Chinese hotel front desk?",
        a: "The questions that save the most time: 有 Wi-Fi 吗 (is there Wi-Fi?), 早餐几点开始 (what time does breakfast start?), 房间在几楼 (what floor is the room on?) and 可以寄存行李吗 (can I store my luggage?). All four are on this page with audio.",
      },
    ],
  },
  {
    slug: "ordering-food",
    emoji: "🍜",
    name: "Ordering food",
    blurb: "Menu, recommendations, spice and the bill.",
    h1: "Ordering food in Chinese: from menu to bill",
    metaTitle: "Ordering food in Chinese: menu, spice and the bill",
    description:
      "How to order food in Chinese — ask for a menu, get a recommendation, say how spicy, and ask for the bill. Nine phrases in eating order, with audio.",
    intro: [
      "Chinese menus are the reason most visitors give up and point. Even with a translation app you'll meet dishes that aren't in it, and the two things that decide whether you enjoy the meal — how spicy, and whether there's meat in it — are easy to get wrong by pointing alone.",
      "There's a shortcut worth knowing: in most Chinese restaurants the menu is now a QR code stuck to the table, and you order in the mini-program that opens. Screenshots and photos work as a translation aid there; the phrases below are what you need when you'd rather ask a person.",
    ],
    steps: [
      {
        sayId: 4,
        title: "Get a menu you can read",
        theySay: {
          zh: "有的，扫码点餐。",
          py: "Yǒu de, sǎo mǎ diǎncān.",
          en: "Yes — scan the code to order.",
        },
        note: "Two things happen at the door before anything else: you'll be asked 几位？ (jǐ wèi?, how many people?) and pointed at a table. Then comes the QR code. If you'd rather have a paper menu or order from a person, this sentence is what gets you there — 菜单 (càidān) is the word.",
      },
      {
        sayId: 51,
        title: "Ask what's good",
        theySay: {
          zh: "这个卖得最好。",
          py: "Zhège mài de zuì hǎo.",
          en: "This one sells best.",
        },
        note: "The single highest-value sentence in a restaurant you can't read. Servers will point at one or two dishes, and those are reliably the ones the kitchen is fast at and the regulars order — a much better bet than a translated menu.",
      },
      {
        sayId: 2,
        title: "Order by pointing",
        theySay: {
          zh: "好，还要别的吗？",
          py: "Hǎo, hái yào bié de ma?",
          en: "OK — anything else?",
        },
        note: "Point and say it; no full sentence needed. Where this really pays off is a 面馆 or street stall with no menu at all: point at what the next customer is eating, say 我要这个, and you're done.",
      },
      {
        sayId: 3,
        title: "Say it when you order, not after",
        theySay: {
          zh: "微辣可以吗？",
          py: "Wēi là kěyǐ ma?",
          en: "Is mildly spicy OK?",
        },
        note: "Chinese spice levels run 不辣 (none), 微辣 (mild), 中辣 (medium), 特辣 (very hot) — and 微辣 in Sichuan or Hunan is still not mild by most visitors' standards. Say 不要辣 at the moment you order, because it's much harder to fix afterwards.",
      },
      {
        sayId: 54,
        title: "Fix a dish that's already on the table",
        theySay: {
          zh: "给你换一个？",
          py: "Gěi nǐ huàn yīgè?",
          en: "Shall I swap it for something else?",
        },
        note: "This is the after-the-fact version of 不要辣, and restaurant staff generally take it well — asking for a swap is normal here. 太…了 is the “too much” frame, so the same shape gives you 太咸了 (too salty) and 太贵了 (too expensive).",
      },
      {
        sayId: 6,
        title: "Say what you don't eat",
        theySay: {
          zh: "这个是素的。",
          py: "Zhège shì sù de.",
          en: "This one is vegetarian.",
        },
        note: "肉 covers pork, beef and lamb in one word, which is why 我不吃肉 works better than naming each animal. If you're vegetarian, 我吃素 is the direct version — and worth pairing with 我过敏 (I'm allergic) if that's the real reason.",
      },
      {
        sayId: 53,
        title: "Ask for more of the cheap things",
        theySay: {
          zh: "免费的。",
          py: "Miǎnfèi de.",
          en: "It's free.",
        },
        note: "Rice refills are usually free in sit-down restaurants; tea and hot water almost always are. 加 means to add, so the same pattern buys you 加汤 (more soup) or 加水 (more water) at no extra charge.",
      },
      {
        sayId: 100,
        title: "Get the total",
        theySay: {
          zh: "一共一百二十八。",
          py: "Yígòng yībǎi èrshíbā.",
          en: "128 yuan altogether.",
        },
        note: "This is where the numbers page earns its keep. 一百二十八 is literally “one hundred, two ten, eight” — the number system is entirely regular, so once you can hear 百 (hundred) and 十 (ten) you can read any bill back.",
      },
      {
        sayId: 10,
        title: "Ask to pay",
        theySay: {
          zh: "扫码付款。",
          py: "Sǎo mǎ fùkuǎn.",
          en: "Scan the code to pay.",
        },
        note: "买单 (mǎidān) is the mainland phrase for “the bill”; in Taiwan people say 结账. Then it's the QR code again — the till prints or shows one, you scan and confirm. Tips are not expected in China, and a service charge would be listed on the menu if there is one.",
      },
    ],
    alsoIds: [7, 52, 89, 101],
    faq: [
      {
        q: "How do you order food in Chinese?",
        a: "Point at the dish and say 我要这个 (I want this one). If you can't read the menu, ask 有什么推荐 (what do you recommend?) and order what the server points at. In most restaurants the menu is a QR code on the table and you order in the app instead.",
      },
      {
        q: "How do I say “not spicy” in Chinese?",
        a: "不要辣 (bú yào là) when you order. Say it clearly and early, because 微辣 (mild) in Sichuan or Hunan cooking is still hot for most visitors. If the dish arrives too hot already, 太辣了 works and staff will usually offer to swap it.",
      },
      {
        q: "How do I ask for the bill in a Chinese restaurant?",
        a: "买单 (mǎidān) — literally “buy the bill”, and the standard phrase in mainland China. Tips aren't expected. When the bill arrives, 一共多少钱 (how much altogether?) is the version to use if there are several dishes on the table.",
      },
    ],
  },
  {
    slug: "paying-in-china",
    emoji: "💴",
    name: "Paying for things",
    blurb: "QR codes, cash and what to do when a card fails.",
    h1: "Paying in China in Chinese: QR codes, cash and cards",
    metaTitle: "Paying in China: QR codes, cash and card failures",
    description:
      "Alipay, WeChat Pay, cash and cards — the Chinese you need at the till, including what to say when a payment fails. Eight phrases with audio.",
    intro: [
      "Paying is the one thing in China that is genuinely different from home. A QR code has replaced the till in most shops, stalls and taxis, and the words 微信 and 支付宝 come up in almost every transaction you'll have.",
      "The good news: you don't need to speak Chinese to pay, you need the app installed. The phrases below are for the moments that app doesn't work — a card that fails, a shop that won't take cash, or a till that only shows you Chinese.",
    ],
    steps: [
      {
        sayId: 97,
        title: "Ask before you commit",
        theySay: {
          zh: "扫码。",
          py: "Sǎo mǎ.",
          en: "Scan the code.",
        },
        note: "The all-purpose question when you can't see a card reader or a cash box. In a small shop it's worth asking before you order or eat, because the answer can change where you sit down.",
      },
      {
        sayId: 95,
        title: "Pay the way China pays",
        theySay: {
          zh: "可以，你扫我。",
          py: "Kěyǐ, nǐ sǎo wǒ.",
          en: "Sure — you scan me.",
        },
        note: "Two directions of scanning, and it matters which: if they say 你扫我 you scan their code; if they show a scanner or say 我扫你, you open your own payment code (付款码) and let them scan you. Foreign cards can be linked inside Alipay or WeChat Pay — do that before you fly, not at the till.",
      },
      {
        sayId: 61,
        title: "Check whether cash works",
        theySay: {
          zh: "不好意思，不收现金。",
          py: "Bù hǎoyìsi, bù shōu xiànjīn.",
          en: "Sorry, we don't take cash.",
        },
        note: "Cash still works in most places, but plenty of small stalls and a few restaurants don't keep a float or change. Ask 收现金吗 before you queue rather than after — and keep small notes, since a 100 for a 7 yuan purchase can be a problem either way.",
      },
      {
        sayId: 36,
        title: "Try a card, expecting the answer",
        theySay: {
          zh: "我们只收扫码。",
          py: "Wǒmen zhǐ shōu sǎo mǎ.",
          en: "We only take QR payment.",
        },
        note: "Cards work at hotels, big chains and airports, and much less reliably in between. Chinese terminals also run on UnionPay rails first, so a Visa or Mastercard that works at your hotel may simply fail in a noodle shop.",
      },
      {
        sayId: 105,
        title: "When the card fails",
        theySay: {
          zh: "试试支付宝。",
          py: "Shìshi Zhīfùbǎo.",
          en: "Try Alipay.",
        },
        note: "A declined card is the most common payment failure for visitors, and it's usually the terminal rather than your bank. 不能用 is a useful frame on its own: 这个不能用 (this one doesn't work), and pointing still does the heavy lifting.",
      },
      {
        sayId: 104,
        title: "When a payment hangs",
        theySay: {
          zh: "支付失败了。",
          py: "Zhīfù shībài le.",
          en: "The payment failed.",
        },
        note: "Say it and show your screen — the Chinese on it will tell staff more than your sentence will. If the money left your account anyway, that's a 退款 (tuìkuǎn, refund), and Alipay keeps a transaction list you can show; screenshots are accepted, arguing is not necessary.",
      },
      {
        sayId: 101,
        title: "Split a bill for a group",
        theySay: {
          zh: "可以，一个一个来。",
          py: "Kěyǐ, yīgè yīgè lái.",
          en: "Sure — one at a time.",
        },
        note: "Say it before the cashier starts scanning, and expect to scan one after another rather than in one go. If it's one person paying for everyone, the phrase to use is 我来付 (I'll get this) — and people do argue over the bill here, so offering is polite, not rude.",
      },
      {
        sayId: 103,
        title: "Ask for the receipt you actually need",
        theySay: {
          zh: "你要发票吗？",
          py: "Nǐ yào fāpiào ma?",
          en: "Do you need a receipt?",
        },
        note: "发票 (fāpiào) is the official tax invoice — different from the printed till slip, and the document you need for expense claims and for the tourist tax refund at the airport. Ask before you pay: a 发票 usually has to be issued from the original transaction.",
      },
    ],
    alsoIds: [96, 100, 102, 60],
    faq: [
      {
        q: "Can I use cash in China?",
        a: "Usually yes, but not everywhere — many small shops and stalls no longer keep change, and some only accept QR payment. 收现金吗 (do you take cash?) is the question to ask before you order, and it's worth keeping small notes rather than 100s.",
      },
      {
        q: "Can foreigners use Alipay and WeChat Pay in China?",
        a: "Yes. Both apps let you link an international Visa or Mastercard inside the app, and both have in-app English. Set it up before you fly: almost everything from taxis to noodle shops is paid by scanning a QR code, and this is the single most useful thing you can prepare.",
      },
      {
        q: "Why does my card keep failing in China?",
        a: "Chinese payment terminals are built around UnionPay and QR payments, so foreign cards often work at hotels and big chains but fail in smaller shops. 我的卡不能用 (my card doesn't work) is the phrase; switching to Alipay or WeChat Pay is usually the fix.",
      },
    ],
  },
  {
    slug: "getting-around",
    emoji: "🚇",
    name: "Getting around",
    blurb: "Tickets, trains, directions and asking people to slow down.",
    h1: "Getting around China in Chinese: tickets, trains and directions",
    metaTitle: "Getting around China: train tickets and directions",
    description:
      "Buying tickets, finding the station and asking for directions in Chinese — plus the four phrases that get you out of any conversation you can't follow.",
    intro: [
      "Long-distance travel in China is fast, cheap and almost entirely in Chinese: the stations are huge, the signs alternate between Chinese and English, and the announcements are not repeated in English. The metro is the easy part — station names are also written in pinyin.",
      "What actually slows people down is not vocabulary, it's not knowing how to stop a conversation that has run past them. Four repair phrases — I don't understand, say it again, speak slowly, write it down — do more for a traveller than any amount of new vocabulary.",
    ],
    steps: [
      {
        sayId: 15,
        title: "Find the station",
        theySay: {
          zh: "前面左转。",
          py: "Qiánmiàn zuǒ zhuǎn.",
          en: "Turn left ahead.",
        },
        note: "火车 means train and 站 means station, so 火车站 and 地铁站 (metro) both follow the same pattern. 哪儿 is the casual spoken form of 哪里 — you'll hear both constantly, and they mean the same thing.",
      },
      {
        sayId: 18,
        title: "Buy a ticket as a foreigner",
        theySay: {
          zh: "去哪儿？",
          py: "Qù nǎr?",
          en: "Where to?",
        },
        note: "Foreign passports usually can't be read by the self-service ticket machines, so go to the staffed window (人工窗口) and bring the passport you booked with — the ticket is tied to it. Tickets also sell out days ahead around public holidays, and the official app is 铁路12306, which has an English version.",
      },
      {
        sayId: 14,
        title: "Ask the price and the class",
        theySay: {
          zh: "二等座五百五。",
          py: "Èrděng zuò wǔbǎi wǔ.",
          en: "Second class, 550.",
        },
        note: "High-speed trains sell 二等座 (second class), 一等座 (first class) and 商务座 (business). Second class is comfortable and usually all you need. 一张 asks for “one ticket”, and 张 is the measure word that goes with it.",
      },
      {
        sayId: 19,
        title: "Confirm the departure time",
        theySay: {
          zh: "九点二十开。",
          py: "Jiǔ diǎn èrshí kāi.",
          en: "It leaves at nine twenty.",
        },
        note: "Chinese time is spoken as number + 点 (o'clock) + minutes, so 九点二十 is 9:20 — exactly the pattern on the numbers page. Gates close about five minutes before departure and stations are big, so arrive with the time to spare.",
      },
      {
        sayId: 48,
        title: "Stop the conversation",
        theySay: {
          zh: "我说慢一点。",
          py: "Wǒ shuō màn yīdiǎn.",
          en: "I'll speak more slowly.",
        },
        note: "The most useful three words in the language when someone launches into directions. Say it early rather than after they've finished — by then they'll have to start over, and most people will.",
      },
      {
        sayId: 49,
        title: "Ask for the repeat",
        theySay: {
          zh: "我再说一遍。",
          py: "Wǒ zài shuō yí biàn.",
          en: "I'll say it again.",
        },
        note: "一遍 is “one time from beginning to end”, which is why 再说一遍 asks for the whole thing again and not just the last word. Pair it with 请说慢一点 and you'll get most instructions a second time, slowly.",
      },
      {
        sayId: 72,
        title: "Ask them to write it down",
        theySay: {
          zh: "你等一下，我写。",
          py: "Nǐ děng yíxià, wǒ xiě.",
          en: "Hold on, I'll write it down.",
        },
        note: "The escape hatch for any conversation you can't follow. Characters are copy-pasteable — paste them into your map app or a translation tool — and place names are exactly what people can't explain but can write.",
      },
      {
        sayId: 58,
        title: "Ask a stranger for a photo",
        theySay: {
          zh: "好，一二三。",
          py: "Hǎo, yī èr sān.",
          en: "OK — one, two, three.",
        },
        note: "Hand the phone over first, then ask, and expect the countdown in Chinese. 张 is the measure word for photos; 拍照 is the general verb. Some tourists get asked for photos themselves in rural areas — 可以 (sure) is a complete answer.",
      },
    ],
    alsoIds: [70, 71, 86],
    faq: [
      {
        q: "How do I buy a train ticket in China as a foreigner?",
        a: "Use the staffed ticket window (人工窗口) rather than the self-service machines, which usually can't read foreign passports. Say 我要买票 (I want to buy a ticket), show your passport and the destination written in Chinese. The official booking app is 铁路12306 and has an English version.",
      },
      {
        q: "How do I ask for directions in Chinese?",
        a: "Where is X? is X 在哪儿 (X zài nǎr) — for example 火车站在哪儿 (where is the train station?). If the answer comes too fast, 我不懂 (I don't understand) followed by 请说慢一点 (please speak more slowly) or 请写下来 (please write it down) will usually get you written characters you can copy.",
      },
      {
        q: "Do I need Chinese to use the metro in China?",
        a: "Barely. Metro station names, signs and ticket machines are labelled in English and pinyin, and announcements repeat in English in most big cities. Taxis and long-distance buses are where Chinese phrases actually matter.",
      },
    ],
  },
  {
    slug: "at-the-pharmacy",
    emoji: "💊",
    name: "At the pharmacy",
    blurb: "Find a pharmacy, say what hurts, get the right medicine.",
    h1: "At a Chinese pharmacy: asking for medicine in Chinese",
    metaTitle: "Pharmacy Chinese: find medicine and explain what hurts",
    description:
      "The Chinese you need at a Chinese drugstore — find one, describe the symptom, mention allergies, and know when a hospital is the right door instead.",
    intro: [
      "Stomach trouble and headaches are the two things that actually derail a trip, and both start at a pharmacy (药店) — the shops with the green cross sign that sit every few blocks in any Chinese city, many open late and some around the clock.",
      "The conversation is short and predictable: what hurts, since when, and whether you are allergic to anything. The pharmacist will pick something and explain how to take it — often only in Chinese, so have your phone's camera ready to translate the box.",
    ],
    steps: [
      {
        sayId: 91,
        title: "Open with what's wrong",
        theySay: {
          zh: "哪里不舒服？",
          py: "Nǎlǐ bù shūfu?",
          en: "What's bothering you?",
        },
        note: "This is the question behind the counter, and 生病了 (I'm sick) is the honest, all-purpose answer that starts it. You don't need to diagnose yourself in Chinese — the follow-up questions will walk you there.",
      },
      {
        sayId: 94,
        title: "Find the pharmacy first",
        theySay: {
          zh: "前面路口有一家。",
          py: "Qiánmiàn lùkǒu yǒu yì jiā.",
          en: "There's one at the intersection ahead.",
        },
        note: "Look for the green cross and the word 药店 — chain drugstores are everywhere and many keep long hours; 24小时 on the sign means round the clock. Hotel staff will point you to the nearest one if the street sign isn't obvious.",
      },
      {
        sayId: 134,
        title: "Say where it hurts",
        theySay: {
          zh: "拉肚子吗？",
          py: "Lā dùzi ma?",
          en: "Do you have diarrhea?",
        },
        note: "肚子疼 (belly hurts) is what the pharmacist needs to hear, and the follow-up questions are exactly this direct — travelers find it startling the first time. Answer honestly; embarrassment costs you the right medicine.",
      },
      {
        sayId: 89,
        title: "Mention allergies before they ask",
        theySay: {
          zh: "对什么过敏？",
          py: "Duì shénme guòmǐn?",
          en: "What are you allergic to?",
        },
        note: "They ask this for almost everything, and the answer matters more than the symptom. If it's a food rather than a drug, 我对花生过敏 (I'm allergic to peanuts) is the sentence to have ready — peanut oil turns up in unexpected places.",
      },
      {
        sayId: 88,
        title: "When the pharmacy isn't enough",
        theySay: {
          zh: "前面医院，挂号在一楼。",
          py: "Qiánmiàn yīyuàn, guàhào zài yīlóu.",
          en: "There's a hospital ahead; registration is on the first floor.",
        },
        note: "Pharmacists redirect people the moment a symptom sounds serious, so take that advice. At a hospital you register first (挂号) and then see a doctor — big hospitals have an international desk, and your hotel front desk can call one for you.",
      },
    ],
    alsoIds: [90, 87],
    faq: [
      {
        q: "Can I buy medicine over the counter in China?",
        a: "Yes — most common remedies for stomach trouble, colds and pain are sold at pharmacies without a prescription. Describe the symptom (我肚子疼 works for the first one), let the pharmacist pick, and keep the box: it tells a doctor exactly what you took if the problem doesn't settle.",
      },
      {
        q: "How do I find a pharmacy in China?",
        a: "Look for the green cross sign with 药店 on it, or ask 这附近有药店吗 (is there a pharmacy nearby?). Chain drugstores are dense in any city, many open past ten at night, and some run 24 hours — the staff are used to customers pointing at what hurts.",
      },
      {
        q: "When should I go to a hospital instead of a pharmacy?",
        a: "For anything beyond a familiar minor complaint — high fever, an injury, breathing trouble — go to a hospital (医院) or call 120 for an ambulance. Pharmacists redirect people themselves when a symptom sounds serious, and hotel desks can help you find a doctor who speaks English.",
      },
    ],
  },
  {
    slug: "bargaining-at-a-market",
    emoji: "🧺",
    name: "Bargaining at a market",
    blurb: "Browse politely, ask the price, talk it down a little.",
    h1: "Bargaining in Chinese: browse, ask, and talk it down",
    metaTitle: "Bargaining in Chinese: market phrases that work politely",
    description:
      "How to bargain at a Chinese market in Chinese — browse without pressure, ask the price, ask for a discount, try things on and close the deal politely.",
    intro: [
      "Bargaining in China is polite, brief and expected — in the right place. Tourist markets and small stalls expect it; supermarkets and chain stores have fixed prices and no amount of 可以便宜一点吗 will move them, so read the setting first.",
      "The whole dance is about six sentences, and tone matters as much as words: smile, take your time, and treat the first quote as an opening position rather than an insult. Walking away slowly is a legitimate final move, and sometimes it's the one that closes the deal.",
    ],
    steps: [
      {
        sayId: 34,
        title: "Browse without pressure",
        theySay: {
          zh: "好的，随便看。",
          py: "Hǎo de, suíbiàn kàn.",
          en: "Sure, take your time.",
        },
        note: "我随便看看 is the opener that tells a seller you're browsing, not buying yet — and they genuinely back off when they hear it. Looking without buying is completely normal here; no one follows you out for it.",
      },
      {
        sayId: 31,
        title: "Ask the price",
        theySay: {
          zh: "八十。",
          py: "Bāshí.",
          en: "Eighty.",
        },
        note: "The answer is a number plus 块 (kuài, the spoken word for yuan) — the numbers page is what lets you actually hear it. In tourist markets the first quote usually has room in it; in a fixed-price shop the number is the number.",
      },
      {
        sayId: 40,
        title: "Ask if there's a deal",
        theySay: {
          zh: "现在有活动。",
          py: "Xiànzài yǒu huódòng.",
          en: "There's a promotion on now.",
        },
        note: "打折 means discount, and it's a real concept in malls — seasonal sales go to 五折 (half price). At a stall the same question politely signals that you know there's a local price and a visitor price.",
      },
      {
        sayId: 32,
        title: "Talk it down",
        theySay: {
          zh: "便宜十块，拿走吧。",
          py: "Piányi shí kuài, ná zǒu ba.",
          en: "Ten yuan off — take it.",
        },
        note: "可以便宜一点吗 is the whole negotiation in one polite line. Counter whatever they say with your own number, and keep the smile on — a friendly ten-minute haggle that ends a few yuan apart is the normal outcome, not a failure.",
      },
      {
        sayId: 33,
        title: "Try it on",
        theySay: {
          zh: "可以，这边试。",
          py: "Kěyǐ, zhèbiān shì.",
          en: "Sure, try it over here.",
        },
        note: "Stalls keep a curtain or a mirror for this. Sizes run smaller than most visitors expect, and the stall's stock is the only size range you have — so trying beats guessing, and 这个有点大 (this one is a bit big) keeps the exchange moving.",
      },
      {
        sayId: 37,
        title: "Ask for your size",
        theySay: {
          zh: "有，等一下。",
          py: "Yǒu, děng yíxià.",
          en: "Yes — one moment.",
        },
        note: "小号, 中号, 大号 are S, M and L — the same three sizes on every market rack. If they fetch one from the back, that's normal: the racks out front are rarely the full stock.",
      },
      {
        sayId: 38,
        title: "Close the deal",
        theySay: {
          zh: "好的，一共三十。",
          py: "Hǎo de, yígòng sānshí.",
          en: "OK — thirty altogether.",
        },
        note: "Once the number is agreed, 给我一个袋子 finishes it and payment is the usual QR scan or cash. That final 一共 number is the deal — anything added afterwards is a new conversation you can simply decline.",
      },
    ],
    alsoIds: [59, 35, 123],
    faq: [
      {
        q: "Do you have to bargain in China?",
        a: "Only where it's expected: tourist markets, small stalls and the shops around them. Malls, chain stores, supermarkets and restaurants all have fixed prices. If you're unsure, ask 这个多少钱 and watch whether the number comes with a pause — that pause is the invitation.",
      },
      {
        q: "How much can you talk a price down at a Chinese market?",
        a: "It varies by market and item, so anchor on the reply rather than a fixed rule. Start with 可以便宜一点吗 (can you make it cheaper?), counter their answer once, and let walking away do the last round — sellers call people back more often than visitors expect.",
      },
      {
        q: "What if I ask the price and don't want to buy?",
        a: "Nothing happens — asking is free and normal. 我随便看看 (I'm just browsing) or a smile and 谢谢 closes the moment politely. You are never obliged to buy after asking, and sellers don't treat it as rude.",
      },
    ],
  },
];

/** slug -> 场景 */
export function getScenario(slug: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}

/** 这条短语出现在哪些场景里（单句页拿它做反向链接）。 */
export function scenariosUsingPhrase(phraseId: number): Scenario[] {
  return SCENARIOS.filter(
    (s) =>
      s.steps.some((st) => st.sayId === phraseId) ||
      (s.alsoIds ?? []).includes(phraseId)
  );
}

/** 场景里所有出现过的短语 id（去重，用于总览页统计）。 */
export function scenarioPhraseIds(s: Scenario): number[] {
  const ids = s.steps.map((st) => st.sayId);
  for (const id of s.alsoIds ?? []) ids.push(id);
  return Array.from(new Set(ids));
}

export const SCENARIO_STEP_TOTAL = SCENARIOS.reduce(
  (n, s) => n + s.steps.length,
  0
);

/**
 * 该分类的短语出现在哪些场景里 —— 分类集合页拿它做「按顺序走一遍」的出口。
 * 动态算而不是手写映射：以后往场景里加句子，分类页的链接自动跟着变。
 */
export function scenariosForCategory(categoryId: string): Scenario[] {
  return SCENARIOS.filter((s) =>
    scenarioPhraseIds(s).some(
      (id) => getPhraseById(id)?.category === categoryId
    )
  );
}

/**
 * 构建期自检。
 *
 * 这里**故意抛错而不是静默跳过**：一步引用了不存在的短语 id，页面会少一段
 * 内容却照样构建通过，只有上线后才发现 —— 和清单的漏挂是同一类事故
 * （见 lib/checklistItems.ts 的 checklistIntegrity）。宁可构建失败。
 */
export const SCENARIO_PROBLEMS: string[] = (() => {
  const problems: string[] = [];
  const slugs = new Set<string>();

  for (const s of SCENARIOS) {
    if (!/^[a-z0-9-]+$/.test(s.slug)) {
      problems.push(`${s.slug}: slug 只能是小写字母/数字/连字符`);
    }
    if (slugs.has(s.slug)) problems.push(`${s.slug}: slug 重复`);
    slugs.add(s.slug);

    if (s.steps.length < 4) {
      problems.push(`${s.slug}: 只有 ${s.steps.length} 步，流程页太薄`);
    }
    if (s.intro.length === 0) problems.push(`${s.slug}: 缺引子`);
    if (s.faq.length < 3) {
      problems.push(`${s.slug}: FAQ 只有 ${s.faq.length} 条（至少 3 条）`);
    }

    const seenSteps = new Set<number>();
    for (const st of s.steps) {
      if (!getPhraseById(st.sayId)) {
        problems.push(`${s.slug}: 步骤引用了不存在的短语 id ${st.sayId}`);
      }
      if (seenSteps.has(st.sayId)) {
        problems.push(`${s.slug}: 短语 id ${st.sayId} 在流程里出现两次`);
      }
      seenSteps.add(st.sayId);
    }
    for (const id of s.alsoIds ?? []) {
      if (!getPhraseById(id)) {
        problems.push(`${s.slug}: alsoIds 引用了不存在的短语 id ${id}`);
      }
      if (seenSteps.has(id)) {
        problems.push(`${s.slug}: alsoIds 的 id ${id} 已经在流程步骤里`);
      }
    }
  }

  return problems;
})();

if (SCENARIO_PROBLEMS.length > 0) {
  throw new Error(
    `场景数据自检失败（修 lib/scenarios.ts 再构建）：\n- ${SCENARIO_PROBLEMS.join("\n- ")}`
  );
}
