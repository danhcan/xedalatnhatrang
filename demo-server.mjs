/**
 * Server demo CỤC BỘ (chỉ để test trên máy, KHÔNG dùng cho production).
 * - Serve index.html tại http://localhost:4321
 * - Tự nối endpoint '/api' vào AI_CONFIG khi serve
 * - POST /api           → chat qua Groq (key từ ~/.dsh/.credentials.yaml)
 * - POST /api/video-call → tạo phòng Jitsi + đẩy thông báo lên ntfy.sh
 *   (test: chủ xe mở link https://ntfy.sh/<topic> trên máy/điện thoại sẽ thấy thông báo)
 *
 * Chạy:  NTFY_TOPIC=ten-topic-cua-chu-xe node demo-server.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4321;
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'thuexedl-demo-9k2fj'; // topic test mặc định

// Đọc key Groq từ credentials cục bộ
function readGroqKey() {
  try {
    const txt = fs.readFileSync(path.join(os.homedir(), '.dsh/.credentials.yaml'), 'utf8');
    const m = txt.match(/GROQ_API_KEY:\s*(\S+)/);
    return m ? m[1] : '';
  } catch { return ''; }
}
const GROQ_KEY = readGroqKey();

const SYSTEM_PROMPT = `Bạn là "Trợ Lý Xe" của THUÊ XE ĐÀ LẠT – NHA TRANG. Trả lời tiếng Việt ngắn gọn (tối đa 90 từ), thân thiện.
BẢNG GIÁ: Nha Trang⇄Đà Lạt: 5 chỗ 1.000.000đ, 7 chỗ 1.200.000đ, 16 chỗ 2.000.000đ, Limousine 2.200.000đ, 29 chỗ 4.000.000đ. Cam Ranh⇄Đà Lạt: 5 chỗ 1.000.000đ, 7 chỗ 1.200.000đ, 16 chỗ 2.200.000đ, Limo 2.400.000đ, 29 chỗ 4.200.000đ, xe sang 3.400.000đ. Nha Trang⇄Sân bay: 5 chỗ 300.000đ, 7 chỗ 350.000đ, 16 chỗ 600.000đ, Limo 1.000.000đ, 29 chỗ 1.400.000đ, xe sang 1.500.000đ. Mũi Né⇄Đà Lạt: 1.400k/1.600k/2.400k. Sài Gòn⇄Đà Lạt: 2.700k/3.000k/5.000k. Săn mây: ghép 199k, 4 chỗ 699k, 7 chỗ 799k. Thuê 1 ngày Đà Lạt: 899k/999k/1.399k. Hợp đồng: 8-25k/km.
Phục vụ 24/24, xe đón sau 5 phút. Hotline 0911099712, Zalo 0877 019 712. KHÔNG bịa giá, khuyên gọi hotline để đặt.`;

async function askGroq(message, history) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      temperature: 0.4,
      max_tokens: 350,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: message },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

const server = http.createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

  // ===== Tạo phòng video + thông báo ntfy (giống chat-worker.js) =====
  if (req.method === 'POST' && req.url === '/api/video-call') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { phone, note = '' } = JSON.parse(body || '{}');
      const clean = String(phone || '').replace(/[^0-9+]/g, '');
      if (!/^(\+?84|0)\d{8,10}$/.test(clean)) throw new Error('Số điện thoại không hợp lệ');
      const roomId = 'ThueXeDLNT-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      const roomUrl = 'https://meet.jit.si/' + roomId;
      const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const text = `🔔 KHÁCH ĐANG CHỜ GỌI VIDEO!\n📞 SĐT khách: ${clean}\n📝 Ghi chú: ${note}\n🔗 Vào phòng: ${roomUrl}\n⏰ ${time}`;
      const ntfyRes = await fetch('https://ntfy.sh/' + NTFY_TOPIC, {
        method: 'POST',
        body: text,
        headers: { 'Title': 'Khach cho goi video - Thue Xe DL-NT', 'Priority': 'high', 'Tags': 'rotating_light', 'Click': roomUrl },
      });
      const notified = ntfyRes.ok;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
      res.end(JSON.stringify({
        ok: true,
        roomUrl,
        notified,
        message: notified
          ? 'Chủ xe đã được thông báo, đang vào phòng gặp bạn. Vui lòng chờ trong phòng nhé!'
          : 'Phòng đã tạo nhưng chưa báo được chủ xe, bạn gọi 0911099712 nhé!',
      }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { message, history = [] } = JSON.parse(body || '{}');
      const reply = await askGroq(String(message || ''), history.slice(-8));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
      res.end(JSON.stringify({ reply }));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }

  // Serve index.html với endpoint tự nối
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace("endpoint: ''", "endpoint: '/api'");
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`Demo server: http://localhost:${PORT}  (Groq key: ${GROQ_KEY ? 'ĐÃ NẠP' : 'KHÔNG CÓ'})`);
});
