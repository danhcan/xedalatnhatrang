/**
 * ============================================================
 *  CHATBOT PROXY – THUÊ XE ĐÀ LẠT NHA TRANG
 *  Cloudflare Worker (miễn phí) nối Gemini / Groq free tier
 * ============================================================
 *  CÁCH TRIỂN KHAI (xem chi tiết trong huong-dan-chatbot.md):
 *  1. dash.cloudflare.com → Workers & Pages → Create → Worker
 *  2. Xoá code mẫu, dán toàn bộ file này → Deploy
 *  3. Worker → Settings → Variables & Secrets → thêm secret:
 *       GEMINI_API_KEY  (lấy free tại aistudio.google.com/apikey)
 *     (tuỳ chọn thêm GROQ_API_KEY làm dự phòng, ALLOWED_ORIGIN để khoá CORS)
 *  4. Copy URL worker (https://<tên>.<sub>.workers.dev)
 *     → mở index.html → AI_CONFIG.endpoint = 'URL-vừa-copy'
 *
 *  Chi phí: 0đ. Gemini 2.0 Flash free tier đủ cho website nhỏ.
 * ============================================================
 */

// ---------- PROMPT HỆ THỐNG (bot học bảng giá từ đây) ----------
// Lưu ý: nếu sửa bảng giá trên website thì sửa cả chỗ này cho khớp.
const SYSTEM_PROMPT = `Bạn là "Trợ Lý Xe" – trợ lý ảo của dịch vụ THUÊ XE ĐÀ LẠT – NHA TRANG (Hộ Kinh Doanh Nguyễn Trọng Tài).

NHIỆM VỤ: tư vấn giá, tuyến xe, loại xe, cách đặt xe. Khách là người Việt, trả lời bằng tiếng Việt thân thiện, NGẮN GỌN (tối đa 90 từ), có thể dùng emoji vừa phải, xuống dòng khi liệt kê.

BẢNG GIÁ CHUẨN (KHÔNG ĐƯỢC BÍA GIÁ NGOÀI BẢNG NÀY):
1. Nha Trang ⇄ Đà Lạt: 5 chỗ 1.000.000đ | 7 chỗ 1.200.000đ | 16 chỗ 2.000.000đ | Limousine 9 chỗ 2.200.000đ | 29 chỗ 4.000.000đ
2. Cam Ranh ⇄ Đà Lạt: 5 chỗ 1.000.000đ | 7 chỗ 1.200.000đ | 16 chỗ 2.200.000đ | Limousine 9 chỗ 2.400.000đ | 29 chỗ 4.200.000đ | Xe sang 3.400.000đ
3. Nha Trang ⇄ Sân bay Cam Ranh: 5 chỗ 300.000đ | 7 chỗ 350.000đ | 16 chỗ 600.000đ | Limousine 9 chỗ 1.000.000đ | 29 chỗ 1.400.000đ | Xe sang 1.500.000đ
4. Mũi Né ⇄ Đà Lạt: 5 chỗ 1.400k | 7 chỗ 1.600k | 16 chỗ 2.400k
5. Sài Gòn ⇄ Đà Lạt: 5 chỗ 2.700k | 7 chỗ 3.000k | 16 chỗ 5.000k
6. Sài Gòn ⇄ Nha Trang: 5 chỗ 2.700k | 7 chỗ 3.000k | 16 chỗ 5.000k
7. Tour săn mây: ghép 199k/người | 4 chỗ 699k | 7 chỗ 799k | 16 chỗ 1.199k
8. Thuê xe 1 ngày tại Đà Lạt: 5 chỗ 899k | 7 chỗ 999k | 16 chỗ 1.399k
9. Thuê xe hợp đồng: 4 chỗ 8k/km | 7 chỗ 9k/km | 16 chỗ–Limo 9 chỗ 12–15k/km | xe sang 25k/km

LOẠI XE: Vios/Accent (1-3 khách), Carnival (4-7), Limousine (5-9), Limousine Massage (3-6), Ford Transit (8-15).

THÔNG TIN KHÁC:
- Phục vụ 24/24, có xe đón sau 5 phút. Hotline chính: 0911099712 – line phụ/Zalo: 0877 019 712. Email: taxi@xedalatnhatrang.xyz
- Đưa đón tận nơi, tài xế người trong tỉnh, xe đời mới.

QUY TẮC:
- Câu hỏi về giá → trả đúng theo bảng, nhắc giá có thể thay đổi theo thời điểm, khuyên gọi hotline để giữ xe.
- Đặt xe/hỗ trợ cụ thể → hướng dẫn gọi 0911099712 (bạn không tự nhận booking được).
- Câu ngoài phạm vi dịch vụ (chính trị, code, chuyện khác) → lịch sự từ chối, mời hỏi về dịch vụ xe.
- Không bao giờ tự bịa số điện thoại hay giá khác.`;

