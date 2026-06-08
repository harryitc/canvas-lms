# Canvas LMS — Tổng quan dự án (Tiếng Việt)

> Tài liệu nội bộ giúp nắm nhanh kiến trúc, công nghệ và cách vận hành dự án Canvas LMS.
> Mục tiêu: làm nền tảng để đi sâu vào từng phần khi cần.

---

## 1. Canvas LMS là gì?

Canvas LMS là một **hệ thống quản lý học tập (Learning Management System)** mã nguồn mở của Instructure.
Đây là một ứng dụng web **SaaS đa người thuê (multi-tenant)** quy mô lớn: nhiều trường/tổ chức cùng chạy
trên một hệ thống, dữ liệu được phân tách theo cây tài khoản (Account hierarchy) và phân mảnh database (sharding).

Đặc điểm cốt lõi:
- **Backend** Ruby on Rails (REST API + GraphQL).
- **Frontend** React/TypeScript, đóng gói bằng rspack (thay thế webpack).
- **Multi-tenancy** qua cây Account, **sharding** qua gem Switchman.
- **Hệ thống plugin** dạng Rails Engine.
- **Tích hợp LTI** cho công cụ học tập bên ngoài.
- **Feature flags** để bật/tắt tính năng theo từng cấp.
- **Brandable CSS** để tùy biến giao diện theo từng tổ chức.

---

## 2. Công nghệ chính (Tech Stack)

### Backend
| Thành phần | Phiên bản / Công nghệ |
|---|---|
| Ngôn ngữ | Ruby `>= 3.4.1` |
| Framework | Rails `8.0` |
| Web server | Puma `~7.0` (hoặc Passenger/Nginx) |
| Database | PostgreSQL (chính) |
| API | `active_model_serializers` (REST), `graphql` `~2.3` (GraphQL) |
| Background jobs | `inst-jobs`, `switchman-inst-jobs` |
| Cache / data | Redis (`redis-clustering`) |
| Sharding | `switchman` `~4.0` |
| Auth | `authlogic`, `bcrypt` |
| Monitoring | `sentry-rails`, `datadog` |
| Cloud | AWS SDK (S3, SNS, SQS, Kinesis, Bedrock) |

> Gemfile được tách module trong `Gemfile.d/*.rb` (app, test, development, postgres, redis, plugins...).

### Frontend
| Thành phần | Phiên bản / Công nghệ |
|---|---|
| Node | `>= 20.0.0`, Yarn `1.19+` |
| UI | React `18.x`, TypeScript |
| Design system | `@instructure/ui-*` (`v11.6`) |
| Bundler | **rspack** (thay webpack) + SWC transpile |
| Styling | SCSS/Sass + Emotion (CSS-in-JS) |
| State/data | Apollo Client (GraphQL), TanStack React Query |
| Forms | React Hook Form, React Final Form |
| Rich editor | `canvas-rce` (package nội bộ) |
| i18n | `react-i18next` |
| Test | **Vitest** (jsdom) — thay dần Jest |

---

## 3. Cấu trúc thư mục

```
canvas-lms/
├── app/         # Rails MVC: controllers, models, views, graphql, serializers, services
├── ui/          # Frontend React/TS: features/, shared/, boot/
├── ui-build/    # Cấu hình build & webpack/rspack
├── packages/    # Các NPM package nội bộ (monorepo)
├── gems/        # Gem nội bộ + gems/plugins/ (các plugin)
├── lib/         # Logic nghiệp vụ Ruby, tiện ích (feature.rb, brandable_css.rb, lti/...)
├── config/      # Cấu hình Rails: database.yml, feature_flags/, domain.yml...
├── db/          # db/migrate/ (937+ migration), structure.sql
├── spec/        # Test backend (RSpec)
├── doc/         # Tài liệu (file này nằm ở đây)
├── script/      # Script setup/dev (docker_dev_setup.sh...)
├── bin/         # Lệnh thực thi (bin/rspec, bin/rubocop...)
└── docker-compose.yml + Dockerfile*  # Hạ tầng container
```

### Bên trong `app/` (Rails MVC)
- `controllers/` — 100+ controller (API `*_api_controller.rb` + web controller), chia theo domain.
- `models/` — 338+ model ActiveRecord (nơi chứa nhiều business logic).
- `graphql/` — schema GraphQL (`canvas_schema.rb`), `mutations/`, `loaders/` (chống N+1), `interfaces/`.
- `serializers/` — định dạng JSON cho API (Active Model Serializers).
- `services/` — tách logic phức tạp thành service object (lti, courses, outcomes, accessibility...).
- `views/`, `presenters/`, `helpers/`, `middleware/`, `observers/`.

### Bên trong `ui/`
- `features/` — 230+ module theo tính năng.
- `shared/` — component, hook, util dùng chung.
- `boot/` — code khởi tạo.

---

