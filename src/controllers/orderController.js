// src/controllers/orderController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapping label → enum Prisma
const STATUT_MAP = {
  'EN_ATTENTE': 'EN_ATTENTE',
  'EN_COURS': 'EN_COURS',
  'LIVRE': 'LIVRE',
  'ANNULE': 'ANNULE',
};

// GET /api/commandes  — liste avec filtres (admin)
const getAllCommandes = async (req, res) => {
  try {
    const { statut, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = statut && STATUT_MAP[statut] ? { statut: STATUT_MAP[statut] } : {};

    const [commandes, total] = await Promise.all([
      prisma.commande.findMany({
        where,
        include: { livreur: { select: { id: true, nom: true, telephone: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.commande.count({ where }),
    ]);

    res.json({
      success: true,
      data: commandes,
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('getAllCommandes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/commandes/:id  — détail d'une commande (public pour le suivi)
const getCommandeById = async (req, res) => {
  try {
    const { id } = req.params;
    const commande = await prisma.commande.findUnique({
      where: { id },
      include: { livreur: { select: { id: true, nom: true, telephone: true } } },
    });

    if (!commande) {
      return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    }

    res.json({ success: true, data: commande });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// POST /api/commandes  — créer une commande (public)
const createCommande = async (req, res) => {
  try {
    const { nomClient, telephone, adresse, localisation, produit, description, montant, notes } = req.body;

    if (!nomClient || !telephone || !adresse || !produit) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires : nom, téléphone, adresse, produit.',
      });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const commande = await prisma.commande.create({
      data: {
        nomClient: nomClient.trim(),
        telephone: telephone.trim(),
        adresse: adresse.trim(),
        localisation: localisation?.trim() || null,
        produit: produit.trim(),
        description: description?.trim() || null,
        montant: montant?.toString() || null,
        notes: notes?.trim() || null,
        image,
        statut: 'EN_ATTENTE',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Commande enregistrée avec succès.',
      data: commande,
    });
  } catch (error) {
    console.error('createCommande:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PATCH /api/commandes/:id/statut  — changer statut (admin)
const updateStatut = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    if (!STATUT_MAP[statut]) {
      return res.status(400).json({ success: false, message: 'Statut invalide. Valeurs: EN_ATTENTE, EN_COURS, LIVRE, ANNULE' });
    }

    const commande = await prisma.commande.update({
      where: { id },
      data: { statut: STATUT_MAP[statut] },
      include: { livreur: { select: { id: true, nom: true } } },
    });

    res.json({ success: true, message: 'Statut mis à jour.', data: commande });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PATCH /api/commandes/:id/assigner  — assigner un livreur (admin)
const assignerLivreur = async (req, res) => {
  try {
    const { id } = req.params;
    const { livreurId } = req.body;

    if (!livreurId) {
      return res.status(400).json({ success: false, message: 'livreurId requis.' });
    }

    // Vérifier que le livreur existe et est disponible
    const livreur = await prisma.livreur.findUnique({ where: { id: parseInt(livreurId) } });
    if (!livreur) return res.status(404).json({ success: false, message: 'Livreur introuvable.' });
    if (!livreur.disponible) return res.status(400).json({ success: false, message: 'Ce livreur n\'est pas disponible.' });

    // Transactionnel : assigner + passer EN_COURS + marquer livreur occupé
    const [commande] = await prisma.$transaction([
      prisma.commande.update({
        where: { id },
        data: { livreurId: parseInt(livreurId), statut: 'EN_COURS' },
        include: { livreur: { select: { id: true, nom: true, telephone: true } } },
      }),
      prisma.livreur.update({
        where: { id: parseInt(livreurId) },
        data: { disponible: false },
      }),
    ]);

    res.json({ success: true, message: 'Livreur assigné. Statut passé à EN_COURS.', data: commande });
  } catch (error) {
    console.error('assignerLivreur:', error);
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// DELETE /api/commandes/:id  — supprimer (admin)
const deleteCommande = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.commande.delete({ where: { id } });
    res.json({ success: true, message: 'Commande supprimée.' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/commandes/stats  — statistiques dashboard (admin)
const getStats = async (req, res) => {
  try {
    const [total, enAttente, enCours, livres, annules, livreurs] = await Promise.all([
      prisma.commande.count(),
      prisma.commande.count({ where: { statut: 'EN_ATTENTE' } }),
      prisma.commande.count({ where: { statut: 'EN_COURS' } }),
      prisma.commande.count({ where: { statut: 'LIVRE' } }),
      prisma.commande.count({ where: { statut: 'ANNULE' } }),
      prisma.livreur.count(),
    ]);

    res.json({
      success: true,
      data: { total, enAttente, enCours, livres, annules, livreurs },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

module.exports = { getAllCommandes, getCommandeById, createCommande, updateStatut, assignerLivreur, deleteCommande, getStats };
