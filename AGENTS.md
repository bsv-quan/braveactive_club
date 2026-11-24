# Huong dan cho coding agent

## Quy trinh moi lan lam viec

1. Doc huong dan nay va phan README lien quan den tinh nang dang sua.
2. Kiem tra trang thai Git truoc khi sua; giu nguyen cac thay doi co san cua nguoi dung.
3. Tim file va cach lam tuong tu trong dung phan cua repo truoc khi tao file hoac them pattern moi.
4. Sua dung pham vi, cap nhat migration/tai lieu lien quan neu can, sau do chay cac lenh kiem tra phu hop o ben duoi.
5. Kiem tra diff cuoi cung va bao cao ro file da sua, lenh da chay, ket qua va viec chua the xac minh.

## Cau truc repo

- `frontend/`: Next.js App Router. Route/page nam trong `src/app/`, UI dung lai nam trong `src/components/`, logic va API client nam trong `src/lib/`, ngon ngu nam trong `src/i18n/`, theme nam trong `src/theme/`, test nam trong `tests/`.
- `backend/`: FastAPI. Route nam trong `app/api/routes/`, schema trong `app/schemas/`, ORM model trong `app/models/`, nghiep vu trong `app/services/`, cau hinh va tien ich he thong trong `app/core/`, test trong `tests/`.
- `backend/alembic/versions/`: migration PostgreSQL. Thay doi schema can co migration Alembic; xem cac migration gan nhat de theo dung quy uoc.
- `docker-compose.yml`: stack local gom PostgreSQL, backend va frontend; profile `test` dung PostgreSQL tam rieng cho backend test.
- `scripts/run.sh`: chay local khong dung Docker; script doc `.env`, chay migration roi khoi dong backend va frontend.
- `README.md`: huong dan day du ve setup, chay app, test va deploy.

Frontend co them quy tac Next.js trong [`frontend/AGENTS.md`](frontend/AGENTS.md). Doc tai lieu Next.js dang cai trong `frontend/node_modules/next/dist/docs/` khi sua API hoac convention Next.js.

## Chay va kiem tra

Uu tien Docker Compose cho chay app local va backend integration test:

```sh
# Chay stack local (frontend: http://localhost:3003, backend: http://localhost:8008)
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:8008/health

# Backend tests: dung test-db rieng, du lieu nam trong tmpfs
docker compose --profile test run --rm backend-tests

# Frontend unit tests (Node.js 22.18+)
node --test frontend/tests/*.test.mjs
```

Khong tro `TEST_DATABASE_URL` vao database ung dung hoac production: backend test co the xoa va tao lai bang. Neu chay backend test truc tiep tren may, chi dung mot PostgreSQL test database trong rieng va lam theo README.

Neu can chay khong Docker, xem README de cai dependencies va cau hinh `.env`, sau do dung `bash scripts/run.sh`. Khong tu tao them lenh lint/format: `frontend/package.json` hien khong khai bao script lint hoac test tong quat; dung cac lenh test da co.

Khong dung `docker compose down -v` neu chua duoc yeu cau ro rang vi lenh nay xoa ca volume du lieu app.

## Quy uoc code

- Doc file ke ben va tai lieu hien co truoc; giu nguyen kien truc, ten goi, dinh dang va pattern cua phan code dang sua. Tranh tao abstraction hoac dependency moi neu khong can thiet.
- Frontend: TypeScript strict, alias `@/*` tro toi `frontend/src/*`. Theo dung pattern App Router va component hien co; neu sua noi dung hien thi, cap nhat day du cac ban dich `en`, `ja`, `vi` trong `frontend/src/i18n/messages/`.
- Backend: theo pattern FastAPI/SQLAlchemy async dang co; giu ranh gioi route, schema, service va model. Thay doi database phai cap nhat model va migration Alembic tuong ung.
- Khong sua file build/generated, dependency cai dat (`node_modules`, `.venv`, `.next`) hoac log de thay cho source.
- Khong doc, in, commit hoac dua secret vao code. Dung `.env.example` de tham khao; `.env` la cau hinh rieng.
- Khi sua behavior, them hoac cap nhat test phu hop. Chi ket luan test/build thanh cong neu da chay lenh va thay ket qua thanh cong.
