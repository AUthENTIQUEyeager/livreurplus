// src/routes/orders.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authenticate = require('../middleware/authenticate');
const {
  getAllCommandes, getCommandeById, createCommande,
  updateStatut, assignerLivreur, deleteCommande, getStats,
} = require('../controllers/orderController');

// Config upload images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `commande_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

// Routes PUBLIQUES
router.post('/', upload.single('image'), createCommande);          // Créer une commande
router.get('/:id', getCommandeById);                                // Suivre une commande par ID

// Routes ADMIN (protégées)
router.get('/', authenticate, getAllCommandes);                     // Liste toutes les commandes
router.get('/admin/stats', authenticate, getStats);                // Statistiques dashboard
router.patch('/:id/statut', authenticate, updateStatut);           // Changer le statut
router.patch('/:id/assigner', authenticate, assignerLivreur);      // Assigner un livreur
router.delete('/:id', authenticate, deleteCommande);               // Supprimer

module.exports = router;
