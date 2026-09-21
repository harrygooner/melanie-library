# Sapharchem Solutions Library

Bản export source từ website đang xuất bản, commit `c9c54795edb965395a00c551584b9392386eaa2b` (v18). Giữ nguyên mã giao diện, responsive, danh mục, công thức, thành phần React và assets. Cấu hình chạy đã được tách khỏi môi trường Sites để tự quản lý trên GitHub/Cloudflare.

## Chạy local

Cài Node.js **22.13+** (khuyến nghị Node 22 LTS) và npm. Giải nén, mở terminal trong thư mục project:

```sh
npm install
npm run dev
```

Mở địa chỉ localhost mà terminal hiển thị (thường http://localhost:5173). Lệnh dev tự áp dụng migrations vào database local trước khi chạy. Dữ liệu local lưu trong `.wrangler/`, không commit lên GitHub. Internet cần cho lần cài dependencies đầu tiên. Không cần Python để chạy hoặc build thông thường; các PDF hiện tại đã đi kèm.

Đăng nhập bằng email trong `app/email-access.ts`; quyền admin giữ nguyên trong `app/lib/authz.ts` và danh sách email. Cơ chế hiện tại chỉ kiểm tra email trong danh sách, **không xác minh quyền sở hữu email**. Đó là hành vi của bản website gốc.

## Build production

```sh
npm run build
npm start
```

Build tạo `dist/client` và `dist/server` cho Cloudflare Workers. Đây là **React 19 + Vinext/Vite**, với cấu trúc Next.js App Router và Tailwind CSS 4; không phải một file HTML tĩnh và không thể chỉ upload lên GitHub Pages để chạy backend.

## Cấu hình

Xem `.env.example`. Bản hiện tại không yêu cầu API key ứng dụng. `DB` (Cloudflare D1) và `BUCKET` (Cloudflare R2) là bindings trong `wrangler.jsonc`, không phải giá trị chuỗi trong `.env`.

Nếu deploy bằng CI, cấu hình `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID` trong GitHub Secrets/environment của CI. Không commit giá trị thật. Có thể dùng `npx wrangler login` khi deploy từ máy cá nhân.

## Deploy độc lập lên Cloudflare

```sh
npx wrangler login
npx wrangler d1 create sapharchem-solutions-library
npx wrangler r2 bucket create sapharchem-documents
```

Điền `database_id` do lệnh tạo D1 trả về vào `wrangler.jsonc` (thay UUID mẫu). Nếu dùng tên resource khác, sửa `database_name` và `bucket_name` tương ứng; giữ binding `DB` và `BUCKET`.

```sh
npm run db:migrate:remote
npm run deploy
```

Lệnh deploy build lại trước khi upload. Có thể gắn domain riêng trong Cloudflare Dashboard. Các file `.openai/` và helper Sites gốc được giữ để bảo toàn source, nhưng cấu hình chạy độc lập dùng `wrangler.jsonc`, không phụ thuộc project Sites cũ.

## Dữ liệu và chức năng đi kèm

- `app/data/`: danh mục nguyên liệu, công thức và dữ liệu tra cứu có trong source.
- `public/`: ảnh, logo, icon, catalog PDF và PDF công thức hiện tại.
- `app/api/`, `db/`, `drizzle/`: đăng nhập email, upload/download tài liệu, request và trạng thái xử lý, schema và migrations.
- Source hiện tại dùng `mailto:` cho email request/phản hồi. Gửi email tự động qua Resend và tải folder tự phân bổ chưa được hoàn thành trong bản đang xuất bản; bản export không tuyên bố có các chức năng này.

**Không có bản sao dữ liệu D1/R2 đang vận hành trong ZIP này.** Các tài liệu admin đã tải lên, file Imderma trong kho riêng, metadata tài liệu và lịch sử request không phải file source. Khi chạy local hoặc tạo cloud resources mới, các phần đó bắt đầu trống. Để chuyển đầy đủ dữ liệu vận hành, cần quyền xuất D1 và toàn bộ object R2 từ dịch vụ đang lưu trữ, rồi nhập lại vào tài khoản Cloudflare của bạn, giữ nguyên `object_key`. Schema có trong migrations. Không trỏ database mới tới kho object cũ hoặc ngược lại.

## Tạo lại PDF (tùy chọn)

PDF đã có sẵn nên bước này không bắt buộc. Các script Python gốc được giữ trong `scripts/`:

```sh
python3 -m pip install -r requirements.txt
npm run assets:generate
```

Script cần fonts DejaVu trong `/usr/share/fonts/truetype/dejavu/` (Ubuntu: gói fonts-dejavu-core), và bộ tài liệu nguồn để trích xuất khi có đường dẫn ngoài project. Trên Windows/macOS cần chỉnh đường dẫn font/nguồn trong scripts. Không chạy lại để build web thông thường.

## Đưa lên GitHub

```sh
git init
git add .
git commit -m "Initial source code backup"
git branch -M main
git remote add origin <MY_GITHUB_REPOSITORY_URL>
git push -u origin main
```

`.gitignore` loại dependencies, bản build, dữ liệu local, secrets và trạng thái công cụ. Không có `.git` hoặc thông tin đăng nhập của repository cũ trong ZIP. Nên giữ repository riêng tư vì chứa nội dung doanh nghiệp và danh sách email được cấp quyền.

## Cấu trúc

`app/` trang, API, dữ liệu và CSS; `components/` UI; `hooks/`, `lib/` tiện ích; `db/`, `drizzle/` database; `public/` assets; `scripts/` công cụ gốc; `build/`, `vendor/`, `examples/`, `tests/` mã hỗ trợ gốc; configs ở thư mục gốc. `package-lock.json` dùng cho npm; `pnpm-lock.yaml` gốc được giữ để tham khảo, ưu tiên npm trong bản export này.

## Kết quả kiểm tra bản export

- `npm install`: thành công, đã tạo `package-lock.json`.
- `npm run build`: thành công.
- `npm run dev`: khởi động thành công; migrations local áp dụng thành công.
- HTTP local: trang đăng nhập 200, đăng nhập 200, trang danh mục 200.
- API local: đọc tài liệu 200, upload 201, download 200; chưa đăng nhập bị từ chối 401.
- Đã rà soát mẫu secret phổ biến; không phát hiện API key/token/private key.
- Chưa deploy sang tài khoản Cloudflare riêng của bạn; cần tạo DB/R2 theo hướng dẫn trên.