// ---------- HẰNG SỐ ----------
const MAX_MESSAGE_LEN = 1000;   // độ dài tối đa 1 tin nhắn khách
const MAX_HISTORY = 12;         // số lượt hội thoại giữ làm ngữ cảnh
const RATE_LIMIT = 30;          // số request
const RATE_WINDOW_MS = 5 * 60 * 1000; // mỗi 5 phút / mỗi IP
// ===== KÊNH THÔNG BÁO CHO CHỦ XE (điền vào Settings → Variables & Secrets) =====
// Miễn phí (khuyên bật trước):
//   NTFY_TOPIC                 topic ntfy riêng tư (vd 'thuexedl-chu-xe-8x27a'), cài app ntfy
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID     nhận thông báo Telegram
// SMS thật (trả phí, tự bật khi điền đủ key + OWNER_PHONE):
//   OWNER_PHONE                số chủ xe dạng 09xxxxxxxx (worker tự đổi +84 cho Twilio)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM     (From = số Twilio, vd +1xxx trial)
//   ESMS_API_KEY, ESMS_SECRET_KEY, (ESMS_BRANDNAME)        từ esms.vn, Brandname bỏ trống = gửi thường

const rateMap = new Map(); // đơn giản, đủ dùng cho web nhỏ

function corsHeaders(env, request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN.split(',').map(s => s.trim()) : null;
  const allowOrigin = !allowed ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

// ---------- GỌI LLM ----------
async function askGemini(apiKey, message, history) {
  const contents = [
    ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: message }] },
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  if (!text) throw new Error('Gemini: phản hồi rỗng');
  return text;
}

async function askGroq(apiKey, message, history) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      temperature: 0.4,
      max_tokens: 400,
      messages: [{ role: 'system', content: SYSTEM_PROMPT },
        ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: message }],
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Groq: phản hồi rỗng');
  return text;
}

// ---------- GỌI VIDEO GẶP CHỦ XE ----------
// Tạo phòng Jitsi miễn phí + thông báo đa kênh cho chủ xe
// (ntfy + Telegram miễn phí; Twilio/eSMS SMS thật — tự bật khi điền đủ key)

function viToE164(phone) {
  // 09xxxxxxxx / 08xxxxxxxx... → +84xxxxxxxxx
  const p = phone.replace(/[^0-9+]/g, '');
  if (p.startsWith('+84')) return p;
  if (p.startsWith('84') && p.length >= 11) return '+' + p;
  if (p.startsWith('0')) return '+84' + p.slice(1);
  return p.startsWith('+') ? p : '+84' + p;
}

