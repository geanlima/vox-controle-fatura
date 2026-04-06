## vox-finance-api

API REST para o `vox-finance` consumir faturas importadas, lançamentos, cartões e layouts.

### Rodar com Docker

```bash
docker compose up --build
```

- API: `http://localhost:8080`
- Docs (Swagger): `http://localhost:8080/docs`
- Postgres (dev): `localhost:5433` (db `vox_finance`, user `vox`, pass `voxpass`)

### Variáveis de ambiente

O `docker-compose.yml` já define os defaults. Para rodar fora do Docker, copie `.env.example` para `.env`.