## 4. Các khái niệm cốt lõi

### 4.1 Multi-tenancy — Cây tài khoản (Account hierarchy)
File: `app/models/account.rb`

- `belongs_to :root_account` — tài khoản gốc của một tổ chức.
- `belongs_to :parent_account` — tài khoản cha trực tiếp.
- `has_many :sub_accounts` / `has_many :all_accounts` — tài khoản con / toàn bộ con cháu.
- `root_account?` xác định tài khoản cấp cao nhất.

→ Cho phép cấu trúc tổ chức lồng nhau, kế thừa cấu hình và quyền hạn theo cây.

### 4.2 Sharding database — Switchman
File: `config/database.yml`, `config/initializers/active_record.rb`

- Phân mảnh database theo chiều ngang. Mỗi shard chứa dữ liệu của một nhóm account/course.
- API chính: `Shard.current`, `Shard.activate { ... }`, `Shard.with_each_shard`.
- Root account "neo" vào shard; muốn truy cập đúng dữ liệu phải activate đúng shard.

### 4.3 Các model nghiệp vụ chính
| Model | Vai trò | Quan hệ chính |
|---|---|---|
| `Account` | Tổ chức/đơn vị | cha-con qua cây account |
| `Course` | Khóa học | thuộc Account; có nhiều Enrollment, Assignment |
| `User` | Người dùng | có nhiều Enrollment qua các Course |
| `Enrollment` | Ghi danh (nối User ↔ Course) | có phân loại: Student/Teacher/TA... |
| `Assignment` | Bài tập (kế thừa `AbstractAssignment`) | có nhiều Submission |
| `Submission` | Bài nộp | thuộc Assignment + User; lưu điểm |

### 4.4 Hệ thống Plugin
Files: `lib/base/canvas/plugin.rb`, `app/models/plugin_setting.rb`, thư mục `gems/plugins/`

- Plugin đăng ký qua `Canvas::Plugin.register()`, được nạp như Rails Engine.
- Cấu hình lưu trong model `PluginSetting` (có hỗ trợ encrypt).
- Các plugin hiện có: `academic_benchmark`, `account_reports`, `moodle_importer`,
  `qti_exporter`, `respondus_soap_endpoint`, `simply_versioned`.

### 4.5 Tích hợp LTI
Files: `lib/lti/`, `app/models/lti/`

- Model chính: `Lti::Registration`, `Lti::LineItem` (chấm điểm AGS), `Lti::Launch`,
  `Lti::ContextControl`, `Lti::ToolConfiguration`, `Lti::IMS::Registration`.
- Cài đặt qua **dynamic registration** (chuẩn IMS) hoặc dán JSON thủ công.
- Liên kết tới `ContextExternalTool` để triển khai công cụ vào các khóa học.

### 4.6 Feature Flags
Files: `lib/feature.rb`, `lib/feature_flags.rb`, `config/feature_flags/*.yml`

- Định nghĩa bằng YAML; mỗi flag có `state` (hidden/off/allowed/on/allowed_on),
  `applies_to` (SiteAdmin/Account/Course), mô tả, cờ beta...
- State có thể khác nhau theo môi trường (development/beta/test/production).
- API: `feature_enabled?`, `feature_allowed?`, `enable_feature!`, `disable_feature!`.
- Lưu trong bảng `feature_flags` theo `context_type/context_id` (bật theo từng account/course).

### 4.7 Brandable CSS (tùy biến giao diện)
Files: `lib/brandable_css.rb`, `app/models/brand_config.rb`, `config/brandable_css.yml`

- `BrandConfig` lưu các giá trị override biến CSS (khóa chính là MD5 → bản ghi bất biến).
- Mỗi Account tham chiếu `brand_config_md5` để đổi màu, font, logo.
- Biến dạng `ic-brand-primary`, `ic-brand-global-nav-bgd`... kế thừa theo cây account.

---

## 5. Môi trường phát triển (Docker)

### Các service (`docker-compose.yml`)
| Service | Vai trò |
|---|---|
| `web` | App Rails (Passenger/Nginx hoặc Puma) |
| `jobs` | Worker chạy delayed job (`script/delayed_job run`) |
| `postgres` | Database (password mặc định: `sekret`) |
| `redis` | Cache |

- `docker-compose.override.yml` (dev): mount code để hot-reload, named volume cho
  bundler/gems/node_modules, biến môi trường `RAILS_ENV=development`, `VIRTUAL_HOST=.canvas.docker`.
- Các service tùy chọn trong `docker-compose/`: selenium, mailcatcher, pgweb, kafka, consul, dynamodb...

### Dockerfile
- Sinh tự động từ template `build/Dockerfile.template`.
- `Dockerfile` (dev/Passenger), `Dockerfile.puma`, `Dockerfile.production`, `Dockerfile.jenkins`.
- Base image: `instructure/ruby-passenger:3.4-jammy` hoặc `instructure/ruby:3.4-jammy`.