async function sendTwilioSms(env, phoneE164, text) {
  const sid = env.TWILIO_ACCOUNT_SID, token = env.TWILIO_AUTH_TOKEN, from = env.TWILIO_FROM;
  if (!sid || !token || !from) return { skipped: true };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(sid + ':' + token),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: phoneE164, From: from, Body: text }),
  });
  if (!res.ok) throw new Error(`Twilio HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return { ok: true };
}

async function sendEsmsSms(env, phoneLocal, text) {
  const key = env.ESMS_API_KEY, secret = env.ESMS_SECRET_KEY;
  if (!key || !secret) return { skipped: true };
  // eMSV V4_post nhận body x-www-form-urlencoded (JSON sẽ bị từ chối)
  const res = await fetch('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ApiKey: key,
      SecretKey: secret,
      Phone: phoneLocal,              // esms nhận số dạng 09xxxxxxxx
      Content: text.slice(0, 450),    // ~3 phần tin
      SmsType: env.ESMS_BRANDNAME ? '2' : '4',  // 2=Brandname, 4=số thường (1 phần 70 ký tự)
      Brandname: env.ESMS_BRANDNAME || '',
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`eSMS HTTP ${res.status}: ${raw.slice(0, 120)}`);
  let data = {};
  try { data = JSON.parse(raw); } catch { /* trả text thường */ }
  // CodeResult 100 = thành công; 101 = sai key; mã khác xem docs esms.vn
  if (data.CodeResult && String(data.CodeResult) !== '100') {
    throw new Error(`eSMS lỗi ${data.CodeResult}: ${data.ErrorMessage || raw.slice(0, 80)}`);
  }
  return { ok: true };
}

// Gửi SMS qua các nhà cung cấp đã cấu hình (song song)
async function sendSmsAll(env, phoneLocal, text) {
  const e164 = viToE164(phoneLocal);
  const jobs = [
    sendTwilioSms(env, e164, text).then(r => ({ twilio: r })).catch(e => ({ twilio: { error: String(e.message || e) } })),
    sendEsmsSms(env, phoneLocal, text).then(r => ({ esms: r })).catch(e => ({ esms: { error: String(e.message || e) } })),
  ];
  const [a, b] = await Promise.all(jobs);
  return { ...a, ...b };
}

async function createVideoCall(env, phone, note) {
  const roomId = 'ThueXeDLNT-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const roomUrl = 'https://meet.jit.si/' + roomId;
  const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  // ===== 1) Kênh free: ntfy + Telegram =====
  const text =
    '🔔 KHÁCH ĐANG CHỜ GỌI VIDEO!\n' +
    '📞 SĐT khách: ' + phone + '\n' +
    (note ? '📝 Ghi chú: ' + note + '\n' : '') +
    '🔗 Vào phòng: ' + roomUrl + '\n' +
    '⏰ ' + time;

  const ntfyTopic = env.NTFY_TOPIC;
  const tgToken = env.TELEGRAM_BOT_TOKEN;
  const tgChat = env.TELEGRAM_CHAT_ID;

  const jobs = [];
  if (ntfyTopic) {
    jobs.push(fetch('https://ntfy.sh/' + ntfyTopic, {
      method: 'POST',
      body: text,
      headers: {
        'Title': 'Khach cho goi video - Thue Xe DL-NT',
        'Priority': 'high',
        'Tags': 'rotating_light',
        'Click': roomUrl,
      },
    }));
  }
  if (tgToken && tgChat) {
    jobs.push(fetch('https://api.telegram.org/bot' + tgToken + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: text + '\n👉 ' + roomUrl }),
    }));
  }
  const freeResults = jobs.length ? await Promise.allSettled(jobs) : [];
  const freeNotified = freeResults.some(r => r.status === 'fulfilled');
  const errors = freeResults.filter(r => r.status === 'rejected').map(r => String(r.reason?.message || r.reason));

  // ===== 2) SMS thật (Twilio / eSMS) — chỉ gửi nếu đã cấu hình =====
  const smsText = `KHACH cho goi video ThueXeDL-NT. SDT khach: ${phone}. Phong: ${roomUrl}`;
  const sms = await sendSmsAll(env, phone, smsText);
  for (const [k, v] of Object.entries(sms)) {
    if (v && v.error) errors.push(k + ': ' + v.error);
  }
  const smsNotified = Object.values(sms).some(v => v && v.ok);

  return { roomUrl, notified: freeNotified || smsNotified, freeNotified, smsNotified, sms, errors };
}

// ---------- ROUTER ----------
export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);

    // Pre-flight
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // Health check
    if (request.method === 'GET') {
      return json({ ok: true, service: 'thue-xe-chatbot', provider: env.GEMINI_API_KEY ? 'gemini' : (env.GROQ_API_KEY ? 'groq' : 'chua-cau-hinh-key') }, 200, cors);
    }

    if (request.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST /chat hoặc /video-call' }, 405, cors);

    // Rate limit theo IP (áp cho cả 2 route)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const entry = rateMap.get(ip);
    if (!entry || now > entry.resetAt) rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    else if (entry.count >= RATE_LIMIT) return json({ error: 'Bạn gửi tin quá nhanh, vui lòng đợi ít phút.' }, 429, cors);
    else entry.count += 1;

    // Đọc & kiểm tra dữ liệu
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON không hợp lệ' }, 400, cors); }

    // ===== TẠO PHÒNG VIDEO + BÁO CHỦ XE =====
    if (new URL(request.url).pathname === '/video-call') {
      const phone = String(body.phone || '').replace(/[^0-9+]/g, '');
      const note = String(body.note || '').slice(0, 200);
      if (!/^(\+?84|0)\d{8,10}$/.test(phone)) {
        return json({ error: 'Số điện thoại không hợp lệ' }, 400, cors);
      }
      const result = await createVideoCall(env, phone, note);
      const channels = [];
      if (result.freeNotified) channels.push('app thông báo');
      if (result.smsNotified) channels.push('SMS');
      return json({
        ok: true,
        roomUrl: result.roomUrl,
        notified: result.notified,
        channels,
        sms: result.sms,
        errors: result.errors,
        message: result.notified
          ? 'Chủ xe đã được thông báo qua ' + channels.join(' + ') + ', đang vào phòng gặp bạn. Vui lòng chờ nhé!'
          : 'Phòng đã tạo nhưng chưa báo được chủ xe. Bạn gọi 0911099712 nhé!',
      }, 200, cors);
    }

    // ===== CHAT THÔNG THƯỜNG =====
    const message = String(body.message || '').slice(0, MAX_MESSAGE_LEN).trim();
    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
    if (!message) return json({ error: 'Thiếu nội dung tin nhắn' }, 400, cors);

    // Gọi LLM: ưu tiên Gemini, lỗi thì chuyển Groq
    const errors = [];
    try {
      if (env.GEMINI_API_KEY) return json({ reply: await askGemini(env.GEMINI_API_KEY, message, history) }, 200, cors);
    } catch (e) { errors.push(String(e.message || e)); }
    try {
      if (env.GROQ_API_KEY) return json({ reply: await askGroq(env.GROQ_API_KEY, message, history) }, 200, cors);
    } catch (e) { errors.push(String(e.message || e)); }

    return json({ error: 'Trợ lý đang bận, vui lòng thử lại sau.', detail: errors }, 502, cors);
  },
};
