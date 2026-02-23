import os, json, jwt, psycopg2, psycopg2.extras
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.hash import bcrypt
from typing import Optional

app = FastAPI(title="Huios Store API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB_URL = os.environ["DATABASE_URL"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin")

security = HTTPBearer()

def get_db():
    return psycopg2.connect(DB_URL)

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL UNIQUE,
            ordem INT DEFAULT 0,
            ativa BOOLEAN DEFAULT true
        );
        CREATE TABLE IF NOT EXISTS produtos (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(200) NOT NULL,
            categoria_id INT REFERENCES categorias(id),
            preco DECIMAL(10,2) NOT NULL,
            descricao TEXT,
            imagem VARCHAR(500),
            tamanhos TEXT DEFAULT '[]',
            cores TEXT DEFAULT '[]',
            estoque INT DEFAULT 0,
            destaque BOOLEAN DEFAULT false,
            ativo BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS pedidos (
            id SERIAL PRIMARY KEY,
            cliente_nome VARCHAR(200),
            cliente_whatsapp VARCHAR(20),
            cliente_email VARCHAR(200),
            endereco TEXT,
            cep VARCHAR(10),
            cidade VARCHAR(100),
            itens TEXT,
            subtotal DECIMAL(10,2),
            frete DECIMAL(10,2) DEFAULT 0,
            total DECIMAL(10,2),
            status VARCHAR(30) DEFAULT 'pendente',
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(200) NOT NULL
        );
    """)
    # Criar admin padrão se não existe
    cur.execute("SELECT id FROM admins WHERE username = %s", (ADMIN_USER,))
    if not cur.fetchone():
        cur.execute("INSERT INTO admins (username, password) VALUES (%s, %s)",
                    (ADMIN_USER, bcrypt.hash(ADMIN_PASS)))
    # Categorias padrão
    for cat in ["Camisetas", "Bíblias", "Copos", "Bonés", "Gorros"]:
        cur.execute("INSERT INTO categorias (nome) VALUES (%s) ON CONFLICT DO NOTHING", (cat,))
    conn.commit()
    cur.close()
    conn.close()

@app.on_event("startup")
def startup():
    init_db()

# === AUTH ===
@app.post("/api/login")
def login(data: dict):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM admins WHERE username = %s", (data.get("username",""),))
    user = cur.fetchone()
    cur.close(); conn.close()
    if not user or not bcrypt.verify(data.get("password",""), user["password"]):
        raise HTTPException(401, "Credenciais inválidas")
    token = jwt.encode({"sub": user["username"], "exp": datetime.utcnow() + timedelta(days=7)}, JWT_SECRET, algorithm="HS256")
    return {"token": token}

def verify_token(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except:
        raise HTTPException(401, "Token inválido")

# === CATEGORIAS ===
@app.get("/api/categorias")
def list_categorias():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM categorias WHERE ativa = true ORDER BY ordem, nome")
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows

@app.post("/api/categorias", dependencies=[Depends(verify_token)])
def create_categoria(data: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO categorias (nome, ordem) VALUES (%s, %s) RETURNING id", (data["nome"], data.get("ordem", 0)))
    cid = cur.fetchone()[0]
    conn.commit(); cur.close(); conn.close()
    return {"id": cid}

@app.put("/api/categorias/{cid}", dependencies=[Depends(verify_token)])
def update_categoria(cid: int, data: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE categorias SET nome=%s, ordem=%s, ativa=%s WHERE id=%s",
                (data["nome"], data.get("ordem",0), data.get("ativa",True), cid))
    conn.commit(); cur.close(); conn.close()
    return {"ok": True}

@app.delete("/api/categorias/{cid}", dependencies=[Depends(verify_token)])
def delete_categoria(cid: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE categorias SET ativa = false WHERE id = %s", (cid,))
    conn.commit(); cur.close(); conn.close()
    return {"ok": True}

# === PRODUTOS ===
@app.get("/api/produtos")
def list_produtos(categoria: Optional[str] = None):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    q = """SELECT p.*, c.nome as categoria FROM produtos p
           JOIN categorias c ON p.categoria_id = c.id WHERE p.ativo = true"""
    params = []
    if categoria:
        q += " AND c.nome = %s"
        params.append(categoria)
    q += " ORDER BY p.destaque DESC, p.created_at DESC"
    cur.execute(q, params)
    rows = cur.fetchall()
    cur.close(); conn.close()
    for r in rows:
        r["tamanhos"] = json.loads(r["tamanhos"]) if r["tamanhos"] else []
        r["cores"] = json.loads(r["cores"]) if r["cores"] else []
        r["preco"] = float(r["preco"])
    return rows

@app.get("/api/produtos/{pid}")
def get_produto(pid: int):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT p.*, c.nome as categoria FROM produtos p JOIN categorias c ON p.categoria_id = c.id WHERE p.id = %s", (pid,))
    r = cur.fetchone()
    cur.close(); conn.close()
    if not r: raise HTTPException(404)
    r["tamanhos"] = json.loads(r["tamanhos"]) if r["tamanhos"] else []
    r["cores"] = json.loads(r["cores"]) if r["cores"] else []
    r["preco"] = float(r["preco"])
    return r

@app.post("/api/produtos", dependencies=[Depends(verify_token)])
def create_produto(data: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""INSERT INTO produtos (nome, categoria_id, preco, descricao, imagem, tamanhos, cores, estoque, destaque)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (data["nome"], data["categoria_id"], data["preco"], data.get("descricao",""),
                 data.get("imagem",""), json.dumps(data.get("tamanhos",[])),
                 json.dumps(data.get("cores",[])), data.get("estoque",0), data.get("destaque",False)))
    pid = cur.fetchone()[0]
    conn.commit(); cur.close(); conn.close()
    return {"id": pid}

@app.put("/api/produtos/{pid}", dependencies=[Depends(verify_token)])
def update_produto(pid: int, data: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""UPDATE produtos SET nome=%s, categoria_id=%s, preco=%s, descricao=%s, imagem=%s,
                   tamanhos=%s, cores=%s, estoque=%s, destaque=%s, ativo=%s WHERE id=%s""",
                (data["nome"], data["categoria_id"], data["preco"], data.get("descricao",""),
                 data.get("imagem",""), json.dumps(data.get("tamanhos",[])),
                 json.dumps(data.get("cores",[])), data.get("estoque",0),
                 data.get("destaque",False), data.get("ativo",True), pid))
    conn.commit(); cur.close(); conn.close()
    return {"ok": True}

