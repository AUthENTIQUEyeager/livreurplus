// src/index.js
// Point d'entrée du serveur LivreurPlus
// Lance avec : npm run dev (développement) ou npm start (production)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Créer le dossier uploads si inexistant ─────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'https://livreurplus.vercel.app',
    'https://livreurplus.vercel.app',
    'http://localhost:5000',
    'http://127.0.0.1:5500',   // Live Server VSCode
    'null',                     // Fichiers HTML ouverts localement
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Fichiers statiques ──────────────────────────────────────────────────────
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '../public')));  // Sert le frontend

// ─── Routes API ──────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/commandes', require('./routes/orders'));
app.use('/api/livreurs', require('./routes/drivers'));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'LivreurPlus API opérationnelle',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Toutes les autres routes → frontend SPA ─────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'Placez votre frontend dans le dossier /public' });
  }
});

// ─── Gestion des erreurs ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
});

// ─── Démarrage ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🚀  LivreurPlus API démarrée');
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log(`  📡  API : http://localhost:${PORT}/api`);
  console.log(`  🗃️   BDD : ${process.env.DATABASE_URL?.split('@')[1] || 'voir .env'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});




// SEED TEMPORAIRE — à supprimer après utilisation
app.get('/api/seed-init', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient();
  try {
    await prisma.commande.deleteMany();
    await prisma.livreur.deleteMany();
    await prisma.admin.deleteMany();
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.admin.create({ data: { email: 'admin@livreurplus.bf', password: hash, nom: 'Admin' } });
    await prisma.livreur.createMany({ data: [
      { nom: 'Ibrahim Sawadogo', telephone: '07 00 22 33 44' },
      { nom: 'Seydou Ouédraogo', telephone: '07 11 22 33 44' },
    ]});
    res.json({ success: true, message: 'Seed OK' });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
