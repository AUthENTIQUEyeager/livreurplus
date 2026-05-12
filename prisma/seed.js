// prisma/seed.js
// Peuple la base avec des données de test réalistes
// Exécuter : node prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding...');

  // Supprimer les données existantes dans l'ordre correct
  await prisma.commande.deleteMany();
  await prisma.livreur.deleteMany();
  await prisma.admin.deleteMany();

  // Créer l'admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.create({
    data: {
      email: 'admin@livreurplus.bf',
      password: hashedPassword,
      nom: 'Administrateur LivreurPlus',
    },
  });
  console.log('✅ Admin créé :', admin.email);

  // Créer les livreurs
  const livreurs = await Promise.all([
    prisma.livreur.create({ data: { nom: 'Ibrahim Sawadogo', telephone: '07 00 22 33 44', disponible: false } }),
    prisma.livreur.create({ data: { nom: 'Seydou Ouédraogo', telephone: '07 11 22 33 44', disponible: true } }),
    prisma.livreur.create({ data: { nom: 'Abdoul Diallo', telephone: '07 22 33 44 55', disponible: false } }),
    prisma.livreur.create({ data: { nom: 'Cheick Sanogo', telephone: '07 33 44 55 66', disponible: true } }),
  ]);
  console.log('✅ Livreurs créés :', livreurs.length);

  // Créer les commandes de test
  const commandes = await Promise.all([
    prisma.commande.create({
      data: {
        nomClient: 'Aminata Diallo',
        telephone: '07 00 11 22 33',
        adresse: 'Secteur 12, Avenue Dioulassoba, Bobo-Dioulasso',
        produit: 'Robe traditionnelle',
        description: 'Tissu délicat, manipuler avec soin',
        montant: '15000',
        statut: 'EN_ATTENTE',
      },
    }),
    prisma.commande.create({
      data: {
        nomClient: 'Moussa Kaboré',
        telephone: '07 55 44 33 22',
        adresse: 'Secteur 25, Rue 18, Bobo-Dioulasso',
        produit: 'Téléphone portable',
        description: 'iPhone 13, très fragile',
        montant: '85000',
        statut: 'EN_COURS',
        livreurId: livreurs[0].id,
      },
    }),
    prisma.commande.create({
      data: {
        nomClient: 'Fatoumata Traoré',
        telephone: '07 11 99 88 77',
        adresse: 'Zone commerciale Bolomakoté',
        produit: 'Pièces mécaniques',
        description: 'Carton de 5kg, pièces moteur',
        montant: '32500',
        statut: 'LIVRE',
        livreurId: livreurs[1].id,
      },
    }),
    prisma.commande.create({
      data: {
        nomClient: 'Oumar Coulibaly',
        telephone: '07 22 33 44 55',
        adresse: 'HAFO, Rue 34, Bobo-Dioulasso',
        produit: 'Documents officiels',
        description: 'Enveloppe scellée, urgent',
        montant: '5000',
        statut: 'EN_ATTENTE',
      },
    }),
    prisma.commande.create({
      data: {
        nomClient: 'Kadiatou Barry',
        telephone: '07 66 77 88 99',
        adresse: 'Secteur 3, Avenue Sangoulé Lamizana',
        produit: 'Colis alimentaire',
        description: 'Produits alimentaires frais',
        montant: '12000',
        statut: 'EN_COURS',
        livreurId: livreurs[2].id,
      },
    }),
  ]);
  console.log('✅ Commandes créées :', commandes.length);

  console.log('\n🎉 Seeding terminé avec succès !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin : admin@livreurplus.bf / admin123');
  console.log('IDs de test pour suivi :');
  commandes.forEach(c => console.log(' -', c.id, '|', c.nomClient, '|', c.statut));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error('❌ Erreur seeding:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