@app.delete("/api/produtos/{pid}", dependencies=[Depends(verify_token)])
def delete_produto(pid: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE produtos SET ativo = false WHERE id = %s", (pid,))
    conn.commit(); cur.close(); conn.close()
    return {"ok": True}

# === PEDIDOS ===
@app.post("/api/pedidos")
def create_pedido(data: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""INSERT INTO pedidos (cliente_nome, cliente_whatsapp, cliente_email, endereco, cep, cidade, itens, subtotal, frete, total)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (data["nome"], data["whatsapp"], data.get("email",""), data["endereco"],
                 data.get("cep",""), data.get("cidade",""), json.dumps(data["itens"]),
                 data["subtotal"], data.get("frete",0), data["total"]))
    pid = cur.fetchone()[0]
    conn.commit(); cur.close(); conn.close()
    return {"id": pid, "msg": "Pedido registrado"}

@app.get("/api/pedidos", dependencies=[Depends(verify_token)])
def list_pedidos(status: Optional[str] = None):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    q = "SELECT * FROM pedidos"
    params = []
    if status:
        q += " WHERE status = %s"
        params.append(status)
    q += " ORDER BY created_at DESC"
    cur.execute(q, params)
    rows = cur.fetchall()
    cur.close(); conn.close()
    for r in rows:
        r["itens"] = json.loads(r["itens"]) if r["itens"] else []
        r["subtotal"] = float(r["subtotal"])
        r["frete"] = float(r["frete"])
        r["total"] = float(r["total"])
    return rows

@app.put("/api/pedidos/{pid}/status", dependencies=[Depends(verify_token)])
def update_pedido_status(pid: int, data: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE pedidos SET status = %s WHERE id = %s", (data["status"], pid))
    conn.commit(); cur.close(); conn.close()
    return {"ok": True}

# === DASHBOARD ===
@app.get("/api/dashboard", dependencies=[Depends(verify_token)])
def dashboard():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM produtos WHERE ativo = true")
    total_produtos = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM pedidos")
    total_pedidos = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM pedidos WHERE status = 'pendente'")
    pendentes = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(total),0) FROM pedidos WHERE status != 'cancelado'")
    faturamento = float(cur.fetchone()[0])
    cur.close(); conn.close()
    return {"total_produtos": total_produtos, "total_pedidos": total_pedidos, "pendentes": pendentes, "faturamento": faturamento}

@app.get("/health")
def health():
    return {"status": "ok"}

# === ADMIN PAGE ===
@app.get("/admin", response_class=HTMLResponse)
def admin_page():
    return open("admin.html").read()
