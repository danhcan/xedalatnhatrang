# Hướng dẫn bật Trợ lý AI cho trang Thuê Xe Đà Lạt – Nha Trang

## Phần 0 — Đưa website lên GitHub Pages (miễn phí)

Chỉ cần `index.html` là đủ chạy (trang tĩnh). Worker AI làm riêng ở Bước 1–3 bên dưới.

1. Đăng nhập **github.com** → **+** → **New repository** → tên `thue-xe-da-lat` → **Public** → Create
2. **Add file** → **Upload files** → kéo thả `index.html` → **Commit changes**
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `root` → Save
4. ~1 phút sau trang sống tại: `https://<tên-github>.github.io/thue-xe-da-lat/`
5. Làm tiếp Bước 1–3 bên dưới (tạo Worker + điền `AI_CONFIG.endpoint`) → upload lại `index.html`

> Lưu ý: GitHub Pages chỉ chạy file tĩnh — KHÔNG upload/cần `chat-worker.js`, `demo-server.mjs`, `test-worker.mjs` lên repo (chúng chạy ở chỗ khác: worker lên Cloudflare, 2 file còn lại chỉ để test trên máy).
> Sau khi có URL trang, thêm secret `ALLOWED_ORIGIN` = URL trang vào Worker để khoá CORS.

---

Trợ lý AI gồm 2 phần, **tất cả miễn phí 0đ**:

| Phần | File | Vai trò |
|---|---|---|
| Widget chat | `index.html` | Khung chat + nút 🤖 nổi góc phải, có sẵn **chế độ offline** trả lời giá/đặt xe/lien hệ khi chưa nối AI |
| Proxy AI | `chat-worker.js` | Cloudflare Worker trung gian – giữ API key an toàn, gọi Gemini (free) |

> **Dùng ngay không cần làm gì cả:** widget đã trả lời được các câu cơ bản (giá theo tuyến, đặt xe, loại xe, hotline) nhờ dữ liệu nhúng trong trang. Làm các bước dưới đây để bot **hiểu câu hỏi tự nhiên** bằng AI thật.

---

## Bước 1 — Lấy API key Gemini (miễn phí)

1. Vào **https://aistudio.google.com/apikey** (đăng nhập Google).
2. Bấm **Create API key** → copy key (dạng `AIza...`).
3. Gói free của Gemini 2.0 Flash đủ cho website nhỏ (khoảng 1.500 câu hỏi/ngày).

## Bước 2 — Tạo Cloudflare Worker

1. Đăng nhập **https://dash.cloudflare.com** → menu **Workers & Pages** → **Create** → **Create Worker**.
2. Đặt tên ví dụ `thue-xe-chatbot` → **Deploy** (dùng code mẫu tạm cũng được).
3. Bấm **Edit code** → xoá toàn bộ → dán nội dung file `chat-worker.js` → **Deploy**.
4. Vào **Settings** của worker → **Variables and Secrets** → **Add**:
   - Type **Secret**, tên `GEMINI_API_KEY`, value = key ở Bước 1.
   - (Khuyên dùng) Type **Text**, tên `ALLOWED_ORIGIN`, value = domain website của bạn, ví dụ `https://xedalatnhatrang.xyz` — để chặn người khác lấy key lạm dụng.
5. Copy địa chỉ worker: `https://thue-xe-chatbot.<tài-khoản>.workers.dev`

## Bước 3 — Nối worker vào trang web

Mở `index.html`, tìm dòng (khoảng dòng 1324):

```js
const AI_CONFIG = { endpoint: '', model: 'gemini-2.0-flash' };
```

Điền URL worker vừa copy:

```js
const AI_CONFIG = { endpoint: 'https://thue-xe-chatbot.tai-khoan-cua-ban.workers.dev', model: 'gemini-2.0-flash' };
```

Upload `index.html` lên hosting là xong. ✅

## Bước 4 — Kiểm tra

- Mở trang web → bấm nút 🤖 góc phải dưới (phía trên 2 nút gọi điện) → hỏi thử:
  - "đà lạt đi nha trang giá bao nhiêu"
  - "cho hỏi đặt xe sân bay"
- Kiểm tra worker hoạt động: mở `https://...workers.dev` trên trình duyệt → hiện
  `{"ok":true,"service":"thue-xe-chatbot","provider":"gemini"}` là đúng.
