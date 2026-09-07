// Test harness: gọi trực tiếp chat-worker.js trong Node (KHÔNG cần deploy)
// Dùng để kiểm tra kênh thông báo TRƯỚC khi đưa lên Cloudflare.
//
// ⚠️ CẢNH BÁO: điền key TWILIO/eSMS THẬT vào dưới đây sẽ GỬI SMS THẬT
//    và trừ tiền tài khoản (~350–900đ/tin). Chỉ điền khi sẵn sàng test.
//    Để key giả → chỉ test ntfy thật + xác minh đường đi SMS (lỗi xác thực có kiểm soát).
//
// Chạy:  node test-worker.mjs
import worker from './chat-worker.js';

const env = {
  // Kênh miễn phí – test thật được ngay
  NTFY_TOPIC: '',                // ví dụ: 'thuexedl-chu-xe-8x27a'
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  // SMS thật – điền key thật để test SMS thật (TỐN TIỀN)
  OWNER_PHONE: '',               // số chủ xe, ví dụ 0912345678
  TWILIO_ACCOUNT_SID: '',
  TWILIO_AUTH_TOKEN: '',
  TWILIO_FROM: '',
  ESMS_API_KEY: '',
  ESMS_SECRET_KEY: '',
  ESMS_BRANDNAME: '',
};

console.log('=== 1) SĐT sai → phải 400 ===');
let res = await worker.fetch(new Request('https://demo.workers.dev/video-call', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '123', note: 'test' }),
}), env, {});
console.log('HTTP', res.status, await res.json());

console.log('\n=== 2) SĐT đúng → chạy mọi kênh đã cấu hình ===');
res = await worker.fetch(new Request('https://demo.workers.dev/video-call', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0912345678', note: 'Test tong hop' }),
}), env, {});
console.log('HTTP', res.status);
console.log(JSON.stringify(await res.json(), null, 2));

console.log('\n=== 3) Không cấu hình kênh nào → notified=false, vẫn trả phòng ===');
res = await worker.fetch(new Request('https://demo.workers.dev/video-call', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0987654321', note: '' }),
}), {}, {});
const d3 = await res.json();
console.log('HTTP', res.status, '| notified:', d3.notified, '| roomUrl:', d3.roomUrl);
