// src/routes/drivers.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authenticate = require('../middleware/authenticate');
const {
  getAllLivreurs, getLivreursDisponibles, createLivreur, updateLivreur, deleteLivreur,
} = require('../controllers/driverController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `livreur_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5242880 } });

// Toutes les routes livreurs sont admin sauf disponibles (pour assignation)
router.get('/disponibles', authenticate, getLivreursDisponibles);
router.get('/', authenticate, getAllLivreurs);
router.post('/', authenticate, upload.single('photo'), createLivreur);
router.patch('/:id', authenticate, upload.single('photo'), updateLivreur);
router.delete('/:id', authenticate, deleteLivreur);

module.exports = router;
