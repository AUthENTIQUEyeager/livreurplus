# LivreurPlus — Guide de démarrage complet

## Prérequis
- Node.js 18+ installé
- WAMP démarré (MySQL actif sur port 3306)
- Un terminal (CMD, PowerShell ou Git Bash)

---

## 1. Configurer la base de données

Ouvrir phpMyAdmin : http://localhost/phpmyadmin
Créer une base de données nommée : **livreurplus**

---

## 2. Configurer les variables d'environnement

```bash
cd livreurplus
cp .env.example .env
```

Ouvrir `.env` et vérifier :
```
DATABASE_URL="mysql://root:@localhost:3306/livreurplus"
JWT_SECRET=livreurplus_secret_key_changez_en_production
PORT=5000
```

Si MySQL a un mot de passe : `mysql://root:VOTRE_MOT_DE_PASSE@localhost:3306/livreurplus`

---

## 3. Installer et démarrer

```bash
npm install
npx prisma db push
node prisma/seed.js
npm run dev
```

L'application tourne sur : http://localhost:5000

---

## Identifiants admin
- Email : admin@livreurplus.bf
- Mot de passe : admin123

---

## Endpoints API

### Public
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/commandes | Créer une commande |
| GET | /api/commandes/:id | Suivre une commande |
| GET | /api/health | Statut du serveur |

### Admin (JWT requis)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/auth/login | Connexion |
| GET | /api/commandes | Toutes les commandes |
| GET | /api/commandes/admin/stats | Statistiques |
| PATCH | /api/commandes/:id/statut | Changer statut |
| PATCH | /api/commandes/:id/assigner | Assigner livreur |
| DELETE | /api/commandes/:id | Supprimer |
| GET | /api/livreurs | Liste livreurs |
| POST | /api/livreurs | Ajouter livreur |
| PATCH | /api/livreurs/:id | Modifier livreur |
| DELETE | /api/livreurs/:id | Supprimer livreur |

---

## Structure des dossiers

```
livreurplus/
├── prisma/
│   ├── schema.prisma       # Schéma base de données
│   └── seed.js             # Données de test
├── src/
│   ├── index.js            # Serveur Express
│   ├── routes/             # Définition des routes
│   ├── controllers/        # Logique métier
│   └── middleware/         # JWT auth
├── public/
│   └── index.html          # Frontend complet
├── uploads/                # Images uploadées (créé auto)
├── .env.example
└── package.json
```
