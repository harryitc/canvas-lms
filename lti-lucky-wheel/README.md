# LTI Lucky Wheel — Vòng quay may mắn cho Canvas LMS

Ví dụ **tích hợp một module ngoài vào Canvas LMS qua chuẩn LTI 1.3**.

Module là một **vòng quay may mắn**: mỗi sinh viên đăng nhập Canvas, mở module và
được **quay đúng 1 lần** để trúng một phần quà (text). Kết quả được lưu lại theo
từng người nên lần mở sau chỉ xem lại quà đã trúng, không quay lại được.

Đây là một app Node.js + Express **chạy độc lập**, không sửa gì code Canvas. Canvas
chỉ "gọi" sang app này qua luồng OpenID Connect của LTI 1.3.

```
Canvas (Platform)  ──OIDC login──►  /login   (tool)
                   ◄──redirect────  authorize_redirect (Canvas)
Canvas             ──POST id_token─►  /launch (tool verify JWT, render vòng quay)
Trình duyệt        ──POST spin────►  /api/spin (server bốc quà, lưu DB)
```

## 1. Cấu trúc

```
lti-lucky-wheel/
├─ src/
│  ├─ server.js   # Express + các route LTI
│  ├─ lti.js      # Luồng OIDC, verify id_token, launch-token
│  ├─ keys.js     # Cặp khóa RSA của tool + JWKS
│  ├─ draw.js     # Bốc quà ngẫu nhiên theo trọng số
│  ├─ store.js    # Lưu kết quả quay (data/spins.json)
│  ├─ config.js   # Cấu hình + danh sách phần quà (PRIZES)
│  └─ views.js    # Render trang HTML
├─ public/        # wheel.js + wheel.css (giao diện vòng quay)
└─ .env.example
```

Sửa danh sách phần quà tại `src/config.js` → mảng `PRIZES` (`label`, `color`, `weight`).

## 2. Chạy tool

```bash
cd lti-lucky-wheel
cp .env.example .env
npm install
npm start
```

Mặc định chạy ở `http://localhost:4000`. Mở `http://localhost:4000/config` để xem
file config LTI (dùng ở bước đăng ký).

### Cần một URL HTTPS public

LTI 1.3 yêu cầu Canvas truy cập được tool qua HTTPS. Khi dev local, dùng **ngrok**:

```bash
ngrok http 4000
```

Lấy URL dạng `https://abcd-1234.ngrok-free.app`, rồi đặt vào `.env`:

```
TOOL_URL=https://abcd-1234.ngrok-free.app
```

> Nếu Canvas chạy bằng Docker trên cùng máy, bạn cũng có thể đặt `TOOL_URL` là tên
> host mà container Canvas gọi tới được (ví dụ trong cùng docker network).

## 3. Khai báo endpoint của Canvas trong `.env`

Thay `canvas.instructure.com` bằng domain Canvas của bạn (vd `canvas.docker`):

```
CANVAS_ISSUER=https://<canvas-domain>
CANVAS_AUTH_URL=https://<canvas-domain>/api/lti/authorize_redirect
CANVAS_JWKS_URL=https://<canvas-domain>/api/lti/security/jwks
CANVAS_TOKEN_URL=https://<canvas-domain>/login/oauth2/token
```

> **Lưu ý `CANVAS_ISSUER`:** với bản Instructure-hosted là `https://canvas.instructure.com`.
> Với Canvas open-source self-host, nếu verify lỗi "issuer", hãy xem giá trị `iss`
> thực tế trong `id_token` (log ở console) và điền đúng vào đây.

## 4. Tạo Developer Key (LTI 1.3) trong Canvas

1. Đăng nhập Canvas bằng tài khoản **Admin**.
2. Vào **Admin → (chọn account) → Developer Keys**.
3. Bấm **+ Developer Key → + LTI Key**.
4. Ở mục **Method**, chọn **Enter URL** và dán:
   ```
   https://<TOOL_URL>/config
   ```
   (hoặc chọn **Paste JSON** rồi dán nội dung trả về từ `/config`.)
5. Nếu form bắt nhập tay, các giá trị quan trọng:
   - **Target Link URI**: `https://<TOOL_URL>/launch`
   - **OpenID Connect Initiation Url**: `https://<TOOL_URL>/login`
   - **JWK Method**: Public JWK URL → `https://<TOOL_URL>/jwks`
   - **Placement**: `Course Navigation`
6. **Save**, rồi gạt trạng thái key sang **ON**.
7. Copy **Client ID** (dãy số dài ở cột Details).

Dán Client ID vào `.env` rồi **restart tool**:

```
CLIENT_ID=10000000000123
```

## 5. Thêm app vào khóa học

1. Vào một **Course → Settings → Apps → View App Configurations → + App**.
2. **Configuration Type**: chọn **By Client ID**.
3. Dán **Client ID** ở trên → **Submit** → **Install**.
4. Vào lại course, ở menu trái sẽ thấy **"Vòng quay may mắn"**.

## 6. Dùng thử

- Mở **Vòng quay may mắn** từ menu khóa học → app launch qua LTI 1.3.
- Bấm **QUAY NGAY** → vòng quay chạy và dừng ở phần quà server đã bốc.
- Mở lại lần nữa → chỉ hiển thị lại quà đã trúng (không quay lại được).

Kết quả lưu ở `data/spins.json`. Xóa file này để cho mọi người quay lại từ đầu.

## Ghi chú kỹ thuật

- **Bảo mật:** server bốc quà (`/api/spin`) chứ không phải client → không gian lận
  được. Mỗi lần launch tạo `launchToken` (JWT ký bằng khóa của tool) để gọi
  `/api/spin` mà không cần cookie cross-site.
- **Định danh sinh viên:** dùng claim `sub` trong `id_token` (ổn định theo từng
  người trên một Canvas) làm khóa lưu "đã quay".
- Ví dụ này **không** dùng các dịch vụ LTI Advantage (AGS/NRPS) nên `scopes` rỗng;
  nếu sau này muốn ghi điểm về Canvas thì mở rộng thêm `scopes` + token endpoint.