- Nếu lỗi: xem **Logs** tab trong worker để biết nguyên nhân.

---

## Tuỳ chọn nâng cao

### 📹 Gọi video gặp chủ xe khi khách hỏi khó (mới – 0đ)
Khi khách bấm chip **"📹 Gặp chủ xe qua video"** hoặc nói "cho gặp chủ xe", "gọi video"...:
1. Bot hỏi **số điện thoại** khách → tạo phòng **Jitsi Meet** miễn phí (`meet.jit.si`).
2. Worker đẩy thông báo **chuông báo 🔔** vào điện thoại chủ xe qua **ntfy** (hoặc Telegram), và **gửi SMS** nếu đã cấu hình.
3. Chủ xe bấm thông báo → vào phòng → gặp khách video + thoại trong ~1 phút.

**Bật kênh thông báo (chọn 1 hoặc nhiều, worker tự gửi song song tất cả kênh đã điền):**

| Kênh | Cần điền secret | Chi phí |
|---|---|---|
| **ntfy** (khuyên dùng) | `NTFY_TOPIC` = tên topic riêng tư. Cài app ntfy → Subscribe topic đó | 0đ |
| **Telegram** | `TELEGRAM_BOT_TOKEN` (từ @BotFather) + `TELEGRAM_CHAT_ID` | 0đ |
| **SMS Twilio** | `OWNER_PHONE` (09xxxxxxxx) + `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM` | Credit thử free ~15$, sau đó ~800đ/tin |
| **SMS eSMS.vn** | `OWNER_PHONE` + `ESMS_API_KEY` + `ESMS_SECRET_KEY` (+ `ESMS_BRANDNAME` nếu có) | ~350–500đ/tin |

**Twilio (SMS quốc tế):** twilio.com → Sign up → lấy **Account SID + Auth Token** trong Console → **Get a trial number** để có `TWILIO_FROM` (dạng +1xxx) → Verify số điện thoại của bạn (trial chỉ gửi được tới số đã verify). Lưu ý: sau khi hết credit thử miễn phí thì trả ~800–900đ/SMS.

**eSMS.vn (SMS Việt Nam):** esms.vn → đăng ký tài khoản → trang quản trị lấy **API Key + Secret Key** → nạp tiền. Không có Brandname thì để trống → gửi dạng số thường. Mỗi tin ~350–500đ.

> Không điền SMS thì hệ thống vẫn chạy 0đ với ntfy/Telegram. Tất cả kênh fail → bot tự chuyển hướng khách gọi hotline 0911099712.
> Test trước khi deploy: `node test-worker.mjs` (điền key thật vào file — lưu ý key thật sẽ gửi SMS THẬT và trừ tiền vài trăm đồng/tin).

> Nút gọi video chỉ hoạt động sau khi đã nối `AI_CONFIG.endpoint` (Bước 3) vì việc tạo phòng chạy trên Worker.

### Thêm Groq làm dự phòng
Worker đã tự động chuyển sang **Groq** nếu Gemini lỗi. Chỉ cần thêm secret `GROQ_API_KEY`
(lấy free tại https://console.groq.com/keys). Không có thì bỏ qua.

### Sửa bảng giá
Giá nằm ở **2 nơi** (phải sửa cả hai cho khớp):
1. Phần HTML bảng giá trong `index.html`.
2. Dữ liệu `PRICE_DATA` trong `index.html` (bot offline dùng) và `SYSTEM_PROMPT` trong `chat-worker.js` (bot AI dùng).

### Thay ảnh xe thật
Tìm các link `picsum.photos/seed/...` trong `index.html` và thay bằng ảnh của bạn.

---

## Vì sao kiến trúc này rẻ và an toàn?

- **0đ/tháng**: Gemini free tier + Cloudflare Workers free (100.000 request/ngày).
- **Key không lộ**: API key nằm trong Worker (server), trình duyệt khách chỉ nói chuyện với worker.
- **Không bao giờ "đứt" hoàn toàn**: AI lỗi/mất mạng → widget tự trả lời bằng dữ liệu giá nhúng sẵn (offline).
- **Chống lạm dụng**: worker giới hạn 30 câu/5 phút mỗi IP, khoá CORS theo domain (nếu đặt `ALLOWED_ORIGIN`), giới hạn độ dài tin nhắn.