### Lệnh thường dùng
```bash
./script/docker_dev_setup.sh     # Cài đặt lần đầu (tự động hóa toàn bộ)
docker compose up -d             # Khởi động dịch vụ
./script/docker_dev_update.sh    # Cập nhật gem, rebuild image, chạy migration
docker compose run --rm web bash # Mở shell dev trong container web
docker compose run --rm web rails c   # Rails console
```

### Truy cập app
- Qua dory: `http://canvas.docker/`
- Trực tiếp: `http://localhost/`
- Cấu hình domain ở `config/domain.yml` (`canvas.docker` cho dev/prod, `localhost` cho test).

> ⚠️ **Lưu ý:** Mọi lệnh `yarn`, `rake`, `bundle`, `rails` phải chạy **bên trong container web**.

---

## 6. Công việc đang làm trên branch `cuong-fix-build-image`

Branch này tập trung **tự động hóa cài đặt dory + sửa build Docker trên Linux/WSL**.

**Dory là gì?** Một reverse proxy (chạy dnsmasq) giúp truy cập Canvas tại `http://canvas.docker/`
thay vì `localhost:port`, tự phân giải domain `.docker` về localhost (không cần sửa `/etc/hosts`).

Các thay đổi gần đây:

1. **Commit `1ca656bbec9`** — thêm hàm `install_dory_if_missing`:
   - File: `script/common/os/linux/impl.sh` (+52 dòng) và `script/common/os/linux/dev_setup.sh`.
   - Tự kiểm tra dory; nếu thiếu thì cài Ruby/build-essential rồi `gem install --user-install dory`
     (cài cấp user, không cần sudo), cảnh báo nếu gem bin chưa nằm trong PATH.

2. **Commit `48fb3af1c64`** — cập nhật DNS config + đảm bảo image dnsmasq cho dory:
   - Sửa `Dockerfile`, `Dockerfile.jenkins`, `Dockerfile.production`, `build/Dockerfile.template`:
     chuẩn hóa URL mirror APT (đổi mirror EC2 Ubuntu về `archive.ubuntu.com`) để tránh lỗi
     tải gói trong môi trường WSL/EC2.
   - Thêm file mới `script/common/utils/ensure_dory_dnsmasq_image.sh`: tự build image dnsmasq
     tùy biến nếu image chính thức không có sẵn (lắng nghe `0.0.0.0:53`, route domain `.docker` về `127.0.0.1`).
   - Cập nhật `script/common/utils/dory_setup.sh` để gọi hàm `ensure_dory_dnsmasq_image` trong `start_dory()`.

→ Mục tiêu: dev trên Linux/WSL có thể setup `canvas.docker` liền mạch như macOS, không cần thao tác thủ công.

---

## 7. Kiểm thử (Testing)

| Loại | Công cụ | Vị trí | Lệnh |
|---|---|---|---|
| Backend | RSpec `~3.12` + FactoryBot | `spec/` | `bin/rspec path/to/spec:<line>` |
| Frontend | Vitest (jsdom) | `ui/**/__tests__/` | `yarn test path/to/test` |

Lệnh chất lượng code khác:
```bash
yarn lint            # Lint JS
bin/rubocop          # Lint Ruby
yarn check:ts        # Type-check TypeScript
yarn check:biome     # Biome
yarn build           # Build frontend (yarn build:watch cho dev)
```

> Có skill nội bộ `rspec` (bắt buộc dùng khi viết/sửa test `*_spec.rb`) và `squash-migrations`.

---

## 8. Quy ước commit (theo CLAUDE.md)

- Mỗi dòng commit message **< 60 ký tự**, ngắn gọn, nêu **lý do** thay đổi.
- ChangeId do git hook sinh ra — **không sửa/xóa**.
- JIRA verb: `fixes` (bug), `closes` (ticket xong hẳn), `refs` (còn lại).
- Mẫu:
  ```
  tóm tắt thay đổi

  mô tả chi tiết hơn nếu cần

  refs <JIRA key>
  flag=<tên flag hoặc none>

  test plan:
  - các bước để kiểm tra
  ```

---

## 9. Gợi ý đi sâu tiếp theo

Tùy hướng quan tâm, có thể đào sâu vào:
- **Luồng request**: `routes` → controller → service → model → serializer/GraphQL.
- **GraphQL**: `app/graphql/` (schema, mutation, loader chống N+1).
- **Sharding thực tế**: cách `Shard.activate` ảnh hưởng query.
- **LTI**: vòng đời launch và đăng ký tool.
- **Pipeline build frontend**: rspack + SWC + Brandable CSS.
- **Branch hiện tại**: hoàn thiện/test luồng dory trên Linux/WSL.

> Cho mình biết bạn muốn đào phần nào trước, mình sẽ dẫn theo code cụ thể.
