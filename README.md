# HUIOS MOVEMENT

Plataforma web do movimento jovem **Huios** da Igreja Mais Que Vencedores (MQV) — Miguel Pereira, RJ.

> *"Huios: filhos maduros, revelados para este tempo." — Romanos 8:19*

🔗 **Produção:** https://huios.mbam.com.br

---

## Arquitetura

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Nginx     │────▶│  FastAPI (8200)   │────▶│ PostgreSQL   │
│  SSL/Proxy  │     │  huios-api       │     │ huios-db     │
└─────────────┘     └──────────────────┘     │ porta 5433   │
                           │                  └──────────────┘
                    ┌──────┴──────┐
                    │   static/   │
                    │  index.html │
                    │  loja.html  │
                    │  style.css  │
                    │  app.js     │
                    └─────────────┘
```

- **Hospedagem:** Oracle Cloud Free Tier (VM ARM Ampere)
- **Containers:** Docker Compose (`huios-api` + `huios-db`)
- **SSL:** Let's Encrypt via Certbot
- **Domínio:** `huios.mbam.com.br` (Nginx reverse proxy → porta 8200)

---

## Estrutura de Arquivos

```
├── index.html          # Landing page (CSS/JS inline)
├── loja.html           # Loja e-commerce
├── style.css           # Estilos da loja
├── app.js              # JavaScript da loja
├── admin.html          # Painel administrativo (SPA)
├── produtos.json       # Config da loja (whatsapp, pix) + fallback de produtos
├── main.py             # Backend FastAPI (editado no servidor)
├── docker-compose.yml  # Stack Docker
├── Dockerfile          # Build da API
├── README.md
└── images/
    ├── logo.jpg        # Logo original
    ├── logo-bg.jpeg    # Logo "sem fundo" (original do usuário)
    └── logo-bg.png     # Logo com fundo removido via PIL (transparente)
```

---

## Páginas e Funcionalidades

### 🏠 Landing Page (`/`)
- **Hero:** slogan, título HUIOS MOVEMENT, referência Romanos 8:19, CTAs
- **Agenda:** 4 cards de cultos/encontros (GI Adolescentes, GI Jovens, Culto MQV quinta, Culto MQV domingo)
- **Sobre:** texto institucional + logo
- **Destaques da Loja:** produtos marcados como destaque (carregados do `produtos.json`)
- **Footer:** endereço + redes sociais (Instagram ×2, Facebook, YouTube, TikTok)

### 🛒 Loja (`/loja`)
- Grid de produtos com busca e filtro por categoria
- Modal de produto com seleção de tamanho/cor
- Carrinho (localStorage) com resumo e edição
- Cálculo de frete por CEP (API ViaCEP)
- Checkout com Mercado Pago (Pix, cartão, boleto) + fallback Pix manual
- Webhook automático: pagamento aprovado → pedido atualiza pra "pago"
- **Login obrigatório** para finalizar compra
- Pedido salvo na API + envio automático via WhatsApp com nº do pedido
- Auto-preenchimento do checkout com dados do perfil do cliente
- Logo como marca d'água de fundo (opacity 0.5)

### 👤 Conta do Cliente
- Cadastro e login (JWT 30 dias)
- Dropdown no header: login/registro, "Meus Pedidos", "Meu Perfil", logout
- Perfil editável: nome, whatsapp, endereço, CEP, cidade
- Histórico de pedidos

### ⚙️ Admin (`/admin`)
- Login com JWT (7 dias)
- **Dashboard:** total de produtos, pedidos, pendentes, faturamento
- **Produtos:** CRUD completo com modal (nome, preço, categoria, descrição, tamanhos, cores, destaque)
- **Upload de imagem:** botão 📷 no modal faz upload direto pro servidor (`/api/upload`)
- **Categorias:** adicionar/excluir
- **Pedidos:** tabela detalhada (cliente, itens, total, endereço, status)
- **Status de pedido:** pendente → pago → enviado → entregue → cancelado

---

## API (FastAPI)

### Autenticação
| Endpoint | Método | Descrição |
|---|---|---|
| `/api/login` | POST | Login admin (JWT 7 dias) |
| `/api/clientes/registro` | POST | Cadastro de cliente |
| `/api/clientes/login` | POST | Login de cliente (JWT 30 dias) |

### Produtos
| Endpoint | Método | Descrição |
|---|---|---|
| `/api/produtos` | GET | Listar todos |
| `/api/produtos` | POST | Criar (admin) |
| `/api/produtos/{id}` | PUT | Atualizar (admin) |
| `/api/produtos/{id}` | DELETE | Excluir (admin) |

### Categorias
| Endpoint | Método | Descrição |
|---|---|---|
| `/api/categorias` | GET | Listar |
| `/api/categorias` | POST | Criar (admin) |
| `/api/categorias/{id}` | DELETE | Excluir (admin) |

### Pedidos
| Endpoint | Método | Descrição |
|---|---|---|
| `/api/pedidos` | GET | Listar todos (admin) |
| `/api/pedidos` | POST | Criar pedido (cliente) |
| `/api/pedidos/{id}/status` | PUT | Atualizar status (admin) |
| `/api/clientes/pedidos` | GET | Pedidos do cliente logado |

### Clientes
| Endpoint | Método | Descrição |
|---|---|---|
| `/api/clientes/perfil` | GET | Dados do perfil |
| `/api/clientes/perfil` | PUT | Atualizar perfil |

### Outros
| Endpoint | Método | Descrição |
|---|---|---|
| `/api/pagamento` | POST | Criar checkout Mercado Pago |
| `/api/webhook/mp` | POST | Webhook MP (atualiza status) |
| `/api/upload` | POST | Upload de imagem (admin) |
| `/api/dashboard` | GET | Estatísticas (admin) |
| `/health` | GET | Health check |

---

## Banco de Dados (PostgreSQL)

### Tabelas
- **admins** — id, username, senha (sha256)
- **categorias** — id, nome (5 padrão: Camisetas, Bíblias, Copos, Bonés, Gorros)
- **produtos** — id, nome, preco, descricao, imagem, categoria, tamanhos, cores, destaque
- **clientes** — id, nome, email (unique), whatsapp, senha (sha256), endereco, cep, cidade
- **pedidos** — id, cliente_email, itens (JSON), total, status, endereco, data

---

## Deploy

```bash
# Editar localmente, depois:
scp arquivo oracle-ampere:~/app/huios/static/
ssh oracle-ampere "cd ~/app/huios && docker-compose up -d --build --force-recreate huios-api"

# Cache bust (CSS/JS):
# Incrementar ?v=N nos links de style.css e app.js dentro de loja.html
```

---

## Paleta de Cores

| Variável | Cor | Uso |
|---|---|---|
| `--bg` | `#13131D` | Fundo principal |
| `--accent` | `#Ec6820` | Laranja (destaques, botões, preços) |
| `--purple` | `#8568AA` | Roxo |
| `--purple2` | `#9D4EDD` | Lilás (slogan, horários) |
| `--card` | `#1a1a2a` | Fundo dos cards |
| `--surface` | `#1e1e30` | Fundo de seções alternadas |

---

## Redes Sociais

- Instagram Huios: [@huios_mqv](https://www.instagram.com/huios_mqv/)
- Instagram MQV: [@mqv_igreja](https://www.instagram.com/mqv_igreja/)
- Facebook: [ChurchMQV](https://www.facebook.com/ChurchMQV)
- YouTube: [@MQVigreja](https://www.youtube.com/@MQVigreja)
- TikTok: [@huios_mqv](https://www.tiktok.com/@huios_mqv)
