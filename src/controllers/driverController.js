// src/controllers/driverController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/livreurs  (admin)
const getAllLivreurs = async (req, res) => {
  try {
    const livreurs = await prisma.livreur.findMany({
      include: { _count: { select: { commandes: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: livreurs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/livreurs/disponibles  — pour la liste d'assignation
const getLivreursDisponibles = async (req, res) => {
  try {
    const livreurs = await prisma.livreur.findMany({
      where: { disponible: true },
      select: { id: true, nom: true, telephone: true },
    });
    res.json({ success: true, data: livreurs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// POST /api/livreurs  (admin)
const createLivreur = async (req, res) => {
  try {
    const { nom, telephone } = req.body;
    if (!nom || !telephone) {
      return res.status(400).json({ success: false, message: 'Nom et téléphone requis.' });
    }
    const photo = req.file ? `/uploads/${req.file.filename}` : null;
    const livreur = await prisma.livreur.create({
      data: { nom: nom.trim(), telephone: telephone.trim(), photo },
    });
    res.status(201).json({ success: true, message: 'Livreur ajouté.', data: livreur });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PATCH /api/livreurs/:id  (admin)
const updateLivreur = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, telephone, disponible } = req.body;
    const data = {};
    if (nom !== undefined) data.nom = nom.trim();
    if (telephone !== undefined) data.telephone = telephone.trim();
    if (disponible !== undefined) data.disponible = disponible === 'true' || disponible === true;
    if (req.file) data.photo = `/uploads/${req.file.filename}`;

    const livreur = await prisma.livreur.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json({ success: true, message: 'Livreur mis à jour.', data: livreur });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Livreur introuvable.' });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// DELETE /api/livreurs/:id  (admin)
const deleteLivreur = async (req, res) => {
  try {
    const { id } = req.params;
    // Désassigner le livreur des commandes actives avant de supprimer
    await prisma.commande.updateMany({
      where: { livreurId: parseInt(id), statut: { in: ['EN_ATTENTE', 'EN_COURS'] } },
      data: { livreurId: null, statut: 'EN_ATTENTE' },
    });
    await prisma.livreur.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: 'Livreur supprimé.' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Livreur introuvable.' });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

module.exports = { getAllLivreurs, getLivreursDisponibles, createLivreur, updateLivreur, deleteLivreur };
